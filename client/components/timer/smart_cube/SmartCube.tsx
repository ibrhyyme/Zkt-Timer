import React, { useContext, useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import { useTranslation } from 'react-i18next';
import './SmartCube.scss';
import SmartStats from './stats/SmartStats';
import Emblem from '../../common/emblem/Emblem';
import Battery from './battery/Battery';
import Connect from './bluetooth/connect';
import { setTimerParams } from '../helpers/params';
import { Bluetooth, Gear } from 'phosphor-react';

import { openModal, closeModal } from '../../../actions/general';
import ManageSmartCubes from './manage_smart_cubes/ManageSmartCubes';
import Cube from 'cubejs';
import block from '../../../styles/bem';
import { initSmartSolver } from '../../../util/smart_scramble';
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
import { analyzeCurrentState, resolveAnalysisMethod } from '../../../util/solve/live_analysis_core';
import { endTimer, startTimer, startInspection } from '../helpers/events';
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
import {showBleConnectInfo} from '../common/showBleConnectInfo';
import { isNative } from '../../../util/platform';
import { resourceUri } from '../../../util/storage';
import { playNativeSound } from '../../../util/native-audio';
import { onVisibilityChange } from '../../../util/app-visibility';
import { SmartSolveEngine, SmartEngineEvent, SolveResult } from '../../../util/smart_cube';
import { recordEngineEvent } from '../../../util/smart_cube/telemetry';
import SmartCubeView, { SmartCubeViewHandle } from './cube_view/SmartCubeView';

const b = block('smart-cube');
const DEFAULT_SOLVED_STATE = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';

// The late-scramble-move window and drop cap now live with the rule that uses them,
// in client/util/smart_cube/solve_engine.ts.

// Scramble-complete beep. On iOS, route through the native AVAudioPlayer
// (.ambient + .mixWithOthers) so background music keeps playing; fall back to
// web Audio when the native plugin is unavailable (Android — NativeAudio is
// iOS-only — and browser).
//
// The web path is preloaded once (see preloadScrambleCompleteSoundWeb below)
// instead of built fresh here: `new Audio(src)` + immediate `play()` makes the
// element fetch/decode the file on that first call, which is exactly the
// "beep comes late" users on Android hit (no native preload to fall back on
// there). Reusing one already-loaded element removes that wait.
let scrambleSoundEl: HTMLAudioElement | null = null;

function preloadScrambleCompleteSoundWeb(): void {
	if (typeof Audio === 'undefined' || scrambleSoundEl) return;
	try {
		scrambleSoundEl = new Audio(resourceUri('audio/success.mp3'));
		scrambleSoundEl.volume = 1.0;
		scrambleSoundEl.load();
	} catch (err) {
		// Audio error — not critical
	}
}

function playScrambleCompleteSound() {
	if (playNativeSound('success')) return;
	try {
		if (scrambleSoundEl) {
			scrambleSoundEl.currentTime = 0;
			scrambleSoundEl.play().catch(e => console.warn('Audio play failed:', e));
			return;
		}
		// Preload effect hasn't run yet (or failed) — same fallback as before.
		const audio = new Audio(resourceUri('audio/success.mp3'));
		audio.volume = 1.0;
		audio.play().catch(e => console.warn('Audio play failed:', e));
	} catch (err) {
		// Audio error — not critical
	}
}

// ── DEBUG LOGGING ──
// Runtime activation: set `window.__SMART_DEBUG__ = true` in browser console
const _log = (cat: string, color: string, ...args: any[]) => {
	if (typeof window === 'undefined' || !(window as any).__SMART_DEBUG__) return;
	const ts = performance.now().toFixed(1);
	console.log(`%c[SC ${cat}] %c${ts}ms`, `color:${color};font-weight:bold`, 'color:gray', ...args);
};
const dbgMove = (...a: any[]) => _log('MOVE', '#2196F3', ...a);
const dbgCorr = (...a: any[]) => _log('CORR', '#FF5722', ...a);
const dbgTimer = (...a: any[]) => _log('TIMER', '#FF9800', ...a);
const dbgReset = (...a: any[]) => _log('RESET', '#607D8B', ...a);
const dbgSync = (...a: any[]) => _log('SYNC', '#00BCD4', ...a);

export default function SmartCube() {
	const { t } = useTranslation();
	const dispatch = useDispatch();
	const context = useContext(TimerContext);

	const connect = useRef(new Connect());

	const scrambleCompletedAtRef = useRef<Date | null>(null);
	// Counts turns swallowed as "late scramble moves" since the current scramble was
	// completed; reset whenever a scramble completes.
	const lateScrambleDropsRef = useRef(0);
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
	const smartCubeShow = useSettings('smart_cube_show');
	// Post-solve phase analysis only feeds LiveAnalysisOverlay; when the overlay is
	// off there is nothing to compute for.
	const analysisMode = useSettings('smart_cube_analysis_mode') || 'cffffop';
	const solveMethod = useSettings('smart_cube_method');

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
		smartCubeScanError,
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
		smartOutOfSync,
		dnfTime,
	} = context;

	// Surface wrong-MAC handshake failures on web (native shows the BleScanningModal
	// error state instead). Without this the cube would silently fail after the watchdog.
	useEffect(() => {
		if (smartCubeScanError === 'wrong_mac' && !isNative()) {
			toastError(t('smart_cube.wrong_mac_desc'));
			setTimerParams({
				smartCubeScanError: null,
				smartCubeScanning: false,
				smartCubeConnecting: false,
			});
		}
	}, [smartCubeScanError]);

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
	const resetMovesRef = useRef<(markSolved?: boolean, isScrambleFinish?: boolean, solveResult?: SolveResult) => void>(null);

	useEffect(() => {
		initSmartSolver();   // Sync fallback init (requestIdleCallback)
		initSolverWorker();  // Worker init (background thread — no UI block)
		preloadScrambleCompleteSoundWeb();
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

	// ── Shared solve engine ──
	// Scramble matching, correction hints, solve detection and the safety nets all live in
	// client/util/smart_cube now, so the timer, friendly rooms and any future surface make
	// the same decisions from the same code instead of drifting copies.
	const engineRef = useRef<SmartSolveEngine | null>(null);
	const engineEventRef = useRef<(event: SmartEngineEvent) => void>(() => { /* set below */ });

	if (!engineRef.current) {
		engineRef.current = new SmartSolveEngine((event) => engineEventRef.current(event));
	}




	// A new scramble (or a correction applied mid-scramble) invalidates the previous
	// completion, so the timer cannot start off a stale stamp. The engine resets its own
	// compressor and offsets inside setScramble.
	useEffect(() => {
		dbgCorr(`SCRAMBLE RESET | scramble: ${scramble?.slice(0, 40)}... | offset: ${smartTurnOffset}`);
		scrambleCompletedAtRef.current = null;
		// `smartCanStart` was only ever cleared by a timer start, an out-of-sync warning or a
		// disconnect, never by a new scramble. Left over from the previous attempt it makes
		// SmartScramble render "ready" across the whole scramble the user has not begun yet.
		setTimerParams({ smartCanStart: false });
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

	// Assigned every render so the engine, created once, always reaches the current closure.
	engineEventRef.current = (event: SmartEngineEvent) => {
		// Field study: batched client-side, dropped server-side unless the site flag is on.
		recordEngineEvent(event, 'timer');

		switch (event.type) {
			case 'SCRAMBLE_COMPLETE': {
				scrambleCompletedAtRef.current = new Date(event.at);
				setTimerParams({ smartCanStart: true, smartUndoMoves: null });

				if (!audioThrottleRef.current) {
					audioThrottleRef.current = true;
					setTimeout(() => { audioThrottleRef.current = false; }, 2000);
					playScrambleCompleteSound();
				}

				resetMoves(false, true);
				if (inspectionEnabled) {
					startInspection(context);
				}
				break;
			}

			case 'UNDO_MOVES':
				setTimerParams({ smartUndoMoves: event.moves });
				break;

			case 'SCRAMBLE_PROGRESS':
				// The scramble display used to run its own matcher over the raw turn stream,
				// which could disagree with the engine — a stray turn after a solve showed
				// the first move as half-done on a physically solved cube.
				setTimerParams({ smartMatchStatus: event.matchStatus });
				break;

			case 'TIMER_START': {
				startTimer(event.startedAt);
				scrambleCompletedAtRef.current = null;
				setInspectionTime(Math.floor((event.inspectionMs / 1000) * 100) / 100);
				setTimerParams({ smartCanStart: false });
				break;
			}

			case 'SOLVE_COMPLETE': {
				const { result } = event;
				if (needsCubeResetRef.current) {
					// Post-abort: the physical cube is solved again, so take a fresh scramble.
					resetMoves(true, false, result);
					setNeedsCubeReset(false);
					resetScramble(context);
				} else {
					resetMoves(false, false, result);
				}
				break;
			}

			case 'LATE_SCRAMBLE_MOVE':
				// Belongs to the scramble, not the solve. Clearing lets the engine rebuild
				// its tracker from the scramble instead of counting it as a solve move.
				setTimerParams({ smartTurns: [] });
				break;

			case 'OUT_OF_SYNC':
				if (event.out) {
					// Any "scramble done" stamp left from before belongs to a state we can
					// no longer vouch for.
					scrambleCompletedAtRef.current = null;
					setTimerParams({ smartCanStart: false, smartOutOfSync: true });
				} else {
					setTimerParams({ smartOutOfSync: false });
				}
				break;

			case 'TRACKER_RESYNCED':
				// The 3D view is driven by moves, so it is now showing a state that never
				// happened. Replay it to the state the cube actually reports.
				cubeViewRef.current?.syncToFacelets(event.facelets);
				break;
		}
	};

	// ── Engine inputs ──
	useEffect(() => {
		if (useSpaceWithSmartCube) return;
		// Matching follows the displayed scramble (which may be a correction path); the
		// facelets target always follows the original.
		engineRef.current?.setScramble(scramble || '', originalScramble || scramble || '');
	}, [scramble, originalScramble, useSpaceWithSmartCube]);

	useEffect(() => {
		engineRef.current?.setConnected(smartCubeConnected);
	}, [smartCubeConnected]);

	useEffect(() => {
		if (useSpaceWithSmartCube) return;
		engineRef.current?.pushTurns(smartTurns);
	}, [smartTurns, useSpaceWithSmartCube]);

	useEffect(() => {
		if (useSpaceWithSmartCube || !smartCurrentState) return;
		engineRef.current?.pushFacelets(smartCurrentState);
	}, [smartStateSeq, useSpaceWithSmartCube]);

	useEffect(() => () => engineRef.current?.dispose(), []);


	// 3D view, gyro and the move mirror live in <SmartCubeView>, shared with friendly rooms.
	const cubeViewRef = useRef<SmartCubeViewHandle>(null);

	// Initial sync, out-of-sync detection and the FACELETS re-anchor all live in the
	// engine (reconcileTracker). It runs on every facelets packet rather than once per
	// connection, so a cube that drifts mid-session recovers too.

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
	// checkForStartAfterTurn / checkForStartAfterTurnBatch moved into the shared engine
	// (SmartSolveEngine.evaluateScramble + tryStartTimer). Rooms run the exact same code.

	function resetMoves(markSolved: boolean = false, isScrambleFinish: boolean = false, solveResult?: SolveResult) {
		dbgReset(`resetMoves() | markSolved: ${markSolved} | isScrambleFinish: ${isScrambleFinish} | fromEngine: ${!!solveResult} | isSolveEnd: ${!!timeStartedAt}`);

		const isSolveEnd = !!timeStartedAt;

		if (isSolveEnd) {
			// Time and corrected moves come from the engine, which already ran the per-solve
			// linear fit and — on a recovery path — corrected the end stamp for a dropped
			// final packet. Recomputing the fit here would silently undo that correction, and
			// is how this page ended up disagreeing with the rooms page in the first place.
			//
			// Solve-end without an engine result should not happen; fall back to the fit so a
			// solve is never lost, but expect the engine to be the source.
			const fallback = solveResult
				? null
				: cubeTimestampLinearFit(smartTurns, timeStartedAt.getTime());
			const correctedMoves = solveResult?.correctedMoves ?? fallback!.correctedMoves;
			const finalTimeMilli: number | null = solveResult
				? solveResult.timeMs
				: Math.max(0, Math.round(fallback!.finalTimeMs));

			dbgTimer(`TIMER STOP | finalTimeMilli: ${finalTimeMilli} | moves: ${correctedMoves.length} | source: ${solveResult?.source || 'fallback-fit'} | correction: ${solveResult?.timeCorrectionMs ?? 0}ms`);

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
			// moves count as 1 (R R = R2 = 1, R U R = 2). Comes from the engine so the rooms
			// page reports the same number for the same solve.
			const htmCount = solveResult
				? solveResult.htmCount
				: countHTM(correctedMoves.map((m: any) => m.turn));

			endTimer(context, finalTimeMilli, {
				inspection_time: inspectionTime,
				smart_device_id: smartDeviceId,
				is_smart_cube: true,
				smart_turn_count: htmCount,
				smart_turns: smartTurnsToSave,
				// Tell the server which ladder to break the solve down with, so the
				// stored steps match what the user saw live.
				// Raw setting, not the display method: 'auto' must reach the server so it
				// can infer the method from the solve rather than assuming CFOP.
				analysis_method: solveMethod || 'auto',
			});

			const tps = finalTimeMilli && finalTimeMilli > 0
				? Number((htmCount / (finalTimeMilli / 1000)).toFixed(2))
				: 0;

			// Move count and TPS are cheap, so they go out with the time.
			setTimerParams({ lastSmartSolveStats: { turns: htmCount, tps } });

			// Corrected phase analysis: so LiveAnalysisOverlay shows correct times
			// correctedMoves.completedAt corrected via linear fit — more accurate than raw timestamps.
			//
			// Deferred by a tick on purpose. Running it inline costs ~75ms of blocked
			// main thread (measured over 26 solves) BEFORE React can paint the final
			// time, so the timer visibly hangs on the frozen value. The overlay it
			// feeds sits below the timer and does not need the same frame.
			if (analysisMode !== 'none') {
				const correctedTurns = correctedMoves.map(m => ({ ...m, time: m.completedAt }));
				const analysisStartState = startState;
				dbgCorr(`CORR_ANALYSIS scheduled | corrected.length=${correctedMoves.length} | htm=${htmCount} | startState=${analysisStartState?.length === 54 ? analysisStartState.slice(0, 27) + '...' : `INVALID(len=${analysisStartState?.length})`}`);
				setTimeout(() => {
					try {
						const correctedAnalysis = analyzeCurrentState(correctedTurns, analysisStartState, resolveAnalysisMethod(solveMethod, analysisMode));
						dbgCorr(`CORR_ANALYSIS success | phase=${correctedAnalysis.currentPhase} | crossSolved=${correctedAnalysis.crossSolved} | isSolved=${correctedAnalysis.isSolved} | oll=${correctedAnalysis.ollIdentified || '-'} | pll=${correctedAnalysis.pllIdentified || '-'} | times=${JSON.stringify(correctedAnalysis.times)}`);
						setTimerParams({
							lastSmartSolveStats: { turns: htmCount, tps, correctedAnalysis }
						});
					} catch (e: any) {
						// If analysis fails, simple stats from endTimer are sufficient
						dbgCorr(`CORR_ANALYSIS FAIL | message=${e?.message} | startStateLen=${analysisStartState?.length} | corrLen=${correctedTurns.length} | stack=${e?.stack?.slice(0, 200)}`);
					}
				}, 0);
			}
		}

		if (isSolveEnd) originalScrambleRef.current = '';

		// If this reset is because we finished scrambling, preserve the scramble alg
		if (isScrambleFinish) {
			// CRITICAL FIX: Use the ORIGINAL scramble (target state), not the current transient 'scramble'
			// (which might be just a short correction path).
			preservedScrambleRef.current = originalScrambleRef.current || scramble;
			lateScrambleDropsRef.current = 0;

			// The engine aligned its tracker to the scramble target before emitting
			// SCRAMBLE_COMPLETE, so phase tracking reads the state from there.
			const scrambledState = engineRef.current?.trackerState || DEFAULT_SOLVED_STATE;
			setStartState(scrambledState);

			if (targetFaceletsRef.current && scrambledState !== targetFaceletsRef.current) {
				console.warn('[SmartCube] tracker does not match the scramble target after rebuild — solve detection may be unreliable');
			}
		} else {
			preservedScrambleRef.current = null;
			// "Mark as solved" / "reset cube state": the tracker must follow, otherwise
			// it keeps the pre-reset state and the next solve never registers as done.
			if (markSolved) engineRef.current?.markSolved();
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
				// Raw setting, not the display method: 'auto' must reach the server so it
				// can infer the method from the solve rather than assuming CFOP.
				analysis_method: solveMethod || 'auto',
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
			// Web-only pre-connection info screen (browser/Chrome-flag guidance + app links).
			if (!(await showBleConnectInfo())) return;
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
			smartScanDevices: [],
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
			smartGyroSupported: false,
			smartOutOfSync: false,
		});
	}

	function toggleManageSmartCubes() {
		dispatch(openModal(<ManageSmartCubes />, { title: t('smart_cube.manage_smart_cubes') }));
	}

	async function markCubeAsSolved() {
		// The cube keeps its own state in firmware. Without telling it to reset, it
		// keeps reporting the stale (scrambled) facelets and overwrites everything we
		// set here on its very next FACELETS packet — which is why marking a solved
		// cube as solved appeared to do nothing after a reconnect.
		const activeCube = (connect.current as any)?.activeCube;
		if (activeCube?.resetCubeState) {
			const done = await activeCube.resetCubeState();
			if (!done) {
				console.warn('[SmartCube] hardware state reset failed — cube may keep reporting the old state');
			}
		}

		resetMoves(true);

		// Force state to solved
		setTimerParams({
			smartCurrentState: DEFAULT_SOLVED_STATE,
			smartPhysicallySolved: true,
			smartOutOfSync: false,
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
		if (activeCube && activeCube._trackerCube) {
			activeCube._trackerCube = new Cube();
		}
	}

	function resetGyro() {
		cubeViewRef.current?.resetGyro();
	}

	let actionButton = null;
	const dropdown = (
		<Dropdown
			openUp={!mobileMode}
			dropdownButtonProps={{ transparent: true, className: 'zt-smart-cube__gear-btn', noMargin: true }}
			icon={<Gear size={18} />}
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
		// The action button below carries the same bluetooth glyph, so repeating it
		// in the status row only duplicates the icon and costs a row of height.
		emblem = null;
		actionButton = (
			<div className="zt-timer__connect-trigger zt-timer__connect-trigger--disabled">
				<Emblem small orange icon={<Bluetooth />} text={t('smart_cube.scanning_short')} />
			</div>
		);
		battery = null;
	} else if (smartCubeConnecting) {
		emblem = null;
		actionButton = (
			<div className="zt-timer__connect-trigger zt-timer__connect-trigger--disabled">
				<Emblem small orange icon={<Bluetooth />} text={t('smart_cube.connecting').replace('...', '')} />
			</div>
		);
		battery = null;
	} else if (smartCubeConnected) {
		// Connection is already conveyed by the battery percentage shown under the
		// cube, so the bluetooth glyph is redundant and only crowds the timer on
		// short screens. Keep the emblem as a fallback indicator only when the
		// battery readout is hidden (cube visual off or level unavailable).
		const batteryVisible = smartCubeShow && typeof smartCubeBatteryLevel === 'number';
		emblem = batteryVisible ? null : <Emblem small green icon={<Bluetooth />} />;
	} else {
		emblem = null;
		actionButton = (
			<div className="zt-timer__connect-trigger" onClick={connectBluetooth} role="button">
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
				{/* Kept mounted even when hidden: tearing the player down would lose the
				    visual state, and the mirror would have to replay from scratch. */}
				<div className={b('cube', { hidden: !smartCubeShow })}>
					<SmartCubeView
						ref={cubeViewRef}
						connect={connect.current}
						connected={smartCubeConnected}
						size={effectiveCubeSize}
						keepVisualOnClear={!!preservedScrambleRef.current}
						onStreamCleared={() => {
							// Only when the clear was not a finished scramble: resetMoves already
							// set startState in that case, and overwriting it here would race.
							if (!preservedScrambleRef.current) {
								setStartState(engineRef.current?.trackerState || DEFAULT_SOLVED_STATE);
							}
						}}
					/>
				</div>
				{/* Mobile keeps the status row directly under the cube. On desktop and
				    tablet it moves into the side cluster next to the cube (see below) so
				    the whole block is one row tall instead of three. */}
				{mobileMode && (
					<div className={b('status')}>
						{emblem}
						{smartCubeShow && battery && (
							<div className={b('battery')}>
								{battery}
							</div>
						)}
						{dropdown}
					</div>
				)}
				{!mobileMode && (
					<div className={b('stats-container')}>
						<LiveAnalysisOverlay startState={startState || engineRef.current?.trackerState || null} />
						<SmartStats />
					</div>
				)}
				{mobileMode && domReady && ReactDOM.createPortal(
					<>
						{actionButton && (
							<div className="zt-timer__mobile-action">
								{actionButton}
							</div>
						)}
						<LiveAnalysisOverlay
							startState={startState || engineRef.current?.trackerState || null}
							mobile={true}
						/>
						<SmartStats mobile={true} />
					</>,
					document.getElementById('mobile-smart-phases-container') || document.body
				)}
			</div>
			{/* Side cluster: connect button on top, status row (charge % + gear menu)
			    underneath, both sitting to the right of the cube. */}
			{!mobileMode && (
				<div className={b('side')}>
					{actionButton}
					<div className={b('status')}>
						{emblem}
						{smartCubeShow && battery && (
							<div className={b('battery')}>
								{battery}
							</div>
						)}
						{dropdown}
					</div>
				</div>
			)}
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
