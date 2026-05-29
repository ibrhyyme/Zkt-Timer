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
import { initSmartSolver, IncrementalCompressor, matchScrambleWithCommutative, invertMove } from '../../../util/smart_scramble';
import { initSolverWorker } from '../../../util/solver_worker_manager';
import { TimerContext } from '../Timer';
import { useSettings } from '../../../util/hooks/useSettings';
import LiveAnalysisOverlay from './LiveAnalysisOverlay';
import { useGeneral } from '../../../util/hooks/useGeneral';
import { useDispatch } from 'react-redux';
import Dropdown from '../../common/inputs/dropdown/Dropdown';
import Button from '../../common/button/Button';
import { toastError } from '../../../util/toast';
import { cubeTimestampLinearFit } from '../../../util/smart_cube_timing';
import { analyzeCurrentState } from '../../../util/solve/live_analysis_core';
import { endTimer, startTimer, startInspection, getSmartCubeClockSkew } from '../helpers/events';
import { stopTimer, clearInspectionTimers, START_TIMEOUT } from '../helpers/timers';
import { resetScramble } from '../helpers/scramble';
import { saveSolve } from '../helpers/save';
import { useMe } from '../../../util/hooks/useMe';
import { isPro } from '../../../lib/pro';
import { serializeSmartTurnsCompact } from '../../../../shared/smart_cube/parse_turns';
import { countHTM } from '../../../../shared/util/solve/move_counter';
import AbortSolveOverlay from './abort_solve/AbortSolveOverlay';
import BluetoothErrorMessage from '../common/BluetoothErrorMessage';
import BleScanningModal from './ble_scanning_modal/BleScanningModal';
import { isNative } from '../../../util/platform';
import { resourceUri } from '../../../util/storage';
import { onVisibilityChange } from '../../../util/app-visibility';
import type { TwistyPlayer } from 'cubing/twisty';
import * as THREE from 'three';

const b = block('smart-cube');
const DEFAULT_SOLVED_STATE = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';

