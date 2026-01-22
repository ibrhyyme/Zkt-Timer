import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useSettings } from '../../util/hooks/useSettings';
import { useDispatch, useSelector } from 'react-redux';
import { convertTimeStringToSeconds } from '../../util/time';
import { openModal } from '../../actions/general';
import { Bluetooth, Timer, Keyboard, X } from 'phosphor-react';
import Stackmat from '../../util/vendor/stackmat';
import { GanTimerConnection, GanTimerEvent, GanTimerState, connectGanTimer } from 'gan-web-bluetooth';
import BluetoothErrorMessage from '../timer/common/BluetoothErrorMessage';
import StackMatPicker from '../settings/stackmat_picker/StackMatPicker';
import './RoomTimerOverlay.scss';

// Timer phases
const STATUS = {
    RESTING: 'RESTING',
    WAITING: 'WAITING',
    PRIMING: 'PRIMING',
    INSPECTING: 'INSPECTING',
    INSPECTING_WAITING: 'INSPECTING_WAITING',
    INSPECTING_PRIMING: 'INSPECTING_PRIMING',
    TIMING: 'TIMING',
    SUBMITTING_DOWN: 'SUBMITTING_DOWN',
    SUBMITTING: 'SUBMITTING',
    MANUAL_INPUT: 'MANUAL_INPUT', // New status for manual entry
};

interface RoomTimerOverlayProps {
    isActive: boolean;
    scramble: string;
    cubeType: string;
    onSubmit: (time: number, plusTwo: boolean, dnf: boolean) => void;
    onRedo: () => void;
    onStatusChange: (status: string) => void;
    onOpenSettings: () => void;
    alreadySolvedThisRound: boolean;
    // Smart cube timer state (from FriendlyRoom)
    smartInspecting?: boolean;
    smartInspectionTime?: number;
    smartTiming?: boolean;
    smartElapsedTime?: number;
    smartReviewing?: boolean;
    smartFinalTime?: number;
    warning?: string;
}

// Module-scoped GAN Timer connection


