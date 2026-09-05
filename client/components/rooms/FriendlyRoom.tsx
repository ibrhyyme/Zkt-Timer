import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
    EditFriendlyRoomSolveInput,
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
import EditSolveModal from './EditSolveModal';
import EditRoomDropdown from './EditRoomDropdown';
import ManageUsersModal from './ManageUsersModal';
import { FriendlyRoomRole, getFriendlyRoomRole, canManageRoom } from '../../../shared/friendly_room/roles';
import { looksLikeRoomId, roomPath } from '../../../shared/friendly_room/slug';
import { List, PencilSimple, Users, Trash, BluetoothConnected, Bluetooth, CheckCircle, CircleNotch, Check, MusicNote, Gear } from 'phosphor-react';
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
import BluetoothErrorMessage from '../timer/common/BluetoothErrorMessage';
import { isNative } from '../../util/platform';
import Connect from '../timer/smart_cube/bluetooth/connect';
import { setTimerParams } from '../timer/helpers/params';
import { SmartTurn } from '../../util/smart_scramble';
import { SmartSolveEngine, SmartEngineEvent } from '../../util/smart_cube';
import { recordEngineEvent } from '../../util/smart_cube/telemetry';
import SmartCubeView, { SmartCubeViewHandle } from '../timer/smart_cube/cube_view/SmartCubeView';
import NotificationLog, { NotificationItem } from './NotificationLog';
import AbortSolveOverlay from '../timer/smart_cube/abort_solve/AbortSolveOverlay';
import ReactDOM from 'react-dom';
import { isPro } from '../../lib/pro';
import { PRO_GATED_TIMER_TYPES } from '../timer/helpers/pro_timer_types';
import './FriendlyRoom.scss';

interface ParamsType {
    // The /rooms/<segment> URL carries a slug ("cuma-aksami-yarisi"), or a raw id for
    // rooms created before slugs shipped and for links shared back then.
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
    const { roomId: roomKey } = useParams<ParamsType>();
    const history = useHistory();
    const me = useMe();
    const userIsPro = isPro(me);
    const dispatch = useDispatch();

    // Slug -> id resolution. Every socket event below still speaks raw ids, so the URL
    // segment is translated exactly once and the rest of the component is unchanged.
    // An id URL needs no round-trip; a slug URL waits for ROOM_KEY_RESOLVED.
    const [resolved, setResolved] = useState<{ id: string; slug: string | null } | null>(
        () => (looksLikeRoomId(roomKey) ? { id: roomKey, slug: null } : null)
    );
    // A resolution is valid for both URL forms of the same room, so the canonical-URL
    // rewrite below does not invalidate it. A different room in the URL zeroes roomId
    // and re-triggers resolution.
    const roomId = resolved && (roomKey === resolved.id || roomKey === resolved.slug) ? resolved.id : '';

    const [room, setRoom] = useState<FriendlyRoomData | null>(null);
    // Mirror of `room` for socket handlers: the listener effect only re-binds on
    // [roomId, history, me], so reading `room` from its closure would give stale data.
    const roomRef = useRef<FriendlyRoomData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [needsPassword, setNeedsPassword] = useState(false);
    const [takenOver, setTakenOver] = useState(false);
    const [alreadyInRoom, setAlreadyInRoom] = useState<{ id: string; slug: string | null; name: string } | null>(null);
    const [editModalOpen, setEditModalOpen] = useState(false);
    // Desktop edit popover (EditRoomDropdown) open state — shared so the cube-type chip can open the same popover
    const [editPopoverOpen, setEditPopoverOpen] = useState(false);
    const [manageUsersModalOpen, setManageUsersModalOpen] = useState(false);
    const [userStatuses, setUserStatuses] = useState<{ [userId: string]: string }>({});
    const [mobileTab, setMobileTab] = useState<'timer' | 'chat'>('timer');
    const [notifications, setNotifications] = useState<NotificationItem[]>([]);