// ── DEBUG LOGGING ──
// Runtime activation: set `window.__SMART_DEBUG__ = true` in browser console
const _log = (cat: string, color: string, ...args: any[]) => {
	if (typeof window === 'undefined' || !(window as any).__SMART_DEBUG__) return;
	const ts = performance.now().toFixed(1);
	console.log(`%c[SC ${cat}] %c${ts}ms`, `color:${color};font-weight:bold`, 'color:gray', ...args);
};
const dbgMove = (...a: any[]) => _log('MOVE', '#2196F3', ...a);
const dbgMatch = (...a: any[]) => _log('MATCH', '#4CAF50', ...a);
const dbgCorr = (...a: any[]) => _log('CORR', '#FF5722', ...a);
const dbgFace = (...a: any[]) => _log('FACE', '#9C27B0', ...a);
const dbgTimer = (...a: any[]) => _log('TIMER', '#FF9800', ...a);
const dbgReset = (...a: any[]) => _log('RESET', '#607D8B', ...a);
const dbgSync = (...a: any[]) => _log('SYNC', '#00BCD4', ...a);

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

	const scrambleCompletedAtRef = useRef<Date | null>(null);
	const [domReady, setDomReady] = useState(false);
	useEffect(() => setDomReady(true), []);

	const [startState, setStartState] = useState<string>(null);
	const [inspectionTime, setInspectionTime] = useState(0);
	const [showAbortDialog, setShowAbortDialog] = useState(false);
	const [abortResetCount, setAbortResetCount] = useState(0);
	const [needsCubeReset, _setNeedsCubeReset] = useState(false);
	const [cubeResetFromAbort, setCubeResetFromAbort] = useState(false);
	const setNeedsCubeReset = (val: boolean) => {
		_setNeedsCubeReset(val);
		setTimerParams({ smartNeedsCubeReset: val });
		if (!val) setCubeResetFromAbort(false);
	};
	const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const INACTIVITY_TIMEOUT_MS = 5000; // 5 seconds

	const useSpaceWithSmartCube = useSettings('use_space_with_smart_cube');
	const inspectionEnabled = useSettings('inspection');
	const timerType = useSettings('timer_type');
	const mobileMode = useGeneral('mobile_mode');
	const me = useMe();
	const userIsPro = isPro(me);

	const smartCubeSize = useSettings('smart_cube_size');

	// Limit cube size on mobile based on viewport (prevent timer/dashboard from being squeezed on small phones)
	const [viewportH, setViewportH] = useState(typeof window !== 'undefined' ? window.innerHeight : 800);
	const [viewportW, setViewportW] = useState(typeof window !== 'undefined' ? window.innerWidth : 400);
	useEffect(() => {
		if (typeof window === 'undefined') return;
		const onResize = () => {
			setViewportH(window.innerHeight);
			setViewportW(window.innerWidth);
		};
		window.addEventListener('resize', onResize);
		return () => window.removeEventListener('resize', onResize);
	}, []);
	const effectiveCubeSize = mobileMode
		? Math.floor(Math.min(smartCubeSize, viewportH * 0.30, viewportW * 0.52))
		: smartCubeSize;

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
		dnfTime,
	} = context;

	// Polling safety refs (avoid stale closures in setInterval and effect handlers)
	const needsCubeResetRef = useRef(needsCubeReset);
	needsCubeResetRef.current = needsCubeReset;
	const smartPhysicallySolvedRef = useRef(smartPhysicallySolved);
	smartPhysicallySolvedRef.current = smartPhysicallySolved;
	const lastSmartMoveTimeRef = useRef(lastSmartMoveTime);
	lastSmartMoveTimeRef.current = lastSmartMoveTime;
	const smartTurnsRef = useRef(smartTurns);
	smartTurnsRef.current = smartTurns;
	const smartCurrentStateRef = useRef(smartCurrentState);
	smartCurrentStateRef.current = smartCurrentState;
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

	const targetFaceletsRef = useRef<string | null>(null);
	const compressorRef = useRef(new IncrementalCompressor());




	// Reset incremental state when scramble or offset changes (new correction applied)
	useEffect(() => {
		dbgCorr(`COMPRESSOR RESET | scramble: ${scramble?.slice(0, 40)}... | offset: ${smartTurnOffset}`);
		compressorRef.current.reset();
		validationCacheRef.current.lastValidatedLength = 0;
		// When new scramble arrives, old scramble completion is invalidated — prevent timer from starting accidentally
		scrambleCompletedAtRef.current = null;
	}, [scramble, smartTurnOffset]);

	// Inspection timeout → when dnfTime:true, clear scramble completion ref
	// and transition to cube solve mode (prevent timer start, user must solve cube)
	useEffect(() => {
		if (dnfTime && !timeStartedAt) {
			scrambleCompletedAtRef.current = null;
			setNeedsCubeReset(true);
			setTimerParams({ smartCanStart: false, lastSmartSolveStats: null, smartUndoMoves: null });
		}
	}, [dnfTime]);

	// Precompute target FACELETS (target state of scramble)
	// Always use originalScramble — not correction scramble, original scramble
	useEffect(() => {
		const origScramble = originalScramble || scramble;
		if (origScramble) {
			try {
				const targetCube = new Cube();
				origScramble.split(' ').filter(m => m.trim()).forEach(m => targetCube.move(m));
				targetFaceletsRef.current = targetCube.asString();
			} catch (e) {
				targetFaceletsRef.current = null;
			}
		} else {
			targetFaceletsRef.current = null;
		}
	}, [scramble, originalScramble]);


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
					visualization: 'PG3D',
					alg: '',
					experimentalSetupAnchor: 'start',
					background: 'none',
					controlPanel: 'none',
					hintFacelets: 'none',
					experimentalDragInput: 'none',
					cameraLatitude: 0,
					cameraLongitude: 0,
					cameraLatitudeLimit: 0,
					tempoScale: 5  // Same as reference (gan-cube-sample) — visible but fast animation
				});

				if (containerRef.current) {
					containerRef.current.appendChild(twisty);
					twisty.style.width = "100%";
					twisty.style.height = "100%";
					twistyPlayerRef.current = twisty;
				}

				// Start Animation Loop for Gyro
				let animRunning = true;

				const animate = async () => {
					if (cancelled || !animRunning) return;

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

				// Stop render loop when moving to background, resume when returning to foreground
				unsubVisibility = onVisibilityChange((visible) => {
					if (visible && !animRunning && !cancelled) {
						animRunning = true;
						animate();
					} else if (!visible) {
						animRunning = false;
						if (animFrameRef.current) {
							cancelAnimationFrame(animFrameRef.current);
							animFrameRef.current = null;
						}
					}
				});

			} catch (error) {
				console.error("Failed to load TwistyPlayer:", error);
			}
		};

		let unsubVisibility: (() => void) | undefined;
		initTwisty();

		return () => {
			cancelled = true;
			unsubVisibility?.();
			if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
			if (containerRef.current) containerRef.current.innerHTML = '';
		};
	}, []);

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

			// [BATCH] race signature: if scramble finished + multiple moves in same tick
			// strongest hypothesis for issue 2 (timer auto-start)
			dbgMove(`BATCH count=${newTurns.length} | new=[${newTurns.map(t => t.turn).join(' ')}] | total=${smartTurns.length} | scrambleCompleted=${scrambleCompletedAtRef.current ? 'SET(' + (Date.now() - scrambleCompletedAtRef.current.getTime()) + 'ms ago)' : 'null'} | timeStartedAt=${!!timeStartedAt}`);
			if (newTurns.length > 1 && scrambleCompletedAtRef.current && !timeStartedAt) {
				dbgMove(`!!! BATCH RACE SUSPECT — ${newTurns.length} moves in same tick + scramble finished + timer not started yet. One of these may be counted as "first solve move"!`);
			}

			newTurns.forEach(turnObj => {
				// Send to TwistyPlayer
				(twistyPlayerRef.current as any).experimentalAddMove(turnObj.turn, { cancel: false });

				// Sync Logical State
				cubejs.current.move(turnObj.turn);
			});

			dbgMove(`+${newTurns.length} moves:`, newTurns.map(t => t.turn).join(' '),
				`| total: ${smartTurns.length} | cubejs: ${cubejs.current.asString().slice(0, 18)}...`);

			appliedTurnsRef.current = smartTurns.length;

			// VALIDATION: Only call once after batch (not per move)
			checkForStartAfterTurnBatch(smartTurns);

			const isSolved = cubejs.current.asString() === smartSolvedState;
			if (isSolved || smartPhysicallySolved) {
				dbgTimer(`SOLVE DETECT | cubejs_solved: ${isSolved} | facelets_solved: ${smartPhysicallySolved} | timeStartedAt: ${!!timeStartedAt}`);
			}
			// Fallback: cubejs incorrect (cascading gap) but physical cube is solved
			if (!useSpaceWithSmartCube && (isSolved || (smartPhysicallySolved && timeStartedAt)) && smartTurns.length) {
				// Use last move timestamp in both paths (prevents display overshoot)
				const lastMove = smartTurns[smartTurns.length - 1];
				const endTs = lastMove?.completedAt || lastSmartMoveTime || undefined;
				if (needsCubeReset) {
					// Post-abort: physical cube solved, reset and generate new scramble
					resetMoves(true, false, endTs);
					setNeedsCubeReset(false);
					resetScramble(context);
				} else {
					resetMoves(false, false, endTs);
				}
			}

			// NOTE: startState is now set inside resetMoves(isScrambleFinish=true).
			// Setting it here after solve finishes is incorrect: cubejs becomes solved state and
			// phase tracking breaks for the next solve.
		} else if (smartTurns.length === 0 && appliedTurnsRef.current > 0) {
			// Reset detected
			cubejs.current = new Cube();

			if (preservedScrambleRef.current) {
				// Scramble finished, initialize to scrambled state
				// We DO NOT reset TwistyPlayer.alg here. We want to keep the visual state (orientation/rotations) as is.
				// The user just finished scrambling, so the visual state IS the scrambled state.

				// Initialize with scramble moves — do not trust FACELETS
				// (on some cube models FACELETS parsing can be incorrect, move tracking is more reliable)
				const targetScramble = originalScrambleRef.current || preservedScrambleRef.current;
				const moves = targetScramble.split(' ').filter(m => m.trim());
				for (const move of moves) {
					cubejs.current.move(move);
				}
			} else {
				// Solve finished or manual reset, initialize to solved state
				if (twistyPlayerRef.current) {
					twistyPlayerRef.current.alg = '';
					// Scene changed — reset refs
					twistySceneRef.current = null;
					twistyVantageRef.current = null;
				}
			}

			appliedTurnsRef.current = 0;
			validationCacheRef.current.lastValidatedLength = 0;
			validationCacheRef.current.lastMatchedIndex = 0;
			compressorRef.current.reset();
			// Update startState only if NOT already set by resetMoves(isScrambleFinish=true).
			// If preservedScrambleRef exists, resetMoves already set correct startState —
			// overwriting here creates race condition with stale smartCurrentState.
			if (!preservedScrambleRef.current) {
				setStartState(cubejs.current.asString());
			}
		}
	}, [smartTurns, smartSolvedState]);

	// FACELETS safety net: stop timer if physical cube is solved
	// Does NOT touch cubejs - only checks physical state
	//
	// RACE CONDITION PROTECTION: BLE move event and FACELETS event arrive in parallel.
	// FACELETS sometimes arrives FIRST (cube state changed) → move event not yet in Redux →
	// resetMoves would commit smartTurns incomplete → last move not recorded, carries to next
	// scramble and would be "undone".
	// Wait 350ms: if BLE move arrives within this time, useEffect[smartTurns] automatically
	// triggers resetMoves (timeStartedAt resets → this setTimeout guard fails).
	// If not, FACELETS engages as fallback anyway.
	useEffect(() => {
		if (
			!smartPhysicallySolved ||
			!timeStartedAt ||
			useSpaceWithSmartCube
		) {
			return;
		}

		dbgFace(`FACELETS SOLVE SAFETY NET armed (350ms) | smartStateSeq: ${smartStateSeq} | lastSmartMoveTime: ${lastSmartMoveTime} | now: ${Date.now()} | delay: ${lastSmartMoveTime ? Date.now() - lastSmartMoveTime : 'N/A'}ms`);

		const tid = setTimeout(() => {
			// If timeStartedAt still exists after 350ms, BLE move event did not arrive
			// — commit via FACELETS as fallback.
			dbgFace(`FACELETS SOLVE SAFETY NET fire (BLE move delayed)`);
			if (needsCubeReset) {
				resetMovesRef.current?.(true, false, lastSmartMoveTimeRef.current || undefined);
				setNeedsCubeReset(false);
				resetScramble(context);
			} else {
				resetMovesRef.current?.(false, false, lastSmartMoveTimeRef.current || undefined);
			}
		}, 350);

		return () => clearTimeout(tid);
	}, [smartStateSeq, timeStartedAt]);

	// FACELETS scramble completion safety net:
	// smartCurrentState is updated from BLE on each FACELETS event.
	// If physical cube reaches target state, complete without waiting for move matcher.
	useEffect(() => {
		if (!smartCurrentState || !targetFaceletsRef.current) return;
		if (timeStartedAt || !scramble) return; // do not run during solve or when no scramble exists
		if (useSpaceWithSmartCube || smartCubeConnecting) return;
		// Do not retrigger if scramble already completed (via correction or matcher)
		if (scrambleCompletedAtRef.current) return;

		// If cube is solved during correction mode → restore original scramble
		// Scenario: mixed cube connected → correction path shown → user could not complete
		// (TOO_MANY) → solved cube → now track original scramble from solved cube
		if (smartCurrentState === DEFAULT_SOLVED_STATE && originalScramble && scramble !== originalScramble) {
			dbgSync('Cube solved during correction — restoring original scramble');
			setTimerParams({
				scramble: originalScramble,
				smartTurnOffset: smartTurns.length,
				smartUndoMoves: null,
			});
			return;
		}

		if (smartCurrentState === targetFaceletsRef.current) {
			dbgFace('FACELETS SCRAMBLE SAFETY NET triggered — physical cube at target (useEffect)',
				`\n  facelets: ${smartCurrentState.slice(0, 27)}...`,
				`\n  target:   ${targetFaceletsRef.current.slice(0, 27)}...`,
				`\n  scramble: ${scramble?.slice(0, 50)}`,
				`\n  origScramble: ${originalScramble || 'null'}`
			);

			scrambleCompletedAtRef.current = new Date();

			setTimerParams({ smartCanStart: true, smartUndoMoves: null });

			if (!audioThrottleRef.current) {
				audioThrottleRef.current = true;
				setTimeout(() => { audioThrottleRef.current = false; }, 2000);
				try {
					const audio = new Audio(resourceUri('audio/success.mp3'));
					audio.volume = 1.0;
					audio.play().catch(e => console.warn('Audio play failed:', e));
				} catch (err) {
					// Audio error — not critical
				}
			}

			resetMoves(false, true);
			if (inspectionEnabled) {
				startInspection(context);
			}
		}
	}, [smartStateSeq]);

	// Polling safety: check every 1s if physical cube is solved (bypasses React dependency issues)
	useEffect(() => {
		if (!timeStartedAt || useSpaceWithSmartCube) return;

		const interval = setInterval(() => {
			if (smartPhysicallySolvedRef.current) {
				dbgFace('POLLING SAFETY NET — physical cube solved, stopping timer');
				if (needsCubeResetRef.current) {
					resetMovesRef.current?.(true, false, lastSmartMoveTimeRef.current || undefined);
				} else {
					resetMovesRef.current?.(false, false, lastSmartMoveTimeRef.current || undefined);
				}
			}
		}, 1000);

		return () => clearInterval(interval);
	}, [timeStartedAt, useSpaceWithSmartCube]);

	// Direct Gyro Subscription (Bypassing Redux)
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
						// Full basis: capture complete first reading and invert
						// Same approach as reference (gan-cube-sample)
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

	// ── Initial Sync: when cube connects, read physical state and calculate scramble ──
	const initialSyncDoneRef = useRef(false);

	useEffect(() => {
		if (!smartCubeConnected || !smartCurrentState || !scramble) return;
		if (timeStartedAt) return; // Do not run during solve
		if (initialSyncDoneRef.current) return;
		// If reconnect during correction mode, should not run again
		// BLE disconnect/reconnect resets initialSyncDoneRef but this guard prevents new correction
		if (originalScramble && scramble !== originalScramble) return;
		initialSyncDoneRef.current = true;

		const SOLVED = DEFAULT_SOLVED_STATE;
		const currentFacelets = smartCurrentState;

		// If cube is solved — use original scramble as is, TwistyPlayer solved (alg='')
		if (currentFacelets === SOLVED) {
			dbgSync('Cube SOLVED when connected — no sync needed');

			return;
		}
		// FACELETS not solved — might be mixed cube connected OR FACELETS parsing error.
		// On some GAN models (e.g. GAN 12) FACELETS byte offsets differ,
		// which shows solved cube as mixed. Instead of computing correction path,
		// continue as solved. If truly mixed, user can use "Mark as solved" button.
		dbgSync(`FACELETS ≠ SOLVED (${currentFacelets.slice(0, 18)}...) — skipping correction path`);
	}, [smartCubeConnected, smartCurrentState]);

	// Reset initial sync when disconnected (so it runs again on reconnect)
	useEffect(() => {
		if (!smartCubeConnected) {
			initialSyncDoneRef.current = false;
		}
	}, [smartCubeConnected]);

	useEffect(() => {
		return () => {
			connect.current.disconnect();
			if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
		};
	}, []);

	// Stop BLE battery polling in background, restart in foreground
	useEffect(() => {
		const unsub = onVisibilityChange((visible) => {
			const cube = connect.current?.activeCube as any;
			if (!cube) return;
			if (!visible && cube.batteryInterval) {
				clearInterval(cube.batteryInterval);
				cube.batteryInterval = null;
			} else if (visible && !cube.batteryInterval && smartCubeConnected) {
				const pollFn = cube.updateBattery || cube.getBatteryLevel;
				if (pollFn) {
					cube.batteryInterval = setInterval(() => pollFn.call(cube), 10000);
				}
			}
		});
		return unsub;
	}, [smartCubeConnected]);

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
		// Skip if scrambling hasn't started or cube needs reset (DNF/abort — user is solving cube, not scrambling)
		if (!scramble || timeStartedAt || needsCubeReset) return;

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

		// [CHECK_START] Entry — track which state we enter with on each checkForStartAfterTurn call
		const lastTurn = currentTurns[currentTurns.length - 1];
		dbgTimer(`CHECK_START entry | currentTurns.length=${currentTurns.length} | lastTurn=${lastTurn?.turn || '-'} (completedAt=${lastTurn?.completedAt || '-'}) | scrambleCompletedAtRef=${scrambleCompletedAtRef.current ? 'SET(' + (Date.now() - scrambleCompletedAtRef.current.getTime()) + 'ms ago)' : 'null'} | timeStartedAt=${!!timeStartedAt} | scramble.head=${scramble?.slice(0, 30) || 'null'}`);

		if (scrambleCompletedAtRef.current) {
			const firstSolveTurn = currentTurns[currentTurns.length - 1];

			// GUARD: after scramble finishes, resetMoves clears smartTurns.
			// This clearing triggers useEffect with empty array — prevent startTimer being
			// accidentally called before user physically makes a move.
			// Wait until real "first solve move" arrives.
			if (!firstSolveTurn) {
				dbgTimer('CHECK_START | scrambleCompletedAtRef set but no new solve move yet — waiting');
				return;
			}

			const msSinceScrambleEnd = Date.now() - scrambleCompletedAtRef.current.getTime();
			// [CHECK_START] detailed context BEFORE startTimer call — is it first solve move or part of scramble batch?
			dbgTimer(`!!! TIMER START triggered | firstSolveTurn=${firstSolveTurn?.turn} (completedAt=${firstSolveTurn?.completedAt}) | scramble finished=${msSinceScrambleEnd}ms ago | currentTurns.length=${currentTurns.length} | appliedTurnsRef=${appliedTurnsRef.current} | last 3 moves=[${currentTurns.slice(-3).map((t: any) => t.turn).join(' ')}]`);
			dbgTimer('TIMER START — scramble already completed, first move received');
			startTimer(firstSolveTurn?.completedAt);
			let it = msSinceScrambleEnd / 1000;
			it = Math.floor(it * 100) / 100;

			scrambleCompletedAtRef.current = null;

			setInspectionTime(it);
			setTimerParams({ smartCanStart: false });
			return;
		}

		if (!currentTurns.length || timeStartedAt || !scramble) return;

		// FACELETS-based completion: is physical cube at target state?
		// Independent from move matcher, most reliable method.
		// Double moves like L2 = L'+L', wrong moves, etc. do not cause issues.
		if (targetFaceletsRef.current && smartCurrentState === targetFaceletsRef.current) {
			dbgFace('FACELETS MATCH (checkForStart) — physical cube at target!');

			scrambleCompletedAtRef.current = new Date();

			setTimerParams({ smartCanStart: true, smartUndoMoves: null });

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
			return;
		}

		const offset = smartTurnOffset || 0;
		const relevantTurns = offset > 0 ? currentTurns.slice(offset) : currentTurns;

		// Use incremental compressor — only processes new turns
		const userMoves = compressorRef.current.processNew(relevantTurns);
		const expectedMoves = scramble.split(' ').filter(m => m.trim());
		const { matched, matchStatus } = matchScrambleWithCommutative(expectedMoves, userMoves);

		dbgMatch(
			`offset: ${offset} | relevantTurns: ${relevantTurns.length} | compressed: [${userMoves.join(' ')}]`,
			`\n  expected: [${expectedMoves.join(' ')}]`,
			`\n  matched: ${matched} | status: [${matchStatus.join(', ')}]`,
			`\n  cubejs: ${cubejs.current.asString().slice(0, 27)}...`,
			`\n  facelets: ${smartCurrentState?.slice(0, 27) || 'null'}...`,
			`\n  target:   ${targetFaceletsRef.current?.slice(0, 27) || 'null'}...`,
		);

		if (matched) {
			// Move matcher matched — verify with cubejs (independent from FACELETS lag)
			// cubejs updates synchronously on each move event, FACELETS can lag by 1+ batches
			if (smartCubeConnected && targetFaceletsRef.current) {
				const cubejsState = cubejs.current.asString();
				if (cubejsState !== targetFaceletsRef.current) {
					// BLE move loss — FACELETS safety net will catch
					dbgMatch('MATCHED but cubejs DOES NOT MATCH — waiting for FACELETS safety net',
						`\n  cubejs:  ${cubejsState.slice(0, 27)}...`,
						`\n  target:  ${targetFaceletsRef.current.slice(0, 27)}...`);
					return;
				}
				// cubejs matched — safe even if FACELETS is behind
			}
			dbgMatch('SCRAMBLE COMPLETED (move matcher + cubejs confirmed)');

			scrambleCompletedAtRef.current = new Date();

			setTimerParams({ smartCanStart: true, smartUndoMoves: null });

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
			// Wrong move detected — calculate and show undo sequence
			const firstWrongIdx = matchStatus.indexOf('wrong');
			const wrongUserMoves = userMoves.slice(firstWrongIdx);

			if (wrongUserMoves.length > 7) {
				// 8+ wrong moves — show solve cube message
				dbgCorr(`WRONG detected | ${wrongUserMoves.length} wrong moves — TOO_MANY`);
				setTimerParams({ smartUndoMoves: ['TOO_MANY'] });
			} else {
				const undoSequence = wrongUserMoves.slice().reverse().map(invertMove);
				dbgCorr(`WRONG detected | undo sequence: [${undoSequence.join(' ')}]`);
				setTimerParams({ smartUndoMoves: undoSequence });
			}
		} else if (matchStatus.includes('half')) {
			// Partial match — orange color provides sufficient info
			setTimerParams({ smartUndoMoves: null });
		} else {
			// All perfect or pending — clear undo
			setTimerParams({ smartUndoMoves: null });
		}
	}

	function resetMoves(markSolved: boolean = false, isScrambleFinish: boolean = false, endTimestamp?: number) {
		dbgReset(`resetMoves() | markSolved: ${markSolved} | isScrambleFinish: ${isScrambleFinish} | endTimestamp: ${endTimestamp || 'not set'} | isSolveEnd: ${!!timeStartedAt}`);

		const isSolveEnd = !!timeStartedAt;

		if (isSolveEnd) {
			// Per-solve post-solve linear fit: same approach as cstimer tsLinearFix / gan-cube-sample cubeTimestampLinearFit
			// Performs linear regression on solution move (cubeTimestamp, localTimestamp) pairs,
			// recalculating each move's time — much more accurate than pre-solve estimate
			const { correctedMoves, finalTimeMs } = cubeTimestampLinearFit(
				smartTurns,
				timeStartedAt.getTime()
			);

			let finalTimeMilli: number | null = Math.round(finalTimeMs);

			// Fallback: if linear fit result is invalid, use raw difference
			if (finalTimeMilli <= 0 && endTimestamp && timeStartedAt) {
				finalTimeMilli = endTimestamp - timeStartedAt.getTime();
			}

			dbgTimer(`TIMER STOP (linear fit) | finalTimeMilli: ${finalTimeMilli} | moves: ${correctedMoves.length}`);

			// Pro user: save in compact format, server creates method_steps.
			// Free user: smart_turns not written, method_steps not created, DB unchanged.
			//
			// IMPORTANT: correctedMoves[i].completedAt comes from cubeTimestampLinearFit —
			// this is BLE adapter's localTimestamp (absolute epoch ms like Date.now()).
			// Subtracting with timeStartedAt.getTime() can produce huge offsets due to
			// BLE clock vs JS clock drift. Always use first move as 0 baseline → 4-byte/move
			// average offset, no extra work for parser.
			let smartTurnsToSave: string | null = null;
			if (userIsPro) {
				const baseMs = correctedMoves.length > 0 ? correctedMoves[0].completedAt : 0;
				smartTurnsToSave = serializeSmartTurnsCompact(
					correctedMoves.map((m: any) => ({
						turn: m.turn,
						completedAt: m.completedAt - baseMs,
					})),
					0
				);
			}

			// cstimer-grade HTM move count: consecutive parallel plane same face repeated
			// moves count as 1 (R R = R2 = 1, R U R = 2). Using HTM instead of raw move length
			// reflects consistent, correct values to DB, TPS calculation, and UI.
			const htmCount = countHTM(correctedMoves.map((m: any) => m.turn));

			endTimer(context, finalTimeMilli, {
				inspection_time: inspectionTime,
				smart_device_id: smartDeviceId,
				is_smart_cube: true,
				smart_turn_count: htmCount,
				smart_turns: smartTurnsToSave,
			});

			// Corrected phase analysis: so LiveAnalysisOverlay shows correct times
			// correctedMoves.completedAt corrected via linear fit — more accurate than raw timestamps
			dbgCorr(`CORR_ANALYSIS start | corrected.length=${correctedMoves.length} | htm=${htmCount} | startState=${startState?.length === 54 ? startState.slice(0, 27) + '...' : `INVALID(len=${startState?.length})`} | first3=${correctedMoves.slice(0, 3).map((m: any) => m.turn).join(' ')} | last3=${correctedMoves.slice(-3).map((m: any) => m.turn).join(' ')}`);
			try {
				const correctedTurns = correctedMoves.map(m => ({ ...m, time: m.completedAt }));
				const correctedAnalysis = analyzeCurrentState(correctedTurns, startState);
				const tps = finalTimeMilli && finalTimeMilli > 0
					? Number((htmCount / (finalTimeMilli / 1000)).toFixed(2))
					: 0;
				dbgCorr(`CORR_ANALYSIS success | phase=${correctedAnalysis.currentPhase} | crossSolved=${correctedAnalysis.crossSolved} | isSolved=${correctedAnalysis.isSolved} | oll=${correctedAnalysis.ollIdentified || '-'} | pll=${correctedAnalysis.pllIdentified || '-'} | times=${JSON.stringify(correctedAnalysis.times)}`);
				setTimerParams({
					lastSmartSolveStats: { turns: htmCount, tps, correctedAnalysis }
				});
			} catch (e: any) {
				// If analysis fails, simple stats from endTimer are sufficient
				dbgCorr(`CORR_ANALYSIS FAIL | message=${e?.message} | startStateLen=${startState?.length} | corrLen=${correctedMoves.length} | stack=${e?.stack?.slice(0, 200)}`);
			}
		}

		if (isSolveEnd) originalScrambleRef.current = '';

		// If this reset is because we finished scrambling, preserve the scramble alg
		if (isScrambleFinish) {
			// CRITICAL FIX: Use the ORIGINAL scramble (target state), not the current transient 'scramble'
			// (which might be just a short correction path).
			preservedScrambleRef.current = originalScrambleRef.current || scramble;

			// For phase tracking: save cube state when scramble finishes
			// This allows LiveAnalysisOverlay to analyze from correct starting state
			const scrambledState = cubejs.current.asString();
			setStartState(scrambledState);
		} else {
			preservedScrambleRef.current = null;
		}

		setTimerParams({
			smartSolvedState: markSolved ? DEFAULT_SOLVED_STATE : smartSolvedState,
			smartTurnOffset: 0,
			smartUndoMoves: null,
			// If isSolveEnd, smartTurns/smartPickUpTime/lastSmartMoveTime already reset in endTimer
			// Setting again unnecessarily triggers useEffect([smartTurns]) a second time
			...(isSolveEnd
				? { originalScramble: '' }
				: { smartTurns: [], smartPickUpTime: 0, lastSmartMoveTime: 0 }),
		});

		// NOTE: Gyro basis NOT reset. In reference project too (gan-cube-sample), basis
		// is preserved throughout session. Only reset on new BLE connection or user
		// "Reset Gyro" button. This way virtual cube always reflects physical cube's
		// actual orientation.

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
		clearInspectionTimers(true, true);
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
		setCubeResetFromAbort(true);
		setNeedsCubeReset(true);
	}

	function handleAbortDiscard() {
		// Reset timer WITHOUT generating a new scramble or clearing smartTurns.
		// smartTurns is kept so cubejs continues tracking the physical cube state.
		stopTimer(START_TIMEOUT);
		clearInspectionTimers(true, true);
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
		setCubeResetFromAbort(true);
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
							position: 'bottom',
							hideCloseButton: true,
							disableBackdropClick: true,
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
			smartCubeConnectStep: null,
		});
	}

	function retryBleScan() {
		setTimerParams({
			smartCubeScanning: true,
			smartCubeScanError: null,
			smartCubeConnectStep: null,
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
			smartCurrentState: null,
		});
	}

	function toggleManageSmartCubes() {
		dispatch(openModal(<ManageSmartCubes />, { title: t('smart_cube.manage_smart_cubes') }));
	}

	function markCubeAsSolved() {
		resetMoves(true);

		// Force state to solved
		setTimerParams({
			smartCurrentState: DEFAULT_SOLVED_STATE,
			smartPhysicallySolved: true,
		});

		// If in correction mode, restore original scramble
		if (originalScramble && scramble !== originalScramble) {
			setTimerParams({
				scramble: originalScramble,
				originalScramble: '',
				smartTurnOffset: 0,
				smartUndoMoves: null,
			});
			originalScrambleRef.current = originalScramble;
		} else {
			setTimerParams({ originalScramble: '' });
			originalScrambleRef.current = scramble;
		}

		// Also reset _trackerCube to solved
		const activeCube = (connect.current as any)?.activeCube;
		if (activeCube && activeCube._trackerCube) {
			activeCube._trackerCube = new Cube();
		}
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
					onClick: markCubeAsSolved,
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
		actionButton = (
			<div className="cd-timer__connect-trigger cd-timer__connect-trigger--disabled">
				<Emblem small orange icon={<Bluetooth />} text={t('smart_cube.scanning_short')} />
			</div>
		);
		battery = null;
	} else if (smartCubeConnecting) {
		emblem = <Emblem small orange icon={<Bluetooth />} />;
		actionButton = (
			<div className="cd-timer__connect-trigger cd-timer__connect-trigger--disabled">
				<Emblem small orange icon={<Bluetooth />} text={t('smart_cube.connecting').replace('...', '')} />
			</div>
		);
		battery = null;
	} else if (smartCubeConnected) {
		emblem = <Emblem small green icon={<Bluetooth />} />;
	} else {
		emblem = <Emblem small red icon={<Bluetooth />} />;
		actionButton = (
			<div className="cd-timer__connect-trigger" onClick={connectBluetooth} role="button">
				<Emblem small red icon={<Bluetooth />} text={t('smart_cube.connect')} />
			</div>
		);
		battery = null;
	}

	// Mismatch banner: show after aborting a solve, when the physical cube
	// still needs to be solved before a new scramble can be generated
	const showCubeMismatch = needsCubeReset && !timeStartedAt && cubeResetFromAbort;

	return (
		<div className={b({ mobile: mobileMode })}>
			<div className={b('wrapper')}>
				<div className={b('cube')}>
					<div
						ref={containerRef}
						style={{ width: effectiveCubeSize, height: effectiveCubeSize }}
					/>
				</div>
				{!mobileMode && (
					<div className={b('stats-container')}>
						<LiveAnalysisOverlay startState={startState || (cubejs.current ? cubejs.current.asString() : null)} />
						<SmartStats />
					</div>
				)}
				{mobileMode && domReady && ReactDOM.createPortal(
					<>
						{actionButton && (
							<div className="cd-timer__mobile-action">
								{actionButton}
							</div>
						)}
						<LiveAnalysisOverlay
							startState={startState || (cubejs.current ? cubejs.current.asString() : null)}
							mobile={true}
						/>
						<SmartStats mobile={true} />
					</>,
					document.getElementById('mobile-smart-phases-container') || document.body
				)}
				<div className={b('info')}>
					{battery}
					{emblem}
					{dropdown}
				</div>
			</div>
			{!mobileMode && actionButton}
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