export default function RoomTimerOverlay({
    isActive,
    scramble,
    cubeType,
    onSubmit,
    onRedo,
    onStatusChange,
    onOpenSettings,
    alreadySolvedThisRound,
    smartInspecting = false,
    smartInspectionTime = 15,
    smartTiming = false,
    smartElapsedTime = 0,
    smartReviewing = false,
    smartFinalTime = 0,
    warning,
}: RoomTimerOverlayProps) {
    const dispatch = useDispatch();

    const [status, setStatus] = useState(STATUS.RESTING);
    const [time, setTime] = useState(0); // milliseconds
    const [startedAt, setStartedAt] = useState<number | null>(null);
    const [penalties, setPenalties] = useState<{
        inspection?: boolean;
        inspectionDNF?: boolean;
        AUF?: boolean;
        DNF?: boolean;
    }>({});

    // Manual entry state
    const [manualTimeInput, setManualTimeInput] = useState('');
    const [manualTimeError, setManualTimeError] = useState(false);
    const manualInputRef = useRef<HTMLInputElement>(null);

    // Device connection states
    const [ganTimerConnected, setGanTimerConnected] = useState(false);
    const [stackmatConnected, setStackmatConnected] = useState(false);
    const ganTimerRef = useRef<GanTimerConnection | null>(null);

    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const keyIsDown = useRef(false);
    const statusRef = useRef(status);
    const rootRef = useRef<HTMLDivElement>(null);
    const primingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const touchStartedRef = useRef(false);
    const touchStartX = useRef<number | null>(null);
    const touchStartY = useRef<number | null>(null);
    const stackmatRef = useRef<Stackmat | null>(null);
    const stackmatStarted = useRef(false);
    const holdStartTimeRef = useRef<number>(0);

    // Keep statusRef in sync and broadcast status changes
    useEffect(() => {
        statusRef.current = status;
        if (status !== STATUS.RESTING && status !== STATUS.MANUAL_INPUT) {
            onStatusChange(status);
        }
    }, [status, onStatusChange]);

    // Settings
    const timerType = useSettings('timer_type');
    const inspection = useSettings('inspection');
    const manualEntry = useSettings('manual_entry');
    const stackmatId = useSettings('stackmat_id');

    // Smart cube timer state from Redux
    const smartCubeTimeStartedAt = useSelector((state: any) => state.timer?.timeStartedAt || null);
    const smartCubeSolving = useSelector((state: any) => state.timer?.solving || false);
    const smartCubeInInspection = useSelector((state: any) => state.timer?.inInspection || false);
    const smartCubeInspectionTimer = useSelector((state: any) => state.timer?.inspectionTimer ?? 17);
    const smartCubeConnected = useSelector((state: any) => state.timer?.smartCubeConnected || false);

    // Smart cube requires inspection, manual entry shows input directly
    const effectiveInspection = timerType === 'smart' ? true : inspection;
    const isManualMode = manualEntry && timerType !== 'smart';

    // Clear timers on unmount
    useEffect(() => {
        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
            if (stackmatRef.current) {
                stackmatRef.current = null;
            }
        };
    }, []);

    // Reset on scramble change
    useEffect(() => {
        reset();
        // For manual entry, show input immediately when active
        if (isManualMode && isActive && !alreadySolvedThisRound) {
            setStatus(STATUS.MANUAL_INPUT);
        }
    }, [scramble, isManualMode, isActive, alreadySolvedThisRound]);

    // Reset penalties when entering smart review mode
    useEffect(() => {
        if (smartReviewing) {
            setPenalties({});
        }
    }, [smartReviewing]);

    // Initialize Stackmat with Retry Logic
    /* Stackmat initialization logic moved to connectStackmat below */

    // GAN Timer event handler
    const handleGanTimerEvent = useCallback((event: GanTimerEvent) => {
        switch (event.state) {
            case GanTimerState.HANDS_ON:
                if (statusRef.current === STATUS.RESTING) {
                    setStatus(STATUS.PRIMING);
                } else if (statusRef.current === STATUS.INSPECTING) {
                    setStatus(STATUS.INSPECTING_PRIMING);
                }
                break;
            case GanTimerState.HANDS_OFF:
                if (statusRef.current === STATUS.PRIMING) {
                    if (effectiveInspection) {
                        startInspection();
                    }
                } else if (statusRef.current === STATUS.INSPECTING_PRIMING) {
                    // Ready to start timing
                }
                break;
            case GanTimerState.GET_SET:
                // Ready state
                break;
            case GanTimerState.RUNNING:
                startTiming();
                break;
            case GanTimerState.STOPPED:
                setTime(event.recordedTime.asTimestamp);
                stopTimer();
                break;
            case GanTimerState.IDLE:
                if (!effectiveInspection || statusRef.current === STATUS.INSPECTING) {
                    // Timer ready
                } else if (statusRef.current === STATUS.RESTING) {
                    startInspection();
                }
                break;
            case GanTimerState.DISCONNECT:
                setGanTimerConnected(false);
                ganTimerRef.current = null;
                break;
        }
    }, [effectiveInspection]);

    // Subscribe to GAN Timer events
    useEffect(() => {
        if (timerType !== 'gantimer' || !isActive) return;

        const conn = ganTimerRef.current;
        const subscription = conn?.events$.subscribe(handleGanTimerEvent);
        setGanTimerConnected(!!conn);

        return () => subscription?.unsubscribe();
    }, [timerType, isActive, handleGanTimerEvent]);

    const now = () => performance.now();

    const isInspectingStatus = (s: string) => s.startsWith('INSPECTING');

    const startInspection = () => {
        // Force reset any stuck keys
        keyIsDown.current = false;

        setStatus(STATUS.INSPECTING);
        statusRef.current = STATUS.INSPECTING;
        setStartedAt(now());
        setTime(15000);
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => tickInspection(), 30);
    };

    const startTiming = () => {
        setStatus(STATUS.TIMING);
        statusRef.current = STATUS.TIMING;
        setStartedAt(now());
        setTime(0);
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => tickTiming(), 10);
    };

    const stopTimer = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        setStatus(STATUS.SUBMITTING);
    };

    const tickInspection = () => {
        // Handle Inspecting Priming logic via interval instead of timeout to avoid race conditions
        if (statusRef.current === STATUS.INSPECTING_WAITING && holdStartTimeRef.current > 0) {
            if (performance.now() - holdStartTimeRef.current >= 200) {
                setStatus(STATUS.INSPECTING_PRIMING);
                statusRef.current = STATUS.INSPECTING_PRIMING;
                if (navigator.vibrate) navigator.vibrate(50);
            }
        }

        setStartedAt((prevStarted) => {
            const s = statusRef.current;
            if (s !== STATUS.INSPECTING && s !== STATUS.INSPECTING_WAITING && s !== STATUS.INSPECTING_PRIMING) return prevStarted;
            if (!prevStarted) return prevStarted;

            const elapsed = now() - prevStarted;
            const remaining = 15000 - elapsed;
            setTime(remaining);

            if (remaining < -2000) {
                setPenalties((prev) => ({ ...prev, inspectionDNF: true }));
                setTimeout(() => {
                    if (timerRef.current) clearInterval(timerRef.current);
                    setStatus(STATUS.SUBMITTING);
                }, 1);
            } else if (remaining < 0) {
                setPenalties((prev) => ({ ...prev, inspection: true }));
            }

            return prevStarted;
        });
    };

    const tickTiming = () => {
        setStartedAt((prevStarted) => {
            if (!prevStarted) return prevStarted;
            const elapsed = now() - prevStarted;
            setTime(elapsed);
            return prevStarted;
        });
    };

    const reset = () => {
        setStatus(STATUS.RESTING);
        statusRef.current = STATUS.RESTING;
        setTime(0);
        setStartedAt(null);
        setPenalties({});
        setManualTimeInput('');
        setManualTimeError(false);
        keyIsDown.current = false;
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    };

    const getFinalTime = () => {
        let adjustedTime = time;
        if (penalties.inspection) adjustedTime += 2000;
        if (penalties.AUF) adjustedTime += 2000;
        return adjustedTime;
    };

    const submitTime = useCallback(() => {
        // Calculate time for submission (without AUF/PlusTwo penalty, but with Inspection penalty)
        let timeToSubmit = time;
        if (penalties.inspection) timeToSubmit += 2000;

        const finalTime = penalties.inspectionDNF ? 0 : timeToSubmit;
        const isDnf = penalties.DNF || penalties.inspectionDNF || false;
        const isPlusTwo = penalties.AUF || false;

        onSubmit(finalTime / 1000, isPlusTwo, isDnf);
        reset();
    }, [penalties, time, onSubmit]);

    const handleRedo = () => {
        reset();
        onRedo();
    };

    const flipPenalty = (penalty: string) => {
        setPenalties((prev) => ({ ...prev, [penalty]: !prev[penalty as keyof typeof prev] }));
    };

    const connectStackmat = useCallback(async () => {
        if (timerType !== 'stackmat' || !isActive) return;

        // Ensure stackmat instance exists
        if (!stackmatRef.current) {
            stackmatRef.current = new Stackmat();
        }

        try {
            await stackmatRef.current.init('', stackmatId || '', false, (timerState) => {
                const now = performance.now();

                // This callback runs on every signal packet
                if (timerState.running && !stackmatStarted.current && timerState.time_milli > 0) {
                    stackmatStarted.current = true;
                    startTiming();
                } else if (!timerState.running && stackmatStarted.current) {
                    stackmatStarted.current = false;
                    if (timerState.time_milli < 300) {
                        // Too short, probably noise or reset
                        reset();
                    } else {
                        setTime(timerState.time_milli);
                        stopTimer();
                    }
                }
            });

            setStackmatConnected(true);
        } catch (e) {
            console.error('Stackmat init error:', e);
            setStackmatConnected(false);
        }
    }, [timerType, isActive, stackmatId]);

    // Auto-connect attempts logic
    useEffect(() => {
        if (timerType === 'stackmat' && isActive && !stackmatConnected && stackmatId) {
            const timeout = setTimeout(() => {
                connectStackmat().catch(err => console.error("Auto connect failed", err));
            }, 500);
            return () => clearTimeout(timeout);
        }
    }, [timerType, isActive, stackmatId, connectStackmat, stackmatConnected]);

    // Keyboard/Touch timer controls
    const simulateSpaceDown = useCallback(() => {
        if (alreadySolvedThisRound) return;
        // Only block keyboard if device is actually connected
        if (timerType === 'stackmat' && stackmatConnected) return;
        if (timerType === 'gantimer' && ganTimerConnected) return;
        // Smart cube - block keyboard entirely ONLY if connected
        if (timerType === 'smart' && smartCubeConnected) return;
        if (keyIsDown.current) return;

        const currentStatus = statusRef.current;

        switch (currentStatus) {
            case STATUS.RESTING:
                setStatus(STATUS.WAITING);
                statusRef.current = STATUS.WAITING;

                // Wait for freeze time before turning green
                primingTimeoutRef.current = setTimeout(() => {
                    setStatus(STATUS.PRIMING);
                    statusRef.current = STATUS.PRIMING;
                    if (navigator.vibrate) navigator.vibrate(50);
                }, 200); // Standard freeze time (reduced to 200ms)
                break;

            case STATUS.INSPECTING:
                setStatus(STATUS.INSPECTING_WAITING);
                statusRef.current = STATUS.INSPECTING_WAITING;
                // Timeout removed! logic moved to tickInspection for reliability
                break;

            case STATUS.TIMING:
                if (timerRef.current) clearInterval(timerRef.current);
                setStatus(STATUS.SUBMITTING_DOWN);
                statusRef.current = STATUS.SUBMITTING_DOWN;
                break;
            case STATUS.MANUAL_INPUT:
                // For manual mode with inspection: start inspection
                if (effectiveInspection) {
                    setStatus(STATUS.PRIMING); // Instant start for inspection entry
                    statusRef.current = STATUS.PRIMING;
                }
                break;
            default:
                break;
        }

        holdStartTimeRef.current = performance.now();
        keyIsDown.current = true;
    }, [alreadySolvedThisRound, timerType, effectiveInspection, stackmatConnected, ganTimerConnected]);

    const simulateSpaceUp = useCallback(() => {
        if (alreadySolvedThisRound) return;
        // Only block keyboard if device is actually connected
        if (timerType === 'stackmat' && stackmatConnected) return;
        if (timerType === 'gantimer' && ganTimerConnected) return;
        // Smart cube - block keyboard entirely
        if (timerType === 'smart' && smartCubeConnected) return;

        keyIsDown.current = false;

        // Clear any pending priming timeout
        if (primingTimeoutRef.current) {
            clearTimeout(primingTimeoutRef.current);
            primingTimeoutRef.current = null;
        }

        const currentStatus = statusRef.current;

        switch (currentStatus) {
            case STATUS.WAITING:
                // Abort start
                setStatus(STATUS.RESTING);
                statusRef.current = STATUS.RESTING;
                break;

            case STATUS.INSPECTING_WAITING:
                // Check if we held long enough (in case statusRef didn't update yet)
                if (performance.now() - holdStartTimeRef.current >= 200) {
                    if (isManualMode) {
                        if (timerRef.current) clearInterval(timerRef.current);
                        setStatus(STATUS.MANUAL_INPUT);
                    } else {
                        startTiming();
                    }
                } else {
                    // Abort start
                    setStatus(STATUS.INSPECTING);
                    statusRef.current = STATUS.INSPECTING;
                }
                break;

            case STATUS.PRIMING:
                if (isManualMode) {
                    // For manual mode: start inspection, then return to manual input
                    if (effectiveInspection) {
                        startInspection();
                    }
                } else if (effectiveInspection) {
                    startInspection();
                } else {
                    startTiming();
                }
                break;
            case STATUS.INSPECTING_PRIMING:
                if (isManualMode) {
                    // For manual mode: stop inspection and show input
                    if (timerRef.current) clearInterval(timerRef.current);
                    setStatus(STATUS.MANUAL_INPUT);
                } else {
                    startTiming();
                }
                break;
            case STATUS.SUBMITTING_DOWN:
                setStatus(STATUS.SUBMITTING);
                statusRef.current = STATUS.SUBMITTING;
                break;
            default:
                break;
        }
    }, [alreadySolvedThisRound, timerType, effectiveInspection, isManualMode, stackmatConnected, ganTimerConnected]);

    // Keyboard handlers
    useEffect(() => {
        if (!isActive) return;

        const isTyping = () => {
            const activeEl = document.activeElement;
            return activeEl && (
                activeEl.tagName === 'INPUT' ||
                activeEl.tagName === 'TEXTAREA' ||
                (activeEl as HTMLElement).isContentEditable
            );
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            // Allow typing in manual input
            if (isTyping() && statusRef.current === STATUS.MANUAL_INPUT) {
                // Allow space to trigger inspection start
                if (e.keyCode === 32 && effectiveInspection && !alreadySolvedThisRound) {
                    e.preventDefault();
                    simulateSpaceDown();
                }
                return;
            }


            const currentStatus = statusRef.current; // Define this early

            // Escape to cancel - Check this FIRST to allow cancelling anytime
            if (e.key === 'Escape' || e.keyCode === 27) {
                e.preventDefault();

                if (currentStatus === STATUS.SUBMITTING) {
                    handleRedo();
                    return;
                }

                if (currentStatus === STATUS.TIMING || currentStatus === STATUS.INSPECTING || currentStatus === STATUS.PRIMING || currentStatus === STATUS.INSPECTING_PRIMING || currentStatus === STATUS.WAITING || currentStatus === STATUS.INSPECTING_WAITING) {
                    // Stop everything
                    if (timerRef.current) clearInterval(timerRef.current);
                    if (primingTimeoutRef.current) clearTimeout(primingTimeoutRef.current);
                    touchStartedRef.current = false;
                    keyIsDown.current = false;

                    reset();
                    if (isManualMode) setStatus(STATUS.MANUAL_INPUT);
                    return;
                }
            }

            if (alreadySolvedThisRound && !smartReviewing) return;
            // Prevent other keys if Prime holding (except Esc which we handled above)
            if (keyIsDown.current) return;

            // Smart Review Keyboard Support
            if (smartReviewing) {
                if (e.key === 'Enter' || e.keyCode === 13) { // Enter
                    e.preventDefault();
                    const sec = smartFinalTime / 1000;
                    const { inspection: inspPenalty, inspectionDNF, AUF, DNF } = penalties;
                    const isDNF = DNF || inspectionDNF;
                    onSubmit(sec, AUF || false, isDNF || false);
                    return;
                }
                return;
            }

            // Enter to submit
            if ((e.key === 'Enter' || e.keyCode === 13) && currentStatus === STATUS.SUBMITTING) {
                e.preventDefault();
                submitTime();
                return;
            }

            // Space
            if (e.key === ' ' || e.keyCode === 32) {
                e.preventDefault();
                e.stopPropagation();
                simulateSpaceDown();
            }
        };

        const handleKeyUp = (e: KeyboardEvent) => {
            if (isTyping() && statusRef.current === STATUS.MANUAL_INPUT) {
                if (e.keyCode === 32 && effectiveInspection) {
                    e.preventDefault();
                    simulateSpaceUp();
                }
                return;
            }

            if (alreadySolvedThisRound) return;

            if (e.keyCode === 32) {
                e.preventDefault();
                e.stopPropagation();
                simulateSpaceUp();
            }
        };

        // Touch event handlers
        const handleTouchStart = (e: TouchEvent) => {
            if ((e.target as HTMLElement).closest('button, input, label, textarea, a')) return;

            // Prevent default to avoid scrolling/zooming while interacting with timer
            if (e.cancelable) e.preventDefault();

            // ALWAYS record start position for slide-cancel logic
            touchStartX.current = e.touches[0].clientX;
            touchStartY.current = e.touches[0].clientY;
            touchStartedRef.current = true;

            const currentStatus = statusRef.current;

            if (currentStatus === STATUS.TIMING) {
                simulateSpaceDown();
                // We don't need to hold to stop
                return;
            }

            // Trigger holding immediately - space down logic handles the delay now
            simulateSpaceDown();
        };

        const handleTouchMove = (e: TouchEvent) => {
            if (touchStartX.current === null || touchStartY.current === null) return;

            // Only prevent scrolling if we are actively holding the timer (priming/inspecting)
            if (keyIsDown.current && e.cancelable) {
                e.preventDefault();
            }

            const x = e.touches[0].clientX;
            const y = e.touches[0].clientY;
            const diffX = Math.abs(x - touchStartX.current);
            const diffY = Math.abs(y - touchStartY.current);

            // Use 20px like KeyWatcher for consistency
            if (diffX > 20 || diffY > 20) {
                if (primingTimeoutRef.current) {
                    clearTimeout(primingTimeoutRef.current);
                    primingTimeoutRef.current = null;
                }

                // Cancel priming if active
                if (keyIsDown.current) {
                    keyIsDown.current = false;
                    // Revert status
                    if (statusRef.current === STATUS.PRIMING || statusRef.current === STATUS.WAITING) setStatus(STATUS.RESTING);
                    else if (statusRef.current === STATUS.INSPECTING_PRIMING || statusRef.current === STATUS.INSPECTING_WAITING) setStatus(STATUS.INSPECTING);
                    else if (statusRef.current === STATUS.SUBMITTING_DOWN) setStatus(STATUS.SUBMITTING);
                }

                touchStartedRef.current = false;
                touchStartX.current = null;
                touchStartY.current = null;
            }
        };

        const handleTouchEnd = (e: TouchEvent) => {
            if ((e.target as HTMLElement).closest('button, input, label, textarea, a')) return;

            if (keyIsDown.current) {
                simulateSpaceUp();
            }
            touchStartedRef.current = false;
            touchStartX.current = null;
            touchStartY.current = null;
        };

        const handleTouchCancel = (e: TouchEvent) => {
            if (primingTimeoutRef.current) {
                clearTimeout(primingTimeoutRef.current);
                primingTimeoutRef.current = null;
            }

            if (keyIsDown.current) {
                keyIsDown.current = false;
                // Revert status
                if (statusRef.current === STATUS.PRIMING || statusRef.current === STATUS.WAITING) setStatus(STATUS.RESTING);
                else if (statusRef.current === STATUS.INSPECTING_PRIMING || statusRef.current === STATUS.INSPECTING_WAITING) setStatus(STATUS.INSPECTING);
                else if (statusRef.current === STATUS.SUBMITTING_DOWN) setStatus(STATUS.SUBMITTING);
            }

            touchStartedRef.current = false;
            touchStartX.current = null;
            touchStartY.current = null;
        };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);

        // Use non-passive listeners for touch to allow preventDefault (prevents scrolling/scalling)
        document.addEventListener('touchstart', handleTouchStart, { passive: false });
        document.addEventListener('touchmove', handleTouchMove, { passive: false });
        document.addEventListener('touchend', handleTouchEnd, { passive: false });
        document.addEventListener('touchcancel', handleTouchCancel, { passive: false });

        const handleContextMenu = (e: Event) => {
            e.preventDefault();
            return false;
        };
        document.addEventListener('contextmenu', handleContextMenu);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            document.removeEventListener('touchstart', handleTouchStart);
            document.removeEventListener('touchmove', handleTouchMove);
            document.removeEventListener('touchend', handleTouchEnd);
            document.removeEventListener('touchcancel', handleTouchCancel);
            document.removeEventListener('contextmenu', handleContextMenu);
            if (primingTimeoutRef.current) {
                clearTimeout(primingTimeoutRef.current);
            }
        };
    }, [isActive, alreadySolvedThisRound, effectiveInspection, submitTime, simulateSpaceDown, simulateSpaceUp, isManualMode]);

    // Connect GAN Timer
    const connectGanTimerDevice = async () => {
        try {
            let bluetoothAvailable = false;

            if (navigator.bluetooth) {
                // Check if getAvailability exists
                if (typeof navigator.bluetooth.getAvailability === 'function') {
                    bluetoothAvailable = await navigator.bluetooth.getAvailability();
                } else {
                    // Assert true provided navigator.bluetooth exists
                    bluetoothAvailable = true;
                }
            }

            if (bluetoothAvailable) {
                const conn = await connectGanTimer();
                ganTimerRef.current = conn;

                conn.events$.subscribe((evt) => {
                    if (evt.state === GanTimerState.DISCONNECT) {
                        ganTimerRef.current = null;
                        setGanTimerConnected(false);
                    }
                });
                conn.events$.subscribe(handleGanTimerEvent);
                setGanTimerConnected(true);
            } else {
                dispatch(openModal(<BluetoothErrorMessage />));
            }
        } catch (e) {
            console.error('GAN Timer connection error:', e);
        }
    };

    const disconnectGanTimer = () => {
        ganTimerRef.current?.disconnect();
        ganTimerRef.current = null;
        setGanTimerConnected(false);
    };

    // Open Stackmat picker
    const openStackmatPicker = () => {
        dispatch(openModal(<StackMatPicker />));
    };

    // Format time for display
    const getTimerText = () => {
        if (isInspectingStatus(status)) {
            if (time < -2000) return 'DNF';
            if (time < 0) return '+2';
            // Show inspection time with decimals (00.00 format)
            return (time / 1000).toFixed(2);
        }
        return formatTime(time);
    };

    // Get timer color based on status
    const getTimerColor = () => {
        switch (status) {
            case STATUS.PRIMING:
            case STATUS.INSPECTING_PRIMING:
                return 'green';
            case STATUS.WAITING:
            case STATUS.INSPECTING_WAITING:
                return 'red'; // Red - Waiting for hold
            case STATUS.INSPECTING:
                if (time < 0) return 'red';
                if (time < 3000) return 'orange';
                return 'white';
            case STATUS.TIMING:
            case STATUS.SUBMITTING:
            case STATUS.SUBMITTING_DOWN:
                return 'white';
            default:
                return 'white';
        }
    };

    // Render submission screen
    const renderSubmitting = () => {
        const { inspection: inspPenalty, inspectionDNF, AUF, DNF } = penalties;
        const isDNF = DNF || inspectionDNF;

        const rawTime = formatTime(time);
        let penaltyString = '';
        if ((inspPenalty || AUF || isDNF) && !inspectionDNF) {
            const parts = [];
            if (inspPenalty) parts.push('2 +');
            parts.push(rawTime);
            if (AUF) parts.push('+ 2');
            parts.push('=');
            penaltyString = parts.join(' ') + ' ';
        }

        const finalTimeStr = isDNF ? 'DNF' : formatTime(getFinalTime());
        const displayTime = inspectionDNF ? 'DNF' : (penaltyString + finalTimeStr);
        const isCalculation = !!penaltyString && !inspectionDNF;

        return (
            <div className="room-timer-overlay__result">
                <div className={`room-timer-overlay__time room-timer-overlay__time--white ${isCalculation ? 'room-timer-overlay__time--calculation' : ''}`}>
                    {displayTime}
                </div>
                <div className="room-timer-overlay__penalties">
                    <label className="room-timer-overlay__checkbox">
                        <input
                            type="checkbox"
                            checked={AUF || false}
                            onChange={() => flipPenalty('AUF')}
                            disabled={inspectionDNF}
                        />
                        <span>+2</span>
                    </label>
                    <label className="room-timer-overlay__checkbox">
                        <input
                            type="checkbox"
                            checked={isDNF || false}
                            onChange={() => flipPenalty('DNF')}
                            disabled={inspectionDNF}
                        />
                        <span>DNF</span>
                    </label>
                    <button className="room-timer-overlay__btn" onClick={submitTime}>
                        KAYDET
                    </button>
                    <button className="room-timer-overlay__btn room-timer-overlay__btn--secondary" onClick={handleRedo}>
                        İPTAL
                    </button>
                </div>
                <p className="room-timer-overlay__hint">
                    Süreyi kaydetmek için Enter'a basın
                </p>
            </div>
        );
    };

    // Render smart cube review screen
    const renderSmartReviewing = () => {
        const { inspection: inspPenalty, inspectionDNF, AUF, DNF } = penalties;
        const isDNF = DNF || inspectionDNF;

        const rawTime = formatTime(smartFinalTime);
        let penaltyString = '';
        if ((inspPenalty || AUF || isDNF) && !inspectionDNF) {
            const parts = [];
            if (inspPenalty) parts.push('2 +');
            parts.push(rawTime);
            if (AUF) parts.push('+ 2');
            parts.push('=');
            penaltyString = parts.join(' ') + ' ';
        }

        let effectiveTime = smartFinalTime;
        if (AUF) effectiveTime += 2000;

        const finalTimeStr = isDNF ? 'DNF' : formatTime(effectiveTime);
        const displayTime = inspectionDNF ? 'DNF' : (penaltyString + finalTimeStr);
        const isCalculation = !!penaltyString && !inspectionDNF;

        const handleSmartSubmit = () => {
            const sec = smartFinalTime / 1000;
            onSubmit(sec, AUF || false, isDNF);
        };

        return (
            <div className="room-timer-overlay__result">
                <div className={`room-timer-overlay__time room-timer-overlay__time--white ${isCalculation ? 'room-timer-overlay__time--calculation' : ''}`}>
                    {displayTime}
                </div>
                {warning && (
                    <div className="room-timer-overlay__warning animate-pulse text-red-500 font-bold text-center mb-4 text-xl">
                        {warning}
                    </div>
                )}
                <div className="room-timer-overlay__penalties">
                    <label className="room-timer-overlay__checkbox">
                        <input
                            type="checkbox"
                            checked={AUF || false}
                            onChange={() => flipPenalty('AUF')}
                            disabled={inspectionDNF}
                        />
                        <span>+2</span>
                    </label>
                    <label className="room-timer-overlay__checkbox">
                        <input
                            type="checkbox"
                            checked={isDNF || false}
                            onChange={() => flipPenalty('DNF')}
                            disabled={inspectionDNF}
                        />
                        <span>DNF</span>
                    </label>
                    <button className="room-timer-overlay__btn" onClick={handleSmartSubmit} disabled={!!warning}>
                        KAYDET
                    </button>
                    <button className="room-timer-overlay__btn room-timer-overlay__btn--secondary" onClick={onRedo}>
                        İPTAL
                    </button>
                </div>
            </div>
        );
    };

    // Render timing screen
    const renderTiming = () => {
        return (
            <div className={`room-timer-overlay__time room-timer-overlay__time--${getTimerColor()}`}>
                {getTimerText()}
            </div>
        );
    };

    // Render manual entry screen
    const renderManualEntry = () => {
        const handleManualChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            const val = e.target.value;
            setManualTimeInput(val);

            try {
                const parsed = convertTimeStringToSeconds(val, false);
                setManualTimeError(parsed.timeSeconds <= 0 && !parsed.dnf);
            } catch {
                setManualTimeError(true);
            }
        };

        const handleManualSubmit = () => {
            if (manualTimeError || !manualTimeInput.trim()) return;

            try {
                const parsed = convertTimeStringToSeconds(manualTimeInput, false);
                onSubmit(parsed.timeSeconds, parsed.plusTwo, parsed.dnf);
                setManualTimeInput('');
                setManualTimeError(false);
                reset();
            } catch {
                setManualTimeError(true);
            }
        };

        const handleKeyPress = (e: React.KeyboardEvent) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleManualSubmit();
            }
        };

        return (
            <div className="room-timer-overlay__manual">
                <p className="room-timer-overlay__manual-label">Süreyi girin:</p>
                <input
                    ref={manualInputRef}
                    type="text"
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            e.stopPropagation();
                            handleManualSubmit();
                        }
                    }}
                    className={`room-timer-overlay__manual-input ${manualTimeError && manualTimeInput ? 'room-timer-overlay__manual-input--error' : ''}`}
                    value={manualTimeInput}
                    onChange={handleManualChange}
                    onKeyPress={handleKeyPress}
                    placeholder="1:23.45 veya DNF"
                    autoFocus
                />
                <p className="room-timer-overlay__manual-hint">
                    Formatlar: 12.34 | 1:23.45 | DNF | 12.34+2
                </p>
                {effectiveInspection && (
                    <p className="room-timer-overlay__manual-hint">
                        İnceleme için Space tuşunu basılı tutun
                    </p>
                )}
                <button
                    className="room-timer-overlay__btn"
                    onClick={handleManualSubmit}
                    disabled={manualTimeError || !manualTimeInput.trim()}
                >
                    KAYDET
                </button>
            </div>
        );
    };

    // Render device connection UI
    const renderDeviceConnect = () => {
        if (timerType === 'gantimer') {
            return (
                <div className="room-timer-overlay__device">
                    <div className="room-timer-overlay__device-icon">
                        <Timer size={48} weight={ganTimerConnected ? 'fill' : 'regular'} />
                    </div>
                    <h3>GAN Akıllı Timer</h3>
                    {ganTimerConnected ? (
                        <>
                            <p className="room-timer-overlay__device-status room-timer-overlay__device-status--connected">
                                <Bluetooth size={16} weight="fill" /> Bağlı
                            </p>
                            <button className="room-timer-overlay__btn room-timer-overlay__btn--secondary" onClick={disconnectGanTimer}>
                                Bağlantıyı Kes
                            </button>
                            <p className="room-timer-overlay__hint">
                                Timer'a ellerinizi koyarak başlayın
                            </p>
                        </>
                    ) : (
                        <>
                            <p className="room-timer-overlay__device-status">
                                Bağlı değil
                            </p>
                            <button className="room-timer-overlay__btn" onClick={connectGanTimerDevice}>
                                <Bluetooth size={18} /> Bağlan
                            </button>
                        </>
                    )}
                </div>
            );
        }

        if (timerType === 'stackmat') {
            return (
                <div className="room-timer-overlay__device">
                    <div className="room-timer-overlay__device-icon">
                        <Keyboard size={48} weight={stackmatConnected ? 'fill' : 'regular'} />
                    </div>
                    <h3>StackMat Timer</h3>
                    {stackmatConnected ? (
                        <>
                            <p className="room-timer-overlay__device-status room-timer-overlay__device-status--connected">
                                Bağlı
                            </p>
                            <p className="room-timer-overlay__hint">
                                StackMat timer'a ellerinizi koyarak başlayın
                            </p>
                        </>
                    ) : (
                        <>
                            <p className="room-timer-overlay__device-status">
                                {stackmatId ? 'Bağlanıyor...' : 'Yapılandırılmamış'}
                            </p>
                            {stackmatId && (
                                <button className="room-timer-overlay__btn room-timer-overlay__btn--primary" onClick={() => connectStackmat()} style={{ marginBottom: '0.5rem' }}>
                                    StackMat Bağlan
                                </button>
                            )}
                            <button className="room-timer-overlay__btn" onClick={openStackmatPicker}>
                                StackMat Ayarla
                            </button>
                        </>
                    )}
                </div>
            );
        }

        if (timerType === 'smart') {
            const isSupported = cubeType === '333';
            return (
                <div className="room-timer-overlay__device">
                    <div className="room-timer-overlay__device-icon">
                        <Bluetooth size={48} />
                    </div>
                    <h3>Akıllı Küp</h3>
                    {!isSupported ? (
                        <p className="room-timer-overlay__device-status room-timer-overlay__device-status--error">
                            Akıllı küp sadece 3x3x3 için destekleniyor
                        </p>
                    ) : (
                        <>
                            <p className="room-timer-overlay__device-status">
                                Şu an oda içinde desteklenmiyor
                            </p>
                            <p className="room-timer-overlay__hint">
                                Klavye veya manuel giriş kullanın
                            </p>
                        </>
                    )}
                </div>
            );
        }

        return null;
    };

    // Determine what to render
    const timerColor = getTimerColor();

    // NOTE: Device-based timers (stackmat, gantimer, smart) - when device is not connected,
    // we don't block the UI. User can still use keyboard. The device info is shown in settings.

    // NOTE: Manual entry is now handled inline in FriendlyRoom, not as overlay

    // Only show overlay for active timer states
    const activeTimerStatuses = [
        STATUS.WAITING,
        STATUS.PRIMING,
        STATUS.INSPECTING,
        STATUS.INSPECTING_WAITING,
        STATUS.INSPECTING_PRIMING,
        STATUS.TIMING,
        STATUS.SUBMITTING_DOWN,
        STATUS.SUBMITTING,
    ];

    // Don't render overlay unless we're in an active timer state AND timer has actually started
    // (time > 0 for TIMING, or explicitly in a priming/inspection state)
    // OR if smart cube is active (solving/inspecting/reviewing)
    const smartCubeShowOverlay = timerType === 'smart' && (smartInspecting || smartTiming || smartReviewing);

    const shouldShowOverlay = isActive && (
        (activeTimerStatuses.includes(status) &&
            (status !== STATUS.TIMING || time > 0 || startedAt !== null)) ||
        smartCubeShowOverlay
    );

    if (!shouldShowOverlay) {
        return null;
    }

    // Smart cube: show timer from props
    if (timerType === 'smart' && smartCubeShowOverlay) {
        return createPortal(
            <div className="room-timer-overlay room-timer-overlay--timing" ref={rootRef}>
                <div className="room-timer-overlay__content">
                    {smartReviewing ? renderSmartReviewing() : (
                        <div className="room-timer-overlay__timer-info">
                            {smartInspecting ? (
                                <div
                                    className={`room-timer-overlay__time ${smartInspectionTime <= 0 ? 'room-timer-overlay__time--red' :
                                        smartInspectionTime <= 3 ? 'room-timer-overlay__time--orange' :
                                            ''
                                        }`}
                                >
                                    {smartInspectionTime <= -2 ? 'DNF' :
                                        smartInspectionTime <= 0 ? '+2' :
                                            (smartInspectionTime).toFixed(2)}
                                </div>
                            ) : (
                                <div className="room-timer-overlay__time">
                                    {formatTime(smartElapsedTime)}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>,
            document.body
        );
    }


    return createPortal(
        <div
            className={`room-timer-overlay room-timer-overlay--${status.toLowerCase()}`}
            ref={rootRef}
        >
            <div className="room-timer-overlay__content">
                {status === STATUS.SUBMITTING ? renderSubmitting() : renderTiming()}
            </div>
        </div>,
        document.body
    );
}

// Helper function for time formatting
function formatTime(ms: number): string {
    if (ms < 0) ms = 0;

    const totalSeconds = ms / 1000;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    if (minutes > 0) {
        return `${minutes}:${seconds.toFixed(2).padStart(5, '0')}`;
    }

    return seconds.toFixed(2);
}


