import React, {useState, useEffect, useRef, useCallback} from 'react';
import block from '../../../../styles/bem';
import {useTranslation} from 'react-i18next';
import {ArrowCounterClockwise, Compass, Info} from 'phosphor-react';
import {useTrainerContext} from '../../TrainerContext';
import {
	expandNotation,
	getOrientationRotation,
	getStickering,
	getPuzzleType,
	isLLCategory,
	getDefaultFrontFace,
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
import {addTime} from '../../hooks/useAlgorithmData';
import {algToId} from '../../../../util/trainer/algorithm_engine';
import {cubeTimestampLinearFit} from '../../../../util/smart_cube_timing';
import {onVisibilityChange} from '../../../../util/app-visibility';
import type {TwistyPlayer} from 'cubing/twisty';
import type {KPattern} from 'cubing/kpuzzle';
import type {SmartTurn} from '../../types';
import * as THREE from 'three';

const b = block('trainer');

export default function TrainerSmartCube() {
	const {t} = useTranslation();
	const {state, dispatch, connectRef} = useTrainerContext();
	const {currentAlgorithm, options} = state;

	// Issue 4: Device info popup + camera pad
	const [showDeviceInfo, setShowDeviceInfo] = useState(false);
	const [isDragging, setIsDragging] = useState(false);
	const padRef = useRef<HTMLDivElement>(null);

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

	// KPattern matching refs
	const myKpatternRef = useRef<KPattern | null>(null);
	const patternStatesRef = useRef<KPattern[]>([]);
	const algPatternStatesRef = useRef<KPattern[]>([]);
	const currentMoveIndexRef = useRef<number>(-1);
	const badAlgRef = useRef<string[]>([]);
	const lastMovesRef = useRef<{move: string}[]>([]);

	// Timer refs
	const solutionMovesRef = useRef<SmartTurn[]>([]);
	const timerStartRef = useRef<number>(0);
	const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

	// State refs (stale closure onlemi)
	const smartPhaseRef = useRef(state.smartPhase);
	smartPhaseRef.current = state.smartPhase;
	const userAlgRef = useRef(state.userAlg);
	userAlgRef.current = state.userAlg;
	const currentAlgorithmRef = useRef(currentAlgorithm);
	currentAlgorithmRef.current = currentAlgorithm;
	const isMoveMaskedRef = useRef(state.isMoveMasked);
	isMoveMaskedRef.current = state.isMoveMasked;

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
			addTime(algToId(alg.algorithm), finalTime);
		}

		// Sonraki algoritmaya gec (minimal gecikme — tamamlanma geri bildirimi icin)
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

		// Case 1: Ilk dogru hamleyi geri alma
		if (idx === 0 && badAlg.length === 1 &&
			lastMoves[lastMoves.length - 1]?.move === getInverseMove(userAlg[idx]?.replace(/[()]/g, '') || '')) {
			currentMoveIndexRef.current = -1;
			badAlgRef.current.pop();
		}
		// Case 2: Son yanlis hamlenin tersi
		else if (badAlg.length >= 2 &&
			lastMoves[lastMoves.length - 1]?.move === getInverseMove(badAlg[badAlg.length - 2])) {
			badAlgRef.current.pop();
			badAlgRef.current.pop();
		}
		// Case 3: 4 ayni hamle (tam tur)
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

		// Visual guncelleme
		if (twistyPlayerRef.current) {
			(twistyPlayerRef.current as any).experimentalAddMove(move, {cancel: false});
		}

		// KPattern guncelleme
		myKpatternRef.current = myKpatternRef.current.applyMove(move);
		lastMovesRef.current.push({move});
		if (lastMovesRef.current.length > 256) {
			lastMovesRef.current = lastMovesRef.current.slice(-256);
		}

		// Timer baslatma (ilk hamle)
		if (smartPhaseRef.current === 'ready') {
			dispatch({type: 'SMART_SET_PHASE', payload: 'solving'});
			solutionMovesRef.current = [];
			startTimerInterval();
		}

		if (smartPhaseRef.current === 'solving' || smartPhaseRef.current === 'ready') {
			solutionMovesRef.current.push(smartTurn);
		}

		// Solved detection helper (Issue 10 + 11)
		const checkSolvedFallback = (): boolean => {
			if (smartPhaseRef.current !== 'solving') return false;
			const kpuzzle = getKPuzzle();
			if (!kpuzzle || !myKpatternRef.current) return false;
			const fixedMy = fixOrientation(myKpatternRef.current);
			const fixedDefault = fixOrientation(kpuzzle.defaultPattern());
			if (isIdenticalIgnoringCenters(fixedMy, fixedDefault)) {
				handleSolveComplete();
				return true;
			}
			return false;
		};

		// Issue 10: Mask mode — sadece solved detection, per-move eslestirme yok
		if (isMoveMaskedRef.current) {
			checkSolvedFallback();
			return;
		}

		// KPattern eslestirme — fixOrientation her iki tarafa da uygulanmali.
		// patternStates zaten fixOrientation uygulanmis; myKpattern'a da uygula
		// ki slice/rotation move sonrasi center normalizasyonu simetrik olsun.
		let found = false;
		const patterns = patternStatesRef.current;
		const fixedMyKpattern = fixOrientation(myKpatternRef.current);

		for (let i = 0; i < patterns.length; i++) {
			if (isIdenticalIgnoringCenters(fixedMyKpattern, patterns[i])) {
				// Trailing rotation'lari otomatik atla (fixOrientation ayni state uretir)
				let j = i;
				while (j + 1 < patterns.length &&
					isIdenticalIgnoringCenters(patterns[i], patterns[j + 1])) {
					j++;
				}
				currentMoveIndexRef.current = j;
				found = true;
				badAlgRef.current = [];
				dispatch({type: 'SET_MATCHED_MOVE_COUNT', payload: j + 1});
				dispatch({type: 'SET_BAD_ALG', payload: []});

				// Son hamle mi?
				if (j === patterns.length - 1) {
					handleSolveComplete();
				}
				break;
			}
		}

		if (!found) {
			badAlgRef.current.push(move);
			handleBadAlg();
			dispatch({type: 'SET_BAD_ALG', payload: [...badAlgRef.current]});

			// Issue 11: Yanlis algoritma toleransi — kup cozulduyse yine de gec
			// En az 1 dogru hamle eslesmis olmali — yanlis+duzeltme ile solved'a
			// donmek false positive yaratir (currentMoveIndex -1 ise hic ilerleme yok)
			if (currentMoveIndexRef.current > 0) {
				checkSolvedFallback();
			}
		}
	}, [dispatch, startTimerInterval, handleSolveComplete, handleBadAlg]);

	// -- Gyro subscription helper (Issue 3) --
	const subscribeToGyro = useCallback((cube: any) => {
		if (!cube?.subscribeGyro || unsubGyroRef.current) return;
		unsubGyroRef.current = cube.subscribeGyro((event: any) => {
			if (event.quaternion) {
				const {x: qx, y: qy, z: qz, w: qw} = event.quaternion;
				const quat = new THREE.Quaternion(qx, qz, -qy, qw).normalize();
				if (!gyroBasisRef.current) {
					gyroBasisRef.current = quat.clone().conjugate();
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

	const SOLVED_FACELETS = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';

	// -- BLE callback setup (move/gyro/facelets) --
	useEffect(() => {
		const conn = connectRef.current;
		if (!conn) return;

		// Move callbacks — dogrudan isleme (Redux bypass)
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

		// Issue 7: FACELETS safety net
		// myKpatternRef solved'dan baslar ve move-by-move ilerler.
		// FACELETS fiziksel kupu yansitir — surekli overwrite edersek
		// eslestirme bozulur (baslangic noktasi kayar).
		// Sadece ilk init (null ise) + solving sirasinda solved detection.
		conn.alertCubeState = (faceletStr: string) => {
			// Ilk state init (henuz pattern yoksa)
			if (!myKpatternRef.current) {
				const pattern = faceletsToPattern(faceletStr);
				if (pattern) myKpatternRef.current = pattern;
			}

			// Solving sirasinda solved detection safety net
			if (smartPhaseRef.current === 'solving' && faceletStr === SOLVED_FACELETS) {
				handleSolveCompleteRef.current();
			}
		};

		// Issue 3: Mount'ta mevcut cube'u kontrol et (selection view'da baglantı kurulmuş olabilir)
		if (conn.activeCube) {
			subscribeToGyro(conn.activeCube);
		}

		// Yeni cube baglantisi icin callback
		conn._onCubeCreated = (cube: any) => subscribeToGyro(cube);

		return () => {
			unsubGyroRef.current?.();
			unsubGyroRef.current = null;
		};
	}, [connectRef, processMove, subscribeToGyro]);

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
						// Scene henuz hazir degil
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
	}, []);

	// -- Algoritma degistiginde patternStates olustur --
	useEffect(() => {
		if (!currentAlgorithm) return;

		const setupPatterns = async () => {
			await ensureCubingReady();
			await ensureKPuzzleReady();
			const kpuzzle = getKPuzzle();
			if (!kpuzzle) return;

			// Algoritma hamlelerini parse et (AUF dahil)
			const expandedAlg = expandNotation(currentAlgorithm.algorithm);
			const algMoves = buildRandomAUFAlg(
				expandedAlg.split(/\s+/),
				currentAlgorithm.category,
				options.randomizeAUF
			);

			// Her yeni algoritma session'inda solved'dan basla.
			// patternStates ve myKpattern ayni baslangic noktasindan gitmeli.
			const initialState = kpuzzle.defaultPattern();
			myKpatternRef.current = initialState;

			// patternStates olustur
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
			algPatternStatesRef.current = apStates;
			currentMoveIndexRef.current = -1;
			badAlgRef.current = [];
			lastMovesRef.current = [];
			solutionMovesRef.current = [];

			dispatch({type: 'SET_MATCHED_MOVE_COUNT', payload: 0});
			dispatch({type: 'SET_TOTAL_EXPECTED_MOVES', payload: algMoves.length});
			dispatch({type: 'SET_BAD_ALG', payload: []});
			dispatch({type: 'SMART_SET_PHASE', payload: 'ready'});
			dispatch({type: 'SET_USER_ALG', payload: algMoves});
			dispatch({type: 'SET_ORIGINAL_USER_ALG', payload: algMoves});

			// Visual TwistyPlayer'i guncelle
			if (twistyPlayerRef.current) {
				const isLL = isLLCategory(currentAlgorithm.category);
				const effectiveFront = isLL ? getDefaultFrontFace(options.topFace) : options.frontFace;
				const rotation = getOrientationRotation(options.topFace, effectiveFront);
				const stickering = getStickering(currentAlgorithm.category);
				const is3x3 = getPuzzleType(currentAlgorithm.category) === '3x3x3';

				// Cubing.js Alg — inverse hesapla
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
	}, [currentAlgorithm, options.randomizeAUF, options.topFace, options.frontFace, dispatch]);

	// Cleanup timer on unmount or external phase change (manuel stop)
	useEffect(() => {
		if (state.smartPhase === 'completed') {
			stopTimerInterval();
		}
		return () => {
			stopTimerInterval();
		};
	}, [state.smartPhase, stopTimerInterval]);

	// -- Partial/wide match detection (CubeDex yaklasimi) --
	// GAN kupler sadece 6 face move raporlar (URFDLB). Wide (r,l,f,b,u,d),
	// slice (M,E,S) ve rotation (x,y,z) move'lari fiziksel olarak yapilir ama
	// BLE uzerinden farkli face turn'ler olarak gelir. Bu yuzden display seviyesinde
	// yarim/ara hamleleri hata degil partial olarak gosteriyoruz.
	const matchedIdx = state.matchedMoveCount - 1;
	const nextExpected = state.userAlg[matchedIdx + 1]?.replace(/[()]/g, '') || '';

	const isHalfMatch = (() => {
		if (state.badAlg.length === 0 || !nextExpected || nextExpected.length <= 1) return false;

		const badCount = state.badAlg.length;
		const expectedBase = nextExpected[0];

		// Onceki hamlelerde veya beklenen hamlede wide/slice/rotation var mi?
		const precedingMoves = state.userAlg.slice(0, matchedIdx + 1).join(' ');
		const hasSliceOrWide = /[MESudlrbfxyz]/.test(precedingMoves) || /[MESudlrbfxyz]/.test(nextExpected);

		// Case 1: Tek bad move + ilk harf eslesmesi (R2→R, r2→R, U2→U, case-insensitive)
		if (badCount === 1 && state.badAlg[0][0].toUpperCase() === expectedBase.toUpperCase()) return true;

		// Case 2: Tek bad move + algoritmada wide/slice/rotation move var
		if (badCount === 1 && hasSliceOrWide) return true;

		// Case 3: 2-3 bad move + M/E/S beklenen hamle (slice move'lar 2-3 face turn uretir)
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
		stopTimerInterval();
		dispatch({type: 'SET_MATCHED_MOVE_COUNT', payload: 0});
		dispatch({type: 'SET_BAD_ALG', payload: []});
		dispatch({type: 'SET_TIMER_STATE', payload: 'IDLE'});
		dispatch({type: 'SET_TIMER_VALUE', payload: 0});
		dispatch({type: 'SMART_SET_PHASE', payload: 'ready'});
	}, [connectRef, dispatch, stopTimerInterval]);

	const handleResetGyro = useCallback(() => {
		gyroBasisRef.current = null;
	}, []);

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

	// Cube name from BLE
	const cubeName = connectRef.current?.activeCube?.device?.name || '';

	return (
		<div className={b('smart-cube-area')}>
			{/* Issue 4a: Menu butonlari */}
			<div className={b('smart-options')}>
				<button onClick={handleResetState} title={t('smart_cube.mark_as_solved')}>
					<ArrowCounterClockwise size={16} />
				</button>
				<button onClick={handleResetGyro} title={t('smart_cube.reset_gyro')}>
					<Compass size={16} />
				</button>
				<button
					onClick={() => setShowDeviceInfo(!showDeviceInfo)}
					title={t('trainer.device_info')}
					className={showDeviceInfo ? b('smart-options-active') : undefined}
				>
					<Info size={16} />
				</button>
			</div>

			{/* Device info popup */}
			{showDeviceInfo && (
				<div className={b('smart-device-info')}>
					<span>{cubeName || t('smart_cube.unknown_device')}</span>
					{state.smartBattery != null && <span>{state.smartBattery}%</span>}
				</div>
			)}

			{/* 3D Kup */}
			<div className={b('smart-cube-wrapper')}>
				<div ref={containerRef} className={b('smart-cube-viewer')} style={{width: 280, height: 280}} />

				{/* Issue 4b: Camera angle XY pad */}
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
			</div>

			{/* Pil seviyesi (device info kapaliyken) */}
			{!showDeviceInfo && state.smartBattery != null && (
				<div className={b('smart-battery')}>{state.smartBattery}%</div>
			)}

			{/* Renkli hamle gosterimi */}
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

			{/* Duzeltme ipucu */}
			{correctionText && !state.isMoveMasked && (
				<div className={b('smart-correction')}>
					Fix: {correctionText}
				</div>
			)}
		</div>
	);
}
