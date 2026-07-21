import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSelector, useDispatch } from 'react-redux';
import { useParams, useHistory } from 'react-router-dom';
import { socketClient } from '../../util/socket/socketio';
import {
    FriendlyRoomData,
    FriendlyRoomClientEvent,
    FriendlyRoomServerEvent,
    FriendlyRoomSolveData,
    FriendlyRoomParticipantData,
    JoinFriendlyRoomInput,
    SessionTakeoverPayload,
    AlreadyInOtherRoomPayload,
    FriendlyRoomConst,
} from '../../../shared/friendly_room';
import Button from '../common/button/Button';
import { useMe } from '../../util/hooks/useMe';
import { getDailyGoalStorage } from '../daily-goal/helpers/storage';
import { fetchRoomSolveCounts } from '../daily-goal/helpers/room-solves';
import { useSettings } from '../../util/hooks/useSettings';
import { setSetting } from '../../db/settings/update';
import OfflineGuard from '../common/offline_guard/OfflineGuard';
import RoomParticipants from './RoomParticipants';
import RoomChat from './RoomChat';
import PasswordModal from './PasswordModal';
import SessionTakeoverModal from './SessionTakeoverModal';
import AlreadyInOtherRoomModal from './AlreadyInOtherRoomModal';
import RoomTable from './RoomTable';
import ScrambleVisual from '../modules/scramble/ScrambleVisual';
import RoomTimerOverlay from './RoomTimerOverlay';
import LeftSettingsDrawer from '../layout/nav/left_settings_drawer/LeftSettingsDrawer';
import EditRoomModal from './EditRoomModal';
import EditRoomDropdown from './EditRoomDropdown';
import ManageUsersModal from './ManageUsersModal';
import { List, PencilSimple, Users, Trash, BluetoothConnected, Bluetooth, CheckCircle, CircleNotch, Check, MusicNote } from 'phosphor-react';
import RoomMusicPlayer from './RoomMusicPlayer';
import {openProOnlyModal} from '../common/pro_only/openProOnlyModal';
import { is3x3CubeType } from '../timer/helpers/util';
import { getTimeString, convertTimeStringToSeconds } from '../../util/time';
import { toastError } from '../../util/toast';
import { resourceUri } from '../../util/storage';
import { connectGanTimer, GanTimerConnection } from '../timer/time_display/gantimer/ganTimerConnection';
import { connectQiyiTimer, QiyiTimerConnection } from '../timer/time_display/qiyitimer/qiyiTimerConnection';
import TimerTypePicker from '../timer/header_control/TimerTypePicker';
import SettingsDropdown from '../quick-controls/SettingsDropdown';
import { openModal, closeModal } from '../../actions/general';
import BleScanningModal from '../timer/smart_cube/ble_scanning_modal/BleScanningModal';
import { isNative } from '../../util/platform';
import Connect from '../timer/smart_cube/bluetooth/connect';
import { preflightChecks } from '../timer/smart_cube/preflight';
import { processSmartTurns, SmartTurn, isTwo, rawTurnIsSame, reverseScramble } from '../../util/smart_scramble';
import { cubeTimestampLinearFit, TimestampedMove } from '../../util/smart_cube_timing';
import Cube from 'cubejs';
import NotificationLog, { NotificationItem } from './NotificationLog';
import AbortSolveOverlay from '../timer/smart_cube/abort_solve/AbortSolveOverlay';
import ReactDOM from 'react-dom';
import { isPro } from '../../lib/pro';
import { PRO_GATED_TIMER_TYPES } from '../timer/helpers/pro_timer_types';
import './FriendlyRoom.scss';

interface ParamsType {
    roomId: string;
}

// Helper to get socket with any cast
const getSocket = () => socketClient() as any;

// Bluetooth connect button glassmorphism class — mobile has white text on blue bar, desktop has text-color on dark bar.
function connectButtonClass(connected: boolean, connecting: boolean): string {
    const base = 'flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-md transition-all border backdrop-blur-sm';
    if (connecting) {
        return `${base} cursor-wait bg-white/10 md:bg-text/[0.08] border-white/20 md:border-text/[0.15] text-white md:text-text`;
    }
    if (connected) {
        return `${base} bg-green-500/25 hover:bg-green-500/35 border-green-400/40 hover:border-green-400/60 text-white md:text-green-400`;
    }
    return `${base} bg-white/15 hover:bg-white/25 md:bg-text/[0.08] md:hover:bg-text/[0.15] border-white/20 hover:border-white/35 md:border-text/[0.15] md:hover:border-text/[0.25] text-white md:text-text`;
}

// Throttle delay for status updates (ms)
const STATUS_THROTTLE_MS = 100;

export default function FriendlyRoom() {
    return (
        <OfflineGuard>
            <FriendlyRoomContent />
        </OfflineGuard>
    );
}

