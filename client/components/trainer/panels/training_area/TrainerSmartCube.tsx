import React, {useState, useEffect, useRef, useCallback} from 'react';
import block from '../../../../styles/bem';
import {useTrainerContext} from '../../TrainerContext';
import {
	expandNotation,
	cleanAlgorithmForCubing,
	getOrientationRotation,
	getStickering,
	getPuzzleType,
	isLLCategory,
	getDefaultFrontFace,
	getEffectiveOrientation,
	buildRandomAUFAlg,
	ensureCubingReady,
	simplifyAlg,
	getInverseMove,
} from '../../../../util/trainer/algorithm_engine';
import {
	ensureKPuzzleReady,
	getKPuzzle,
	faceletsToPattern,
	fixOrientation,
	isIdenticalIgnoringCenters,
} from '../../../../util/trainer/pattern_utils';
import {getRemappedMask} from '../../../../util/trainer/stickering_remap';
import {addTime, incrementFailCount, resetFailCount, checkAutoLearn} from '../../hooks/useAlgorithmData';
import {useWakeLock} from '../../../../util/hooks/useWakeLock';
import {algToId} from '../../../../util/trainer/algorithm_engine';
import {cubeTimestampLinearFit} from '../../../../util/smart_cube_timing';
import {onVisibilityChange} from '../../../../util/app-visibility';
import type {TwistyPlayer} from 'cubing/twisty';
import type {KPattern} from 'cubing/kpuzzle';
import type {SmartTurn} from '../../types';
import * as THREE from 'three';
import {calculateNetRotationQuat} from '../../../../util/cube_rotation_quat';
import {useSettings} from '../../../../util/hooks/useSettings';
import ScrambleMoveList, {isGreenBaseColor} from '../../../timer/time_display/timer_scramble/smart_scramble/ScrambleMoveList';
import {sequenceMatchStatus} from '../../../timer/time_display/timer_scramble/smart_scramble/scramble_move_state';
import {HOME_TILT_DEG, HOME_TURN_DEG} from '../../../timer/smart_cube/cube_view/view_defaults';
import {recolorPuzzle} from '../../../timer/smart_cube/cube_view/cube_palette';
import {getSmartCubeManager} from '../../../../util/smart_cube/connection_manager';
import {SmartAlgTracker, CubeStateOps} from '../../../../util/trainer/smart_alg_tracker';

const b = block('trainer');

// The move matching rules live in util/trainer/smart_alg_tracker.ts (tested in node). Here they
// run on cubing.js KPatterns: centers are ignored and orientation fixed, which is what makes
// wide moves, slices and rotations match the plain face turns the cube reports.
const KPATTERN_OPS: CubeStateOps<KPattern> = {
	apply: (state, move) => state.applyMove(move),
	normalize: fixOrientation,
	same: isIdenticalIgnoringCenters,
};