    // Solve the user is currently correcting (their own most recent one)
    const [editingSolve, setEditingSolve] = useState<FriendlyRoomSolveData | null>(null);

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
    const smartCubeMoveOrderFix = useSettings('smart_cube_move_order_fix');
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
    const reduxSmartCubeScanError = useSelector((state: any) => state.timer?.smartCubeScanError || null);
    // The cube's own report of its physical state. Rooms ignored this for years and
    // trusted the move stream alone, which is why a single dropped BLE packet left the
    // timer running forever.
    const reduxSmartCurrentState = useSelector((state: any) => state.timer?.smartCurrentState || null);
    const reduxSmartBatteryLevel = useSelector((state: any) => state.timer?.smartCubeBatteryLevel);
    const reduxSmartGyroSupported = useSelector((state: any) => state.timer?.smartGyroSupported || false);

    const [smartCubeConnecting, setSmartCubeConnecting] = useState(false);
    const smartConnectRef = useRef<Connect | null>(null);
    const smartCubeSolveSubmittedRef = useRef(false);
    // Native BLE has no OS-level device chooser: adapter.requestDevice() stays pending until
    // BleScanningModal calls selectScannedDevice. Without the picker a room scan just hangs
    // until the scan timeout, which is why the cube connected on the timer page but not here.
    const smartScanModalOpenRef = useRef(false);

    // Use Redux state for connected status and timer
    const smartCubeConnected = reduxSmartCubeConnected;
    const smartTurns = reduxSmartTurns as SmartTurn[];
    const smartCanStart = reduxSmartCanStart;
    const smartCubeTimeStartedAt = reduxTimeStartedAt;
    const smartCubeInInspection = reduxInInspection;
    const smartCubeSolving = reduxSolving;
    const smartCubeFinalTime = reduxFinalTime;

    const clearSmartBleParams = () => {
        setTimerParams({
            smartCubeScanning: false,
            smartCubeConnecting: false,
            smartCubeScanError: null,
            smartCubeConnectStep: null,
            smartScanDevices: [],
        });
    };

    const closeSmartScanModal = () => {
        if (!smartScanModalOpenRef.current) return;
        smartScanModalOpenRef.current = false;
        dispatch(closeModal());
    };

    const cancelSmartScan = () => {
        smartConnectRef.current?.cancelScan?.();
        closeSmartScanModal();
        clearSmartBleParams();
        setSmartCubeConnecting(false);
    };

    const retrySmartScan = () => {
        // alertScanning resets the picker's phase; failures come back through alertScanError.
        smartConnectRef.current?.connect()?.catch(() => { /* surfaced via alertScanError */ });
    };

    const handleConnectSmartCube = async () => {
        if (smartCubeConnecting || smartCubeConnected) return;
        setSmartCubeConnecting(true);

        // Assign before connecting: leaving the room mid-scan must be able to cancel it.
        const conn = new Connect();
        smartConnectRef.current = conn;

        if (isNative()) {
            // Wipe leftovers from an earlier session so the picker never opens on a stale error.
            clearSmartBleParams();
            smartScanModalOpenRef.current = true;
            dispatch(openModal(
                <BleScanningModal
                    mode="smartcube"
                    onCancel={cancelSmartScan}
                    onRetry={retrySmartScan}
                />,
                {
                    position: 'bottom',
                    hideCloseButton: true,
                    disableBackdropClick: true,
                }
            ));
        } else {
            const available = !!navigator.bluetooth && (await navigator.bluetooth.getAvailability());
            if (!available) {
                smartConnectRef.current = null;
                setSmartCubeConnecting(false);
                dispatch(openModal(<BluetoothErrorMessage />));
                return;
            }
        }

        // connect() swallows its own failures and reports them through the alert* callbacks
        // (which feed the picker), so this never rejects — the catch is only a safety net.
        try {
            await conn.connect();
        } catch (err) {
            console.error('Smart Cube connection failed:', err);
        }
        setSmartCubeConnecting(false);
    };

    const disconnectSmartCube = () => {
        // Cancel first: a scan may still be pending if the user never picked a cube.
        smartConnectRef.current?.cancelScan?.();
        closeSmartScanModal();

        if (smartConnectRef.current) {
            smartConnectRef.current.disconnect();
            smartConnectRef.current = null;
        }

        // Mirrors SmartCube.tsx disconnectBluetooth — without this the shared timer slice keeps
        // reporting a connected cube and the room's bluetooth button stays green.
        setTimerParams({
            smartCanStart: false,
            smartCubeConnected: false,
            smartCubeConnecting: false,
            smartCubeScanning: false,
            smartCubeScanError: null,
            smartCubeConnectStep: null,
            smartScanDevices: [],
            smartTurns: [],
            smartDeviceId: '',
            smartCurrentState: null,
            smartGyroSupported: false,
            smartOutOfSync: false,
        });
        setSmartCubeConnecting(false);
    };