function FriendlyRoomContent() {
    const { t } = useTranslation();
    const { roomId } = useParams<ParamsType>();
    const history = useHistory();
    const me = useMe();
    const userIsPro = isPro(me);
    const dispatch = useDispatch();

    const [room, setRoom] = useState<FriendlyRoomData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [needsPassword, setNeedsPassword] = useState(false);
    const [takenOver, setTakenOver] = useState(false);
    const [alreadyInRoom, setAlreadyInRoom] = useState<{ id: string; name: string } | null>(null);
    const [editModalOpen, setEditModalOpen] = useState(false);
    // Desktop edit popover (EditRoomDropdown) open state — shared so the cube-type chip can open the same popover
    const [editPopoverOpen, setEditPopoverOpen] = useState(false);
    const [manageUsersModalOpen, setManageUsersModalOpen] = useState(false);
    const [userStatuses, setUserStatuses] = useState<{ [userId: string]: string }>({});
    const [mobileTab, setMobileTab] = useState<'timer' | 'chat'>('timer');
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);

    // Music player state
    const [musicPlayerOpen, setMusicPlayerOpen] = useState(false);

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

    // When component unmounts (leaving room), disconnect smart cube
    useEffect(() => {
        return () => {
            disconnectSmartCube();
            disconnectQiyiTimer();
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
    const manualTimeInputRef = useRef<HTMLInputElement>(null); // Manual input ref
    const prevTimerTypeRef = useRef<string | null>(null); // Track previous timer type

    // Settings
    const manualEntry = useSettings('manual_entry');
    const timerType = useSettings('timer_type');
    const inspection = useSettings('inspection');
    const inspectionDelay = useSettings('inspection_delay');
    const timerDecimalPoints = useSettings('timer_decimal_points');
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
            // Priority: keyboard -> manual -> stackmat -> qiyiwired -> smart -> gantimer -> qiyitimer
            const allTypes = ['keyboard', 'manual', 'stackmat', 'qiyiwired', 'smart', 'gantimer', 'qiyitimer'];
            // Never auto-select a Pro-gated type for a free user: the Pro effect below
            // would immediately push it back to keyboard, and the two would ping-pong.
            const selectable = userIsPro ? allTypes : allTypes.filter(t => !PRO_GATED_TIMER_TYPES.has(t));
            const targetType = selectable.find(t => room.allowed_timer_types.includes(t));
            // Room only allows types this user cannot use — leave the setting alone
            // rather than fighting the Pro guard.
            if (!targetType) return;

            if (targetType === 'manual') {
                setSetting('manual_entry', true);
            } else {
                setSetting('manual_entry', false);
                setSetting('timer_type', targetType as any);
            }
            // Notify user once
            // toastError(`Timer türü bu oda için "${targetType}" olarak değiştirildi.`);
        }
    }, [room?.allowed_timer_types, timerType, manualEntry, userIsPro]);

    // Enforce Pro gating at runtime, not only in the timer type picker.
    // The picker disables smart/gantimer/qiyitimer for non-Pro users inside rooms,
    // but `timer_type` is a global setting: a free user could pick "smart" on the
    // timer page (where it is not gated) and carry it into a room. Downgrade here.
    useEffect(() => {
        if (userIsPro) return;
        if (!PRO_GATED_TIMER_TYPES.has(timerType)) return;

        // Drop the live BLE connection too — switching the type alone hides the UI
        // but would leave the device paired and draining battery.
        if (timerType === 'smart') {
            disconnectSmartCube();
        } else if (timerType === 'gantimer') {
            disconnectGanTimer();
        } else if (timerType === 'qiyitimer') {
            disconnectQiyiTimer();
        }
        setSetting('manual_entry', false);
        setSetting('timer_type', 'keyboard');
    }, [userIsPro, timerType]);

    // When room cube type changes, check smart cube compatibility
    useEffect(() => {
        if (!room?.cube_type) return;

        const roomSubset = (room as any).scramble_subset ?? null;
        const smartSupported = is3x3CubeType(room.cube_type, roomSubset);

        if (timerType === 'smart' && !smartSupported) {
            // Disconnect smart cube
            disconnectSmartCube();
            // Switch timer to keyboard
            setSetting('timer_type', 'keyboard');
        }
    }, [room?.cube_type, timerType]);

    // When timer type changes from smart cube to another type, disconnect Bluetooth
    useEffect(() => {
        // If previous type was 'smart' and now it's something else, disconnect
        if (prevTimerTypeRef.current === 'smart' && timerType !== 'smart') {
            disconnectSmartCube();
        }

        // QiYi: disconnect on type change
        if (prevTimerTypeRef.current === 'qiyitimer' && timerType !== 'qiyitimer') {
            disconnectQiyiTimer();
        }

        // GAN: same cleanup — without this the timer stayed paired after switching away.
        if (prevTimerTypeRef.current === 'gantimer' && timerType !== 'gantimer') {
            disconnectGanTimer();
        }

        // Save current timer type
        prevTimerTypeRef.current = timerType;
    }, [timerType]);

    const [ganTimerConnecting, setGanTimerConnecting] = useState(false);
    const ganTimerRef = useRef<GanTimerConnection | null>(null);

    // QiYi Timer connection state
    const [qiyiTimerConnected, setQiyiTimerConnected] = useState(false);
    const [qiyiTimerConnecting, setQiyiTimerConnecting] = useState(false);
    const qiyiTimerRef = useRef<QiyiTimerConnection | null>(null);

    const handleConnectGanTimer = async () => {
        if (ganTimerConnecting) return;
        setGanTimerConnecting(true);

        if (isNative()) {
            dispatch(openModal(
                <BleScanningModal
                    mode="gantimer"
                    onCancel={() => {
                        dispatch(closeModal());
                        setGanTimerConnecting(false);
                    }}
                />,
                {
                    position: 'bottom',
                    hideCloseButton: true,
                    disableBackdropClick: true,
                }
            ));
        }

        try {
            const conn = await connectGanTimer();
            if (isNative()) {
                dispatch(closeModal());
            }
            ganTimerRef.current = conn;
            setGanTimerConnected(true);
        } catch (err) {
            console.error('GAN Timer connection failed:', err);
            if (isNative()) {
                dispatch(closeModal());
            }
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

    const handleConnectQiyiTimer = async () => {
        if (qiyiTimerConnecting) return;
        setQiyiTimerConnecting(true);

        if (isNative()) {
            dispatch(openModal(
                <BleScanningModal
                    mode="qiyitimer"
                    onCancel={() => {
                        dispatch(closeModal());
                        setQiyiTimerConnecting(false);
                    }}
                />,
                {
                    position: 'bottom',
                    hideCloseButton: true,
                    disableBackdropClick: true,
                }
            ));
        }

        try {
            const conn = await connectQiyiTimer();
            if (isNative()) {
                dispatch(closeModal());
            }
            qiyiTimerRef.current = conn;
            setQiyiTimerConnected(true);
        } catch (err) {
            console.error('QiYi Timer connection failed:', err);
            if (isNative()) {
                dispatch(closeModal());
            }
        } finally {
            setQiyiTimerConnecting(false);
        }
    };

    const disconnectQiyiTimer = () => {
        if (qiyiTimerRef.current) {
            qiyiTimerRef.current.disconnect();
            qiyiTimerRef.current = null;
        }
        setQiyiTimerConnected(false);
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
    const reduxSmartPhysicallySolved = useSelector((state: any) => state.timer?.smartPhysicallySolved || false);
    const reduxLastSmartMoveTime = useSelector((state: any) => state.timer?.lastSmartMoveTime || 0);
    const reduxSmartStateSeq = useSelector((state: any) => state.timer?.smartStateSeq || 0);

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
                ? t('rooms.connection_cancelled')
                : t('rooms.connection_error') + ': ' + (err.message || t('rooms.unknown_error'));
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
    // AbortSolve state
    const [showAbortDialog, setShowAbortDialog] = useState(false);
    const [abortResetCount, setAbortResetCount] = useState(0);
    const [smartAbortVisible, setSmartAbortVisible] = useState(false);
    const [needsCubeReset, setNeedsCubeReset] = useState(false);
    const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const INACTIVITY_TIMEOUT_MS = 5000;
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
        setSmartInspectionTime(inspectionDelay ?? 15);
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
            setSmartInspectionTime(inspectionDelay ?? 15);
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
        const isSolved = smartTiming ? (currentCubeState === reduxSmartSolvedState || reduxSmartPhysicallySolved) : false;
        const isSolvedAnytime = currentCubeState === reduxSmartSolvedState || reduxSmartPhysicallySolved;

        // Warning if user messes up cube during review
        const warning = smartReviewing && !isSolvedAnytime ? t('rooms.solve_cube_for_scramble') : undefined;
        setSmartWarning(warning);



        // --- STOP LOGIC ---
        // If timer is running and cube is solved
        if (smartTiming && isSolved && smartTimerStartedAt) {
            setSmartTiming(false);

            // Linear fit ile Bluetooth gecikmesini düzelt (normal timer ile aynı yöntem)
            const solutionTurns = smartTurns.slice(scrambleTurnCountRef.current);
            const { finalTimeMs } = cubeTimestampLinearFit(solutionTurns as unknown as TimestampedMove[], smartTimerStartedAt);
            let timeMs = Math.round(finalTimeMs);
            // Fallback: linear fit geçersizse ham timestamp farkını kullan
            if (timeMs <= 0) {
                timeMs = (reduxSmartPhysicallySolved && reduxLastSmartMoveTime)
                    ? reduxLastSmartMoveTime - smartTimerStartedAt
                    : Date.now() - smartTimerStartedAt;
            }

            setSmartTimerStartedAt(null);
            if (smartTimerIntervalRef.current) clearInterval(smartTimerIntervalRef.current);

            // Enter review mode
            setSmartFinalTime(timeMs);

            // Calculate stats
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
                        const inspDelay = inspectionDelay ?? 15;
                        setSmartInspecting(true);
                        setSmartInspectionTime(inspDelay);
                        const inspectionStart = Date.now();
                        smartInspectionIntervalRef.current = setInterval(() => {
                            const elapsed = (Date.now() - inspectionStart) / 1000;
                            const remaining = inspDelay - elapsed;
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

    // M' move safety net: if physical cube is solved, stop timer
    // Not in main useEffect's reduxSmartPhysicallySolved dependency, so separate useEffect
    useEffect(() => {
        if (
            reduxSmartPhysicallySolved &&
            smartTiming &&
            smartTimerStartedAt
        ) {
            console.log('[FriendlyRoom] Safety net: STOPPING TIMER (physically solved)');
            setSmartTiming(false);
            const timeMs = (reduxLastSmartMoveTime || Date.now()) - smartTimerStartedAt;
            setSmartTimerStartedAt(null);
            if (smartTimerIntervalRef.current) clearInterval(smartTimerIntervalRef.current);

            setSmartFinalTime(timeMs);

            // Calculate stats
            const solutionTurns = smartTurns.slice(scrambleTurnCountRef.current);
            const turnCount = solutionTurns.length;
            const timeInSeconds = timeMs / 1000;
            const tps = timeInSeconds > 0 ? Number((turnCount / timeInSeconds).toFixed(2)) : 0;

            setSmartStats({ turns: turnCount, tps });
            setSmartReviewing(true);
        }
    }, [reduxSmartStateSeq, smartTiming]);

    // When physical cube is solved, auto-clear mismatch flag
    useEffect(() => {
        if (reduxSmartPhysicallySolved && needsCubeReset) {
            setNeedsCubeReset(false);
            sessionStartRef.current = smartTurns.length;
            processedTurnsRef.current = smartTurns.length;
            scrambleTurnCountRef.current = 0;
            cubejsRef.current = new Cube();
        }
    }, [reduxSmartStateSeq]);

    // 5 seconds inactivity → show abort button
    useEffect(() => {
        if (inactivityTimerRef.current) {
            clearTimeout(inactivityTimerRef.current);
            inactivityTimerRef.current = null;
        }

        if (!smartTiming || !smartTimerStartedAt) {
            setSmartAbortVisible(false);
            setShowAbortDialog(false);
            return;
        }

        // Hide abort button when new move arrives
        if (smartAbortVisible) {
            setSmartAbortVisible(false);
        }

        inactivityTimerRef.current = setTimeout(() => {
            setSmartAbortVisible(true);
        }, INACTIVITY_TIMEOUT_MS);

        return () => {
            if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
        };
    }, [smartTiming, smartTimerStartedAt, smartTurns.length, abortResetCount]);

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
            }, 33);
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
        setSmartInspectionTime(inspectionDelay ?? 15);
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


    // Reconnect flag: socket reconnect should do full ROOM_DATA hydration
    const isReconnectingRef = useRef(false);

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
            setAlreadyInRoom(null);
            setTakenOver(false);

            // After reconnect, full hydration: reset live statuses, clear manual input/inspection
            if (isReconnectingRef.current) {
                isReconnectingRef.current = false;
                setUserStatuses({});
                setManualTimeInput('');
                setManualTimeError(false);
                setManualInspecting(false);
                if (manualInspectionRef.current) {
                    clearInterval(manualInspectionRef.current);
                    manualInspectionRef.current = null;
                }
            }
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

        // Single active session: this device's session was taken over by another device
        socket.on(FriendlyRoomServerEvent.SESSION_TAKEOVER, (_data: SessionTakeoverPayload) => {
            // If BLE is connected, release it so the new device can connect the cube
            try { disconnectSmartCube(); } catch { /* already closed */ }
            try { disconnectGanTimer(); } catch { /* already closed */ }
            try { disconnectQiyiTimer(); } catch { /* already closed */ }
            setTakenOver(true);
            setLoading(false);
        });

        // Single active session: user is already in another room
        socket.on(FriendlyRoomServerEvent.ALREADY_IN_OTHER_ROOM, (data: AlreadyInOtherRoomPayload) => {
            setAlreadyInRoom({ id: data.current_room_id, name: data.current_room_name });
            setLoading(false);
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
                    const prevHistory = prev.scramble_history ?? [];
                    const filtered = prevHistory.filter(s => s.scramble_index !== data.scramble_index);
                    return {
                        ...prev,
                        current_scramble: data.scramble,
                        scramble_index: data.scramble_index,
                        scramble_history: [
                            ...filtered,
                            { scramble_index: data.scramble_index, scramble: data.scramble },
                        ].sort((a, b) => a.scramble_index - b.scramble_index),
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
                setNeedsCubeReset(false);
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

                // Own solve persisted server-side: refresh the room-solve cache so daily
                // goals + activity reflect it (only when the user opted in).
                if (data.user_id === me?.id && getDailyGoalStorage().count_room_solves) {
                    fetchRoomSolveCounts();
                }
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
            socket.off(FriendlyRoomServerEvent.SESSION_TAKEOVER);
            socket.off(FriendlyRoomServerEvent.ALREADY_IN_OTHER_ROOM);
        };
    }, [roomId, history, me]);

    // Join room on mount (if user is logged in) and on Reconnect
    // Also handles the case where user disconnects for > 45s (server timeout) -> Redirect to /rooms instead of rejoining
    const lastDisconnectRef = useRef<number | null>(null);

    useEffect(() => {
        if (!me) return;

        const socket = getSocket();

        const joinRoom = () => {
            // If server grace period has passed, user was removed — redirect to lobby instead of rejoin.
            // Timeout value comes from shared FriendlyRoomConst.PLAYER_DISCONNECT_GRACE_MS.
            if (lastDisconnectRef.current) {
                const elapsed = Date.now() - lastDisconnectRef.current;
                if (elapsed > FriendlyRoomConst.PLAYER_DISCONNECT_GRACE_MS) {
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

        const onReconnect = () => {
            // Reconnect: request full state from server; ROOM_DATA handler will hydrate
            isReconnectingRef.current = true;
            joinRoom();
            socket.emit(FriendlyRoomClientEvent.GET_ROOM, roomId);
        };

        // Join immediately on mount
        joinRoom();

        // Listen for events
        socket.on('connect', onReconnect);
        socket.on('disconnect', onDisconnect);

        return () => {
            socket.off('connect', onReconnect);
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

    function handleDeleteRoom() {
        getSocket().emit(FriendlyRoomClientEvent.DELETE_ROOM, roomId);
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

    // Smart Cube Abort Handlers
    function handleSmartAbortClick() {
        setShowAbortDialog(true);
    }

    function handleSmartAbortDnf() {
        if (!smartTimerStartedAt || !room) return;
        // DNF olarak submit et
        const solveData: FriendlyRoomSolveData = {
            time: 0,
            dnf: true,
            plus_two: false,
            scramble_index: room.scramble_index,
        };
        getSocket().emit(FriendlyRoomClientEvent.SUBMIT_SOLVE, roomId, solveData);

        // Timer state'i sıfırla
        setSmartTiming(false);
        setSmartTimerStartedAt(null);
        setSmartElapsedTime(0);
        if (smartTimerIntervalRef.current) clearInterval(smartTimerIntervalRef.current);
        setShowAbortDialog(false);
        setSmartAbortVisible(false);
        setNeedsCubeReset(true);
    }

    function handleSmartAbortDiscard() {
        // Timer'ı sıfırla, submit yapma (redo gibi)
        setSmartTiming(false);
        setSmartTimerStartedAt(null);
        setSmartElapsedTime(0);
        setSmartFinalTime(0);
        setSmartStats(null);
        setSmartScrambleCompletedAt(null);
        if (smartTimerIntervalRef.current) clearInterval(smartTimerIntervalRef.current);
        // Turn processing'i sıfırla - yeniden scramble yapabilsin
        sessionStartRef.current = smartTurns.length;
        processedTurnsRef.current = smartTurns.length;
        scrambleTurnCountRef.current = 0;
        cubejsRef.current = new Cube();
        setShowAbortDialog(false);
        setSmartAbortVisible(false);
        setNeedsCubeReset(true);
    }

    function handleSmartAbortContinue() {
        setShowAbortDialog(false);
        setSmartAbortVisible(false);
        setAbortResetCount(c => c + 1);
    }

    function handleSmartResetCubeState() {
        setNeedsCubeReset(false);
        sessionStartRef.current = smartTurns.length;
        processedTurnsRef.current = smartTurns.length;
        scrambleTurnCountRef.current = 0;
        cubejsRef.current = new Cube();
    }

    // Check if user already solved this round
    const alreadySolvedThisRound = (() => {
        if (!room || !me) return false;
        const myParticipant = room.participants.find((p) => p.user_id === me.id);
        if (!myParticipant) return false;
        return myParticipant.solves.some((s) => s.scramble_index === room.scramble_index);
    })();

    // When new round starts (alreadySolvedThisRound becomes false), focus on input
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

    // NOTE: Smart cube auto-submit REMOVED - user must manually click SAVE in review screen
    // This allows user to choose DNF, +2, or CANCEL before saving

    // Smart cube: Reset submit flag on new scramble or scramble index change
    // Also reset on scramble_index to handle spectator mode changes
    useEffect(() => {
        smartCubeSolveSubmittedRef.current = false;
    }, [room?.current_scramble, room?.scramble_index]);

    if (loading) {
        return (
            <div className="flex h-[100dvh] w-full items-center justify-center bg-background text-text">
                <div className="text-lg font-medium animate-pulse">{t('rooms.room_loading')}</div>
            </div>
        );
    }

    if (needsPassword) {
        return (
            <div className="flex h-[100dvh] w-full flex-col items-center justify-center bg-background p-4 text-text">
                <PasswordModal
                    onSubmit={handlePasswordSubmit}
                    onCancel={() => history.push('/rooms')}
                />
            </div>
        );
    }

    if (takenOver) {
        return (
            <div className="flex h-[100dvh] w-full flex-col items-center justify-center bg-background p-4 text-text">
                <SessionTakeoverModal onConfirm={() => history.push('/rooms')} />
            </div>
        );
    }

    if (alreadyInRoom) {
        const currentRoomId = alreadyInRoom.id;
        return (
            <div className="flex h-[100dvh] w-full flex-col items-center justify-center bg-background p-4 text-text">
                <AlreadyInOtherRoomModal
                    currentRoomName={alreadyInRoom.name}
                    onGoToCurrentRoom={() => {
                        // State'i hemen temizle, navigasyondan sonra yeni JOIN tetiklenecek
                        setAlreadyInRoom(null);
                        setLoading(true);
                        history.push(`/rooms/${currentRoomId}`);
                    }}
                    onCancel={() => {
                        setAlreadyInRoom(null);
                        history.push('/rooms');
                    }}
                />
            </div>
        );
    }

    if (error || !room) {
        return (
            <div className="flex h-[100dvh] w-full flex-col items-center justify-center bg-background text-text p-4 text-center">
                <div className="text-red-400 mb-4 text-lg">
                    {error || t('rooms.room_not_found')}
                </div>
                <Button onClick={() => history.push('/rooms')}>{t('rooms.back_to_rooms')}</Button>
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

    const formatStat = (val: number | null) => val !== null ? (val / 1000).toFixed(timerDecimalPoints ?? 2) : '-';

    return (
        <div className="fixed inset-0 z-[100] md:fixed md:inset-0 md:top-[var(--nav-h)] md:h-[calc(100vh-var(--nav-h))] flex flex-col bg-background text-text overflow-hidden font-sans pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
            {/* 1. Header & Scramble (Fixed) */}
            <div className="shrink-0 flex flex-col">
                {/* Top Bar - Native App Header Style (mobile blue, desktop dark glassmorphism — distinct tone from scramble area + clear border) */}
                <div className="flex items-center justify-between bg-blue-600 md:bg-text/[0.04] md:backdrop-blur-2xl md:border-b md:border-text/[0.15] px-3 md:px-4 py-2 md:py-3 shadow-lg md:shadow-[0_6px_24px_rgba(0,0,0,0.35)] z-30 relative gap-2">
                    {/* Hamburger Menu (Only for Host) — glassmorphism */}
                    {isHost ? (
                        <div className="relative z-50 shrink-0" ref={hostMenuRef}>
                            <button
                                className={`p-1.5 md:p-2 rounded-lg transition-all border ${
                                    hostMenuOpen
                                        ? 'bg-white/15 border-white/20 md:bg-text/15 md:border-text/20'
                                        : 'bg-white/5 border-white/10 hover:bg-white/15 hover:border-white/20 md:bg-text/5 md:border-text/10 md:hover:bg-text/15 md:hover:border-text/20'
                                } text-white md:text-text`}
                                onClick={() => setHostMenuOpen(!hostMenuOpen)}
                            >
                                <List size={20} weight="bold" />
                            </button>

                            {/* Dropdown Menu — glassmorphism */}
                            {hostMenuOpen && (
                                <div
                                    className="absolute top-full left-0 mt-2 w-60 rounded-xl border border-text/[0.12] shadow-[0_20px_50px_rgba(0,0,0,0.6)] z-50 overflow-hidden"
                                    style={{
                                        background: 'rgba(var(--background-color), 0.92)',
                                        backdropFilter: 'blur(20px) saturate(180%)',
                                        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
                                        animation: 'host-menu-in 0.18s cubic-bezier(0.16, 1, 0.3, 1)',
                                    }}
                                >
                                    <div className="py-1.5 px-1.5">
                                        <button
                                            onClick={() => {
                                                setEditModalOpen(true);
                                                setHostMenuOpen(false);
                                            }}
                                            className="w-full text-left px-3 py-2.5 rounded-lg text-sm text-text hover:bg-text/[0.08] hover:text-text flex items-center gap-3 transition-colors"
                                        >
                                            <PencilSimple size={18} weight="bold" />
                                            {t('rooms.edit_room')}
                                        </button>
                                        <button
                                            onClick={() => {
                                                setManageUsersModalOpen(true);
                                                setHostMenuOpen(false);
                                            }}
                                            className="w-full text-left px-3 py-2.5 rounded-lg text-sm text-text hover:bg-text/[0.08] hover:text-text flex items-center gap-3 transition-colors"
                                        >
                                            <Users size={18} weight="bold" />
                                            {t('rooms.manage_users')}
                                        </button>
                                        <div className="h-px bg-text/[0.1] my-1.5 mx-1" />
                                        <button
                                            onClick={handleDeleteRoom}
                                            className="w-full text-left px-3 py-2.5 rounded-lg text-sm text-red-400 hover:bg-red-500/15 hover:text-red-300 flex items-center gap-3 transition-colors"
                                        >
                                            <Trash size={18} weight="bold" />
                                            {t('rooms.delete_room')}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : null}

                    <div className="flex items-center gap-2 md:gap-3 flex-1 min-w-0 overflow-hidden">
                        <div className="flex items-center gap-2 min-w-0 overflow-hidden">
                            <h1 className="text-lg md:text-xl font-bold tracking-tight text-white md:text-text m-0 leading-none truncate block">
                                {room.name}
                            </h1>
                            {isHost && (
                                isMobile ? (
                                    <button
                                        onClick={() => setEditModalOpen(true)}
                                        className="shrink-0 p-1 text-gray-300 hover:text-white transition-colors rounded-md hover:bg-white/10 focus:outline-none"
                                        title={t('rooms.edit_room')}
                                    >
                                        <PencilSimple size={18} weight="bold" />
                                    </button>
                                ) : (
                                    <EditRoomDropdown
                                        currentName={room.name}
                                        isPrivate={room.is_private}
                                        currentAllowedTypes={room.allowed_timer_types}
                                        cubeType={room.cube_type}
                                        open={editPopoverOpen}
                                        onOpenChange={setEditPopoverOpen}
                                        onSubmit={(name, isPrivate, password, allowedTypes, cubeType) => {
                                            getSocket().emit(FriendlyRoomClientEvent.UPDATE_ROOM, roomId, {
                                                name,
                                                is_private: isPrivate,
                                                password,
                                                allowed_timer_types: allowedTypes,
                                                cube_type: cubeType,
                                            });
                                        }}
                                    />
                                )
                            )}
                        </div>
                        <span
                            onClick={() => {
                                if (!isHost) return;
                                // Desktop opens the same edit popover as the pencil; mobile uses the modal
                                if (isMobile) setEditModalOpen(true);
                                else setEditPopoverOpen(true);
                            }}
                            className={`shrink-0 rounded-md px-2.5 py-1 text-[11px] font-bold tracking-wider text-white md:text-primary bg-white/20 md:bg-primary/12 border border-white/10 md:border-primary/25 backdrop-blur-sm transition-all ${isHost ? 'cursor-pointer hover:bg-white/30 md:hover:bg-primary/20' : ''}`}
                            title={isHost ? t('rooms.click_to_change_event') : undefined}
                        >
                            {room.cube_type.toUpperCase()}
                        </span>

                        {/* Spectator/Competing Mode Toggle */}
                        {isActive && myParticipant && (
                            <button
                                onClick={() => getSocket().emit(FriendlyRoomClientEvent.TOGGLE_SPECTATOR, roomId)}
                                className={`shrink-0 ml-1 md:ml-2 px-2 md:px-3 py-1 text-xs font-bold rounded-full transition-all shadow-sm ${myParticipant.is_spectator
                                    ? 'bg-red-500 hover:bg-red-600 text-white'
                                    : 'bg-green-500 hover:bg-green-600 text-white'
                                    }`}
                            >
                                <span className="hidden md:inline">{myParticipant.is_spectator ? t('rooms.spectator') : t('rooms.compete')}</span>
                                <span className="md:hidden">{myParticipant.is_spectator ? t('rooms.spectator') : t('rooms.compete')}</span>
                            </button>
                        )}
                    </div>
                    <div className="flex items-center gap-1 md:gap-2 shrink-0">
                        {/* Timer Type Picker (desktop only, mobile uses modal Timer tab) */}
                        <TimerTypePicker
                            allowedTimerTypes={room.allowed_timer_types}
                            requireProForSmart
                        />

                        {/* Bluetooth Connect Button for GAN Timer — glassmorphism */}
                        {timerType === 'gantimer' && (
                            <button
                                onClick={ganTimerConnected ? disconnectGanTimer : handleConnectGanTimer}
                                disabled={ganTimerConnecting}
                                className={connectButtonClass(ganTimerConnected, ganTimerConnecting)}
                                title={ganTimerConnected ? t('rooms.disconnect') : t('rooms.connect_timer')}
                            >
                                {ganTimerConnected ? (
                                    <BluetoothConnected size={16} weight="bold" />
                                ) : (
                                    <Bluetooth size={16} weight="bold" />
                                )}
                                <span className="hidden md:inline">{ganTimerConnecting ? t('rooms.connecting') : ganTimerConnected ? t('rooms.timer_connected') : t('rooms.connect_timer')}</span>
                            </button>
                        )}

                        {/* Bluetooth Connect Button for QiYi Timer — glassmorphism */}
                        {timerType === 'qiyitimer' && (
                            <button
                                onClick={qiyiTimerConnected ? disconnectQiyiTimer : handleConnectQiyiTimer}
                                disabled={qiyiTimerConnecting}
                                className={connectButtonClass(qiyiTimerConnected, qiyiTimerConnecting)}
                                title={qiyiTimerConnected ? t('rooms.disconnect') : t('rooms.connect_qiyi_timer')}
                            >
                                {qiyiTimerConnected ? (
                                    <BluetoothConnected size={16} weight="bold" />
                                ) : (
                                    <Bluetooth size={16} weight="bold" />
                                )}
                                <span className="hidden md:inline">{qiyiTimerConnecting ? t('rooms.connecting') : qiyiTimerConnected ? t('rooms.qiyi_timer_connected') : t('rooms.connect_qiyi_timer')}</span>
                            </button>
                        )}

                        {/* Bluetooth Connect Button for Smart Cube — glassmorphism */}
                        {timerType === 'smart' && (
                            <button
                                onClick={smartCubeConnected ? disconnectSmartCube : handleConnectSmartCube}
                                disabled={smartCubeConnecting}
                                className={connectButtonClass(smartCubeConnected, smartCubeConnecting)}
                                title={smartCubeConnected ? t('rooms.disconnect') : t('rooms.connect_smart_cube')}
                            >
                                {smartCubeConnected ? (
                                    <BluetoothConnected size={16} weight="bold" />
                                ) : (
                                    <Bluetooth size={16} weight="bold" />
                                )}
                                <span className="hidden md:inline">{smartCubeConnecting ? t('rooms.connecting') : smartCubeConnected ? t('rooms.cube_connected') : t('rooms.connect_cube')}</span>
                            </button>
                        )}
                        {/* Mobile: gear button kaldirildi — sol drawer ile degistirildi (asagida mount).
                            Desktop: SettingsDropdown inline ayni kalir. */}
                        {!isMobile && (
                            <SettingsDropdown
                                hideMobileModules
                                hideSmartCubeFeatures
                                hideSlamStop
                                hideGoals
                            />
                        )}
                        <button
                            onClick={() => {
                                if (isPro(me)) {
                                    setMusicPlayerOpen(!musicPlayerOpen);
                                } else {
                                    openProOnlyModal(dispatch, t, 'room_music');
                                }
                            }}
                            className={`p-1.5 md:p-2 rounded-lg transition-all border ${
                                musicPlayerOpen
                                    ? 'bg-green-500/20 border-green-400/40 text-green-300 md:text-green-400'
                                    : 'bg-white/10 border-white/15 hover:bg-white/20 hover:border-white/25 md:bg-text/[0.08] md:border-text/[0.12] md:hover:bg-text/[0.15] md:hover:border-text/[0.25] text-white md:text-text hover:text-white md:hover:text-text'
                            }`}
                            title={t('rooms.music_player')}
                        >
                            <MusicNote weight="bold" size={18} />
                        </button>

                        {isHost && isActive && (
                            <button
                                onClick={handleNextScramble}
                                className={`${isMobile ? 'h-8 px-2.5 text-[10px]' : 'px-3.5 py-1.5 text-xs'} bg-blue-500 hover:bg-blue-400 text-white font-bold rounded-md transition-all whitespace-nowrap shadow-[0_4px_14px_rgba(59,130,246,0.4)] hover:shadow-[0_6px_18px_rgba(59,130,246,0.55)] hover:-translate-y-px`}
                                title={t('rooms.next_scramble_tooltip')}
                            >
                                {isMobile ? t('rooms.scramble') : t('rooms.new_scramble')}
                            </button>
                        )}

                        <button
                            onClick={handleLeaveRoom}
                            className={`${isMobile ? 'h-8 px-2.5 text-[10px]' : 'px-3.5 py-1.5 text-xs'} bg-red-500/85 hover:bg-red-500 text-white font-bold rounded-md transition-all shadow-[0_4px_12px_rgba(239,68,68,0.35)] hover:shadow-[0_6px_18px_rgba(239,68,68,0.5)] hover:-translate-y-px border border-red-400/30`}
                        >
                            {t('rooms.exit')}
                        </button>
                    </div>
                </div>

                {/* Mobile Tabs - Only show on lg and below */}
                {isActive && isMobile && (
                    <div className="flex border-b border-text/[0.1] bg-background">
                        <button
                            className={`flex-1 py-3 text-sm font-medium transition-colors relative ${mobileTab === 'timer' ? 'text-blue-400' : 'text-text hover:text-text'
                                }`}
                            onClick={() => setMobileTab('timer')}
                        >
                            {t('rooms.timer_tab')}
                            {mobileTab === 'timer' && (
                                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                            )}
                        </button>
                        <button
                            className={`flex-1 py-3 text-sm font-medium transition-colors relative ${mobileTab === 'chat' ? 'text-blue-400' : 'text-text hover:text-text'
                                }`}
                            onClick={() => setMobileTab('chat')}
                        >
                            {t('rooms.chat_tab')}
                            {mobileTab === 'chat' && (
                                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                            )}
                        </button>
                    </div>
                )}

                {/* Scramble Area */}
                {isActive && (
                    <div className="flex items-center flex-col justify-center bg-module py-4 px-4 border-b border-text/[0.05]">
                        {/* Scramble Display - colored for smart cube */}
                        <div className="text-center font-mono text-base md:text-3xl leading-relaxed font-medium select-all px-1">
                            {alreadySolvedThisRound ? (
                                <span className="text-text animate-pulse">{t('rooms.waiting_for_others')}</span>
                            ) : needsCubeReset && timerType === 'smart' && smartCubeConnected ? (
                                <div className="flex flex-col items-center gap-3 py-2">
                                    <span className="text-orange-400 font-bold text-lg md:text-2xl">{t('smart_cube.cube_mismatch_message')}</span>
                                    <button
                                        onClick={handleSmartResetCubeState}
                                        className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-bold rounded-lg transition-colors"
                                    >
                                        {t('smart_cube.reset_cube_state')}
                                    </button>
                                </div>
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
                                                <span className="text-green-500 text-4xl md:text-6xl font-black tracking-[0.2em]">{t('rooms.ready')}</span>
                                                <span className="text-green-500/50 text-xs md:text-sm font-bold tracking-widest mt-1">{t('rooms.start_solving')}</span>
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
                                                    {t('rooms.solve_cube_to_start')}
                                                </span>
                                            );
                                        }

                                        // Show correction moves
                                        const correctionMoves = reverseScramble(failedMoves);
                                        return (
                                            <div className="flex flex-col items-center gap-1">
                                                <span className="text-text text-xs uppercase tracking-wider">{t('rooms.correction')}:</span>
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
                                        let colorClass = 'text-text'; // default

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
                                <span className="text-text">{room.current_scramble}</span>
                            )}
                        </div>

                        {/* Manual Entry Section - always visible when manual mode */}
                        {isManualMode && (
                            <div className="mt-4 flex flex-col items-center gap-2 w-full max-w-md">
                                {manualInspecting ? (
                                    // Show inspection timer inline
                                    <div
                                        className={`w-full px-4 py-3 text-4xl md:text-5xl font-mono text-center rounded-lg bg-module border-2 ${manualInspectionTime < 0 ? 'border-red-500 text-red-500' :
                                            manualInspectionTime < 3000 ? 'border-orange-500 text-orange-500' :
                                                'border-red-500 text-red-400'
                                            }`}
                                    >
                                        {manualInspectionTime < -2000 ? 'DNF' :
                                            manualInspectionTime < 0 ? '+2' :
                                                (manualInspectionTime / 1000).toFixed(timerDecimalPoints ?? 2)}
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
                                                className={`flex-1 min-w-0 px-4 py-3 text-2xl md:text-3xl font-mono text-center rounded-lg bg-module border-2 ${manualTimeError && manualTimeInput
                                                    ? 'border-red-500 focus:border-red-400'
                                                    : 'border-text/[0.2] focus:border-blue-500'
                                                    } text-text placeholder-text/40 outline-none transition-colors appearance-none`}
                                                placeholder={alreadySolvedThisRound ? t('rooms.saved') : "1234"}
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
                                                        const inspDelayMs = (inspectionDelay ?? 15) * 1000;
                                                        setManualInspectionTime(inspDelayMs);
                                                        manualInspectionStartRef.current = performance.now();
                                                        manualInspectionRef.current = setInterval(() => {
                                                            if (manualInspectionStartRef.current) {
                                                                const elapsed = performance.now() - manualInspectionStartRef.current;
                                                                const remaining = inspDelayMs - elapsed;
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
                                                className="shrink-0 w-[56px] flex items-center justify-center bg-blue-600 active:bg-blue-700 disabled:bg-gray-800 disabled:text-text text-white rounded-lg transition-colors"
                                            >
                                                <Check size={28} weight="bold" />
                                            </button>
                                        </form>

                                        {/* Penalties Checkboxes */}
                                        {!alreadySolvedThisRound && (
                                            <div className="flex items-center gap-6 mt-4 justify-center">
                                                <label className="flex items-center gap-2 cursor-pointer group text-text hover:text-white transition-colors">
                                                    <div className={`w-6 h-6 rounded flex items-center justify-center border-2 transition-colors ${penalties.AUF ? 'bg-amber-500 border-amber-500' : 'border-gray-600 group-hover:border-gray-400'}`}>
                                                        {penalties.AUF && <Check size={16} weight="bold" className="text-white" />}
                                                    </div>
                                                    <span className={`font-bold text-lg select-none ${penalties.AUF ? 'text-white' : ''}`}>AUF</span>
                                                    <input type="checkbox" className="hidden" checked={penalties.AUF} onChange={() => setPenalties(p => ({ ...p, AUF: !p.AUF }))} />
                                                </label>

                                                <label className="flex items-center gap-2 cursor-pointer group text-text hover:text-white transition-colors">
                                                    <div className={`w-6 h-6 rounded flex items-center justify-center border-2 transition-colors ${penalties.DNF ? 'bg-rose-500 border-rose-500' : 'border-gray-600 group-hover:border-gray-400'}`}>
                                                        {penalties.DNF && <Check size={16} weight="bold" className="text-white" />}
                                                    </div>
                                                    <span className={`font-bold text-lg select-none ${penalties.DNF ? 'text-white' : ''}`}>DNF</span>
                                                    <input type="checkbox" className="hidden" checked={penalties.DNF} onChange={() => setPenalties(p => ({ ...p, DNF: !p.DNF }))} />
                                                </label>

                                                <label className="flex items-center gap-2 cursor-pointer group text-text hover:text-white transition-colors">
                                                    <div className={`w-6 h-6 rounded flex items-center justify-center border-2 transition-colors ${penalties.inspection ? 'bg-amber-500 border-amber-500' : 'border-gray-600 group-hover:border-gray-400'}`}>
                                                        {penalties.inspection && <Check size={16} weight="bold" className="text-white" />}
                                                    </div>
                                                    <span className={`font-bold text-lg select-none ${penalties.inspection ? 'text-white' : ''}`}>{t('rooms.inspection')}</span>
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
                            flex-col bg-background
                            ${!isMobile
                                ? 'flex relative w-[60%] border-r border-text/[0.1]'
                                : `absolute inset-0 ${mobileTab === 'timer' ? 'flex z-10' : 'hidden'}`
                            }
                            transition-opacity duration-200
                        `}>

                            {/* Table Container - takes all remaining space */}
                            <div
                                className={`flex-1 h-full w-full overflow-hidden bg-background ${
                                    isMobile && timerType === 'keyboard' && !isManualMode ? 'timer-touch-area' : ''
                                }`}
                                style={isMobile && timerType === 'keyboard' && !isManualMode ? {
                                    WebkitUserSelect: 'none',
                                    userSelect: 'none' as any,
                                    WebkitTouchCallout: 'none',
                                } : undefined}
                            >
                                <RoomTable
                                    participants={room.participants}
                                    scrambleIndex={room.scramble_index}
                                    userStatuses={userStatuses}
                                    currentUserId={me?.id}
                                    scrambleHistory={room.scramble_history}
                                />
                            </div>

                            {/* Mobile Timer Touch Area - Fixed at bottom of Timer Tab */}
                            {isMobile && timerType === 'keyboard' && !isManualMode && (
                                <div className="timer-touch-area shrink-0 h-32 w-full bg-background border-t border-text/[0.1] flex flex-col items-center justify-center select-none touch-none cursor-pointer active:bg-module transition-colors relative z-20"
                                     style={{ WebkitTouchCallout: 'none' }}>
                                    <span className="text-6xl font-mono font-medium text-text tracking-tight">
                                        {(() => {
                                            const myParticipant = room.participants.find(p => p.user_id === me?.id);
                                            const dpVal = timerDecimalPoints ?? 2;
                                            if (!myParticipant || myParticipant.solves.length === 0) return (0).toFixed(dpVal);

                                            // Find last solve (highest scramble index)
                                            const lastSolve = myParticipant.solves.reduce((prev, current) =>
                                                (prev.scramble_index > current.scramble_index) ? prev : current
                                            );

                                            // Format time
                                            if (lastSolve.dnf) return 'DNF';
                                            const time = lastSolve.plus_two ? lastSolve.time + 2 : lastSolve.time;
                                            return time.toFixed(dpVal);
                                        })()}
                                    </span>
                                </div>
                            )}

                        </div>

                        {/* Chat Layout - Center (30% on desktop) */}
                        <div className={`
                            flex-col bg-background
                            ${!isMobile
                                ? 'flex relative w-[30%] border-r border-text/[0.1]'
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
                    <div className="flex h-full w-full flex-col bg-background overflow-y-auto overflow-x-hidden">

                        {/* Waiting Room Header */}
                        <div className="shrink-0 text-center mt-6 md:mt-12 mb-6 md:mb-12 space-y-3 px-4">
                            <h2 className="text-2xl md:text-4xl font-bold text-text tracking-tight">
                                {t('rooms.waiting_for_players')}
                            </h2>
                            <p className="text-text text-sm md:text-base">
                                {isHost
                                    ? t('rooms.host_start_instruction')
                                    : t('rooms.guest_wait_instruction')}
                            </p>
                        </div>

                        {/* Content Grid */}
                        <div className="flex-1 flex flex-col md:flex-row items-center md:items-start justify-center gap-6 md:gap-8 px-4 md:px-8 max-w-7xl mx-auto w-full pb-8">

                            {/* Left: Participants */}
                            <div className="w-full max-w-md md:max-w-none md:flex-1 h-[300px] md:h-[500px] bg-background rounded-2xl border border-text/[0.1] overflow-hidden flex flex-col shadow-2xl relative group">
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
                                                {t('rooms.start_room')}
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
                                        <span className="text-text text-sm font-medium tracking-wider">{t('rooms.waiting_for_host')}</span>
                                    </div>
                                )}
                            </div>

                            {/* Right: Chat */}
                            <div className="w-full max-w-md md:max-w-none md:flex-1 h-[300px] md:h-[500px] bg-background rounded-2xl border border-text/[0.1] overflow-hidden flex flex-col shadow-2xl relative group">
                                <RoomChat roomId={roomId} />
                                <div className="absolute inset-0 border-2 border-transparent group-hover:border-blue-500/20 rounded-2xl pointer-events-none transition-colors" />
                            </div>

                        </div>
                    </div>
                )}
            </div>

            {/* 3. Bottom Panel (Stats & Preview) - Fixed Sticky */}
            {isActive && mobileTab === 'timer' && (
                <div className="shrink-0 bg-module border-t border-text/[0.1] p-2 pb-safe z-20 shadow-[0_-4px_20px_rgba(0,0,0,0.3)] w-full">
                    <div className="flex items-center justify-between w-full px-2 md:px-6">
                        {/* Compact Stats */}
                        <div className="flex flex-col gap-1 text-xs md:text-sm">
                            <div className="grid grid-cols-[50px_repeat(3,minmax(40px,1fr))] gap-x-2 gap-y-1 items-center">
                                <span className="text-text font-semibold text-[10px] uppercase tracking-wider"></span>
                                <span className="text-blue-400 font-bold text-center text-[10px] uppercase tracking-wider">{t('rooms.single')}</span>
                                <span className="text-blue-400 font-bold text-center text-[10px] uppercase tracking-wider">{t('rooms.ao5')}</span>
                                <span className="text-blue-400 font-bold text-center text-[10px] uppercase tracking-wider">{t('rooms.ao12')}</span>

                                <span className="text-text font-medium text-left">{t('rooms.current')}</span>
                                <span className="text-text font-mono text-center">{formatStat(times.length > 0 ? times[times.length - 1] : null)}</span>
                                <span className="text-text font-mono text-center">{formatStat(ao5)}</span>
                                <span className="text-text font-mono text-center">{formatStat(ao12)}</span>

                                <span className="text-text font-medium text-left">{t('rooms.best')}</span>
                                <span className="text-text font-mono text-center">{formatStat(single)}</span>
                                <span className="text-text font-mono text-center">{formatStat(bestAo5)}</span>
                                <span className="text-text font-mono text-center">{formatStat(bestAo12)}</span>
                            </div>
                        </div>

                        {/* Cube Preview (Restored & Resized) */}
                        <div className="w-[110px] h-[80px] md:w-[140px] md:h-[100px] flex items-center justify-center bg-transparent ml-4 shrink-0">
                            <ScrambleVisual
                                scramble={room.current_scramble}
                                cubeType={room.cube_type}
                                width="100%"
                                compact
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Smart Cube Abort Solve Overlay */}
            {timerType === 'smart' && smartCubeConnected && ReactDOM.createPortal(
                <AbortSolveOverlay
                    showAbortButton={smartAbortVisible && smartTiming}
                    showDialog={showAbortDialog}
                    showMismatchBanner={false}
                    onAbortClick={handleSmartAbortClick}
                    onDnf={handleSmartAbortDnf}
                    onDiscard={handleSmartAbortDiscard}
                    onContinue={handleSmartAbortContinue}
                    onResetCubeState={handleSmartResetCubeState}
                />,
                document.body
            )}

            {/* Full-screen Timer Overlay */}
            <RoomTimerOverlay
                isActive={isActive}
                scramble={room.current_scramble}
                cubeType={room.cube_type}
                scrambleSubset={(room as any).scramble_subset ?? null}
                onSubmit={(t, p2, dnf) => {
                    handleSolveSubmit(t, p2, dnf);
                    setSmartReviewing(false);
                }}
                onRedo={() => {
                    handleSolveRedo();
                    // Full smart cube state reset for re-solve
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
                onOpenSettings={() => {/* no-op — gear → sol drawer'a tasindi */}}
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
                qiyiTimerRef={qiyiTimerRef}
                qiyiTimerConnected={qiyiTimerConnected}
            />

            {/* Mobile sol drawer — oda parametreleriyle. Desktop'ta SettingsDropdown inline. */}
            {isMobile && (
                <LeftSettingsDrawer
                    allowedTimerTypes={room.allowed_timer_types}
                    requireProForSmart
                    hideSmartCubeFeatures
                    hideMobileModules
                    hideSlamStop
                />
            )}
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
                roomId={roomId}
                participants={room.participants}
                onKick={(userId) => {
                    getSocket().emit(FriendlyRoomClientEvent.KICK_USER, roomId, userId);
                }}
                onBan={(userId) => {
                    getSocket().emit(FriendlyRoomClientEvent.BAN_USER, roomId, userId);
                }}
            />
            <RoomMusicPlayer
                isOpen={musicPlayerOpen}
                onClose={() => setMusicPlayerOpen(false)}
            />
        </div>
    );
}
