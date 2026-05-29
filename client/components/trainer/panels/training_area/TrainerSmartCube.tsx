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
	SOLVED_STATE as SOLVED_FACELETS,
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

const b = block('trainer');

export default function TrainerSmartCube() {
	const {state, dispatch, connectRef} = useTrainerContext();
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
	const HOME_ORIENTATION = useRef(
		new THREE.Quaternion().setFromEuler(new THREE.Euler(15 * Math.PI / 180, -20 * Math.PI / 180, 0))
	);
	const cubeQuaternion = useRef(HOME_ORIENTATION.current.clone());
	const animFrameRef = useRef<number | null>(null);
	const unsubGyroRef = useRef<(() => void) | null>(null);
	// Net rotation-aware gyro reset: uses previous algorithm's net rotation
	// in new basis calculation to correct drift while preserving orientation
	const netRotationQuatRef = useRef<THREE.Quaternion>(new THREE.Quaternion());
	const pendingNetRotRef = useRef<THREE.Quaternion | null>(null);

	// KPattern matching refs
	const myKpatternRef = useRef<KPattern | null>(null);
	const patternStatesRef = useRef<KPattern[]>([]);
	const currentMoveIndexRef = useRef<number>(-1);
	const badAlgRef = useRef<string[]>([]);
	const lastMovesRef = useRef<{move: string}[]>([]);
	// Did at least one wrong move happen during solve (for auto-learn + fail counter)
	const solveHasMistakeRef = useRef<boolean>(false);
	// algMoves stable reference — for patternStates rebuild on FACELETS update
	const algMovesRef = useRef<string[]>([]);

	// Timer refs
	const solutionMovesRef = useRef<SmartTurn[]>([]);
	const timerStartRef = useRef<number>(0);
	const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

	// State refs (stale closure prevention)
	const smartPhaseRef = useRef(state.smartPhase);
	smartPhaseRef.current = state.smartPhase;
	const userAlgRef = useRef(state.userAlg);
	userAlgRef.current = state.userAlg;
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

	// -- BadAlg recovery (CubeDex port) --
	const handleBadAlg = useCallback(() => {
		const badAlg = badAlgRef.current;
		const lastMoves = lastMovesRef.current;
		const userAlg = userAlgRef.current;
		const idx = currentMoveIndexRef.current;

		// Case 1: Undo first correct move
		if (idx === 0 && badAlg.length === 1 &&
			lastMoves[lastMoves.length - 1]?.move === getInverseMove(userAlg[idx]?.replace(/[()]/g, '') || '')) {
			currentMoveIndexRef.current = -1;
			badAlgRef.current.pop();
		}
		// Case 2: Inverse of last wrong move
		else if (badAlg.length >= 2 &&
			lastMoves[lastMoves.length - 1]?.move === getInverseMove(badAlg[badAlg.length - 2])) {
			badAlgRef.current.pop();
			badAlgRef.current.pop();
		}
		// Case 3: 4 same moves (full rotation)
		else if (badAlg.length > 3 && lastMoves.length > 3 &&
			lastMoves[lastMoves.length - 1].move === lastMoves[lastMoves.length - 2].move &&
			lastMoves[lastMoves.length - 2].move === lastMoves[lastMoves.length - 3].move &&
			lastMoves[lastMoves.length - 3].move === lastMoves[lastMoves.length - 4].move) {
			badAlgRef.current.splice(-4, 4);
		}

		dispatch({type: 'SET_MATCHED_MOVE_COUNT', payload: Math.max(0, currentMoveIndexRef.current + 1)});
	}, [dispatch]);

	// -- Core move processing (KPattern matching) --
	const processMove = useCallback((smartTurn: SmartTurn) => {
		const move = smartTurn.turn;
		if (!myKpatternRef.current || patternStatesRef.current.length === 0) return;

		// Update 3D visualization
		if (twistyPlayerRef.current) {
			(twistyPlayerRef.current as any).experimentalAddMove(move, {cancel: false});
		}

		// Update KPattern
		myKpatternRef.current = myKpatternRef.current.applyMove(move);
		lastMovesRef.current.push({move});
		if (lastMovesRef.current.length > 256) {
			lastMovesRef.current = lastMovesRef.current.slice(-256);
		}

		// Solved detection helper — compare with algorithm's TARGET state.
		// patternStates' last element = initialState.applyAlg(algMoves) = physical target state.
		// Can be called regardless of phase (ready or solving).
		const checkSolvedFallback = (): boolean => {
			if (!myKpatternRef.current) return false;
			const targetState = patternStatesRef.current[patternStatesRef.current.length - 1];
			if (!targetState) return false;
			const fixedMy = fixOrientation(myKpatternRef.current);
			if (isIdenticalIgnoringCenters(fixedMy, targetState)) {
				handleSolveComplete();
				return true;
			}
			return false;
		};

		// Mask mode — no per-move matching, only solved detection
		if (isMoveMaskedRef.current) {
			checkSolvedFallback();
			return;
		}

		// KPattern matching — fixOrientation must be applied to both sides.
		const patterns = patternStatesRef.current;
		const fixedMyKpattern = fixOrientation(myKpatternRef.current);
		let matchIdx = -1;
		for (let i = 0; i < patterns.length; i++) {
			if (isIdenticalIgnoringCenters(fixedMyKpattern, patterns[i])) {
				// Auto-skip trailing rotations (fixOrientation produces same state)
				matchIdx = i;
				while (matchIdx + 1 < patterns.length &&
					isIdenticalIgnoringCenters(patterns[i], patterns[matchIdx + 1])) {
					matchIdx++;
				}
				break;
			}
		}

		// Phase='ready': try to match; if match, transition to solving, else it's setup move
		// (not added to badAlg). This way, while user is setting up cube,
		// engine doesn't report "wrong move".
		if (smartPhaseRef.current === 'ready') {
			if (matchIdx >= 0) {
				// Started applying algorithm
				currentMoveIndexRef.current = matchIdx;
				badAlgRef.current = [];
				dispatch({type: 'SMART_SET_PHASE', payload: 'solving'});
				dispatch({type: 'SET_MATCHED_MOVE_COUNT', payload: matchIdx + 1});
				dispatch({type: 'SET_BAD_ALG', payload: []});
				solutionMovesRef.current = [smartTurn];
				startTimerInterval();
				if (matchIdx === patterns.length - 1) {
					handleSolveComplete();
				}
			} else {
				// Setup move or own method — only solved detection
				checkSolvedFallback();
			}
			return;
		}

		// Phase='solving': normal matching flow
		solutionMovesRef.current.push(smartTurn);

		if (matchIdx >= 0) {
			currentMoveIndexRef.current = matchIdx;
			badAlgRef.current = [];
			dispatch({type: 'SET_MATCHED_MOVE_COUNT', payload: matchIdx + 1});
			dispatch({type: 'SET_BAD_ALG', payload: []});
			if (matchIdx === patterns.length - 1) {
				handleSolveComplete();
			}
		} else {
			badAlgRef.current.push(move);
			solveHasMistakeRef.current = true;
			// Flashing error indicator (if user enabled error indicator setting)
			if (optionsRef.current.flashingError) {
				setFlashKey((k) => k + 1);
			}
			handleBadAlg();
			dispatch({type: 'SET_BAD_ALG', payload: [...badAlgRef.current]});

			// Wrong algorithm tolerance: at least 1 correct move must be matched —
			// wrong+correct back to solved creates false positive.
			if (currentMoveIndexRef.current > 0) {
				checkSolvedFallback();
			}
		}
	}, [dispatch, startTimerInterval, handleSolveComplete, handleBadAlg]);

	// -- patternStates rebuilder (also called on FACELETS update) --
	// Builds patternStates from current myKpatternRef value + algMovesRef.
	// When user is setting up cube, FACELETS arrives, myKpattern is updated,
	// and we call this to keep patternStates' initialState current.
	const rebuildPatternStates = useCallback(async () => {
		await ensureCubingReady();
		await ensureKPuzzleReady();
		const kpuzzle = getKPuzzle();
		if (!kpuzzle) return;
		const algMoves = algMovesRef.current;
		if (algMoves.length === 0) return;

		const initialState = myKpatternRef.current ?? kpuzzle.defaultPattern();
		myKpatternRef.current = initialState;

		const pStates: KPattern[] = [];
		const apStates: KPattern[] = [];
		algMoves.forEach((move, index) => {
			const cleanMove = move.replace(/[()]/g, '');
			const prev = index === 0 ? initialState : apStates[index - 1];
			const applied = prev.applyMove(cleanMove);
			apStates[index] = applied;
			pStates[index] = fixOrientation(applied);
		});
		patternStatesRef.current = pStates;
	}, []);

	// -- Gyro subscription helper (Issue 3) --
	const subscribeToGyro = useCallback((cube: any) => {
		if (!cube?.subscribeGyro || unsubGyroRef.current) return;
		unsubGyroRef.current = cube.subscribeGyro((event: any) => {
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

	// -- BLE callback setup (move/gyro/facelets) --
	useEffect(() => {
		const conn = connectRef.current;
		if (!conn) return;

		// Move callbacks — process directly (Redux bypass)
		conn.alertTurnCube = (move: string) => processMove({
			turn: move.replace(/\s/g, ''),
			completedAt: Date.now(),
			cubeTimestamp: null,
			localTimestamp: null,
		});
		conn.alertTurnCubeBatch = (moves: any[]) => {
			if (!moves || moves.length === 0) return;
			const formatted: SmartTurn[] = moves.map((m: any) => ({
				turn: (m.move || m.turn || '').replace(/\s/g, ''),
				completedAt: m.timestamp || m.completedAt || Date.now(),
				cubeTimestamp: m.cubeTimestamp ?? null,
				localTimestamp: m.localTimestamp ?? null,
			}));
			formatted.forEach(processMove);
		};

		// FACELETS callback: engine state synchronization
		// - During solving: does NOT overwrite (breaks per-move kpattern matching)
		// - Outside solving (ready/idle/completed): overwrites — reflects physical cube state
		// - When phase='ready': also rebuilds patternStates — to keep initialState current while
		//   user is setting up. This way, mask mode + own method solving in mid-solve categories
		//   like F2L is also caught.
		// - During solving: if physical cube is SOLVED, handleSolveComplete is triggered (safety net).
		conn.alertCubeState = (faceletStr: string) => {
			if (smartPhaseRef.current === 'solving') {
				// No overwrite during solving — only solved detection safety net
				if (faceletStr === SOLVED_FACELETS) {
					handleSolveCompleteRef.current();
				}
				return;
			}

			const pattern = faceletsToPattern(faceletStr);
			if (!pattern) return;

			// Ready/idle/completed: reflect physical cube state
			myKpatternRef.current = pattern;

			// When phase='ready': rebuild patternStates — user might be setting up.
			// This way, when first algorithm move arrives, patternStates[0] is built
			// from current initialState.
			if (smartPhaseRef.current === 'ready' && algMovesRef.current.length > 0) {
				rebuildPatternStates();
			}
		};

		// Issue 3: Check for existing cube on mount (may have been connected in selection view)
		if (conn.activeCube) {
			subscribeToGyro(conn.activeCube);
		}

		// Callback for new cube connection
		conn._onCubeCreated = (cube: any) => subscribeToGyro(cube);

		return () => {
			unsubGyroRef.current?.();
			unsubGyroRef.current = null;
		};
	}, [connectRef, processMove, subscribeToGyro, rebuildPatternStates]);

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
					} catch {
						// Scene not yet ready
					}
				}

				if (twistySceneRef.current && twistyVantageRef.current) {
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
			algMovesRef.current = algMoves;

			// myKpatternRef reflects physical cube via FACELETS callback when BLE is connected;
			// if null, assume solved. patternStates is built from this initialState by applying algorithm.
			if (!myKpatternRef.current) {
				myKpatternRef.current = kpuzzle.defaultPattern();
			}

			// Net rotation-aware gyro reset:
			// Save previous algorithm's net rotation, then null basis.
			// On first gyro event in callback, calculate new basis = netRot × conj(hardwareQuat).
			// This corrects drift while preserving algorithm's net rotation.
			pendingNetRotRef.current = netRotationQuatRef.current.clone();
			gyroBasisRef.current = null;

			// Build patternStates (using rebuild helper)
			await rebuildPatternStates();

			// Calculate and save net rotation for this algorithm.
			// Will be used to adjust gyro basis on next algorithm transition.
			netRotationQuatRef.current = calculateNetRotationQuat(algMoves);

			currentMoveIndexRef.current = -1;
			badAlgRef.current = [];
			lastMovesRef.current = [];
			solutionMovesRef.current = [];
			solveHasMistakeRef.current = false;

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
	}, [currentAlgorithm, options.randomizeAUF, options.topFace, options.frontFace, options.whiteOnBottom, dispatch, rebuildPatternStates]);

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
	const matchedIdx = state.matchedMoveCount - 1;
	const nextExpected = state.userAlg[matchedIdx + 1]?.replace(/[()]/g, '') || '';

	const isHalfMatch = (() => {
		if (state.badAlg.length === 0 || !nextExpected || nextExpected.length <= 1) return false;

		const badCount = state.badAlg.length;
		const expectedBase = nextExpected[0];

		// Is there wide/slice/rotation in preceding moves or expected move?
		const precedingMoves = state.userAlg.slice(0, matchedIdx + 1).join(' ');
		const hasSliceOrWide = /[MESudlrbfxyz]/.test(precedingMoves) || /[MESudlrbfxyz]/.test(nextExpected);

		// Case 1: Single bad move + first letter match (R2→R, r2→R, U2→U, case-insensitive)
		if (badCount === 1 && state.badAlg[0][0].toUpperCase() === expectedBase.toUpperCase()) return true;

		// Case 2: Single bad move + algorithm has wide/slice/rotation move
		if (badCount === 1 && hasSliceOrWide) return true;

		// Case 3: 2-3 bad moves + M/E/S expected move (slice moves produce 2-3 face turns)
		if ((badCount === 2 || badCount === 3) && 'MES'.includes(expectedBase)) return true;

		return false;
	})();

	// -- Correction moves display --
	const correctionText = (state.badAlg.length > 0 && !isHalfMatch)
		? simplifyAlg(state.badAlg.map(m => getInverseMove(m)).reverse().join(' '))
		: '';

	// -- Issue 4a: Menu handlers --
	const handleResetState = useCallback(async () => {
		const kpuzzle = getKPuzzle();
		if (kpuzzle) {
			myKpatternRef.current = kpuzzle.defaultPattern();
		}
		// TwistyPlayer visual reset
		if (twistyPlayerRef.current) {
			(twistyPlayerRef.current as any).alg = '';
		}
		// Tracker cube reset (GAN)
		const cube = connectRef.current?.activeCube;
		if (cube?._trackerCube) {
			const CubeJS = (await import('cubejs')).default;
			cube._trackerCube = new CubeJS();
		}
		currentMoveIndexRef.current = -1;
		badAlgRef.current = [];
		lastMovesRef.current = [];
		solutionMovesRef.current = [];
		solveHasMistakeRef.current = false;
		stopTimerInterval();
		dispatch({type: 'SET_MATCHED_MOVE_COUNT', payload: 0});
		dispatch({type: 'SET_BAD_ALG', payload: []});
		dispatch({type: 'SET_TIMER_STATE', payload: 'IDLE'});
		dispatch({type: 'SET_TIMER_VALUE', payload: 0});
		dispatch({type: 'SMART_SET_PHASE', payload: 'ready'});
	}, [connectRef, dispatch, stopTimerInterval]);

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
		const yaw = (-20 + nx * 120) * Math.PI / 180;
		const pitch = (15 - ny * 90) * Math.PI / 180;
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
					{state.userAlg.map((move, i) => {
						let mod = 'dim';
						if (i <= matchedIdx) {
							mod = 'green';
						} else if (state.badAlg.length > 0 && i === matchedIdx + 1) {
							mod = isHalfMatch ? 'orange' : 'red';
						} else if (i === matchedIdx + 1) {
							mod = 'current';
						}
						return (
							<span key={i} className={b('smart-move', {[mod]: true})}>
								{move}
							</span>
						);
					})}
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