    // Connection established — alertConnected already closed the picker, so only drop our handle.
    // Dispatching closeModal() again here would pop whatever modal the user opened next.
    useEffect(() => {
        if (smartCubeConnected) {
            smartScanModalOpenRef.current = false;
        }
    }, [smartCubeConnected]);

    // Surface wrong-MAC handshake failures on web (native shows the picker's error state instead).
    // Without this the cube would silently fail after the watchdog.
    useEffect(() => {
        if (reduxSmartCubeScanError === 'wrong_mac' && !isNative()) {
            toastError(t('smart_cube.wrong_mac_desc'));
            setTimerParams({
                smartCubeScanError: null,
                smartCubeScanning: false,
                smartCubeConnecting: false,
            });
            setSmartCubeConnecting(false);
        }
    }, [reduxSmartCubeScanError]);

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
    // Correction hint produced by the engine ("do D2 to get back on track").
    const [smartUndoMoves, setSmartUndoMoves] = useState<string[] | null>(null);
    const [smartOutOfSync, setSmartOutOfSync] = useState(false);
    // Per-move scramble match from the engine. Deriving it here from the raw turn stream
    // is what let the display disagree with the matcher that decides when a scramble ends.
    const [smartMatchStatus, setSmartMatchStatus] = useState<('perfect' | 'half' | 'wrong' | 'pending')[]>([]);
    const [smartCubeMenuOpen, setSmartCubeMenuOpen] = useState(false);
    const roomCubeViewRef = useRef<SmartCubeViewHandle>(null);

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

    // ── Smart cube engine ──
    // The same engine the timer page drives. Rooms used to carry a hand-copied snapshot
    // of the timer's rules that had drifted years behind: no facelets cross-check, no
    // safety nets, its own correction maths. Every difference between the two pages was
    // a bug users hit here and not there.
    const engineRef = useRef<SmartSolveEngine | null>(null);
    const engineEventRef = useRef<(event: SmartEngineEvent) => void>(() => { /* set below */ });

    if (!engineRef.current) {
        engineRef.current = new SmartSolveEngine(
            (event) => engineEventRef.current(event),
            { solvedState: reduxSmartSolvedState, moveOrderFix: smartCubeMoveOrderFix }
        );
    }

    // The timer page does the same. Kept in sync rather than baked in at construction so
    // toggling the setting takes effect without rebuilding the engine mid-session.
    useEffect(() => {
        engineRef.current?.setMoveOrderFix(smartCubeMoveOrderFix);
    }, [smartCubeMoveOrderFix]);