export default function TrainerSmartCube() {
	const {state, dispatch} = useTrainerContext();
	const {currentAlgorithm, options} = state;

	// Wake lock — screen should not turn off when smart cube is connected
	useWakeLock(options.wakeLockEnabled && state.smartConnected);

	// Camera pad state
	const [isDragging, setIsDragging] = useState(false);
	const padRef = useRef<HTMLDivElement>(null);

	// Flashing error indicator — animation re-triggers after each key increment
	const [flashKey, setFlashKey] = useState(0);

	// TwistyPlayer refs
	const containerRef = useRef<HTMLDivElement>(null);
	const twistyPlayerRef = useRef<TwistyPlayer | null>(null);

	// Gyro refs
	const twistySceneRef = useRef<THREE.Scene | null>(null);
	const twistyVantageRef = useRef<any>(null);
	const gyroBasisRef = useRef<THREE.Quaternion | null>(null);
	// Shared with the timer's cube view so both show the cube from the same angle.
	const HOME_ORIENTATION = useRef(
		new THREE.Quaternion().setFromEuler(new THREE.Euler(HOME_TILT_DEG * Math.PI / 180, -HOME_TURN_DEG * Math.PI / 180, 0))
	);
	const cubeQuaternion = useRef(HOME_ORIENTATION.current.clone());
	const animFrameRef = useRef<number | null>(null);
	// Same sticker palette as the timer's cube view; see cube_palette.ts.
	const paletteDoneRef = useRef(new WeakSet<object>());
	const recolorPendingRef = useRef(true);
	const unsubGyroRef = useRef<(() => void) | null>(null);
	// Net rotation-aware gyro reset: uses previous algorithm's net rotation
	// in new basis calculation to correct drift while preserving orientation
	const netRotationQuatRef = useRef<THREE.Quaternion>(new THREE.Quaternion());
	const pendingNetRotRef = useRef<THREE.Quaternion | null>(null);

	// KPattern matching: tracked cube state, expected states, matched index, pending moves.
	const trackerRef = useRef<SmartAlgTracker<KPattern> | null>(null);
	if (trackerRef.current === null) trackerRef.current = new SmartAlgTracker<KPattern>(KPATTERN_OPS);
	// The pending moves are a turn in progress (first quarter of a U2, one face of an M).
	const [pendingPartial, setPendingPartial] = useState(false);
	// Did at least one wrong move happen during solve (for auto-learn + fail counter)
	const solveHasMistakeRef = useRef<boolean>(false);
	// True from algorithm load / reset until the first physical move. While true, FACELETS may
	// sync the tracked cube state (idle baseline / manual setup positioning). Once a move is processed
	// it flips false and FACELETS stops touching it — otherwise a FACELETS reporting the
	// intermediate state of a multi-move turn (e.g. the single-M of an M2 = R' L) would re-anchor
	// patternStates mid-sequence and desync the match permanently.
	const awaitingBaselineRef = useRef<boolean>(true);

	// Timer refs
	const solutionMovesRef = useRef<SmartTurn[]>([]);
	const timerStartRef = useRef<number>(0);
	const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

	// State refs (stale closure prevention)
	const smartPhaseRef = useRef(state.smartPhase);
	smartPhaseRef.current = state.smartPhase;
	const currentAlgorithmRef = useRef(currentAlgorithm);
	currentAlgorithmRef.current = currentAlgorithm;
	const isMoveMaskedRef = useRef(state.isMoveMasked);
	isMoveMaskedRef.current = state.isMoveMasked;
	const optionsRef = useRef(options);
	optionsRef.current = options;

	// -- Timer helpers --
	const startTimerInterval = useCallback(() => {
		if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
		timerStartRef.current = Date.now();
		dispatch({type: 'SET_TIMER_STATE', payload: 'RUNNING'});
		dispatch({type: 'SET_TIMER_VALUE', payload: 0});
		timerIntervalRef.current = setInterval(() => {
			dispatch({type: 'SET_TIMER_VALUE', payload: Date.now() - timerStartRef.current});
		}, 30);
	}, [dispatch]);

	const stopTimerInterval = useCallback(() => {
		if (timerIntervalRef.current) {
			clearInterval(timerIntervalRef.current);
			timerIntervalRef.current = null;
		}
	}, []);

	// -- Solve complete --
	const handleSolveComplete = useCallback(() => {
		stopTimerInterval();

		let finalTime = Date.now() - timerStartRef.current;
		if (solutionMovesRef.current.length > 0) {
			const hasCubeTimestamps = solutionMovesRef.current.some(m => m.cubeTimestamp != null);
			if (hasCubeTimestamps) {
				const result = cubeTimestampLinearFit(solutionMovesRef.current, timerStartRef.current);
				if (result.finalTimeMs > 0) finalTime = result.finalTimeMs;
			}
		}

		dispatch({type: 'SET_TIMER_VALUE', payload: finalTime});
		dispatch({type: 'SET_TIMER_STATE', payload: 'STOPPED'});
		dispatch({type: 'SMART_SET_PHASE', payload: 'completed'});

		const alg = currentAlgorithmRef.current;
		if (alg) {
			const algId = algToId(alg.algorithm);
			const hadMistakes = solveHasMistakeRef.current;
			addTime(algId, finalTime, hadMistakes ? 1 : 0);
			// Fail counter: increment if mistakes, reset if clean solve
			if (hadMistakes) {
				incrementFailCount(algId);
			} else {
				resetFailCount(algId);
			}
			// Auto-update Learning State: mark "learned" if last N solves are clean
			if (optionsRef.current.autoLearnEnabled) {
				checkAutoLearn(algId, optionsRef.current.autoLearnThreshold);
			}
		}
		solveHasMistakeRef.current = false;

		// Move to next algorithm (minimal delay — for completion feedback)
		setTimeout(() => {
			dispatch({type: 'ADVANCE_ALGORITHM'});
		}, 150);
	}, [dispatch, stopTimerInterval]);

	// -- Core move processing (KPattern matching, see SmartAlgTracker) --
	const processMove = useCallback((smartTurn: SmartTurn) => {
		const move = smartTurn.turn;
		const tracker = trackerRef.current;
		if (!tracker || !tracker.isReady()) return;
		// User is physically turning → the tracked state is move-driven from here on.
		// FACELETS must not overwrite it mid-sequence (see alertCubeState).
		awaitingBaselineRef.current = false;

		// Update 3D visualization
		if (twistyPlayerRef.current) {
			(twistyPlayerRef.current as any).experimentalAddMove(move, {cancel: false});
		}

		// Null after the algorithm was completed: the move is applied so the next algorithm
		// starts from the right state, but not judged against the old one.
		const result = tracker.push(move, isMoveMaskedRef.current);
		if (!result) return;

		// The attempt starts on the first physical move, right or wrong. A wrong first move
		// used to be taken for a setup move and ignored, which left the expectations anchored
		// before it, so nothing after it matched either (2.8-c).
		if (result.started) {
			solutionMovesRef.current = [smartTurn];
			dispatch({type: 'SMART_SET_PHASE', payload: 'solving'});
			startTimerInterval();
		} else {
			solutionMovesRef.current.push(smartTurn);
		}

		if (result.mistake) {
			solveHasMistakeRef.current = true;
			// Flashing error indicator (if user enabled error indicator setting)
			if (optionsRef.current.flashingError) {
				setFlashKey((k) => k + 1);
			}
		}

		// Mask mode — no per-move matching, only solved detection
		if (result.verdict !== 'masked') {
			dispatch({type: 'SET_MATCHED_MOVE_COUNT', payload: result.matchedCount});
			dispatch({type: 'SET_BAD_ALG', payload: result.bad});
			setPendingPartial(result.partial);
		}

		if (result.completed) {
			handleSolveComplete();
		}
	}, [dispatch, startTimerInterval, handleSolveComplete]);

	// -- patternStates rebuilder (also called on FACELETS update) --
	// Re-anchors the tracker's expected states on its current cube state.
	// When user is setting up cube, FACELETS arrives, the tracked state is updated,
	// and we call this to keep the expected states' initial state current.
	const rebuildPatternStates = useCallback(async () => {
		await ensureCubingReady();
		await ensureKPuzzleReady();
		const kpuzzle = getKPuzzle();
		const tracker = trackerRef.current;
		if (!kpuzzle || !tracker || !tracker.hasAlgorithm()) return;
		if (!tracker.getCurrent()) tracker.setCurrent(kpuzzle.defaultPattern());
		tracker.rebuild();
	}, []);

	// -- Gyro subscription helper --
	// Through the manager rather than straight off the cube instance: the cube can be
	// replaced under us by an auto-reconnect, and the manager also stops processing gyro
	// packets entirely when no page is subscribed.
	const subscribeToGyro = useCallback(() => {
		if (unsubGyroRef.current) return;
		unsubGyroRef.current = getSmartCubeManager().subscribeGyro((event: any) => {
			if (event.quaternion) {
				const {x: qx, y: qy, z: qz, w: qw} = event.quaternion;
				const quat = new THREE.Quaternion(qx, qz, -qy, qw).normalize();
				if (!gyroBasisRef.current) {
					// Lazy basis capture — triggered on first gyro event.
					// If pendingNetRot exists: basis = netRot × conj(quat)
					// Thus display = HOME × netRot × conj(quat) × quat = HOME × netRot
					// (previous algorithm's net rotation is preserved, drift is corrected)
					const baseConj = quat.clone().conjugate();
					const pending = pendingNetRotRef.current;
					if (pending) {
						gyroBasisRef.current = pending.clone().multiply(baseConj);
						pendingNetRotRef.current = null;
					} else {
						gyroBasisRef.current = baseConj;
					}
				}
				cubeQuaternion.current.copy(
					quat.premultiply(gyroBasisRef.current).premultiply(HOME_ORIENTATION.current)
				);
			}
		});
	}, []);

	// handleSolveComplete ref (FACELETS callback'de stale closure onlemi)
	const handleSolveCompleteRef = useRef(handleSolveComplete);
	handleSolveCompleteRef.current = handleSolveComplete;

	// -- BLE subscriptions (move/gyro/facelets) --
	// `turnStream: false` on the attachment: the trainer processes moves here and never reads
	// `timer.smartTurns`, so mirroring them into Redux would only grow an array nobody empties.
	useEffect(() => {
		const manager = getSmartCubeManager();
		const detach = manager.attach({turnStream: false});

		// Move stream, processed directly with no Redux round trip.
		const unsubMoves = manager.subscribeMoves(({moves}) => {
			moves.forEach((move) => processMove(move as SmartTurn));
		});

		// FACELETS callback: engine state synchronization
		// - During solving: does NOT overwrite (breaks per-move kpattern matching)
		// - Outside solving (ready/idle/completed): overwrites — reflects physical cube state
		// - When phase='ready': also rebuilds patternStates — to keep initialState current while
		//   user is setting up. This way, mask mode + own method solving in mid-solve categories
		//   like F2L is also caught.
		// - During solving: if the physical cube reached the algorithm's end state, handleSolveComplete
		//   is triggered (safety net). Never "solved": see SmartAlgTracker.reportState.
		const unsubFacelets = manager.subscribeFacelets((faceletStr: string) => {
			const pattern = faceletsToPattern(faceletStr);

			if (smartPhaseRef.current === 'solving') {
				// No overwrite during solving — only the end state safety net
				if (pattern && trackerRef.current?.reportState(pattern)) {
					handleSolveCompleteRef.current();
				}
				return;
			}

			if (!pattern) return;

			// Once the user has started turning (a move processed since the last reset / algorithm
			// load), myKpattern is driven SOLELY by move events. A FACELETS here would otherwise
			// overwrite an in-progress multi-move state — e.g. the intermediate single-M (R' L) of
			// an M2 — and re-anchor patternStates to it, desyncing the per-move match permanently
			// (matchIdx stuck at -1). Only sync from FACELETS while still awaiting the first move
			// (idle baseline / manual setup positioning).
			if (!awaitingBaselineRef.current) return;

			// Idle / setup positioning: reflect physical cube state.
			trackerRef.current?.setCurrent(pattern);

			// While awaiting the first move in 'ready', rebuild patternStates so the initialState
			// tracks the physical cube (supports manually setting the cube up before starting).
			if (smartPhaseRef.current === 'ready' && trackerRef.current?.hasAlgorithm()) {
				rebuildPatternStates();
			}
		});

		// The cube may already be connected (paired in the selection view, or on another page
		// entirely). The manager's subscription survives a reconnect swapping the cube out, so
		// this is a single call rather than a per-cube hook.
		subscribeToGyro();

		return () => {
			unsubMoves();
			unsubFacelets();
			detach();
			unsubGyroRef.current?.();
			unsubGyroRef.current = null;
		};
	}, [processMove, subscribeToGyro, rebuildPatternStates]);

	// -- TwistyPlayer + Gyro animation loop --
	useEffect(() => {
		if (!containerRef.current) return;
		containerRef.current.innerHTML = '';
		if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);

		let cancelled = false;
		let unsubVisibility: (() => void) | undefined;

		const initTwisty = async () => {
			const {TwistyPlayer} = await import('cubing/twisty');
			if (cancelled) return;

			const player = new TwistyPlayer({
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
				tempoScale: 5,
				backView: options.backView === 'none' ? 'none' : (options.backView as any),
			});

			if (containerRef.current && !cancelled) {
				containerRef.current.appendChild(player);
				player.style.width = '100%';
				player.style.height = '100%';
				twistyPlayerRef.current = player;
			}

			// Gyro SLERP animation loop
			let animRunning = true;
			const animate = async () => {
				if (cancelled || !animRunning) return;

				if (!twistySceneRef.current || !twistyVantageRef.current) {
					try {
						const vantageList = await (player as any).experimentalCurrentVantages();
						twistyVantageRef.current = [...vantageList][0];
						twistySceneRef.current = await twistyVantageRef.current.scene.scene();
						recolorPendingRef.current = true;
					} catch {
						// Scene not yet ready
					}
				}

				if (twistySceneRef.current && twistyVantageRef.current) {
					// Once per puzzle. It stays applied through stickering and algorithm
					// changes, which the trainer makes on every case.
					if (recolorPendingRef.current) {
						const result = recolorPuzzle(twistySceneRef.current, paletteDoneRef.current);
						if (result !== 'not-found') recolorPendingRef.current = false;
					}
					twistySceneRef.current.quaternion.slerp(cubeQuaternion.current, 0.25);
					twistyVantageRef.current.render();
				}

				animFrameRef.current = requestAnimationFrame(animate);
			};
			animate();

			unsubVisibility = onVisibilityChange((visible: boolean) => {
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
		};

		initTwisty();

		return () => {
			cancelled = true;
			unsubVisibility?.();
			if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
			if (containerRef.current) containerRef.current.innerHTML = '';
			twistyPlayerRef.current = null;
			twistySceneRef.current = null;
			twistyVantageRef.current = null;
		};
		// backView is a TwistyPlayer constructor option — cannot be changed at runtime,
		// player must be recreated to reflect the change.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [options.backView]);

	// -- Build patternStates when algorithm changes --
	useEffect(() => {
		if (!currentAlgorithm) return;

		const setupPatterns = async () => {
			await ensureCubingReady();
			await ensureKPuzzleReady();
			const kpuzzle = getKPuzzle();
			if (!kpuzzle) return;

			// Parse algorithm moves (including AUF)
			// cleanAlgorithmForCubing: normalizes Rw→r, smart quotes, single-move parens
			// This normalization is critical in custom alternative algorithms
			const expandedAlg = cleanAlgorithmForCubing(currentAlgorithm.algorithm);
			const algMoves = buildRandomAUFAlg(
				expandedAlg.split(/\s+/),
				currentAlgorithm.category,
				options.randomizeAUF
			);

			// Net rotation-aware gyro reset:
			// Save previous algorithm's net rotation, then null basis.
			// On first gyro event in callback, calculate new basis = netRot × conj(hardwareQuat).
			// This corrects drift while preserving algorithm's net rotation.
			pendingNetRotRef.current = netRotationQuatRef.current.clone();
			gyroBasisRef.current = null;

			// Expected states from the current cube state (reflects the physical cube via FACELETS
			// when BLE is connected; solved if nothing is known yet), progress cleared.
			trackerRef.current?.load(algMoves, kpuzzle.defaultPattern());

			// Calculate and save net rotation for this algorithm.
			// Will be used to adjust gyro basis on next algorithm transition.
			netRotationQuatRef.current = calculateNetRotationQuat(algMoves);

			solutionMovesRef.current = [];
			setPendingPartial(false);
			solveHasMistakeRef.current = false;
			// New algorithm → allow FACELETS baseline sync until the first physical move.
			awaitingBaselineRef.current = true;

			dispatch({type: 'SET_MATCHED_MOVE_COUNT', payload: 0});
			dispatch({type: 'SET_TOTAL_EXPECTED_MOVES', payload: algMoves.length});
			dispatch({type: 'SET_BAD_ALG', payload: []});
			dispatch({type: 'SMART_SET_PHASE', payload: 'ready'});
			dispatch({type: 'SET_USER_ALG', payload: algMoves});
			dispatch({type: 'SET_ORIGINAL_USER_ALG', payload: algMoves});

			// Update visual TwistyPlayer
			if (twistyPlayerRef.current) {
				const isLL = isLLCategory(currentAlgorithm.category);
				// If whiteOnBottom preset is active, top/front face is overridden
				const effective = getEffectiveOrientation({
					topFace: options.topFace,
					frontFace: options.frontFace,
					whiteOnBottom: options.whiteOnBottom,
				});
				const effectiveFront = isLL ? getDefaultFrontFace(effective.topFace) : effective.frontFace;
				const rotation = getOrientationRotation(effective.topFace, effectiveFront);
				const stickering = getStickering(currentAlgorithm.category);
				const is3x3 = getPuzzleType(currentAlgorithm.category) === '3x3x3';

				// Cubing.js Alg — calculate inverse
				const {Alg} = await import('cubing/alg');
				const inverseAlg = Alg.fromString(algMoves.join(' ')).invert().toString();
				const setupAlg = rotation ? `${rotation} ${inverseAlg}` : inverseAlg;

				(twistyPlayerRef.current as any).alg = '';
				(twistyPlayerRef.current as any).experimentalSetupAlg = setupAlg;

				// Stickering
				const baseStickering = is3x3 ? stickering : 'full';
				if (baseStickering !== 'full') {
					(twistyPlayerRef.current as any).experimentalStickering = baseStickering;
					// Custom mask for rotated orientations
					const customMask = await getRemappedMask(baseStickering, rotation);
					if (customMask) {
						(twistyPlayerRef.current as any).experimentalStickeringMaskOrbits = customMask;
					}
				} else {
					(twistyPlayerRef.current as any).experimentalStickering = 'full';
				}
			}
		};

		setupPatterns();
	}, [currentAlgorithm, options.randomizeAUF, options.topFace, options.frontFace, options.whiteOnBottom, dispatch]);

	// Clean up timer on unmount or external phase change (manual stop)
	useEffect(() => {
		if (state.smartPhase === 'completed') {
			stopTimerInterval();
		}
		return () => {
			stopTimerInterval();
		};
	}, [state.smartPhase, stopTimerInterval]);

	// -- Partial/wide match detection (CubeDex approach) --
	// GAN cubes only report 6 face moves (URFDLB). Wide (r,l,f,b,u,d),
	// slice (M,E,S), and rotation (x,y,z) moves are physically performed but
	// come across BLE as different face turns. Therefore, at display level,
	// we show half/intermediate moves as partial, not as error.
	// Decided by the tracker on cube states, the same verdict that counts and flashes a mistake,
	// so it also holds after rotations and wide moves, where the reported face letter differs
	// from the written one. The letter based guesses that used to sit here showed real mistakes
	// as "half" with no fix text (R done for R', or any single wrong move in an algorithm with a
	// wide, slice or rotation move) while the same move flashed red and was counted.
	const isHalfMatch = state.badAlg.length > 0 && pendingPartial;

	// -- Correction moves display --
	const correctionText = (state.badAlg.length > 0 && !isHalfMatch)
		? simplifyAlg(state.badAlg.map(m => getInverseMove(m)).reverse().join(' '))
		: '';

	// -- Algorithm move list --
	// Drawn by the same component as the timer's smart scramble, so a move being
	// drilled confirms and recedes exactly the way a scramble move does. Only the
	// input differs: the trainer knows a done count and a verdict on the move in
	// progress, not an engine status array, so it is converted here.
	const algMatchStatus = sequenceMatchStatus(
		state.userAlg.length,
		state.matchedMoveCount,
		state.badAlg.length > 0 ? (isHalfMatch ? 'half' : 'wrong') : undefined
	);
	// Green-based themes: confirm in blue so it stands out from green move text.
	const useBlueMatch = isGreenBaseColor(useSettings('text_color'));

	// -- Issue 4a: Menu handlers --
	const handleResetState = useCallback(async () => {
		const kpuzzle = getKPuzzle();
		if (kpuzzle) {
			trackerRef.current?.setCurrent(kpuzzle.defaultPattern());
		}
		// TwistyPlayer visual reset
		if (twistyPlayerRef.current) {
			(twistyPlayerRef.current as any).alg = '';
		}
		// Tracker cube reset (GAN)
		const cube = getSmartCubeManager().activeCube;
		if (cube?._trackerCube) {
			const CubeJS = (await import('cubejs')).default;
			cube._trackerCube = new CubeJS();
		}
		trackerRef.current?.resetProgress();
		setPendingPartial(false);
		solutionMovesRef.current = [];
		solveHasMistakeRef.current = false;
		// Reset → allow FACELETS baseline sync until the first physical move.
		awaitingBaselineRef.current = true;
		stopTimerInterval();
		dispatch({type: 'SET_MATCHED_MOVE_COUNT', payload: 0});
		dispatch({type: 'SET_BAD_ALG', payload: []});
		dispatch({type: 'SET_TIMER_STATE', payload: 'IDLE'});
		dispatch({type: 'SET_TIMER_VALUE', payload: 0});
		dispatch({type: 'SMART_SET_PHASE', payload: 'ready'});
	}, [dispatch, stopTimerInterval]);

	const handleResetGyro = useCallback(() => {
		gyroBasisRef.current = null;
		pendingNetRotRef.current = null; // Manual reset — no net rotation compensation
	}, []);

	// -- Toolbar event listeners (reset/gyro from toolbar buttons) --
	useEffect(() => {
		const onReset = () => handleResetState();
		const onGyroReset = () => handleResetGyro();

		window.addEventListener('trainer:smart-reset', onReset);
		window.addEventListener('trainer:smart-gyro-reset', onGyroReset);

		return () => {
			window.removeEventListener('trainer:smart-reset', onReset);
			window.removeEventListener('trainer:smart-gyro-reset', onGyroReset);
		};
	}, [handleResetState, handleResetGyro]);

	// -- Issue 4b: Camera angle XY pad --
	const handlePadPointerDown = useCallback((e: React.PointerEvent) => {
		setIsDragging(true);
		(e.target as HTMLElement).setPointerCapture(e.pointerId);
	}, []);

	const handlePadPointerMove = useCallback((e: React.PointerEvent) => {
		if (!isDragging || !padRef.current) return;
		const rect = padRef.current.getBoundingClientRect();
		const nx = (e.clientX - rect.left) / rect.width - 0.5;
		const ny = (e.clientY - rect.top) / rect.height - 0.5;
		// Centred on the home angle, so touching the middle of the pad leaves the view
		// where it is instead of snapping it to a different default.
		const yaw = (-HOME_TURN_DEG + nx * 120) * Math.PI / 180;
		const pitch = (HOME_TILT_DEG - ny * 90) * Math.PI / 180;
		HOME_ORIENTATION.current.setFromEuler(new THREE.Euler(pitch, yaw, 0));
	}, [isDragging]);

	const handlePadPointerUp = useCallback(() => {
		setIsDragging(false);
	}, []);

	return (
		<div className={b('smart-cube-area')}>
			{/* 3D Cube */}
			<div className={b('smart-cube-wrapper')}>
				<div ref={containerRef} className={b('smart-cube-viewer')} style={{width: options.cubeSize, height: options.cubeSize}} />
				{options.flashingError && flashKey > 0 && (
					<div key={flashKey} className={b('error-flash')} />
				)}
				{state.showCameraPad && (
					<div
						ref={padRef}
						className={b('smart-camera-pad')}
						onPointerDown={handlePadPointerDown}
						onPointerMove={handlePadPointerMove}
						onPointerUp={handlePadPointerUp}
						onPointerCancel={handlePadPointerUp}
					>
						<div className={b('smart-camera-dot')} />
					</div>
				)}
			</div>

			{/* Solution moves */}
			{state.userAlg.length > 0 && !state.isMoveMasked && (
				<div className={b('smart-moves')}>
					<ScrambleMoveList moves={state.userAlg} matchStatus={algMatchStatus} useBlueMatch={useBlueMatch} />
				</div>
			)}

			{correctionText && (
				<div className={b('smart-correction')}>
					Fix: {correctionText}
				</div>
			)}
		</div>
	);
}
