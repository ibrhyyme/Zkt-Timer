import React, { useContext, useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { useTranslation } from 'react-i18next';
import './SmartCube.scss';
import SmartStats from './stats/SmartStats';
import Emblem from '../../common/emblem/Emblem';
import Battery from './battery/Battery';
import Connect from './bluetooth/connect';
import { setTimerParams } from '../helpers/params';
import { Bluetooth, DotsThree } from 'phosphor-react';

import { openModal, closeModal } from '../../../actions/general';
import ManageSmartCubes from './manage_smart_cubes/ManageSmartCubes';
import Cube from 'cubejs';
import block from '../../../styles/bem';
import { initSmartSolver, computeCorrectionPathAsync, IncrementalCompressor, matchScrambleWithCommutative } from '../../../util/smart_scramble';
import { initSolverWorker } from '../../../util/solver_worker_manager';
import { TimerContext } from '../Timer';
import { useSettings } from '../../../util/hooks/useSettings';
import LiveAnalysisOverlay from './LiveAnalysisOverlay';
import { useGeneral } from '../../../util/hooks/useGeneral';
import { useDispatch } from 'react-redux';
import Dropdown from '../../common/inputs/dropdown/Dropdown';
import Button from '../../common/button/Button';
import { toastError } from '../../../util/toast';
import { endTimer, startTimer, startInspection, resetTimerParams } from '../helpers/events';
import { stopTimer, clearInspectionTimers, START_TIMEOUT } from '../helpers/timers';
import { resetScramble } from '../helpers/scramble';
import { saveSolve } from '../helpers/save';
import AbortSolveOverlay from './abort_solve/AbortSolveOverlay';
import BluetoothErrorMessage from '../common/BluetoothErrorMessage';
import BleScanningModal from './ble_scanning_modal/BleScanningModal';
import { isNative } from '../../../util/platform';
import { resourceUri } from '../../../util/storage';
import type { TwistyPlayer } from 'cubing/twisty';
import * as THREE from 'three';

const b = block('smart-cube');
const DEFAULT_SOLVED_STATE = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';

export default function SmartCube() {
	const { t } = useTranslation();
	const dispatch = useDispatch();
	const context = useContext(TimerContext);

	const containerRef = useRef<HTMLDivElement>(null);
	const twistyPlayerRef = useRef<TwistyPlayer | null>(null);

	// References for Gyro Logic
	const twistySceneRef = useRef<THREE.Scene | null>(null);
	const twistyVantageRef = useRef<any>(null);
	const gyroBasisRef = useRef<THREE.Quaternion | null>(null);
	const HOME_ORIENTATION = useRef(new THREE.Quaternion().setFromEuler(new THREE.Euler(15 * Math.PI / 180, -20 * Math.PI / 180, 0)));
	const cubeQuaternion = useRef(HOME_ORIENTATION.current.clone());
	const animFrameRef = useRef<number | null>(null);

	const cubejs = useRef(new Cube());
	const connect = useRef(new Connect());

	const [scrambleCompletedAt, setScrambleCompletedAt] = useState(null);
	const [domReady, setDomReady] = useState(false);
	useEffect(() => setDomReady(true), []);

	const [startState, setStartState] = useState<string>(null);
	const [inspectionTime, setInspectionTime] = useState(0);
	const [showAbortDialog, setShowAbortDialog] = useState(false);
	const [abortResetCount, setAbortResetCount] = useState(0);
	const [needsCubeReset, setNeedsCubeReset] = useState(false);
	const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const INACTIVITY_TIMEOUT_MS = 5000; // 5 seconds

	const useSpaceWithSmartCube = useSettings('use_space_with_smart_cube');
	const inspectionEnabled = useSettings('inspection');
	const timerType = useSettings('timer_type');
	const mobileMode = useGeneral('mobile_mode');

	let smartCubeSize = useSettings('smart_cube_size');
	if (mobileMode) {
		smartCubeSize = 240;
	}

	const {
		scramble,
		smartTurns,
		smartDeviceId,
		smartCubeScanning,
		smartCubeConnecting,
		smartCubeBatteryLevel,
		smartSolvedState,
		smartCubeConnected,
		timeStartedAt,
		smartGyroSupported,
		originalScramble,
		smartTurnOffset,
		lastSmartMoveTime,
		smartCurrentState,
		smartAbortVisible,
		smartStateSeq,
		smartPhysicallySolved,
	} = context;

	// Polling safety refs (avoid stale closures in setInterval)
	const needsCubeResetRef = useRef(needsCubeReset);
	needsCubeResetRef.current = needsCubeReset;
	const smartPhysicallySolvedRef = useRef(smartPhysicallySolved);
	smartPhysicallySolvedRef.current = smartPhysicallySolved;
	const lastSmartMoveTimeRef = useRef(lastSmartMoveTime);
	lastSmartMoveTimeRef.current = lastSmartMoveTime;
	const resetMovesRef = useRef<(markSolved?: boolean, isScrambleFinish?: boolean, endTimestamp?: number) => void>(null);

	useEffect(() => {
		initSmartSolver();   // Sync fallback init (requestIdleCallback)
		initSolverWorker();  // Worker init (background thread — no UI block)
	}, []);

	// Preservation ref to keep scrambled state when smartTurns is cleared
	const preservedScrambleRef = useRef<string | null>(null);

	const originalScrambleRef = useRef<string>(originalScramble || '');

	useEffect(() => {
		if (originalScramble) {
			originalScrambleRef.current = originalScramble;
		}
	}, [originalScramble]);

	useEffect(() => {
		if (scramble && !originalScrambleRef.current && (smartTurnOffset || 0) === 0) {
			originalScrambleRef.current = scramble;
			setTimerParams({ originalScramble: scramble });
		}
	}, [scramble]);

	const correctionDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const correctionGenRef = useRef(0);
	const compressorRef = useRef(new IncrementalCompressor());

	// Reset incremental state when scramble or offset changes (new correction applied)
	useEffect(() => {
		compressorRef.current.reset();
		validationCacheRef.current.lastValidatedLength = 0;
	}, [scramble, smartTurnOffset]);

	// Initialize TwistyPlayer
	useEffect(() => {
		if (!containerRef.current) return;

		// Clean up previous player
		containerRef.current.innerHTML = '';
		if (animFrameRef.current) {
			cancelAnimationFrame(animFrameRef.current);
		}

		let twisty: TwistyPlayer;
		let cancelled = false;

		const initTwisty = async () => {
			try {
				const { TwistyPlayer } = await import('cubing/twisty');
				if (cancelled) return;

				twisty = new TwistyPlayer({
					puzzle: '3x3x3',
					visualization: '3D',
					alg: '',
					experimentalSetupAnchor: 'start',
					background: 'none',
					controlPanel: 'none',
					hintFacelets: 'none',
					experimentalDragInput: 'none',
					cameraLatitude: 0,
					cameraLongitude: 0,
					cameraLatitudeLimit: 0,
					tempoScale: 100  // Maksimum hız - hızlı hamlelerde instant hareket
				});

				if (containerRef.current) {
					containerRef.current.appendChild(twisty);
					twisty.style.width = "100%";
					twisty.style.height = "100%";
					twistyPlayerRef.current = twisty;
				}

				// Start Animation Loop for Gyro
				const animate = async () => {
					if (cancelled) return;

					if (!twistySceneRef.current || !twistyVantageRef.current) {
						try {
							const vantageList = await (twisty as any).experimentalCurrentVantages();
							twistyVantageRef.current = [...vantageList][0];
							twistySceneRef.current = await twistyVantageRef.current.scene.scene();
						} catch (e) {
							// Scene not ready yet
						}
					}

					if (twistySceneRef.current && twistyVantageRef.current) {
						twistySceneRef.current.quaternion.slerp(cubeQuaternion.current, 0.25);
						twistyVantageRef.current.render();
					}

					animFrameRef.current = requestAnimationFrame(animate);
				};
				animate();

			} catch (error) {
				console.error("Failed to load TwistyPlayer:", error);
			}
		};

		initTwisty();

		return () => {
			cancelled = true;
			if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
			if (containerRef.current) containerRef.current.innerHTML = '';
		};
	}, [smartCubeSize]);

	// Apply turns to TwistyPlayer - WITHOUT Animation Await (Fire and Forget)
	const appliedTurnsRef = useRef<number>(0);
	// Validation cache to prevent duplicate checks
	const validationCacheRef = useRef({
		lastValidatedLength: 0,
		lastMatchedIndex: 0,
	});

	useEffect(() => {
		if (smartTurns.length > appliedTurnsRef.current && twistyPlayerRef.current) {

			// BATCH PROCESSING: Apply all new turns at once
			const newTurns = smartTurns.slice(appliedTurnsRef.current);

			newTurns.forEach(turnObj => {
				// Send to TwistyPlayer
				(twistyPlayerRef.current as any).experimentalAddMove(turnObj.turn, { cancel: false });

				// Sync Logical State
				cubejs.current.move(turnObj.turn);
			});

			appliedTurnsRef.current = smartTurns.length;

			// VALIDATION: Only call once after batch (not per move)
			checkForStartAfterTurnBatch(smartTurns);

			const isSolved = cubejs.current.asString() === smartSolvedState;
			// Yedek: cubejs yanlışsa (cascading gap) ama fiziksel küp çözüldüyse
			if (!useSpaceWithSmartCube && (isSolved || (smartPhysicallySolved && timeStartedAt)) && smartTurns.length) {
				// smartPhysicallySolved yolunda lastSmartMoveTime kullan (sessizlik gecikmesini çıkar)
				const endTs = (smartPhysicallySolved && !isSolved) ? (lastSmartMoveTime || undefined) : undefined;
				if (needsCubeReset) {
					// Post-abort: physical cube solved, reset and generate new scramble
					resetMoves(true, false, endTs);
					setNeedsCubeReset(false);
					resetScramble(context);
				} else {
					resetMoves(false, false, endTs);
				}
			}

			// Live Analysis Sync
			if (smartTurns.length === 0 && cubejs.current) {
				const current = cubejs.current.asString();
				setStartState(current);
			}
		} else if (smartTurns.length === 0 && appliedTurnsRef.current > 0) {
			// Reset detected
			cubejs.current = new Cube();

			if (preservedScrambleRef.current) {
				// Scramble finished, initialize to scrambled state
				// We DO NOT reset TwistyPlayer.alg here. We want to keep the visual state (orientation/rotations) as is.
				// The user just finished scrambling, so the visual state IS the scrambled state.

				// Cube.js move() expects single moves, so we must parse the scramble string
				const moves = preservedScrambleRef.current.split(' ').filter(m => m.trim());
				for (const move of moves) {
					cubejs.current.move(move);
				}
			} else {
				// Solve finished or manual reset, initialize to solved state
				if (twistyPlayerRef.current) {
					twistyPlayerRef.current.alg = '';
				}
			}

			appliedTurnsRef.current = 0;
			validationCacheRef.current.lastValidatedLength = 0;
			validationCacheRef.current.lastMatchedIndex = 0;
			compressorRef.current.reset();
			setStartState(cubejs.current.asString());
		}
	}, [smartTurns, smartSolvedState]);

	// FACELETS güvenlik ağı: fiziksel küp çözüldüyse timer durdur
	// cubejs'e DOKUNMAZ - sadece fiziksel durumu kontrol eder
	// BLE'den son hamle düşerse, 1.5s sessizlik sonrası FACELETS ile yakalanır
	useEffect(() => {
		if (timeStartedAt && smartTurns.length > 0) {
		}
		if (
			smartPhysicallySolved &&
			timeStartedAt &&
			smartTurns.length > 0 &&
			!useSpaceWithSmartCube
		) {
			if (needsCubeReset) {
				resetMoves(true, false, lastSmartMoveTime || undefined);
				setNeedsCubeReset(false);
				resetScramble(context);
			} else {
				resetMoves(false, false, lastSmartMoveTime || undefined);
			}
		}
	}, [smartStateSeq, timeStartedAt]);

	// Polling safety: check every 1s if physical cube is solved (bypasses React dependency issues)
	useEffect(() => {
		if (!timeStartedAt || useSpaceWithSmartCube) return;

		const interval = setInterval(() => {
			if (smartPhysicallySolvedRef.current) {
				if (needsCubeResetRef.current) {
					resetMovesRef.current?.(true, false, lastSmartMoveTimeRef.current || undefined);
				} else {
					resetMovesRef.current?.(false, false, lastSmartMoveTimeRef.current || undefined);
				}
			}
		}, 1000);

		return () => clearInterval(interval);
	}, [timeStartedAt, useSpaceWithSmartCube]);

	// Direct Gyro Subscription (Bylassing Redux)
	useEffect(() => {
		if (!connect.current || !connect.current.activeCube) return;

		const activeCube = connect.current.activeCube as any;

		// If the active cube supports direct subscription (added in gan.js)
		if (activeCube && typeof activeCube.subscribeGyro === 'function') {
			const unsubscribe = activeCube.subscribeGyro((event: any) => {
				if (event.type === 'GYRO' && event.quaternion) {
					const { x: qx, y: qy, z: qz, w: qw } = event.quaternion;
					const quat = new THREE.Quaternion(qx, qz, -qy, qw).normalize();

					if (!gyroBasisRef.current) {
						gyroBasisRef.current = quat.clone().conjugate();
					}

					cubeQuaternion.current.copy(quat.premultiply(gyroBasisRef.current).premultiply(HOME_ORIENTATION.current));
				}
			});

			return () => {
				unsubscribe();
			};
		}
	}, [smartCubeConnected]); // Re-subscribe if connection changes

	useEffect(() => {
		return () => {
			connect.current.disconnect();
			if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
		};
	}, []);

	// Bluetooth disconnect on timer change
	const prevTimerTypeRef = useRef<string | null>(null);
	useEffect(() => {
		if (prevTimerTypeRef.current === 'smart' && timerType !== 'smart') {
			disconnectBluetooth();
		}
		prevTimerTypeRef.current = timerType;
	}, [timerType]);

	// Inactivity detection: show abort button after 10s of no moves during solve.
	// Uses setTimeout + smartTurns.length dependency. Each new move resets the timer.
	// abortResetCount triggers a re-schedule after user dismisses the abort dialog.
	useEffect(() => {
		// Clear existing timer
		if (inactivityTimerRef.current) {
			clearTimeout(inactivityTimerRef.current);
			inactivityTimerRef.current = null;
		}

		// Reset abort UI when solve ends or space mode is on
		if (!timeStartedAt || useSpaceWithSmartCube) {
			if (smartAbortVisible) {
				setTimerParams({ smartAbortVisible: false });
			}
			setShowAbortDialog(false);
			return;
		}

		// Hide abort button when a new move is detected (user resumed activity)
		if (smartAbortVisible) {
			setTimerParams({ smartAbortVisible: false });
		}

		// Schedule abort button to appear after INACTIVITY_TIMEOUT_MS
		inactivityTimerRef.current = setTimeout(() => {
			setTimerParams({ smartAbortVisible: true });
		}, INACTIVITY_TIMEOUT_MS);

		return () => {
			if (inactivityTimerRef.current) {
				clearTimeout(inactivityTimerRef.current);
			}
		};
	}, [timeStartedAt, useSpaceWithSmartCube, smartTurns.length, abortResetCount]);

	// Audio ref
	const audioThrottleRef = useRef(false);

	// Batch validation wrapper with cache
	function checkForStartAfterTurnBatch(currentTurns: any[]) {
		// Skip if scrambling hasn't started
		if (!scramble || timeStartedAt) return;

		// CACHE CHECK: Skip if no new moves since last validation
		if (currentTurns.length === validationCacheRef.current.lastValidatedLength) {
			return;
		}

		// Perform validation (existing logic)
		checkForStartAfterTurn(currentTurns);

		// Update cache
		validationCacheRef.current.lastValidatedLength = currentTurns.length;
	}

	function checkForStartAfterTurn(currentTurns: any[]) {
		if (useSpaceWithSmartCube || smartCubeConnecting) return;

		if (scrambleCompletedAt) {
			startTimer();
			let it = (new Date().getTime() - scrambleCompletedAt.getTime()) / 1000;
			it = Math.floor(it * 100) / 100;

			setScrambleCompletedAt(null);
			setInspectionTime(it);
			setTimerParams({ smartCanStart: false });
			return;
		}

		if (!currentTurns.length || timeStartedAt || !scramble) return;

		const offset = smartTurnOffset || 0;
		const relevantTurns = offset > 0 ? currentTurns.slice(offset) : currentTurns;

		// Use incremental compressor — only processes new turns
		const userMoves = compressorRef.current.processNew(relevantTurns);
		const expectedMoves = scramble.split(' ').filter(m => m.trim());
		const { matched, matchStatus } = matchScrambleWithCommutative(expectedMoves, userMoves);

		if (matched) {
			setScrambleCompletedAt(new Date());
			setTimerParams({ smartCanStart: true });

			if (!audioThrottleRef.current) {
				audioThrottleRef.current = true;
				setTimeout(() => { audioThrottleRef.current = false; }, 2000);
				try {
					const audio = new Audio(resourceUri('audio/success.mp3'));
					audio.volume = 1.0;
					audio.play().catch(e => console.warn('Audio play failed:', e));
				} catch (err) {
					console.error('Audio init error:', err);
				}
			}

			resetMoves(false, true);
			if (inspectionEnabled) {
				startInspection(context);
			}
		} else if (matchStatus.includes('wrong')) {
			triggerSmartCorrection();
		}
	}

	function triggerSmartCorrection() {
		if (correctionDebounceRef.current) clearTimeout(correctionDebounceRef.current);
		if (!originalScrambleRef.current && scramble) originalScrambleRef.current = scramble;

		const gen = ++correctionGenRef.current;

		// Debounce 250ms to prevent lag during fast scrambling (15-20 TPS bursts)
		correctionDebounceRef.current = setTimeout(async () => {
			const scrambleToUse = originalScrambleRef.current;
			if (!scrambleToUse) return;

			const allRawUserMoves = smartTurns.map(t => t.turn);

			// Async: runs Cube.solve() in Web Worker — no main thread blocking
			const correctionMoves = await computeCorrectionPathAsync(scrambleToUse, allRawUserMoves);

			// Discard stale result if a newer correction was triggered
			if (gen !== correctionGenRef.current) return;

			if (correctionMoves.length === 0) {
				setTimerParams({ smartCanStart: true });
				setScrambleCompletedAt(new Date());
				resetMoves(false, true);
				return;
			}

			const newScramble = correctionMoves.join(' ');

			if (newScramble !== scramble) {
				setTimerParams({
					scramble: newScramble,
					smartTurnOffset: smartTurns.length,
					originalScramble: scrambleToUse,
				});
			}
		}, 250);
	}

	function resetMoves(markSolved: boolean = false, isScrambleFinish: boolean = false, endTimestamp?: number) {
		const isSolveEnd = !!timeStartedAt;
		if (isSolveEnd) {
			// endTimestamp: Safety net'ten geliyorsa son hamle zamanını kullan (sessizlik gecikmesini çıkar)
			const finalTimeMilli = endTimestamp && timeStartedAt
				? endTimestamp - timeStartedAt.getTime()
				: null;
			endTimer(context, finalTimeMilli, {
				inspection_time: inspectionTime,
				smart_device_id: smartDeviceId,
				is_smart_cube: true,
				smart_turn_count: smartTurns.length,
				smart_turns: JSON.stringify(smartTurns),
			});
		}

		if (isSolveEnd) originalScrambleRef.current = '';

		// If this reset is because we finished scrambling, preserve the scramble alg
		if (isScrambleFinish) {
			// CRITICAL FIX: Use the ORIGINAL scramble (target state), not the current transient 'scramble'
			// (which might be just a short correction path).
			preservedScrambleRef.current = originalScrambleRef.current || scramble;
		} else {
			preservedScrambleRef.current = null;
		}

		setTimerParams({
			smartSolvedState: markSolved ? DEFAULT_SOLVED_STATE : smartSolvedState,
			smartTurns: [],
			smartPickUpTime: 0,
			lastSmartMoveTime: 0,
			smartTurnOffset: 0,
			...(isSolveEnd ? { originalScramble: '' } : {}),
		});

		// Reset Gyro Basis
		gyroBasisRef.current = null;

		// Note: Visual cube and CubeJS reset is handled in the useEffect detecting smartTurns change
	}

	// Update resetMoves ref every render (for polling interval)
	resetMovesRef.current = resetMoves;

	// Abort solve handlers
	function handleAbortClick() {
		setShowAbortDialog(true);
	}

	function handleAbortDnf() {
		if (!timeStartedAt) return;
		const now = new Date();

		// Pass time=0 so raw_time=0, which locks the DNF (cannot be toggled off)
		saveSolve(
			context,
			0,
			context.scramble,
			timeStartedAt.getTime(),
			now.getTime(),
			true, // dnf
			false,
			{
				is_smart_cube: true,
				smart_device_id: smartDeviceId,
				smart_turn_count: smartTurns.length,
				smart_turns: JSON.stringify(smartTurns),
			}
		);

		// Reset timer WITHOUT generating a new scramble or clearing smartTurns.
		// smartTurns is kept so cubejs continues tracking the physical cube state.
		// When the user physically solves the cube, the solve detection will fire.
		stopTimer(START_TIMEOUT);
		clearInspectionTimers(false, true);
		setTimerParams({
			timeStartedAt: null,
			solving: false,
			canStart: false,
			spaceTimerStarted: 0,
			scramble: '',
			smartPickUpTime: 0,
			lastSmartMoveTime: 0,
			smartAbortVisible: false,
		});
		setShowAbortDialog(false);
		setNeedsCubeReset(true);
	}

	function handleAbortDiscard() {
		// Reset timer WITHOUT generating a new scramble or clearing smartTurns.
		// smartTurns is kept so cubejs continues tracking the physical cube state.
		stopTimer(START_TIMEOUT);
		clearInspectionTimers(false, true);
		setTimerParams({
			timeStartedAt: null,
			solving: false,
			canStart: false,
			spaceTimerStarted: 0,
			scramble: '',
			smartPickUpTime: 0,
			lastSmartMoveTime: 0,
			smartAbortVisible: false,
		});
		setShowAbortDialog(false);
		setNeedsCubeReset(true);
	}

	function handleAbortContinue() {
		setShowAbortDialog(false);
		setTimerParams({ smartAbortVisible: false });
		setAbortResetCount(c => c + 1); // Restart inactivity timer
	}

	function handleResetCubeState() {
		resetMoves(true);
		setShowAbortDialog(false);
		setTimerParams({ smartAbortVisible: false });
		setNeedsCubeReset(false);
		resetScramble(context);
	}

	async function connectBluetooth() {
		try {
			let bluetoothAvailable = isNative() || (!!navigator.bluetooth && (await navigator.bluetooth.getAvailability()));
			if (bluetoothAvailable) {
				if (isNative()) {
					dispatch(openModal(
						<BleScanningModal
							mode="smartcube"
							onCancel={cancelBleScan}
							onRetry={retryBleScan}
						/>,
						{
							title: t('smart_cube.ble_scan_title'),
							hideCloseButton: true,
							disableBackdropClick: true,
							width: 400,
						}
					));
				}
				connect.current.connect();
			} else {
				dispatch(openModal(<BluetoothErrorMessage />));
			}
		} catch (e) {
			console.error('[BLE] connectBluetooth error:', e);
			toastError('Web Bluetooth API error' + (e ? `: ${e}` : ''));
		}
	}

	function cancelBleScan() {
		connect.current.cancelScan();
		dispatch(closeModal());
		setTimerParams({
			smartCubeScanning: false,
			smartCubeConnecting: false,
			smartCubeScanError: null,
		});
	}

	function retryBleScan() {
		setTimerParams({
			smartCubeScanning: true,
			smartCubeScanError: null,
		});
		connect.current.connect();
	}

	function disconnectBluetooth() {
		connect.current.disconnect();
		setTimerParams({
			smartCanStart: false,
			smartCubeConnected: false,
			smartCubeConnecting: false,
			smartTurns: [],
			smartDeviceId: '',
		});
	}

	function toggleManageSmartCubes() {
		dispatch(openModal(<ManageSmartCubes />, { title: t('smart_cube.manage_smart_cubes') }));
	}

	function resetGyro() {
		gyroBasisRef.current = null;
	}

	let actionButton = null;
	const dropdown = (
		<Dropdown
			dropdownButtonProps={{ transparent: true }}
			icon={<DotsThree />}
			options={[
				{
					text: t('smart_cube.mark_as_solved'),
					hidden: !smartCubeConnected,
					disabled: !!timeStartedAt,
					onClick: () => resetMoves(true),
				},
				{
					text: t('smart_cube.reset_gyro'),
					hidden: !smartCubeConnected || !smartGyroSupported,
					disabled: !!timeStartedAt,
					onClick: resetGyro,
				},
				{
					text: t('smart_cube.disconnect'),
					hidden: !smartCubeConnected,
					disabled: !!timeStartedAt,
					onClick: disconnectBluetooth,
				},
				{ text: t('smart_cube.manage_smart_cubes'), disabled: !!timeStartedAt, onClick: toggleManageSmartCubes },
			]}
		/>
	);

	let battery = <Battery level={smartCubeBatteryLevel} />;
	let emblem;
	if (smartCubeScanning) {
		emblem = <Emblem small orange icon={<Bluetooth />} />;
		actionButton = <Button text={t('smart_cube.scanning_short')} disabled />;
		battery = null;
	} else if (smartCubeConnecting) {
		emblem = <Emblem small orange icon={<Bluetooth />} />;
		actionButton = <Button text={t('smart_cube.connecting')} disabled />;
		battery = null;
	} else if (smartCubeConnected) {
		emblem = <Emblem small green icon={<Bluetooth />} />;
	} else {
		emblem = <Emblem small red icon={<Bluetooth />} />;
		actionButton = <Button text={t('smart_cube.connect')} onClick={connectBluetooth} icon={<Bluetooth />} />;
		battery = null;
	}

	// Mismatch banner: show after aborting a solve, when the physical cube
	// still needs to be solved before a new scramble can be generated
	const showCubeMismatch = needsCubeReset && !timeStartedAt;

	return (
		<div className={b({ mobile: mobileMode })}>
			<div className={b('wrapper')}>
				<div className={b('cube')}>
					<div ref={containerRef} style={{ width: smartCubeSize, height: smartCubeSize }} />
				</div>
				{!mobileMode && (
					<div className={b('stats-container')}>
						<LiveAnalysisOverlay startState={startState || (cubejs.current ? cubejs.current.asString() : null)} />
						<SmartStats />
					</div>
				)}
				{mobileMode && domReady && ReactDOM.createPortal(
					<LiveAnalysisOverlay
						startState={startState || (cubejs.current ? cubejs.current.asString() : null)}
						mobile={true}
					/>,
					document.getElementById('mobile-smart-phases-container') || document.body
				)}
				<div className={b('info')}>
					{battery}
					{emblem}
					{dropdown}
				</div>
			</div>
			{actionButton}
			{domReady && ReactDOM.createPortal(
				<AbortSolveOverlay
					showAbortButton={!!smartAbortVisible && !!timeStartedAt}
					showDialog={showAbortDialog}
					showMismatchBanner={showCubeMismatch}
					onAbortClick={handleAbortClick}
					onDnf={handleAbortDnf}
					onDiscard={handleAbortDiscard}
					onContinue={handleAbortContinue}
					onResetCubeState={handleResetCubeState}
				/>,
				document.body
			)}
		</div>
	);
}