    // Assigned every render so the engine, which is created once, always reaches the
    // current closure instead of the one from first mount.
    engineEventRef.current = (event: SmartEngineEvent) => {
        // Field study: batched client-side, dropped server-side unless the site flag is on.
        recordEngineEvent(event, 'room');

        switch (event.type) {
            case 'SCRAMBLE_COMPLETE': {
                setSmartScrambleCompletedAt(new Date(event.at));
                setSmartUndoMoves(null);

                if (successAudioRef.current) {
                    successAudioRef.current.currentTime = 0;
                    successAudioRef.current.play().catch(e => console.warn('Audio play failed:', e));
                }

                if (inspection && !smartInspectionIntervalRef.current) {
                    const inspDelay = inspectionDelay ?? 15;
                    setSmartInspecting(true);
                    setSmartInspectionTime(inspDelay);
                    const inspectionStart = Date.now();
                    smartInspectionIntervalRef.current = setInterval(() => {
                        setSmartInspectionTime(inspDelay - (Date.now() - inspectionStart) / 1000);
                    }, 100);
                }
                break;
            }

            case 'UNDO_MOVES':
                setSmartUndoMoves(event.moves);
                break;

            case 'SCRAMBLE_PROGRESS':
                setSmartMatchStatus(event.matchStatus);
                break;

            case 'TIMER_START':
                if (smartInspectionIntervalRef.current) {
                    clearInterval(smartInspectionIntervalRef.current);
                    smartInspectionIntervalRef.current = null;
                }
                setSmartInspecting(false);
                setSmartScrambleCompletedAt(null);
                setSmartTiming(true);
                setSmartTimerStartedAt(event.startedAt);
                setSmartElapsedTime(0);
                break;

            case 'SOLVE_COMPLETE': {
                const { result } = event;
                setSmartTiming(false);
                setSmartTimerStartedAt(null);
                if (smartTimerIntervalRef.current) {
                    clearInterval(smartTimerIntervalRef.current);
                    smartTimerIntervalRef.current = null;
                }
                // timeMs is already corrected for BLE lag and stamped from the cube's own
                // clock, so a late detection no longer inflates the displayed time.
                setSmartFinalTime(result.timeMs);
                // HTM, same metric the timer page shows. Raw turn count read higher here and
                // made the same solve look faster in a room than on the timer.
                setSmartStats({ turns: result.htmCount, tps: result.tps });
                setSmartReviewing(true);
                if (needsCubeReset) setNeedsCubeReset(false);
                break;
            }

            case 'LATE_SCRAMBLE_MOVE':
                // The turn belongs to the scramble, not the solve. Clearing the stream lets
                // the engine rebuild its tracker from the scramble.
                setTimerParams({ smartTurns: [] });
                break;

            case 'OUT_OF_SYNC':
                setSmartOutOfSync(event.out);
                break;

            case 'TRACKER_RESYNCED':
                // The 3D view is driven by moves, so after a re-anchor it is showing a state
                // that never happened. Replay it to what the cube actually reports.
                roomCubeViewRef.current?.syncToFacelets(event.facelets);
                break;
        }
    };

    // ── Engine inputs ──
    // Each signal gets its own effect so a change in one does not replay the others.
    useEffect(() => {
        engineRef.current?.setScramble(room?.current_scramble || '');

        setSmartReviewing(false);
        setSmartFinalTime(0);
        setSmartStats(null);
        setSmartElapsedTime(0);
        setSmartInspecting(false);
        setSmartInspectionTime(inspectionDelay ?? 15);
        setSmartUndoMoves(null);

        if (smartInspectionIntervalRef.current) {
            clearInterval(smartInspectionIntervalRef.current);
            smartInspectionIntervalRef.current = null;
        }
        if (smartTimerIntervalRef.current) {
            clearInterval(smartTimerIntervalRef.current);
            smartTimerIntervalRef.current = null;
        }
    }, [room?.current_scramble]);

    useEffect(() => {
        engineRef.current?.setConnected(smartCubeConnected);
    }, [smartCubeConnected]);

    useEffect(() => {
        if (timerType !== 'smart') return;
        engineRef.current?.pushTurns(smartTurns);
    }, [smartTurns, timerType]);

    useEffect(() => {
        if (timerType !== 'smart' || !reduxSmartCurrentState) return;
        engineRef.current?.pushFacelets(reduxSmartCurrentState);
    }, [reduxSmartStateSeq, timerType]);

    useEffect(() => () => engineRef.current?.dispose(), []);

    // Review warning: the cube has to be solved before the next scramble can be tracked.
    useEffect(() => {
        setSmartWarning(
            smartReviewing && !reduxSmartPhysicallySolved
                ? t('rooms.solve_cube_for_scramble')
                : undefined
        );
    }, [smartReviewing, reduxSmartPhysicallySolved, t]);

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

    // Scramble-change reset lives in the engine input effect above; keeping a second copy
    // here raced with it (both cleared the same intervals from different render passes).

    // Smart cube solve submission effects are placed after alreadySolvedThisRound is declared

    // Throttled status update


    // Translate the URL segment into a room id (slug URLs only).
    useEffect(() => {
        if (roomId) return;
        if (!roomKey) return;

        const socket = getSocket();

        const onResolved = (payload: { key: string; room_id: string | null; slug: string | null }) => {
            if (payload.key !== roomKey) return;
            if (!payload.room_id) {
                setError(t('rooms.room_not_found'));
                setLoading(false);
                return;
            }
            setResolved({ id: payload.room_id, slug: payload.slug });
        };

        socket.on(FriendlyRoomServerEvent.ROOM_KEY_RESOLVED, onResolved);
        socket.emit(FriendlyRoomClientEvent.RESOLVE_ROOM_KEY, roomKey);

        return () => {
            socket.off(FriendlyRoomServerEvent.ROOM_KEY_RESOLVED, onResolved);
        };
    }, [roomKey, roomId, t]);

