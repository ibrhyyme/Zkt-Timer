import React, {useState, useEffect, useRef, useCallback} from 'react';
import block from '../../../../styles/bem';
import {useTrainerContext} from '../../TrainerContext';
import {
	cleanAlgorithmForCubing,
	getOrientationRotation,
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
import {caseDrawing, type CaseDrawing} from '../../../../util/trainer/case_drawing';
import {addTime, incrementFailCount, resetFailCount, checkAutoLearn} from '../../hooks/useAlgorithmData';
import {useWakeLock} from '../../../../util/hooks/useWakeLock';
import {algToId} from '../../../../util/trainer/algorithm_engine';
import {cubeTimestampLinearFit} from '../../../../util/smart_cube_timing';
import {isAppVisible, onVisibilityChange} from '../../../../util/app-visibility';
import type {KPattern} from 'cubing/kpuzzle';
import type {SmartTurn} from '../../types';
import * as THREE from 'three';
import {calculateNetRotationQuat} from '../../../../util/cube_rotation_quat';
import {useSettings} from '../../../../util/hooks/useSettings';
import ScrambleMoveList, {isGreenBaseColor} from '../../../timer/time_display/timer_scramble/smart_scramble/ScrambleMoveList';
import {sequenceMatchStatus} from '../../../timer/time_display/timer_scramble/smart_scramble/scramble_move_state';
import {HOME_TILT_DEG, HOME_TURN_DEG} from '../../../timer/smart_cube/cube_view/view_defaults';
import {CubeRenderer} from '../../../timer/smart_cube/cube_view/render/cube_renderer';
import {useCubePalette} from '../../../../util/cube_colors/useCubePalette';
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

	// The 3D cube: our engine (cube_view/render/), as the timer's live cube
	const containerRef = useRef<HTMLDivElement>(null);
	const cubeRef = useRef<CubeRenderer | null>(null);
	// The case the cube shows before any move: orientation rotation, then the algorithm undone.
	// Kept for "reset", which puts the cube back on it.
	const setupTurnsRef = useRef<string[]>([]);
	const setupLooksRef = useRef<CaseDrawing['looks']>(null);

	// The user's sticker colours, as on the timer's live cube.
	const cubeColors = useCubePalette();
	const faceColorsRef = useRef(cubeColors.nxn);
	faceColorsRef.current = cubeColors.nxn;
	const paletteKey = cubeColors.nxn.join(',');

	// Gyro refs
	const gyroBasisRef = useRef<THREE.Quaternion | null>(null);
	/** The last reading with its basis applied (identity before any): the camera pad turns the view around it. */
	const gyroRef = useRef(new THREE.Quaternion());
	// Shared with the timer's cube view so both show the cube from the same angle.
	const HOME_ORIENTATION = useRef(
		new THREE.Quaternion().setFromEuler(new THREE.Euler(HOME_TILT_DEG * Math.PI / 180, -HOME_TURN_DEG * Math.PI / 180, 0))
	);
	const cubeQuaternion = useRef(HOME_ORIENTATION.current.clone());
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
		cubeRef.current?.addMove(move);

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
				gyroRef.current.copy(quat.premultiply(gyroBasisRef.current));
				cubeQuaternion.current.copy(gyroRef.current).premultiply(HOME_ORIENTATION.current);
				// The renderer eases towards it, a quarter of the way per frame (as before).
				cubeRef.current?.setOrientation(cubeQuaternion.current);
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

	// -- 3D cube --
	// Built once, on the client. It draws only when something changes (a turn, the gyro, the
	// case), so a cube lying still costs nothing; the gyro eases in the renderer, a quarter of
	// the way per frame, as the old loop did.
	useEffect(() => {
		const container = containerRef.current;
		if (!container) return undefined;
		let cube: CubeRenderer;
		try {
			cube = new CubeRenderer({
				size: 3,
				faceColors: faceColorsRef.current,
				tableTilt: (HOME_TILT_DEG * Math.PI) / 180,
				orientation: cubeQuaternion.current,
			});
		} catch (error) {
			// No WebGL (blocked, lost, very old device): matching and the timer still work.
			console.error('[TrainerSmartCube] 3D view unavailable:', error);
			return undefined;
		}
		cube.setMoves(setupTurnsRef.current);
		cube.setCapLooks(setupLooksRef.current);
		cube.setBackView(optionsRef.current.backView);
		container.appendChild(cube.canvas);

		// Its box is sized by the cube size option, or by CSS on a phone.
		const fit = () => cube.resize(Math.max(1, Math.min(container.clientWidth, container.clientHeight)));
		fit();
		const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
		if (observer) observer.observe(container);
		else window.addEventListener('resize', fit);

		cube.setActive(isAppVisible());
		const unsubVisibility = onVisibilityChange((visible: boolean) => cube.setActive(visible));
		cubeRef.current = cube;

		return () => {
			if (observer) observer.disconnect();
			else window.removeEventListener('resize', fit);
			unsubVisibility();
			cube.dispose();
			if (cubeRef.current === cube) cubeRef.current = null;
		};
	}, []);

	// The back view is drawn in the same canvas: no rebuild.
	useEffect(() => {
		cubeRef.current?.setBackView(options.backView);
	}, [options.backView]);

	useEffect(() => {
		cubeRef.current?.setFaceColors(faceColorsRef.current);
	}, [paletteKey]);

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

			// The case on the 3D cube: the algorithm as drilled (with its AUF) undone after the
			// orientation rotation, and the category's stickering (case_drawing.ts, as the
			// trainer's other cube views).
			const isLL = isLLCategory(currentAlgorithm.category);
			// If whiteOnBottom preset is active, top/front face is overridden
			const effective = getEffectiveOrientation({
				topFace: options.topFace,
				frontFace: options.frontFace,
				whiteOnBottom: options.whiteOnBottom,
			});
			const effectiveFront = isLL ? getDefaultFrontFace(effective.topFace) : effective.frontFace;
			const drawing = await caseDrawing({
				category: currentAlgorithm.category,
				algorithm: algMoves.join(' '),
				topFace: effective.topFace,
				frontFace: effectiveFront,
			});
			// An algorithm the engine cannot read: the cube just turned to the orientation.
			setupTurnsRef.current = drawing
				? drawing.turns
				: getOrientationRotation(effective.topFace, effectiveFront).split(' ').filter(Boolean);
			setupLooksRef.current = drawing ? drawing.looks : null;
			cubeRef.current?.setMoves(setupTurnsRef.current);
			cubeRef.current?.setCapLooks(setupLooksRef.current);
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
		// Visual reset: back to the case
		cubeRef.current?.setMoves(setupTurnsRef.current);
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
		// Shown at once, also for a cube without a gyroscope (it used to wait for a reading).
		cubeQuaternion.current.copy(gyroRef.current).premultiply(HOME_ORIENTATION.current);
		cubeRef.current?.setOrientation(cubeQuaternion.current);
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
