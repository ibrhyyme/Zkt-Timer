import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useParams, useHistory } from 'react-router-dom';
import { socketClient } from '../../util/socket/socketio';
import {
    FriendlyRoomData,
    FriendlyRoomClientEvent,
    FriendlyRoomServerEvent,
    FriendlyRoomSolveData,
    FriendlyRoomParticipantData,
    JoinFriendlyRoomInput,
} from '../../../shared/friendly_room';
import Button from '../common/button/Button';
import { useMe } from '../../util/hooks/useMe';
import { useSettings } from '../../util/hooks/useSettings';
import { setSetting } from '../../db/settings/update';
import RoomParticipants from './RoomParticipants';
import RoomChat from './RoomChat';
import PasswordModal from './PasswordModal';
import RoomTable from './RoomTable';
import ScrambleVisual from '../modules/scramble/ScrambleVisual';
import RoomTimerOverlay from './RoomTimerOverlay';
import RoomSettingsModal from './RoomSettingsModal';
import EditRoomModal from './EditRoomModal';
import ManageUsersModal from './ManageUsersModal';
import { Gear, List, PencilSimple, Users, Trash, BluetoothConnected, Bluetooth, CheckCircle, CircleNotch, Check } from 'phosphor-react';
import { getTimeString, convertTimeStringToSeconds } from '../../util/time';
import { toastError } from '../../util/toast';
import { resourceUri } from '../../util/storage';
import { connectGanTimer, GanTimerConnection } from 'gan-web-bluetooth';
import Connect from '../timer/smart_cube/bluetooth/connect';
import { preflightChecks } from '../timer/smart_cube/preflight';
import { processSmartTurns, SmartTurn, isTwo, rawTurnIsSame, reverseScramble } from '../../util/smart_scramble';
import Cube from 'cubejs';
import NotificationLog, { NotificationItem } from './NotificationLog';
import './FriendlyRoom.scss';

interface ParamsType {
    roomId: string;
}

// Helper to get socket with any cast
const getSocket = () => socketClient() as any;

// Throttle delay for status updates (ms)
const STATUS_THROTTLE_MS = 100;