    // Learn the slug from room state — an id URL never went through RESOLVE_ROOM_KEY.
    // Must land before the rewrite below, otherwise the new URL would not match the
    // resolution and roomId would flicker back to empty.
    useEffect(() => {
        if (!room) return;
        setResolved((prev) => {
            // Late ROOM_DATA for a room we already navigated away from must not drag the
            // URL back to it.
            if (!prev || prev.id !== room.id) return prev;
            return prev.slug === room.slug ? prev : { id: room.id, slug: room.slug };
        });
    }, [room?.id, room?.slug]);

    // Rewrite an id URL to the canonical slug URL. Legacy rooms have no slug and keep
    // their id in the address bar.
    useEffect(() => {
        if (!resolved?.slug) return;
        if (roomKey === resolved.slug) return;
        history.replace(`/rooms/${resolved.slug}`);
    }, [resolved, roomKey, history]);

    // Reconnect flag: socket reconnect should do full ROOM_DATA hydration
    const isReconnectingRef = useRef(false);

    useEffect(() => {
        roomRef.current = room;
    }, [room]);

    // Solve edits are announced client-side (with t()) instead of via the server's
    // NOTIFICATION event, whose messages are hard-coded Turkish.
    function getParticipantUsername(userId: string): string {
        return roomRef.current?.participants.find((p) => p.user_id === userId)?.username ?? '';
    }

    function addRoomNotification(type: string, message: string) {
        setNotifications((prev) => [
            ...prev,
            {
                id: Math.random().toString(36).substr(2, 9),
                type,
                message,
                timestamp: Date.now(),
            },
        ]);
    }

    // Fetch room data
    useEffect(() => {
        // Slug URL: wait for resolution — the server rejects an empty room id anyway,
        // but JOIN_ROOM would surface it as a full-screen error.
        if (!roomId) return;

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
            setAlreadyInRoom({ id: data.current_room_id, slug: data.current_room_slug, name: data.current_room_name });
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

        socket.on(FriendlyRoomServerEvent.SOLVE_UPDATED, (data: { room_id: string; user_id: string; solve: any }) => {
            if (data.room_id !== roomId) return;

            setRoom((prev) => {
                if (!prev) return prev;
                return {
                    ...prev,
                    participants: prev.participants.map((p) => {
                        if (p.user_id !== data.user_id) return p;
                        return {
                            ...p,
                            solves: p.solves.map((s) => (s.id === data.solve.id ? { ...s, ...data.solve } : s)),
                        };
                    }),
                };
            });

            addRoomNotification('INFO', t('rooms.edit_solve.notification_edited', {
                username: getParticipantUsername(data.user_id),
            }));

            // A corrected DNF changes what counts toward daily goals + the activity heatmap.
            if (data.user_id === me?.id && getDailyGoalStorage().count_room_solves) {
                fetchRoomSolveCounts();
            }
        });

        socket.on(FriendlyRoomServerEvent.SOLVE_DELETED, (data: { room_id: string; user_id: string; solve_id: string }) => {
            if (data.room_id !== roomId) return;

            setRoom((prev) => {
                if (!prev) return prev;
                return {
                    ...prev,
                    participants: prev.participants.map((p) => {
                        if (p.user_id !== data.user_id) return p;
                        return {
                            ...p,
                            solves: p.solves.filter((s) => s.id !== data.solve_id),
                        };
                    }),
                };
            });

            addRoomNotification('INFO', t('rooms.edit_solve.notification_deleted', {
                username: getParticipantUsername(data.user_id),
            }));

            if (data.user_id === me?.id && getDailyGoalStorage().count_room_solves) {
                fetchRoomSolveCounts();
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

        // Handle moderator promotion / demotion
        socket.on(FriendlyRoomServerEvent.MODERATOR_CHANGED, (data: { room_id: string; user_id: string; is_moderator: boolean }) => {
            if (data.room_id === roomId) {
                setRoom((prev) => {
                    if (!prev) return prev;
                    return {
                        ...prev,
                        participants: prev.participants.map((p) =>
                            p.user_id === data.user_id ? { ...p, is_moderator: data.is_moderator } : p
                        ),
                    };
                });
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
            socket.off(FriendlyRoomServerEvent.SOLVE_UPDATED);
            socket.off(FriendlyRoomServerEvent.SOLVE_DELETED);
            socket.off(FriendlyRoomServerEvent.ROOM_STARTED);
            socket.off(FriendlyRoomServerEvent.ROOM_DELETED);
            socket.off(FriendlyRoomServerEvent.ADMIN_CHANGED);
            socket.off(FriendlyRoomServerEvent.USER_STATUS);
            socket.off(FriendlyRoomServerEvent.MODERATOR_CHANGED);
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
        if (!me || !roomId) return;

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

    function handleEditSolve(solveId: string, time: number, plusTwo: boolean, dnf: boolean) {
        if (!roomId) return;

        const input: EditFriendlyRoomSolveInput = {
            solve_id: solveId,
            time,
            dnf,
            plus_two: plusTwo,
        };

        getSocket().emit(FriendlyRoomClientEvent.EDIT_SOLVE, roomId, input);
    }

    function handleDeleteSolve(solveId: string) {
        if (!roomId) return;
        getSocket().emit(FriendlyRoomClientEvent.DELETE_SOLVE, roomId, solveId);
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
        // Abandon the attempt without committing; the engine rewinds to the scramble phase.
        engineRef.current?.abort();
        setSmartUndoMoves(null);
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
        // Re-anchor to the solved state: the user is telling us the cube is physically solved.
        engineRef.current?.markSolved();
        setSmartUndoMoves(null);
        setSmartOutOfSync(false);
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

    // The one solve the user is allowed to correct. The round auto-advances as soon as
    // everyone has solved, so this is the highest scramble_index they own — not
    // necessarily the room's current round.
    const myLastSolve = useMemo<FriendlyRoomSolveData | null>(() => {
        if (!room || !me) return null;
        const myParticipant = room.participants.find((p) => p.user_id === me.id);
        if (!myParticipant || myParticipant.solves.length === 0) return null;
        return myParticipant.solves.reduce((prev, current) =>
            prev.scramble_index > current.scramble_index ? prev : current
        );
    }, [room, me]);

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
        const currentRoomPath = roomPath(alreadyInRoom);
        return (
            <div className="flex h-[100dvh] w-full flex-col items-center justify-center bg-background p-4 text-text">
                <AlreadyInOtherRoomModal
                    currentRoomName={alreadyInRoom.name}
                    onGoToCurrentRoom={() => {
                        // State'i hemen temizle, navigasyondan sonra yeni JOIN tetiklenecek
                        setAlreadyInRoom(null);
                        setLoading(true);
                        history.push(currentRoomPath);
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

    const myParticipant = room.participants.find((p) => p.user_id === me?.id);
    const myRole = getFriendlyRoomRole(room.created_by.id, me?.id, myParticipant?.is_moderator);
    const isHost = myRole === FriendlyRoomRole.OWNER;
    // Owner and moderators share the room controls (edit, start, next scramble, manage
    // users). Deleting the room and assigning roles stay owner-only.
    const canManage = canManageRoom(myRole);
    const isActive = room.status === 'ACTIVE';

    // Calculate current user's stats for bottom panel
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
                    {/* Hamburger Menu (Host + moderators) — glassmorphism */}
                    {canManage ? (
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
                                        {isHost && (
                                            <>
                                                <div className="h-px bg-text/[0.1] my-1.5 mx-1" />
                                                <button
                                                    onClick={handleDeleteRoom}
                                                    className="w-full text-left px-3 py-2.5 rounded-lg text-sm text-red-400 hover:bg-red-500/15 hover:text-red-300 flex items-center gap-3 transition-colors"
                                                >
                                                    <Trash size={18} weight="bold" />
                                                    {t('rooms.delete_room')}
                                                </button>
                                            </>
                                        )}
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
                            {canManage && (
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
                                if (!canManage) return;
                                // Desktop opens the same edit popover as the pencil; mobile uses the modal
                                if (isMobile) setEditModalOpen(true);
                                else setEditPopoverOpen(true);
                            }}
                            className={`shrink-0 rounded-md px-2.5 py-1 text-[11px] font-bold tracking-wider text-white md:text-primary bg-white/20 md:bg-primary/12 border border-white/10 md:border-primary/25 backdrop-blur-sm transition-all ${canManage ? 'cursor-pointer hover:bg-white/30 md:hover:bg-primary/20' : ''}`}
                            title={canManage ? t('rooms.click_to_change_event') : undefined}
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

                        {canManage && isActive && (
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
                                    // Progress and correction both come from the engine, so the
                                    // display can never disagree with the matcher that decides
                                    // when the scramble is done. The old code ran its own
                                    // positional diff here, which is why a correction hint kept
                                    // repeating after the user had already performed it.
                                    const scrambleParts = room.current_scramble.split(' ');

                                    if (smartScrambleCompletedAt) {
                                        return (
                                            <div className="flex flex-col items-center justify-center py-4 animate-pulse">
                                                <span className="text-green-500 text-4xl md:text-6xl font-black tracking-[0.2em]">{t('rooms.ready')}</span>
                                                <span className="text-green-500/50 text-xs md:text-sm font-bold tracking-widest mt-1">{t('rooms.start_solving')}</span>
                                            </div>
                                        );
                                    }

                                    if (smartOutOfSync || (smartUndoMoves?.length === 1 && smartUndoMoves[0] === 'TOO_MANY')) {
                                        return (
                                            <span className="text-red-400 font-bold animate-pulse">
                                                {t('rooms.solve_cube_to_start')}
                                            </span>
                                        );
                                    }

                                    if (smartUndoMoves?.length) {
                                        return (
                                            <div className="flex flex-col items-center gap-1">
                                                <span className="text-text text-xs uppercase tracking-wider">{t('rooms.correction')}:</span>
                                                <div>
                                                    {smartUndoMoves.map((move, i) => (
                                                        <span key={"fix-" + move + "-" + i} className="text-red-400 font-bold">
                                                            {move}{' '}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    }

                                    return scrambleParts.map((turn, i) => {
                                        const status = smartMatchStatus[i];
                                        const colorClass =
                                            status === 'perfect' ? 'text-green-400'
                                                : status === 'half' ? 'text-orange-400'
                                                    : 'text-text';

                                        return (
                                            <span key={turn + "-" + i} className={colorClass}>
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

                                        {/* Saved this round: offer a correction instead of a dead end */}
                                        {alreadySolvedThisRound && myLastSolve && !isSpectator && (
                                            <button
                                                type="button"
                                                onClick={() => setEditingSolve(myLastSolve)}
                                                className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-module border border-text/[0.2] text-text font-bold text-sm hover:border-text/[0.4] transition-colors"
                                            >
                                                <PencilSimple size={16} weight="bold" />
                                                <span>{t('rooms.edit_solve.edit_last')}</span>
                                            </button>
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
                                    hostId={room.created_by.id}
                                    myLastSolveId={myLastSolve?.id}
                                    onEditSolve={setEditingSolve}
                                />
                            </div>

                            {/* Mobile Timer Touch Area - Fixed at bottom of Timer Tab */}
                            {isMobile && timerType === 'keyboard' && !isManualMode && (
                                <div className="timer-touch-area shrink-0 h-32 w-full bg-background border-t border-text/[0.1] flex flex-col items-center justify-center select-none touch-none cursor-pointer active:bg-module transition-colors relative z-20"
                                     style={{ WebkitTouchCallout: 'none' }}>
                                    <span className="text-6xl font-mono font-medium text-text tracking-tight">
                                        {(() => {
                                            const dpVal = timerDecimalPoints ?? 2;
                                            if (!myLastSolve) return (0).toFixed(dpVal);

                                            // Format time
                                            if (myLastSolve.dnf) return 'DNF';
                                            const time = myLastSolve.plus_two ? myLastSolve.time + 2 : myLastSolve.time;
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
                                {canManage
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
                                {canManage ? (
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

                        {/* Cube preview. With a smart cube connected the flat scramble drawing is
                            redundant — the physical cube is the source of truth — so the live 3D
                            view takes its place, same component the timer page uses. */}
                        <div
                            className={`w-[110px] md:w-[140px] flex flex-col items-center justify-center bg-transparent ml-4 shrink-0 ${
                                // The 3D view carries a battery/settings row under it, so a fixed
                                // height clipped it by ~8px. Let the column size itself here; the
                                // flat preview keeps the original fixed box.
                                timerType === 'smart' && smartCubeConnected
                                    ? 'min-h-[80px] md:min-h-[100px]'
                                    : 'h-[80px] md:h-[100px]'
                            }`}
                        >
                            {timerType === 'smart' && smartCubeConnected ? (
                                <>
                                    <SmartCubeView
                                        ref={roomCubeViewRef}
                                        connect={smartConnectRef.current}
                                        connected={smartCubeConnected}
                                        size={isMobile ? 68 : 88}
                                    />
                                    <div className="flex items-center gap-2 -mt-0.5">
                                        {typeof reduxSmartBatteryLevel === 'number' && (
                                            <span className="text-[10px] font-bold text-green-400">{reduxSmartBatteryLevel}%</span>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => setSmartCubeMenuOpen((v) => !v)}
                                            className="text-text/70 hover:text-text transition-colors"
                                            title={t('smart_cube.settings')}
                                        >
                                            <Gear size={14} weight="bold" />
                                        </button>
                                    </div>
                                    {smartCubeMenuOpen && (
                                        <div className="absolute bottom-16 right-4 z-20 flex flex-col items-stretch gap-1 p-2 rounded-lg bg-module border border-text/[0.1] min-w-[190px] shadow-lg">
                                            <button
                                                type="button"
                                                className="px-3 py-1.5 text-xs font-bold text-left rounded hover:bg-text/[0.06] transition-colors disabled:opacity-40"
                                                disabled={smartTiming}
                                                onClick={() => {
                                                    handleSmartResetCubeState();
                                                    setSmartCubeMenuOpen(false);
                                                }}
                                            >
                                                {t('smart_cube.mark_as_solved')}
                                            </button>
                                            {reduxSmartGyroSupported && (
                                                <button
                                                    type="button"
                                                    className="px-3 py-1.5 text-xs font-bold text-left rounded hover:bg-text/[0.06] transition-colors"
                                                    onClick={() => {
                                                        roomCubeViewRef.current?.resetGyro();
                                                        setSmartCubeMenuOpen(false);
                                                    }}
                                                >
                                                    {t('smart_cube.reset_gyro')}
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                className="px-3 py-1.5 text-xs font-bold text-left rounded hover:bg-text/[0.06] transition-colors disabled:opacity-40"
                                                disabled={smartTiming}
                                                onClick={() => {
                                                    disconnectSmartCube();
                                                    setSmartCubeMenuOpen(false);
                                                }}
                                            >
                                                {t('smart_cube.disconnect')}
                                            </button>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <ScrambleVisual
                                    scramble={room.current_scramble}
                                    cubeType={room.cube_type}
                                    width="100%"
                                    compact
                                />
                            )}
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
                    setSmartUndoMoves(null);
                    // Rewind the engine to the scramble phase so the round can be re-solved.
                    engineRef.current?.abort();
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
                ownerId={room.created_by.id}
                viewerId={me?.id ?? ''}
                viewerRole={myRole}
                onKick={(userId) => {
                    getSocket().emit(FriendlyRoomClientEvent.KICK_USER, roomId, userId);
                }}
                onBan={(userId) => {
                    getSocket().emit(FriendlyRoomClientEvent.BAN_USER, roomId, userId);
                }}
                onSetModerator={(userId, isModerator) => {
                    getSocket().emit(FriendlyRoomClientEvent.SET_MODERATOR, roomId, userId, isModerator);
                }}
                onTransferOwnership={(userId) => {
                    getSocket().emit(FriendlyRoomClientEvent.TRANSFER_OWNERSHIP, roomId, userId);
                }}
            />
            <RoomMusicPlayer
                isOpen={musicPlayerOpen}
                onClose={() => setMusicPlayerOpen(false)}
            />
            <EditSolveModal
                isOpen={editingSolve !== null}
                solve={editingSolve}
                scrambleHistory={room.scramble_history}
                onClose={() => setEditingSolve(null)}
                onSave={handleEditSolve}
                onDelete={handleDeleteSolve}
            />
        </div>
    );
}