export default function FriendlyRoom() {
    const { roomId } = useParams<ParamsType>();
    const history = useHistory();
    const me = useMe();

    const [room, setRoom] = useState<FriendlyRoomData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [needsPassword, setNeedsPassword] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [manageUsersModalOpen, setManageUsersModalOpen] = useState(false);
    const [userStatuses, setUserStatuses] = useState<{ [userId: string]: string }>({});
    const [mobileTab, setMobileTab] = useState<'timer' | 'chat'>('timer');
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);

    // Host menu state
    const [hostMenuOpen, setHostMenuOpen] = useState(false);
    const hostMenuRef = useRef<HTMLDivElement>(null);

    // Responsive state
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768); // md breakpoint

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Component unmount olduğunda (odadan çıkış) smart cube bağlantısını kes
    useEffect(() => {
        return () => {
            disconnectSmartCube();
        };
    }, []);

    // Handle click outside for host menu
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (hostMenuRef.current && !hostMenuRef.current.contains(event.target as Node)) {
                setHostMenuOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    // Manual entry state
    const [manualTimeInput, setManualTimeInput] = useState('');
    const [manualTimeError, setManualTimeError] = useState(false);
    const [penalties, setPenalties] = useState({ AUF: false, DNF: false, inspection: false });
    const [manualInspecting, setManualInspecting] = useState(false);
    const [manualInspectionTime, setManualInspectionTime] = useState(15000); // ms
    const manualInspectionRef = useRef<NodeJS.Timeout | null>(null);
    const manualInspectionStartRef = useRef<number | null>(null);
    const manualTimeInputRef = useRef<HTMLInputElement>(null); // ✅ Manuel input ref
    const prevTimerTypeRef = useRef<string | null>(null); // ✅ Önceki timer türünü takip et

    // Settings
    const manualEntry = useSettings('manual_entry');
    const timerType = useSettings('timer_type');
    const inspection = useSettings('inspection');
    const isManualMode = manualEntry && timerType !== 'smart';

    // GAN Timer connection state
    const [ganTimerConnected, setGanTimerConnected] = useState(false);


    // Settings Persistence Note:
    // We previously forced default settings (inspection: true) here on room join.
    // This was removed to allow user preferences to persist across rooms and sessions.
    // The global default for inspection is 'false', so it will be off by default unless enabled by the user.

    // Check and enforce allowed timer types
    useEffect(() => {
        if (!room?.allowed_timer_types) return;

        // Define current effective type
        let currentTypeKey: string = timerType;
        if (manualEntry) currentTypeKey = 'manual';

        // Check if allowed
        if (room.allowed_timer_types.length > 0 && !room.allowed_timer_types.includes(currentTypeKey)) {
            // Find first allowed valid type to switch to
            // Priority: keyboard -> manual -> stackmat -> smart -> gantimer
            const allTypes = ['keyboard', 'manual', 'stackmat', 'smart', 'gantimer'];
            const targetType = allTypes.find(t => room.allowed_timer_types.includes(t)) || room.allowed_timer_types[0];

            if (targetType === 'manual') {
                setSetting('manual_entry', true);
            } else {
                setSetting('manual_entry', false);
                setSetting('timer_type', targetType as any);
            }
            // Notify user once
            // toastError(`Timer türü bu oda için "${targetType}" olarak değiştirildi.`);
        }
    }, [room?.allowed_timer_types, timerType, manualEntry]);

    // Oda küp türü değiştiğinde smart cube uyumluluğunu kontrol et
    useEffect(() => {
        if (!room?.cube_type) return;

        const smartCubeSupportedTypes = ['333', '333oh', '333bl', '333mirror'];

        if (timerType === 'smart' && !smartCubeSupportedTypes.includes(room.cube_type)) {
            // Smart cube bağlantısını kes
            disconnectSmartCube();
            // Timer türünü klavyeye çevir
            setSetting('timer_type', 'keyboard');
        }
    }, [room?.cube_type, timerType]);

    // Timer türü smart cube'dan başka bir türe değiştiğinde Bluetooth bağlantısını kes
    useEffect(() => {
        // Eğer önceki tür 'smart' idiyse ve şimdi başka bir şeyse, disconnect et
        if (prevTimerTypeRef.current === 'smart' && timerType !== 'smart') {
            disconnectSmartCube();
        }

        // Şimdiki timer türünü kaydet
        prevTimerTypeRef.current = timerType;
    }, [timerType]);

    const [ganTimerConnecting, setGanTimerConnecting] = useState(false);
    const ganTimerRef = useRef<GanTimerConnection | null>(null);

    const handleConnectGanTimer = async () => {
        if (ganTimerConnecting) return;
        setGanTimerConnecting(true);
        try {
            const conn = await connectGanTimer();
            ganTimerRef.current = conn;
            setGanTimerConnected(true);
            // TODO: Add event listeners for timer events
        } catch (err) {
            console.error('GAN Timer connection failed:', err);
        } finally {
            setGanTimerConnecting(false);
        }
    };

    const disconnectGanTimer = () => {
        if (ganTimerRef.current) {
            ganTimerRef.current.disconnect();
            ganTimerRef.current = null;
        }
        setGanTimerConnected(false);
    };

    // Smart Cube connection state - read from Redux store
    const reduxSmartTurns = useSelector((state: any) => state.timer?.smartTurns || []);
    const reduxSmartCubeConnected = useSelector((state: any) => state.timer?.smartCubeConnected || false);
    const reduxSmartCanStart = useSelector((state: any) => state.timer?.smartCanStart || false);
    const reduxTimeStartedAt = useSelector((state: any) => state.timer?.timeStartedAt || null);
    const reduxInInspection = useSelector((state: any) => state.timer?.inInspection || false);
    const reduxSolving = useSelector((state: any) => state.timer?.solving || false);
    const reduxFinalTime = useSelector((state: any) => state.timer?.finalTime || 0);
    const reduxSmartSolvedState = useSelector((state: any) => state.timer?.smartSolvedState || 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB');

    const [smartCubeConnecting, setSmartCubeConnecting] = useState(false);
    const smartConnectRef = useRef<Connect | null>(null);
    const smartCubeSolveSubmittedRef = useRef(false);

    // Use Redux state for connected status and timer
    const smartCubeConnected = reduxSmartCubeConnected;
    const smartTurns = reduxSmartTurns as SmartTurn[];
    const smartCanStart = reduxSmartCanStart;
    const smartCubeTimeStartedAt = reduxTimeStartedAt;
    const smartCubeInInspection = reduxInInspection;
    const smartCubeSolving = reduxSolving;
    const smartCubeFinalTime = reduxFinalTime;

    const handleConnectSmartCube = async () => {
        if (smartCubeConnecting || smartCubeConnected) return;
        setSmartCubeConnecting(true);
        try {
            const conn = new Connect();
            await conn.connect(); // This opens Bluetooth device picker and waits for selection
            smartConnectRef.current = conn;

            // Connection successful
            setSmartCubeConnecting(false);

        } catch (err) {
            console.error('Smart Cube connection failed:', err);
            // Show user friendly error for Bluetooth cancellation or missing support
            const msg = err.name === 'NotFoundError' || err.message?.includes('cancelled')
                ? 'Bağlantı iptal edildi.'
                : 'Bağlantı hatası: ' + (err.message || 'Bilinmeyen hata');
            toastError(msg);
            setSmartCubeConnecting(false);
        }
    };

    const disconnectSmartCube = () => {
        if (smartConnectRef.current) {
            smartConnectRef.current.disconnect();
            smartConnectRef.current = null;
        }
    };

    // ========== SMART CUBE TIMER LOGIC ==========
    // This replicates SmartCube.tsx checkForStartAfterTurn logic for rooms

    // Local state for smart cube timing
    const [smartScrambleCompletedAt, setSmartScrambleCompletedAt] = useState<Date | null>(null);
    const [smartInspecting, setSmartInspecting] = useState(false);
    const [smartInspectionTime, setSmartInspectionTime] = useState(15);
    const [smartTiming, setSmartTiming] = useState(false);
    const [smartTimerStartedAt, setSmartTimerStartedAt] = useState<number | null>(null);
    const [smartElapsedTime, setSmartElapsedTime] = useState(0);
    const [smartReviewing, setSmartReviewing] = useState(false);
    const [smartFinalTime, setSmartFinalTime] = useState(0);
    const [smartStats, setSmartStats] = useState<{ turns: number; tps: number } | null>(null);
    const [smartWarning, setSmartWarning] = useState<string | undefined>(undefined);
    const smartInspectionIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const smartTimerIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const cubejsRef = useRef(new Cube());
    const processedTurnsRef = useRef(0);
    const scrambleTurnCountRef = useRef(0);
    const sessionStartRef = useRef(0);
    const prevScrambleRef = useRef<string | undefined>(undefined);
    const prevConnectedRef = useRef(false);

    // Throttled status update
    const lastStatusRef = useRef<string>('');
    const statusTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    const handleStatusChange = useCallback((status: string) => {
        // Skip if same status
        if (status === lastStatusRef.current) return;

        // Clear any pending timeout
        if (statusTimeoutRef.current) {
            clearTimeout(statusTimeoutRef.current);
        }

        // Throttle the emit
        statusTimeoutRef.current = setTimeout(() => {
            lastStatusRef.current = status;
            getSocket().emit(FriendlyRoomClientEvent.SEND_STATUS, roomId, status);
        }, STATUS_THROTTLE_MS);
    }, [roomId]);

    // 1. Connection Reset Check & Reset on Scramble Change
    useEffect(() => {
        // A. Connection Reset: If just connected, reset history
        if (smartCubeConnected && !prevConnectedRef.current) {
            sessionStartRef.current = smartTurns.length;
            processedTurnsRef.current = smartTurns.length;
            scrambleTurnCountRef.current = 0;
            setSmartScrambleCompletedAt(null);
            setSmartInspecting(false);
            setSmartTiming(false);
        }
        prevConnectedRef.current = smartCubeConnected;

        // B. Scramble Reset
        if (room?.current_scramble === prevScrambleRef.current) return;
        prevScrambleRef.current = room?.current_scramble;

        cubejsRef.current = new Cube();

        // Start processing turns from NOW
        processedTurnsRef.current = smartTurns.length;
        sessionStartRef.current = smartTurns.length;
        scrambleTurnCountRef.current = 0;

        setSmartScrambleCompletedAt(null);
        setSmartInspecting(false);
        setSmartInspectionTime(15);
        setSmartTiming(false);
        setSmartTimerStartedAt(null);
        setSmartElapsedTime(0);
        setSmartReviewing(false);
        setSmartFinalTime(0);

        // Clear intervals
        if (smartInspectionIntervalRef.current) clearInterval(smartInspectionIntervalRef.current);
        if (smartTimerIntervalRef.current) clearInterval(smartTimerIntervalRef.current);
    }, [room?.current_scramble, smartTurns, smartCubeConnected]);

    // 2. Handle Inspection Setting Change
    useEffect(() => {
        if (!inspection && smartInspecting) {
            setSmartInspecting(false);
            if (smartInspectionIntervalRef.current) clearInterval(smartInspectionIntervalRef.current);
            setSmartInspectionTime(15);
        }
    }, [inspection, smartInspecting]);

    // Audio ref
    const successAudioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        try {
            successAudioRef.current = new Audio(resourceUri('audio/success.mp3'));
            successAudioRef.current.load();
        } catch (e) {
            console.error('Audio init error', e);
        }
    }, []);

    // 2. Process turns & Handle Timer Logic (Main Loop)
    useEffect(() => {
        if (!smartCubeConnected || !room?.current_scramble || !me) return;

        let turnsProcessedThisCycle = false;

        // Check for Redux reset (smartTurns cleared)
        if (smartTurns.length < processedTurnsRef.current) {
            processedTurnsRef.current = 0;
            scrambleTurnCountRef.current = 0;
            sessionStartRef.current = 0;
            // No need to reset cube here, we do it at start timing
        }

        // Apply new turns to virtual cube
        if (smartTurns.length > processedTurnsRef.current) {
            // Only apply turns if we are TIMING or REVIEWING
            if ((smartTiming && smartTimerStartedAt) || smartReviewing) {
                for (let i = processedTurnsRef.current; i < smartTurns.length; i++) {
                    cubejsRef.current.move(smartTurns[i].turn);
                }
            }

            processedTurnsRef.current = smartTurns.length;
            turnsProcessedThisCycle = true;
        }

        const currentCubeState = (smartTiming || smartReviewing) ? cubejsRef.current.asString() : '';
        const isSolved = smartTiming ? currentCubeState === reduxSmartSolvedState : false;
        const isSolvedAnytime = currentCubeState === reduxSmartSolvedState;

        // Warning if user messes up cube during review
        const warning = smartReviewing && !isSolvedAnytime ? 'Yeni karıştırma için küpü çözün!' : undefined;
        setSmartWarning(warning);



        // --- STOP LOGIC ---
        // If timer is running and cube is solved
        if (smartTiming && isSolved && smartTimerStartedAt) {
            setSmartTiming(false);
            const timeMs = Date.now() - smartTimerStartedAt;
            setSmartTimerStartedAt(null);
            if (smartTimerIntervalRef.current) clearInterval(smartTimerIntervalRef.current);

            // Enter review mode
            setSmartFinalTime(timeMs);

            // Calculate stats
            const solutionTurns = smartTurns.slice(scrambleTurnCountRef.current);
            const turnCount = solutionTurns.length;
            const timeInSeconds = timeMs / 1000;
            const tps = timeInSeconds > 0 ? Number((turnCount / timeInSeconds).toFixed(2)) : 0;

            setSmartStats({ turns: turnCount, tps });
            setSmartReviewing(true);
            return;
        }

        // --- START LOGIC ---
        if (!smartTiming) {
            // A. Check if scramble is just completed
            // Only consider turns from the current session
            const currentSessionTurns = smartTurns.slice(sessionStartRef.current);

            if (!smartScrambleCompletedAt && currentSessionTurns.length > 0) {
                if (preflightChecks(currentSessionTurns, room.current_scramble)) {
                    setSmartScrambleCompletedAt(new Date());

                    // Play success sound
                    if (successAudioRef.current) {
                        successAudioRef.current.currentTime = 0;
                        successAudioRef.current.play().catch(e => console.warn('Audio play failed:', e));
                    }

                    scrambleTurnCountRef.current = smartTurns.length; // Record absolute index

                    // Start inspection if enabled
                    if (inspection && !smartInspectionIntervalRef.current) {
                        setSmartInspecting(true);
                        setSmartInspectionTime(15);
                        const inspectionStart = Date.now();
                        smartInspectionIntervalRef.current = setInterval(() => {
                            const elapsed = (Date.now() - inspectionStart) / 1000;
                            const remaining = 15 - elapsed;
                            setSmartInspectionTime(remaining);

                            if (remaining <= -2) {
                                // DNF logic handled by submit/timeout if needed
                            }
                        }, 100);
                    }
                }
            }

            // B. Start Timer on first move AFTER scramble completion
            if (smartScrambleCompletedAt && turnsProcessedThisCycle) {
                // Stop inspection
                if (smartInspecting) {
                    setSmartInspecting(false);
                    if (smartInspectionIntervalRef.current) clearInterval(smartInspectionIntervalRef.current);
                }

                // Start Timer
                setSmartTiming(true);
                setSmartTimerStartedAt(Date.now());
                setSmartScrambleCompletedAt(null); // Consumed
                setSmartElapsedTime(0);

                // RESET VIRTUAL CUBE WITH SCRAMBLE
                cubejsRef.current = new Cube();
                const moves = room.current_scramble.split(' ');
                moves.forEach(m => {
                    if (m.trim()) cubejsRef.current.move(m);
                });

                // Apply ONLY the solution moves (filtering out scramble moves)
                const startIdx = scrambleTurnCountRef.current;
                for (let i = startIdx; i < smartTurns.length; i++) {
                    cubejsRef.current.move(smartTurns[i].turn);
                }
            }
        }
    }, [smartTurns, smartCubeConnected, room?.current_scramble, smartTiming, smartScrambleCompletedAt, smartInspecting, inspection, smartTimerStartedAt, smartReviewing, reduxSmartSolvedState]);

    // Broadcast Smart Cube Status
    useEffect(() => {
        if (!smartCubeConnected) return;

        if (smartTiming) {
            handleStatusChange('TIMING');
        } else if (smartInspecting) {
            handleStatusChange('INSPECTING');
        } else if (smartScrambleCompletedAt) {
            handleStatusChange('INSPECTING'); // Show as inspecting when ready
        } else if (smartReviewing) {
            handleStatusChange('SUBMITTING');
        } else {
            handleStatusChange('RESTING');
        }
    }, [smartTiming, smartInspecting, smartScrambleCompletedAt, smartReviewing, smartCubeConnected, handleStatusChange]);


    // Timer interval for timing phase
    useEffect(() => {
        if (smartTiming && smartTimerStartedAt) {
            smartTimerIntervalRef.current = setInterval(() => {
                setSmartElapsedTime(Date.now() - smartTimerStartedAt);
            }, 10);
        } else {
            if (smartTimerIntervalRef.current) {
                clearInterval(smartTimerIntervalRef.current);
                smartTimerIntervalRef.current = null;
            }
        }

        return () => {
            if (smartTimerIntervalRef.current) {
                clearInterval(smartTimerIntervalRef.current);
            }
        };
    }, [smartTiming, smartTimerStartedAt]);

    // Reset smart cube state on new scramble
    useEffect(() => {
        setSmartScrambleCompletedAt(null);
        setSmartInspecting(false);
        setSmartInspectionTime(15);
        setSmartTiming(false);
        setSmartTimerStartedAt(null);
        setSmartElapsedTime(0);
        processedTurnsRef.current = 0;

        if (smartInspectionIntervalRef.current) {
            clearInterval(smartInspectionIntervalRef.current);
            smartInspectionIntervalRef.current = null;
        }
        if (smartTimerIntervalRef.current) {
            clearInterval(smartTimerIntervalRef.current);
            smartTimerIntervalRef.current = null;
        }
    }, [room?.current_scramble]);

    // Smart cube solve submission effects are placed after alreadySolvedThisRound is declared

    // Throttled status update


    // Fetch room data
    useEffect(() => {
        const socket = getSocket();

        // Request room data
        socket.emit(FriendlyRoomClientEvent.GET_ROOM, roomId);

        // Listen for room data
        socket.on(FriendlyRoomServerEvent.ROOM_DATA, (roomData: FriendlyRoomData) => {
            setRoom(roomData);
            setLoading(false);
            setNeedsPassword(false);
        });

        // Listen for errors
        socket.on(FriendlyRoomServerEvent.ERROR, (errorMsg: string) => {
            if (errorMsg === 'Password required') {
                setNeedsPassword(true);
                setLoading(false);
            } else {
                setError(errorMsg);
                setLoading(false);
            }
        });

        // Listen for updates
        socket.on(FriendlyRoomServerEvent.PLAYER_JOINED, (data: { room_id: string; participant: FriendlyRoomParticipantData }) => {
            if (data.room_id === roomId) {
                // Optimistic update
                setRoom((prev) => {
                    if (!prev) return prev;
                    const exists = prev.participants.some((p) => p.user_id === data.participant.user_id);
                    if (exists) {
                        return {
                            ...prev,
                            participants: prev.participants.map((p) =>
                                p.user_id === data.participant.user_id ? data.participant : p
                            ),
                        };
                    }
                    return {
                        ...prev,
                        participants: [...prev.participants, data.participant],
                    };
                });

                // Force sync to ensure consistency
                getSocket().emit(FriendlyRoomClientEvent.GET_ROOM, roomId);
            }
        });

        socket.on(FriendlyRoomServerEvent.PLAYER_LEFT, (data: { room_id: string; user_id: string }) => {
            if (data.room_id === roomId) {
                // If I was kicked/left, redirect
                if (me && data.user_id === me.id) {
                    history.push('/rooms');
                    return;
                }

                // Optimistic update
                setRoom((prev) => {
                    if (!prev) return prev;
                    return {
                        ...prev,
                        participants: prev.participants.filter((p) => p.user_id !== data.user_id),
                    };
                });

                // Force sync
                getSocket().emit(FriendlyRoomClientEvent.GET_ROOM, roomId);
            }
        });

        socket.on(FriendlyRoomServerEvent.SCRAMBLE_UPDATED, (data: { room_id: string; scramble: string; scramble_index: number }) => {
            if (data.room_id === roomId) {
                setRoom((prev) => {
                    if (!prev) return prev;
                    return {
                        ...prev,
                        current_scramble: data.scramble,
                        scramble_index: data.scramble_index,
                    };
                });
                // Clear statuses for new round
                setUserStatuses({});
                // Clear manual entry input and inspection
                setManualTimeInput('');
                setManualTimeError(false);
                setManualInspecting(false);
                if (manualInspectionRef.current) {
                    clearInterval(manualInspectionRef.current);
                    manualInspectionRef.current = null;
                }
            }
        });

        socket.on(FriendlyRoomServerEvent.SOLVE_SUBMITTED, (data: { room_id: string; user_id: string; solve: any }) => {
            if (data.room_id === roomId) {
                setRoom((prev) => {
                    if (!prev) return prev;
                    return {
                        ...prev,
                        participants: prev.participants.map((p) => {
                            if (p.user_id === data.user_id) {
                                return {
                                    ...p,
                                    solves: [...p.solves, data.solve],
                                };
                            }
                            return p;
                        }),
                    };
                });
            }
        });

        socket.on(FriendlyRoomServerEvent.ROOM_STARTED, (data: { room_id: string; scramble: string; scramble_index: number }) => {
            if (data.room_id === roomId) {
                setRoom((prev) => {
                    if (!prev) return prev;
                    return {
                        ...prev,
                        status: 'ACTIVE',
                        current_scramble: data.scramble,
                        scramble_index: data.scramble_index,
                    };
                });
                // Clear statuses for new round
                setUserStatuses({});
                // Force sync
                getSocket().emit(FriendlyRoomClientEvent.GET_ROOM, roomId);
            }
        });

        socket.on(FriendlyRoomServerEvent.ROOM_DELETED, (deletedRoomId: string) => {
            if (deletedRoomId === roomId) {
                history.push('/rooms');
            }
        });

        // Handle admin change
        socket.on(FriendlyRoomServerEvent.ADMIN_CHANGED, (data: { room_id: string; new_admin_id: string }) => {
            if (data.room_id === roomId) {
                setRoom((prev) => {
                    if (!prev) return prev;
                    // Find the new admin user
                    const newAdmin = prev.participants.find((p) => p.user_id === data.new_admin_id);
                    if (!newAdmin) return prev;
                    return {
                        ...prev,
                        created_by: {
                            id: newAdmin.user_id,
                            username: newAdmin.username,
                        },
                    };
                });
            }
        });

        // Handle user status updates
        socket.on(FriendlyRoomServerEvent.USER_STATUS, (data: { room_id: string; user_id: string; status: string }) => {
            if (data.room_id === roomId) {
                setUserStatuses((prev) => ({
                    ...prev,
                    [data.user_id]: data.status,
                }));
            }
        });

        // Handle spectator mode changes
        socket.on(FriendlyRoomServerEvent.SPECTATOR_CHANGED, (data: { room_id: string; user_id: string; is_spectator: boolean }) => {
            if (data.room_id === roomId) {
                setRoom((prev) => {
                    if (!prev) return prev;
                    return {
                        ...prev,
                        participants: prev.participants.map((p) =>
                            p.user_id === data.user_id ? { ...p, is_spectator: data.is_spectator } : p
                        ),
                    };
                });
            }
        });

        // Handle notifications
        socket.on(FriendlyRoomServerEvent.NOTIFICATION, (data: { type: string; message: string }) => {
            setNotifications((prev) => [
                ...prev,
                {
                    id: Math.random().toString(36).substr(2, 9),
                    type: data.type,
                    message: data.message,
                    timestamp: Date.now(),
                },
            ]);
        });

        return () => {
            socket.off(FriendlyRoomServerEvent.ROOM_DATA);
            socket.off(FriendlyRoomServerEvent.ERROR);
            socket.off(FriendlyRoomServerEvent.PLAYER_JOINED);
            socket.off(FriendlyRoomServerEvent.PLAYER_LEFT);
            socket.off(FriendlyRoomServerEvent.SCRAMBLE_UPDATED);
            socket.off(FriendlyRoomServerEvent.SOLVE_SUBMITTED);
            socket.off(FriendlyRoomServerEvent.ROOM_STARTED);
            socket.off(FriendlyRoomServerEvent.ROOM_DELETED);
            socket.off(FriendlyRoomServerEvent.ADMIN_CHANGED);
            socket.off(FriendlyRoomServerEvent.USER_STATUS);
            socket.off(FriendlyRoomServerEvent.SPECTATOR_CHANGED);
            socket.off(FriendlyRoomServerEvent.NOTIFICATION);
        };
    }, [roomId, history, me]);

    // Join room on mount (if user is logged in) and on Reconnect
    // Also handles the case where user disconnects for > 45s (server timeout) -> Redirect to /rooms instead of rejoining
    const lastDisconnectRef = useRef<number | null>(null);

    useEffect(() => {
        if (!me) return;

        const socket = getSocket();

        const joinRoom = () => {
            // If we were disconnected for more than 45 seconds (server grace period), 
            // we have likely been kicked by the server. 
            // In this case, do NOT rejoin, but redirect to /rooms to reflect the kick.
            if (lastDisconnectRef.current) {
                const elapsed = Date.now() - lastDisconnectRef.current;
                // Use slightly less than 45s to be safe? No, server is 45s. 
                // If we are definitely over 45s, we are kicked.
                if (elapsed > 45000) {
                    history.push('/rooms');
                    return;
                }
            }

            lastDisconnectRef.current = null; // Reset

            if (!needsPassword) {
                const input: JoinFriendlyRoomInput = { room_id: roomId };
                socket.emit(FriendlyRoomClientEvent.JOIN_ROOM, input);
            }
        };

        const onDisconnect = () => {
            lastDisconnectRef.current = Date.now();
        };

        // Join immediately on mount
        joinRoom();

        // Listen for events
        socket.on('connect', joinRoom);
        socket.on('disconnect', onDisconnect);

        return () => {
            socket.off('connect', joinRoom);
            socket.off('disconnect', onDisconnect);
        };
    }, [me, roomId, needsPassword, history]);

    // Handle visibility change (tab switch/minimize) logic for Grace Period
    useEffect(() => {
        if (!room || !me) return;

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                // User switched tab or minimized - Signal AWAY (starts 45s timer)
                // Note: If this eventually causes a disconnect (mobile sleep), the disconnect handler above takes over timing.
                // If socket stays alive, server sends PLAYER_LEFT after 45s, which is handled by the main event listener.
                getSocket().emit(FriendlyRoomClientEvent.SIGNAL_AWAY);
            } else if (document.visibilityState === 'visible') {
                // User returned - Signal BACK (cancels timer)
                getSocket().emit(FriendlyRoomClientEvent.SIGNAL_BACK);
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            // If component unmounts (leaving room page), we don't need to manual send anything 
            // because socket disconnect or navigation LEAVE_ROOM will handle cleanup.
        };
    }, [room, me, roomId]);

    function handlePasswordSubmit(password: string) {
        const input: JoinFriendlyRoomInput = { room_id: roomId, password };
        getSocket().emit(FriendlyRoomClientEvent.JOIN_ROOM, input);
    }

    function handleLeaveRoom() {
        getSocket().emit(FriendlyRoomClientEvent.LEAVE_ROOM, roomId);
        history.push('/rooms');
    }

    function handleStartRoom() {
        getSocket().emit(FriendlyRoomClientEvent.START_ROOM, roomId);
    }

    function handleNextScramble() {
        getSocket().emit(FriendlyRoomClientEvent.NEXT_SCRAMBLE, roomId);
    }

    function handleSolveSubmit(time: number, plusTwo: boolean, dnf: boolean) {
        if (!room) return;

        const solveData: FriendlyRoomSolveData = {
            time: time,
            dnf,
            plus_two: plusTwo,
            scramble_index: room.scramble_index,
        };

        getSocket().emit(FriendlyRoomClientEvent.SUBMIT_SOLVE, roomId, solveData);
    }

    function handleSolveRedo() {
        // User wants to redo - do nothing, timer overlay handles the reset
    }

    // Check if user already solved this round
    const alreadySolvedThisRound = (() => {
        if (!room || !me) return false;
        const myParticipant = room.participants.find((p) => p.user_id === me.id);
        if (!myParticipant) return false;
        return myParticipant.solves.some((s) => s.scramble_index === room.scramble_index);
    })();

    // Yeni round başladığında (alreadySolvedThisRound false olunca) input'a focus ver
    useEffect(() => {
        if (!alreadySolvedThisRound && isManualMode && room?.status === 'ACTIVE') {
            requestAnimationFrame(() => {
                manualTimeInputRef.current?.focus();
            });
        }
    }, [alreadySolvedThisRound, isManualMode]);

    // Get current user's last solve time for display
    const myCurrentSolve = (() => {
        if (!room || !me) return null;
        const myParticipant = room.participants.find((p) => p.user_id === me.id);
        if (!myParticipant) return null;
        return myParticipant.solves.find((s) => s.scramble_index === room.scramble_index);
    })();

    // Smart cube: isSpectator check for various logic
    const isSpectator = room?.participants.find((p) => p.user_id === me?.id)?.is_spectator;

    // NOTE: Smart cube auto-submit REMOVED - user must manually click KAYDET in review screen
    // This allows user to choose DNF, +2, or İPTAL before saving

    // Smart cube: Reset submit flag on new scramble or scramble index change
    // FIX: Also reset on scramble_index to handle spectator mode changes
    useEffect(() => {
        smartCubeSolveSubmittedRef.current = false;
    }, [room?.current_scramble, room?.scramble_index]);

    if (loading) {
        return (
            <div className="flex h-[100dvh] w-full items-center justify-center bg-[#0f1014] text-white">
                <div className="text-lg font-medium animate-pulse">Oda yükleniyor...</div>
            </div>
        );
    }

    if (needsPassword) {
        return (
            <div className="flex h-[100dvh] w-full flex-col items-center justify-center bg-[#0f1014] p-4 text-white">
                <PasswordModal
                    onSubmit={handlePasswordSubmit}
                    onCancel={() => history.push('/rooms')}
                />
            </div>
        );
    }

    if (error || !room) {
        return (
            <div className="flex h-[100dvh] w-full flex-col items-center justify-center bg-[#0f1014] text-white p-4 text-center">
                <div className="text-red-400 mb-4 text-lg">
                    {error || 'Oda bulunamadı'}
                </div>
                <Button onClick={() => history.push('/rooms')}>Odalara Dön</Button>
            </div>
        );
    }

    const isHost = me?.id === room.created_by.id;
    const isActive = room.status === 'ACTIVE';

    // Calculate current user's stats for bottom panel
    const myParticipant = room.participants.find((p) => p.user_id === me?.id);
    const mySolves = myParticipant?.solves || [];

    // Get valid times (not DNF), apply +2 penalty
    const times = mySolves
        .filter((s) => !s.dnf)
        .map((s) => (s.plus_two ? s.time + 2 : s.time) * 1000); // Convert to ms

    // Best single
    const single = times.length > 0 ? Math.min(...times) : null;

    // Calculate average (WCA style: sort, drop best and worst, average middle)
    const calculateAvg = (arr: number[], count: number): number | null => {
        if (arr.length < count) return null;
        const last = arr.slice(-count);
        const sorted = [...last].sort((a, b) => a - b);
        // Remove best and worst
        const middle = sorted.slice(1, -1);
        return middle.reduce((a, b) => a + b, 0) / middle.length;
    };

    const ao5 = calculateAvg(times, 5);
    const ao12 = calculateAvg(times, 12);

    // Best averages
    const calculateBestAvg = (arr: number[], count: number): number | null => {
        if (arr.length < count) return null;
        let best: number | null = null;
        for (let i = 0; i <= arr.length - count; i++) {
            const window = arr.slice(i, i + count);
            const sorted = [...window].sort((a, b) => a - b);
            const middle = sorted.slice(1, -1);
            const avg = middle.reduce((a, b) => a + b, 0) / middle.length;
            if (best === null || avg < best) best = avg;
        }
        return best;
    };

    const bestAo5 = calculateBestAvg(times, 5);
    const bestAo12 = calculateBestAvg(times, 12);

    const formatStat = (val: number | null) => val !== null ? (val / 1000).toFixed(2) : '-';

    return (
        <div className="fixed inset-0 z-[100] md:fixed md:inset-0 md:top-[80px] md:h-[calc(100vh-80px)] flex flex-col bg-[#0f1014] text-white overflow-hidden font-sans">
            {/* 1. Header & Scramble (Fixed) */}
            <div className="shrink-0 flex flex-col">
                {/* Top Bar - Native App Header Style */}
                <div className="flex items-center justify-between bg-blue-600 px-3 md:px-4 py-2 md:py-3 shadow-lg z-10 relative gap-2">
                    {/* Hamburger Menu (Only for Host) */}
                    {isHost ? (
                        <div className="relative z-50 shrink-0" ref={hostMenuRef}>
                            <button
                                className={`p-1 text-white hover:bg-white/10 rounded-md transition-colors ${hostMenuOpen ? 'bg-white/10' : ''}`}
                                onClick={() => setHostMenuOpen(!hostMenuOpen)}
                            >
                                <List size={24} weight="bold" />
                            </button>

                            {/* Dropdown Menu */}
                            {hostMenuOpen && (
                                <div className="absolute top-full left-0 mt-2 w-56 bg-[#1a1b1f] border border-gray-800 rounded-lg shadow-xl transition-all transform origin-top-left z-50 overflow-hidden">
                                    <div className="py-1">
                                        <button
                                            onClick={() => {
                                                setEditModalOpen(true);
                                                setHostMenuOpen(false);
                                            }}
                                            className="w-full text-left px-4 py-3 text-sm text-gray-300 hover:bg-white/5 hover:text-white flex items-center gap-3 transition-colors"
                                        >
                                            <PencilSimple size={18} />
                                            Odayı Düzenle
                                        </button>
                                        <button
                                            onClick={() => {
                                                setManageUsersModalOpen(true);
                                                setHostMenuOpen(false);
                                            }}
                                            className="w-full text-left px-4 py-3 text-sm text-gray-300 hover:bg-white/5 hover:text-white flex items-center gap-3 transition-colors"
                                        >
                                            <Users size={18} />
                                            Kullanıcıları Yönet
                                        </button>
                                        <div className="h-px bg-gray-800 my-1" />
                                        <button
                                            onClick={handleLeaveRoom}
                                            className="w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 flex items-center gap-3 transition-colors"
                                        >
                                            <Trash size={18} />
                                            Odayı Sil
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : null}

                    <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0 overflow-hidden">
                        <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                            <h1 className="text-lg md:text-xl font-bold tracking-tight text-white m-0 leading-none truncate block">
                                {room.name}
                            </h1>
                            {isHost && (
                                <button
                                    onClick={() => setEditModalOpen(true)}
                                    className="shrink-0 p-1 text-gray-400 hover:text-white transition-colors rounded-full hover:bg-white/10 focus:outline-none"
                                    title="Odayı Düzenle"
                                >
                                    <PencilSimple size={18} weight="bold" />
                                </button>
                            )}
                        </div>
                        <span
                            onClick={() => isHost && setEditModalOpen(true)}
                            className={`shrink-0 rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold text-white backdrop-blur-sm transition-colors ${isHost ? 'cursor-pointer hover:bg-white/30' : ''}`}
                            title={isHost ? "Etkinliği değiştirmek için tıkla" : undefined}
                        >
                            {room.cube_type.toUpperCase()}
                        </span>

                        {/* Spectator/Competing Mode Toggle - Hidden on very small screens if needed, but important */}
                        {isActive && myParticipant && (
                            <button
                                onClick={() => getSocket().emit(FriendlyRoomClientEvent.TOGGLE_SPECTATOR, roomId)}
                                className={`shrink-0 ml-1 md:ml-2 px-2 md:px-3 py-1 text-xs font-bold rounded-full transition-all shadow-sm ${myParticipant.is_spectator
                                    ? 'bg-red-500 hover:bg-red-600 text-white'
                                    : 'bg-green-500 hover:bg-green-600 text-white'
                                    }`}
                            >
                                <span className="hidden md:inline">{myParticipant.is_spectator ? 'İzleyici' : 'Mücadele'}</span>
                                <span className="md:hidden">{myParticipant.is_spectator ? 'View' : 'Play'}</span>
                            </button>
                        )}
                    </div>
                    <div className="flex items-center gap-1 md:gap-2 shrink-0">
                        {/* Bluetooth Connect Button for GAN Timer */}
                        {timerType === 'gantimer' && (
                            <button
                                onClick={ganTimerConnected ? disconnectGanTimer : handleConnectGanTimer}
                                disabled={ganTimerConnecting}
                                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded transition-all ${ganTimerConnected
                                    ? 'bg-green-500 hover:bg-green-600 text-white'
                                    : ganTimerConnecting
                                        ? 'bg-blue-400 text-white cursor-wait'
                                        : 'bg-blue-500 hover:bg-blue-600 text-white'
                                    }`}
                                title={ganTimerConnected ? 'Bağlantıyı Kes' : 'GAN Timer Bağla'}
                            >
                                {ganTimerConnected ? (
                                    <BluetoothConnected size={16} weight="bold" />
                                ) : (
                                    <Bluetooth size={16} weight="bold" />
                                )}
                                <span className="hidden md:inline">{ganTimerConnecting ? 'Bağlanıyor...' : ganTimerConnected ? 'Timer Bağlı' : 'Timer Bağla'}</span>
                            </button>
                        )}

                        {/* Bluetooth Connect Button for Smart Cube */}
                        {timerType === 'smart' && (
                            <button
                                onClick={smartCubeConnected ? disconnectSmartCube : handleConnectSmartCube}
                                disabled={smartCubeConnecting}
                                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded transition-all ${smartCubeConnected
                                    ? 'bg-green-500 hover:bg-green-600 text-white'
                                    : smartCubeConnecting
                                        ? 'bg-blue-400 text-white cursor-wait'
                                        : 'bg-blue-500 hover:bg-blue-600 text-white'
                                    }`}
                                title={smartCubeConnected ? 'Bağlantıyı Kes' : 'Akıllı Küp Bağla'}
                            >
                                {smartCubeConnected ? (
                                    <BluetoothConnected size={16} weight="bold" />
                                ) : (
                                    <Bluetooth size={16} weight="bold" />
                                )}
                                <span className="hidden md:inline">{smartCubeConnecting ? 'Bağlanıyor...' : smartCubeConnected ? 'Küp Bağlı' : 'Küp Bağla'}</span>
                            </button>
                        )}
                        <button
                            onClick={() => setSettingsOpen(true)}
                            className="p-1 md:p-2 text-white/90 hover:text-white transition-colors"
                        >
                            <Gear weight="bold" size={20} />
                        </button>

                        {isHost && isActive && (
                            <button
                                onClick={handleNextScramble}
                                className={`${isMobile ? 'h-8 px-2 text-[10px]' : 'px-3 py-1.5 text-xs'} bg-blue-600 hover:bg-blue-700 text-white font-bold rounded transition-colors shadow-sm whitespace-nowrap`}
                                title="Herkesi bir sonraki karıştırmaya geçir"
                            >
                                {isMobile ? 'Karıştır' : 'Yeni Karıştırma'}
                            </button>
                        )}

                        <button
                            onClick={handleLeaveRoom}
                            className={`${isMobile ? 'h-8 px-2 text-[10px]' : 'px-3 py-1.5 text-xs'} bg-red-500 hover:bg-red-600 text-white font-bold rounded transition-colors shadow-sm`}
                        >
                            Çıkış
                        </button>
                    </div>
                </div>

                {/* Mobile Tabs - Only show on lg and below */}
                {isActive && isMobile && (
                    <div className="flex border-b border-gray-800 bg-[#15161A]">
                        <button
                            className={`flex-1 py-3 text-sm font-medium transition-colors relative ${mobileTab === 'timer' ? 'text-blue-400' : 'text-gray-400 hover:text-gray-200'
                                }`}
                            onClick={() => setMobileTab('timer')}
                        >
                            Timer
                            {mobileTab === 'timer' && (
                                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                            )}
                        </button>
                        <button
                            className={`flex-1 py-3 text-sm font-medium transition-colors relative ${mobileTab === 'chat' ? 'text-blue-400' : 'text-gray-400 hover:text-gray-200'
                                }`}
                            onClick={() => setMobileTab('chat')}
                        >
                            Sohbet
                            {mobileTab === 'chat' && (
                                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                            )}
                        </button>
                    </div>
                )}

                {/* Scramble Area */}
                {isActive && (
                    <div className="flex items-center flex-col justify-center bg-[#0a0b0e] py-4 px-4 border-b border-gray-800/50">
                        {/* Scramble Display - colored for smart cube */}
                        <div className="text-center font-mono text-base md:text-3xl leading-relaxed font-medium select-all px-1">
                            {alreadySolvedThisRound ? (
                                <span className="text-gray-500 animate-pulse">Diğer kullanıcılar bekleniyor...</span>
                            ) : timerType === 'smart' && smartCubeConnected ? (
                                // Smart cube: show colored scramble with correction hints
                                (() => {
                                    const currentSessionTurns = smartTurns.slice(sessionStartRef.current);
                                    const smartScramble = processSmartTurns(currentSessionTurns);
                                    const scrambleParts = room.current_scramble.split(' ');
                                    const failedMoves: string[] = [];
                                    let orangeMiddle = false;

                                    if (smartScrambleCompletedAt) {
                                        return (
                                            <div className="flex flex-col items-center justify-center py-4 animate-pulse">
                                                <span className="text-green-500 text-4xl md:text-6xl font-black tracking-[0.2em]">HAZIR</span>
                                                <span className="text-green-500/50 text-xs md:text-sm font-bold tracking-widest mt-1">ÇÖZMEYE BAŞLA</span>
                                            </div>
                                        );
                                    }

                                    // First pass: detect failed moves
                                    for (let i = 0; i < scrambleParts.length; i++) {
                                        const turn = scrambleParts[i];
                                        const smartTurn = smartScramble[i];

                                        if (failedMoves.length === 0 && smartScramble.length > i && smartTurn === turn && !orangeMiddle) {
                                            // Green - correct
                                        } else if (smartScramble.length > i && rawTurnIsSame(smartTurn, turn) && isTwo(turn) && !orangeMiddle) {
                                            // Orange - half done
                                            orangeMiddle = true;
                                        } else if (smartScramble.length > i) {
                                            // Red - wrong move, add to failedMoves
                                            failedMoves.push(smartTurn);
                                        }
                                    }

                                    // If there are failed moves, show correction (reverse of failed moves)
                                    if (failedMoves.length > 0) {
                                        // Too many wrong moves - just tell user to solve the cube
                                        if (failedMoves.length > 7) {
                                            return (
                                                <span className="text-red-400 font-bold animate-pulse">
                                                    Başlamak için küpü çöz
                                                </span>
                                            );
                                        }

                                        // Show correction moves
                                        const correctionMoves = reverseScramble(failedMoves);
                                        return (
                                            <div className="flex flex-col items-center gap-1">
                                                <span className="text-gray-500 text-xs uppercase tracking-wider">Düzeltme:</span>
                                                <div>
                                                    {correctionMoves.map((move, i) => (
                                                        <span key={`fix-${move}-${i}`} className="text-red-400 font-bold">
                                                            {move}{' '}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    }

                                    // Normal display with colors
                                    orangeMiddle = false;
                                    return scrambleParts.map((turn, i) => {
                                        const smartTurn = smartScramble[i];
                                        let colorClass = 'text-gray-200'; // default

                                        if (smartScramble.length > i && smartTurn === turn && !orangeMiddle) {
                                            colorClass = 'text-green-400'; // completed
                                        } else if (smartScramble.length > i && rawTurnIsSame(smartTurn, turn) && isTwo(turn) && !orangeMiddle) {
                                            colorClass = 'text-orange-400'; // half done (X2 moves)
                                            orangeMiddle = true;
                                        }

                                        return (
                                            <span key={`${turn}-${i}`} className={colorClass}>
                                                {turn}{' '}
                                            </span>
                                        );
                                    });
                                })()
                            ) : (
                                // Normal: show plain scramble
                                <span className="text-gray-200">{room.current_scramble}</span>
                            )}
                        </div>

                        {/* Manual Entry Section - always visible when manual mode */}
                        {isManualMode && (
                            <div className="mt-4 flex flex-col items-center gap-2 w-full max-w-md">
                                {manualInspecting ? (
                                    // Show inspection timer inline
                                    <div
                                        className={`w-full px-4 py-3 text-4xl md:text-5xl font-mono text-center rounded-lg bg-[#1a1b1f] border-2 ${manualInspectionTime < 0 ? 'border-red-500 text-red-500' :
                                            manualInspectionTime < 3000 ? 'border-orange-500 text-orange-500' :
                                                'border-red-500 text-red-400'
                                            }`}
                                    >
                                        {manualInspectionTime < -2000 ? 'DNF' :
                                            manualInspectionTime < 0 ? '+2' :
                                                (manualInspectionTime / 1000).toFixed(2)}
                                    </div>
                                ) : (
                                    <>
                                        {/* Show input field */}
                                        <form
                                            className="w-full flex gap-2"
                                            noValidate
                                            onSubmit={(e) => {
                                                e.preventDefault();
                                                if (!manualTimeError && manualTimeInput.trim() && !alreadySolvedThisRound) {
                                                    try {
                                                        const parsed = convertTimeStringToSeconds(manualTimeInput, false);
                                                        const finalDnf = parsed.dnf || penalties.DNF;
                                                        const finalPlusTwo = parsed.plusTwo || penalties.AUF || penalties.inspection;

                                                        handleSolveSubmit(parsed.timeSeconds, finalPlusTwo, finalDnf);
                                                        setManualTimeInput('');
                                                        setManualTimeError(false);
                                                        setPenalties({ AUF: false, DNF: false, inspection: false });
                                                    } catch {
                                                        setManualTimeError(true);
                                                    }
                                                }
                                            }}
                                        >
                                            <input
                                                ref={manualTimeInputRef}
                                                type="text"
                                                inputMode="decimal"
                                                pattern="[0-9]*"
                                                className={`flex-1 min-w-0 px-4 py-3 text-2xl md:text-3xl font-mono text-center rounded-lg bg-[#1a1b1f] border-2 ${manualTimeError && manualTimeInput
                                                    ? 'border-red-500 focus:border-red-400'
                                                    : 'border-gray-700 focus:border-blue-500'
                                                    } text-white placeholder-gray-500 outline-none transition-colors appearance-none`}
                                                placeholder={alreadySolvedThisRound ? "Kaydedildi" : "1234"}
                                                value={manualTimeInput}
                                                disabled={alreadySolvedThisRound}
                                                enterKeyHint="done"
                                                autoComplete="off"
                                                autoCorrect="off"
                                                autoCapitalize="none"
                                                spellCheck="false"
                                                onBlur={(e) => {
                                                    const target = e.target as HTMLInputElement;
                                                    if (!alreadySolvedThisRound) {
                                                        const refocus = () => {
                                                            if (!target.disabled && (document.activeElement === document.body || !document.activeElement)) {
                                                                target.focus();
                                                            }
                                                        };
                                                        requestAnimationFrame(refocus);
                                                        setTimeout(refocus, 50);
                                                    }
                                                }}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setManualTimeInput(val);
                                                    try {
                                                        const parsed = convertTimeStringToSeconds(val, false);
                                                        setManualTimeError(parsed.timeSeconds <= 0 && !parsed.dnf);
                                                    } catch {
                                                        setManualTimeError(true);
                                                    }
                                                }}
                                                onKeyDown={(e) => {
                                                    // Space key for inspection
                                                    if (e.key === ' ' && inspection && !alreadySolvedThisRound && !manualTimeInput) {
                                                        e.preventDefault();
                                                        // Start inspection
                                                        setManualInspecting(true);
                                                        setManualInspectionTime(15000);
                                                        manualInspectionStartRef.current = performance.now();
                                                        manualInspectionRef.current = setInterval(() => {
                                                            if (manualInspectionStartRef.current) {
                                                                const elapsed = performance.now() - manualInspectionStartRef.current;
                                                                const remaining = 15000 - elapsed;
                                                                setManualInspectionTime(remaining);
                                                                // Auto-stop at DNF
                                                                if (remaining < -2000) {
                                                                    if (manualInspectionRef.current) clearInterval(manualInspectionRef.current);
                                                                    setManualInspecting(false);
                                                                    // Auto-submit DNF
                                                                    handleSolveSubmit(0, false, true);
                                                                }
                                                            }
                                                        }, 50);
                                                    }
                                                }}
                                                onKeyUp={(e) => {
                                                    // Space release ends inspection
                                                    if (e.key === ' ' && manualInspecting) {
                                                        e.preventDefault();
                                                        if (manualInspectionRef.current) clearInterval(manualInspectionRef.current);
                                                        setManualInspecting(false);
                                                    }
                                                }}
                                            />

                                            {/* Submit Button for iOS/Touch */}
                                            <button
                                                type="submit"
                                                disabled={!manualTimeInput || alreadySolvedThisRound || manualTimeError}
                                                className="shrink-0 w-[56px] flex items-center justify-center bg-blue-600 active:bg-blue-700 disabled:bg-gray-800 disabled:text-gray-600 text-white rounded-lg transition-colors"
                                            >
                                                <Check size={28} weight="bold" />
                                            </button>
                                        </form>

                                        {/* Penalties Checkboxes */}
                                        {!alreadySolvedThisRound && (
                                            <div className="flex items-center gap-6 mt-4 justify-center">
                                                <label className="flex items-center gap-2 cursor-pointer group text-gray-400 hover:text-white transition-colors">
                                                    <div className={`w-6 h-6 rounded flex items-center justify-center border-2 transition-colors ${penalties.AUF ? 'bg-amber-500 border-amber-500' : 'border-gray-600 group-hover:border-gray-400'}`}>
                                                        {penalties.AUF && <Check size={16} weight="bold" className="text-white" />}
                                                    </div>
                                                    <span className={`font-bold text-lg select-none ${penalties.AUF ? 'text-white' : ''}`}>AUF</span>
                                                    <input type="checkbox" className="hidden" checked={penalties.AUF} onChange={() => setPenalties(p => ({ ...p, AUF: !p.AUF }))} />
                                                </label>

                                                <label className="flex items-center gap-2 cursor-pointer group text-gray-400 hover:text-white transition-colors">
                                                    <div className={`w-6 h-6 rounded flex items-center justify-center border-2 transition-colors ${penalties.DNF ? 'bg-rose-500 border-rose-500' : 'border-gray-600 group-hover:border-gray-400'}`}>
                                                        {penalties.DNF && <Check size={16} weight="bold" className="text-white" />}
                                                    </div>
                                                    <span className={`font-bold text-lg select-none ${penalties.DNF ? 'text-white' : ''}`}>DNF</span>
                                                    <input type="checkbox" className="hidden" checked={penalties.DNF} onChange={() => setPenalties(p => ({ ...p, DNF: !p.DNF }))} />
                                                </label>

                                                <label className="flex items-center gap-2 cursor-pointer group text-gray-400 hover:text-white transition-colors">
                                                    <div className={`w-6 h-6 rounded flex items-center justify-center border-2 transition-colors ${penalties.inspection ? 'bg-amber-500 border-amber-500' : 'border-gray-600 group-hover:border-gray-400'}`}>
                                                        {penalties.inspection && <Check size={16} weight="bold" className="text-white" />}
                                                    </div>
                                                    <span className={`font-bold text-lg select-none ${penalties.inspection ? 'text-white' : ''}`}>INSPECTION</span>
                                                    <input type="checkbox" className="hidden" checked={penalties.inspection} onChange={() => setPenalties(p => ({ ...p, inspection: !p.inspection }))} />
                                                </label>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* 2. Main Content Area (Dynamic Grid/Table) */}
            <div className={`flex-1 overflow-hidden relative w-full ${isActive && !isMobile ? 'flex flex-row' : ''}`}>
                {isActive ? (
                    <>
                        {/* Timer Layout (Table) - Left (60% on desktop) */}
                        <div className={`
                            flex-col bg-[#0f1014]
                            ${!isMobile
                                ? 'flex relative w-[60%] border-r border-[#333]'
                                : `absolute inset-0 ${mobileTab === 'timer' ? 'flex z-10' : 'hidden'}`
                            } 
                            transition-opacity duration-200
                        `}>

                            {/* Table Container - takes all remaining space */}
                            <div className="flex-1 h-full w-full overflow-hidden bg-[#0f1014]">
                                <RoomTable
                                    participants={room.participants}
                                    scrambleIndex={room.scramble_index}
                                    userStatuses={userStatuses}
                                    currentUserId={me?.id}
                                />
                            </div>

                            {/* Mobile Timer Touch Area - Fixed at bottom of Timer Tab */}
                            {isMobile && timerType === 'keyboard' && !isManualMode && (
                                <div className="timer-touch-area shrink-0 h-32 w-full bg-[#15161A] border-t border-[#333] flex flex-col items-center justify-center select-none touch-none cursor-pointer active:bg-[#1a1c22] transition-colors relative z-20">
                                    <span className="text-6xl font-mono font-medium text-gray-200 tracking-tight">
                                        {(() => {
                                            const myParticipant = room.participants.find(p => p.user_id === me?.id);
                                            if (!myParticipant || myParticipant.solves.length === 0) return '0.00';

                                            // Find last solve (highest scramble index)
                                            const lastSolve = myParticipant.solves.reduce((prev, current) =>
                                                (prev.scramble_index > current.scramble_index) ? prev : current
                                            );

                                            // Format time
                                            if (lastSolve.dnf) return 'DNF';
                                            const time = lastSolve.plus_two ? lastSolve.time + 2 : lastSolve.time;
                                            return time.toFixed(2);
                                        })()}
                                    </span>
                                </div>
                            )}

                        </div>

                        {/* Chat Layout - Center (30% on desktop) */}
                        <div className={`
                            flex-col bg-[#0f1014]
                            ${!isMobile
                                ? 'flex relative w-[30%] border-r border-[#333]'
                                : `absolute inset-0 ${mobileTab === 'chat' ? 'flex z-10' : 'hidden'}`
                            }
                            transition-opacity duration-200
                        `}>
                            <RoomChat roomId={roomId} />
                        </div>

                        {/* Notification Log - Right (10% on desktop) - Hidden on mobile */}
                        {!isMobile && (
                            <div className="relative w-[10%] flex flex-col h-full overflow-hidden">
                                <NotificationLog notifications={notifications} />
                            </div>
                        )}
                    </>
                ) : (
                    <div className="flex h-full w-full flex-col bg-[#0f1014] overflow-y-auto overflow-x-hidden">

                        {/* Waiting Room Header */}
                        <div className="shrink-0 text-center mt-6 md:mt-12 mb-6 md:mb-12 space-y-3 px-4">
                            <h2 className="text-2xl md:text-4xl font-bold text-white tracking-tight">
                                Oyuncular Bekleniyor
                            </h2>
                            <p className="text-gray-400 text-sm md:text-base">
                                {isHost
                                    ? 'Hazır olduğunuzda "Başlat" butonuna tıklayın.'
                                    : 'Host odayı başlatana kadar bekleyin.'}
                            </p>
                        </div>

                        {/* Content Grid */}
                        <div className="flex-1 flex flex-col md:flex-row items-center md:items-start justify-center gap-6 md:gap-8 px-4 md:px-8 max-w-7xl mx-auto w-full pb-8">

                            {/* Left: Participants */}
                            <div className="w-full max-w-md md:max-w-none md:flex-1 h-[300px] md:h-[500px] bg-[#15161A] rounded-2xl border border-gray-800 overflow-hidden flex flex-col shadow-2xl relative group">
                                <RoomParticipants
                                    participants={room.participants}
                                    currentScrambleIndex={room.scramble_index}
                                    hostId={room.created_by.id}
                                />
                                <div className="absolute inset-0 border-2 border-transparent group-hover:border-blue-500/20 rounded-2xl pointer-events-none transition-colors" />
                            </div>

                            {/* Center: Action Button (Desktop: Center Column) */}
                            <div className="shrink-0 flex flex-col items-center justify-center gap-4 py-2 md:py-0 md:h-[500px]">
                                {isHost ? (
                                    <div className="relative group">
                                        <button
                                            onClick={(e) => {
                                                const btn = e.currentTarget;
                                                const filler = btn.querySelector('.fire-filler') as HTMLElement;
                                                if (filler) {
                                                    filler.style.width = '100%';
                                                    setTimeout(() => {
                                                        handleStartRoom();
                                                    }, 600); // Wait for animation
                                                } else {
                                                    handleStartRoom();
                                                }
                                            }}
                                            className="relative overflow-hidden w-48 md:w-56 h-12 md:h-14 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-[0_0_20px_rgba(37,99,235,0.3)] hover:shadow-[0_0_30px_rgba(37,99,235,0.5)] transition-all active:scale-95 group"
                                        >
                                            <span className="relative z-10 flex items-center justify-center gap-2">
                                                Odayı Başlat
                                            </span>
                                            {/* Fire Animation Layer */}
                                            <div
                                                className="fire-filler absolute top-0 left-0 h-full w-0 bg-gradient-to-r from-orange-500 via-red-500 to-yellow-500 transition-[width] duration-500 ease-in"
                                                style={{ willChange: 'width' }}
                                            />
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-2 animate-pulse">
                                        <div className="w-12 h-12 rounded-full border-2 border-gray-700 border-t-blue-500 animate-spin" />
                                        <span className="text-gray-500 text-sm font-medium tracking-wider">YÖNETİCİ BEKLENİYOR</span>
                                    </div>
                                )}
                            </div>

                            {/* Right: Chat */}
                            <div className="w-full max-w-md md:max-w-none md:flex-1 h-[300px] md:h-[500px] bg-[#15161A] rounded-2xl border border-gray-800 overflow-hidden flex flex-col shadow-2xl relative group">
                                <RoomChat roomId={roomId} />
                                <div className="absolute inset-0 border-2 border-transparent group-hover:border-blue-500/20 rounded-2xl pointer-events-none transition-colors" />
                            </div>

                        </div>
                    </div>
                )}
            </div>

            {/* 3. Bottom Panel (Stats & Preview) - Fixed Sticky */}
            {isActive && mobileTab === 'timer' && (
                <div className="shrink-0 bg-[#0a0b0e] border-t border-gray-800 p-2 pb-safe z-20 shadow-[0_-4px_20px_rgba(0,0,0,0.3)] w-full">
                    <div className="flex items-center justify-between w-full px-2 md:px-6">
                        {/* Compact Stats */}
                        <div className="flex flex-col gap-1 text-xs md:text-sm">
                            <div className="grid grid-cols-[50px_repeat(3,minmax(40px,1fr))] gap-x-2 gap-y-1 items-center">
                                <span className="text-gray-500 font-semibold text-[10px] uppercase tracking-wider"></span>
                                <span className="text-blue-400 font-bold text-center text-[10px] uppercase tracking-wider">SINGLE</span>
                                <span className="text-blue-400 font-bold text-center text-[10px] uppercase tracking-wider">AO5</span>
                                <span className="text-blue-400 font-bold text-center text-[10px] uppercase tracking-wider">AO12</span>

                                <span className="text-gray-400 font-medium text-left">Güncel</span>
                                <span className="text-gray-200 font-mono text-center">{formatStat(times.length > 0 ? times[times.length - 1] : null)}</span>
                                <span className="text-gray-200 font-mono text-center">{formatStat(ao5)}</span>
                                <span className="text-gray-200 font-mono text-center">{formatStat(ao12)}</span>

                                <span className="text-gray-400 font-medium text-left">En İyi</span>
                                <span className="text-gray-200 font-mono text-center">{formatStat(single)}</span>
                                <span className="text-gray-200 font-mono text-center">{formatStat(bestAo5)}</span>
                                <span className="text-gray-200 font-mono text-center">{formatStat(bestAo12)}</span>
                            </div>
                        </div>

                        {/* Cube Preview (Restored & Resized) */}
                        <div className="h-[80px] md:h-[100px] w-auto aspect-[4/3] flex items-center justify-center bg-transparent ml-4 shrink-0">
                            <ScrambleVisual
                                scramble={room.current_scramble}
                                cubeType={room.cube_type}
                                width="100%"
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Full-screen Timer Overlay */}
            {/* Full-screen Timer Overlay */}
            <RoomTimerOverlay
                isActive={isActive}
                scramble={room.current_scramble}
                cubeType={room.cube_type}
                onSubmit={(t, p2, dnf) => {
                    handleSolveSubmit(t, p2, dnf);
                    setSmartReviewing(false);
                }}
                onRedo={() => {
                    handleSolveRedo();
                    // FIX: Full smart cube state reset for re-solve
                    setSmartReviewing(false);
                    setSmartScrambleCompletedAt(null);
                    setSmartFinalTime(0);
                    setSmartStats(null);
                    setSmartTiming(false);
                    setSmartElapsedTime(0);
                    // Reset turn processing to current position
                    sessionStartRef.current = smartTurns.length;
                    processedTurnsRef.current = smartTurns.length;
                    scrambleTurnCountRef.current = 0;
                    // Reset virtual cube for fresh scramble matching
                    cubejsRef.current = new Cube();
                }}
                onStatusChange={handleStatusChange}
                onOpenSettings={() => setSettingsOpen(true)}
                alreadySolvedThisRound={alreadySolvedThisRound}
                smartInspecting={smartInspecting}
                smartInspectionTime={smartInspectionTime}
                smartTiming={smartTiming}
                smartElapsedTime={smartElapsedTime}
                smartReviewing={smartReviewing}
                smartFinalTime={smartFinalTime}
                smartStats={smartStats || undefined}
                warning={smartWarning}
                isMobile={isMobile}
            />

            {/* Settings Modal */}
            <RoomSettingsModal
                isOpen={settingsOpen}
                onClose={() => setSettingsOpen(false)}
                cubeType={room.cube_type}
                allowedTimerTypes={room.allowed_timer_types}
            />
            {/* New Modals */}
            <EditRoomModal
                isOpen={editModalOpen}
                onClose={() => setEditModalOpen(false)}
                currentName={room.name}
                isPrivate={room.is_private}
                currentAllowedTypes={room.allowed_timer_types}
                cubeType={room.cube_type}
                onSubmit={(name, isPrivate, password, allowedTypes, cubeType) => {
                    getSocket().emit(FriendlyRoomClientEvent.UPDATE_ROOM, roomId, {
                        name,
                        is_private: isPrivate,
                        password,
                        allowed_timer_types: allowedTypes,
                        cube_type: cubeType
                    });
                }}
            />
            <ManageUsersModal
                isOpen={manageUsersModalOpen}
                onClose={() => setManageUsersModalOpen(false)}
                participants={room.participants}
                onKick={(userId) => {
                    getSocket().emit(FriendlyRoomClientEvent.KICK_USER, roomId, userId);
                }}
                onBan={(userId) => {
                    getSocket().emit(FriendlyRoomClientEvent.BAN_USER, roomId, userId);
                }}
            />
        </div>
    );
}
