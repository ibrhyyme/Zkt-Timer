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
import { initSmartSolver, computeCorrectionPathAsync, IncrementalCompressor, matchScrambleWithCommutative, isTwo, getRawTurn, areCommutative } from '../../../util/smart_scramble';
import { getReverseTurns } from '../../../util/solve/turns';
import { initSolverWorker, solveAsync } from '../../../util/solver_worker_manager';
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

// ── DEBUG LOGGING ──
const SC_DEBUG = false;
const _log = (cat: string, color: string, ...args: any[]) => {
	if (!SC_DEBUG) return;
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

	const [scrambleCompletedAt, setScrambleCompletedAt] = useState(null);
	const scrambleCompletedAtRef = useRef<Date | null>(null);
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

	const correctionDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const correctionGenRef = useRef(0);
	const halfMatchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const targetFaceletsRef = useRef<string | null>(null);
	const initialSyncMovesRef = useRef<string[]>([]);
	const compressorRef = useRef(new IncrementalCompressor());
	const intermediatesRef = useRef(new Set<string>());
	const lastFaceletsTimeRef = useRef<number>(0);

	// Reset incremental state when scramble or offset changes (new correction applied)
	useEffect(() => {
		dbgCorr(`COMPRESSOR RESET | scramble: ${scramble?.slice(0, 40)}... | offset: ${smartTurnOffset}`);
		compressorRef.current.reset();
		validationCacheRef.current.lastValidatedLength = 0;
	}, [scramble, smartTurnOffset]);

	// Precompute target FACELETS (scramble'in hedef durumu)
	// Her zaman originalScramble kullan — correction scramble degil, orijinal scramble
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

	// Precompute intermediate states for state-based verification (cstimer checkInSeq approach)
	// Orijinal scramble'in her adimindaki kup durumunu hesapla.
	// Double move'lar icin CW/CCW sub-power durumlarini da ekle.
	// Kommutatif ciftler icin ters sira alternatifini de ekle.
	useEffect(() => {
		const origScramble = originalScramble || scramble;
		if (!origScramble) {
			intermediatesRef.current = new Set();
			return;
		}

		try {
			const moves = origScramble.split(' ').filter(m => m.trim());
			const states = new Set<string>();
			const cube = new Cube();
			const statesBefore: string[] = [];

			for (let i = 0; i < moves.length; i++) {
				statesBefore.push(cube.asString());
				const move = moves[i];

				if (isTwo(move)) {
					// CW sub-power: state_before + bir CW ceyrek-donus (ornek: F2 icin sadece F)
					const cwCube = Cube.fromString(statesBefore[i]);
					cwCube.move(getRawTurn(move));
					states.add(cwCube.asString());

					// CCW sub-power: state_before + bir CCW ceyrek-donus (ornek: F2 icin sadece F')
					const ccwCube = Cube.fromString(statesBefore[i]);
					ccwCube.move(getRawTurn(move) + "'");
					states.add(ccwCube.asString());
				}

				// Tam hamle sonrasi durum
				cube.move(move);
				states.add(cube.asString());

				// Kommutatif alternatif: sonraki hamle ile yer degistirme
				// Ornek: "U D" scramble'da kullanici D'yi once yaparsa, state_before_U + D
				if (i < moves.length - 1 && areCommutative(moves[i], moves[i + 1])) {
					const altCube = Cube.fromString(statesBefore[i]);
					altCube.move(moves[i + 1]);
					states.add(altCube.asString());

					// Kommutatif hareketteki double-move sub-power'lari da ekle
					if (isTwo(moves[i + 1])) {
						const cwAlt = Cube.fromString(statesBefore[i]);
						cwAlt.move(getRawTurn(moves[i + 1]));
						states.add(cwAlt.asString());

						const ccwAlt = Cube.fromString(statesBefore[i]);
						ccwAlt.move(getRawTurn(moves[i + 1]) + "'");
						states.add(ccwAlt.asString());
					}
				}
			}

			intermediatesRef.current = states;
		} catch (e) {
			intermediatesRef.current = new Set();
		}
	}, [originalScramble, scramble]);

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
					tempoScale: 5  // Referans (gan-cube-sample) ile ayni — gorunur ama hizli animasyon
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

			newTurns.forEach(turnObj => {
				// Send to TwistyPlayer
				(twistyPlayerRef.current as any).experimentalAddMove(turnObj.turn, { cancel: false });

				// Sync Logical State
				cubejs.current.move(turnObj.turn);
			});

			dbgMove(`+${newTurns.length} hamle:`, newTurns.map(t => t.turn).join(' '),
				`| toplam: ${smartTurns.length} | cubejs: ${cubejs.current.asString().slice(0, 18)}...`);

			appliedTurnsRef.current = smartTurns.length;

			// VALIDATION: Only call once after batch (not per move)
			checkForStartAfterTurnBatch(smartTurns);

			const isSolved = cubejs.current.asString() === smartSolvedState;
			if (isSolved || smartPhysicallySolved) {
				dbgTimer(`SOLVE DETECT | cubejs_solved: ${isSolved} | facelets_solved: ${smartPhysicallySolved} | timeStartedAt: ${!!timeStartedAt}`);
			}
			// Yedek: cubejs yanlışsa (cascading gap) ama fiziksel küp çözüldüyse
			if (!useSpaceWithSmartCube && (isSolved || (smartPhysicallySolved && timeStartedAt)) && smartTurns.length) {
				// Her iki yolda da son hamle timestamp'ini kullan (display overshoot önlenir)
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

			// NOT: startState artik resetMoves(isScrambleFinish=true) icinde set ediliyor.
			// Solve bittiginde burada set etmek yanlis: cubejs solved state olur ve
			// bir sonraki cozumun faz takibi bozulur.
		} else if (smartTurns.length === 0 && appliedTurnsRef.current > 0) {
			// Reset detected
			cubejs.current = new Cube();

			if (preservedScrambleRef.current) {
				// Scramble finished, initialize to scrambled state
				// We DO NOT reset TwistyPlayer.alg here. We want to keep the visual state (orientation/rotations) as is.
				// The user just finished scrambling, so the visual state IS the scrambled state.

				// Smart cube: fiziksel FACELETS state'i kullan (kullanici correction sirasinda
				// hata yapip duzeltmis olabilir — teorik scramble state'i fiziksel durumla uyusmayabilir)
				if (smartCubeConnected && smartCurrentState) {
					try {
						cubejs.current = Cube.fromString(smartCurrentState);
					} catch (e) {
						// Fallback: scramble hamleleriyle init et
						const moves = preservedScrambleRef.current.split(' ').filter(m => m.trim());
						for (const move of moves) {
							cubejs.current.move(move);
						}
					}
				} else {
					// Normal (non-smart) akis: scramble hamleleriyle init et
					const moves = preservedScrambleRef.current.split(' ').filter(m => m.trim());
					for (const move of moves) {
						cubejs.current.move(move);
					}
				}
			} else {
				// Solve finished or manual reset, initialize to solved state
				if (twistyPlayerRef.current) {
					twistyPlayerRef.current.alg = '';
					// Scene degisti — ref'leri sifirla
					twistySceneRef.current = null;
					twistyVantageRef.current = null;
				}
			}

			appliedTurnsRef.current = 0;
			validationCacheRef.current.lastValidatedLength = 0;
			validationCacheRef.current.lastMatchedIndex = 0;
			compressorRef.current.reset();
			// startState'i sadece resetMoves(isScrambleFinish=true) SET ETMEDIYSE guncelle.
			// preservedScrambleRef varsa, resetMoves zaten dogru startState'i set etti —
			// burada uzerine yazmak stale smartCurrentState ile race condition yaratir.
			if (!preservedScrambleRef.current) {
				setStartState(cubejs.current.asString());
			}
		}
	}, [smartTurns, smartSolvedState]);

	// FACELETS freshness tracking: GAN kuplerde FACELETS event'i sadece baglanti ve
	// sessizlik (1.5s) sirasinda gelir. Aktif karistirmada FACELETS guncellenmez.
	// Bu ref, facelets-based correction'in stale veri ile hesaplanmasini onler.
	useEffect(() => {
		if (smartStateSeq > 0) {
			lastFaceletsTimeRef.current = Date.now();
		}
	}, [smartStateSeq]);

	// FACELETS güvenlik ağı: fiziksel küp çözüldüyse timer durdur
	// cubejs'e DOKUNMAZ - sadece fiziksel durumu kontrol eder
	// BLE'den son hamle düşerse, 1.5s sessizlik sonrası FACELETS ile yakalanır
	useEffect(() => {
		if (
			smartPhysicallySolved &&
			timeStartedAt &&
			!useSpaceWithSmartCube
		) {
			dbgFace(`FACELETS SOLVE SAFETY NET tetiklendi | smartStateSeq: ${smartStateSeq} | lastSmartMoveTime: ${lastSmartMoveTime} | now: ${Date.now()} | gecikme: ${lastSmartMoveTime ? Date.now() - lastSmartMoveTime : 'N/A'}ms`);
			if (needsCubeReset) {
				resetMoves(true, false, lastSmartMoveTime || undefined);
				setNeedsCubeReset(false);
				resetScramble(context);
			} else {
				resetMoves(false, false, lastSmartMoveTime || undefined);
			}
		}
	}, [smartStateSeq, timeStartedAt]);

	// FACELETS scramble completion safety net:
	// smartCurrentState BLE'den her FACELETS event'inde guncellenir.
	// Eger fiziksel kup hedef duruma ulastiysa, move matcher'i beklemeden tamamla.
	useEffect(() => {
		if (!smartCurrentState || !targetFaceletsRef.current) return;
		if (timeStartedAt || !scramble) return; // solve sirasinda veya scramble yokken calisma
		if (useSpaceWithSmartCube || smartCubeConnecting) return;
		// Scramble zaten tamamlandiysa (correction veya matcher tarafindan) tekrar tetikleme
		if (scrambleCompletedAtRef.current) return;

		if (smartCurrentState === targetFaceletsRef.current) {
			dbgFace('FACELETS SCRAMBLE SAFETY NET tetiklendi — fiziksel kup hedefte (useEffect)');
			if (halfMatchTimeoutRef.current) clearTimeout(halfMatchTimeoutRef.current);
			if (correctionDebounceRef.current) clearTimeout(correctionDebounceRef.current);

			scrambleCompletedAtRef.current = new Date();
			setScrambleCompletedAt(scrambleCompletedAtRef.current);
			setTimerParams({ smartCanStart: true });

			if (!audioThrottleRef.current) {
				audioThrottleRef.current = true;
				setTimeout(() => { audioThrottleRef.current = false; }, 2000);
				try {
					const audio = new Audio(resourceUri('audio/success.mp3'));
					audio.volume = 1.0;
					audio.play().catch(e => console.warn('Audio play failed:', e));
				} catch (err) {
					// Audio hata — kritik degil
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
				dbgFace('POLLING SAFETY NET — fiziksel kup cozulmus, timer durduruluyor');
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
						// Full basis: ilk okumanin tamamini yakalayip tersinir
						// Referans (gan-cube-sample) ile ayni yaklasim
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

	// ── Initial Sync: kup baglaninca fiziksel durumu oku ve scramble hesapla ──
	const initialSyncDoneRef = useRef(false);

	useEffect(() => {
		if (!smartCubeConnected || !smartCurrentState || !scramble) return;
		if (timeStartedAt) return; // Solve sirasinda calismaz
		if (initialSyncDoneRef.current) return;
		initialSyncDoneRef.current = true;

		const SOLVED = DEFAULT_SOLVED_STATE;
		const currentFacelets = smartCurrentState;

		// Kup cozukse — orijinal scramble'i oldugu gibi kullan, TwistyPlayer solved (alg='')
		if (currentFacelets === SOLVED) {
			dbgSync('Kup COZULMUS baglandi — sync gerekmez');
			return;
		}
		dbgSync(`Kup KARISIK baglandi | facelets: ${currentFacelets.slice(0, 27)}...`);

		// Hedef durumu hesapla (scramble'in son hali)
		const targetCube = new Cube();
		const scrambleMoves = scramble.split(' ').filter(m => m.trim());
		scrambleMoves.forEach(m => targetCube.move(m));
		const targetFacelets = targetCube.asString();

		// Async: fiziksel durumu coz ve correction/sync hesapla
		(async () => {
			try {
				// 1. Fiziksel durumu coz (current → solved)
				const currentCube = Cube.fromString(currentFacelets);
				const solveStr = await solveAsync(currentCube.toJSON());

				// 2. Ters cevir: solved → current (sanal kullanici hamleleri)
				const toCurrentMoves: string[] = (typeof solveStr === 'string' && solveStr.trim())
					? getReverseTurns(solveStr) as string[]
					: [];

				// Sonraki correction hesaplamalarinda kullanmak icin sakla
				// (triggerSmartCorrection bu prefix'i BLE hamlelerinin onune ekler)
				initialSyncMovesRef.current = toCurrentMoves;
				dbgSync(`Sync hamleler: [${toCurrentMoves.join(' ')}] (${toCurrentMoves.length} hamle)`);

				// 3. TwistyPlayer'i fiziksel duruma sync et
				if (twistyPlayerRef.current && toCurrentMoves.length > 0) {
					twistyPlayerRef.current.alg = toCurrentMoves.join(' ');
					// Scene degisti — ref'leri sifirla, animation loop yeni scene'i fetch etsin
					twistySceneRef.current = null;
					twistyVantageRef.current = null;
				}

				// 4. cubejs'i de sync et
				cubejs.current = Cube.fromString(currentFacelets);
				appliedTurnsRef.current = 0;

				// 5. Kup zaten hedef karisik durumda mi?
				dbgSync(`Hedef facelets: ${targetFacelets.slice(0, 27)}... | eslesme: ${currentFacelets === targetFacelets}`);
				if (currentFacelets === targetFacelets) {
					scrambleCompletedAtRef.current = new Date();
					setScrambleCompletedAt(scrambleCompletedAtRef.current);
					setTimerParams({ smartCanStart: true });
					resetMoves(false, true);
					return;
				}

				// 6. Kup bozuk ve hedefte degil — correction path hesapla

				const correctionMoves = await computeCorrectionPathAsync(scramble, toCurrentMoves);

				if (correctionMoves.length === 0) {
					// Solver farki — aslinda hedefte
					scrambleCompletedAtRef.current = new Date();
					setScrambleCompletedAt(scrambleCompletedAtRef.current);
					setTimerParams({ smartCanStart: true });
					resetMoves(false, true);
					return;
				}

				// 7. Yeni scramble = correction path (current → target)
				const newScramble = correctionMoves.join(' ');
				dbgSync(`Sync correction path: ${newScramble}`);
				setTimerParams({
					scramble: newScramble,
					smartTurnOffset: 0,
					originalScramble: scramble,
				});
			} catch (error) {
				console.error('[ZKT:SYNC] Initial sync hatasi:', error);
			}
		})();
	}, [smartCubeConnected, smartCurrentState]);

	// Disconnect olunca initial sync'i resetle (reconnect'te tekrar calissin)
	useEffect(() => {
		if (!smartCubeConnected) {
			initialSyncDoneRef.current = false;
			initialSyncMovesRef.current = [];
		}
	}, [smartCubeConnected]);

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

		if (scrambleCompletedAtRef.current) {
			dbgTimer('TIMER START — scramble onceden tamamlanmis, ilk hamle geldi');
			startTimer();
			let it = (new Date().getTime() - scrambleCompletedAtRef.current.getTime()) / 1000;
			it = Math.floor(it * 100) / 100;

			scrambleCompletedAtRef.current = null;
			setScrambleCompletedAt(null);
			setInspectionTime(it);
			setTimerParams({ smartCanStart: false });
			return;
		}

		if (!currentTurns.length || timeStartedAt || !scramble) return;

		// FACELETS-based completion: fiziksel kup hedef durumda mi?
		// Move matcher'dan bagimsiz, en guvenilir yontem.
		// L2 = L'+L' gibi ikili hamleler, hatali hamleler vs. sorun yaratmaz.
		if (targetFaceletsRef.current && smartCurrentState === targetFaceletsRef.current) {
			dbgFace('FACELETS MATCH (checkForStart) — fiziksel kup hedefte!');
			if (halfMatchTimeoutRef.current) clearTimeout(halfMatchTimeoutRef.current);
			if (correctionDebounceRef.current) clearTimeout(correctionDebounceRef.current);


			scrambleCompletedAtRef.current = new Date();
			setScrambleCompletedAt(scrambleCompletedAtRef.current);
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
			`\n  inIntermediate: ${intermediatesRef.current.has(cubejs.current.asString())}`
		);

		if (matched) {
			// Move matcher eslesti — cubejs ile dogrula (FACELETS lag'inden bagimsiz)
			// cubejs her hamle event'inde senkron guncellenir, FACELETS 1+ batch geride kalabilir
			if (smartCubeConnected && targetFaceletsRef.current) {
				const cubejsState = cubejs.current.asString();
				if (cubejsState !== targetFaceletsRef.current) {
					dbgMatch('MATCHED ama cubejs UYUSMUYOR — correction tetikleniyor',
						`\n  cubejs:  ${cubejsState.slice(0, 27)}...`,
						`\n  target:  ${targetFaceletsRef.current.slice(0, 27)}...`);
					triggerSmartCorrection();
					return;
				}
				// cubejs eslesti — FACELETS geride olsa bile guvenli
			}
			dbgMatch('SCRAMBLE TAMAMLANDI (move matcher + cubejs onayladi)');

			if (halfMatchTimeoutRef.current) clearTimeout(halfMatchTimeoutRef.current);
			if (correctionDebounceRef.current) clearTimeout(correctionDebounceRef.current);
			correctionGenRef.current++;
			scrambleCompletedAtRef.current = new Date();
			setScrambleCompletedAt(scrambleCompletedAtRef.current);
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
			// State-based dogrulama: cubejs hala orijinal scramble yolunda mi?
			const isOnTrack = intermediatesRef.current.has(cubejs.current.asString());
			dbgCorr(`WRONG tespit | cubejs on-track: ${isOnTrack} | intermediates size: ${intermediatesRef.current.size}`);
			if (!isOnTrack) {
				dbgCorr('→ Correction TETIKLENIYOR (wrong + off-track)');
				triggerSmartCorrection();
			} else {
				dbgCorr('→ Correction ATLANDI (wrong ama cubejs hala dogru yolda — compressor timing hatasi)');
			}
		} else if (matchStatus.includes('half')) {
			const noMorePending = !matchStatus.includes('pending');
			const lastHalfIdx = matchStatus.lastIndexOf('half');
			const hasPerfectAfterHalf = matchStatus.slice(lastHalfIdx + 1).includes('perfect');
			dbgCorr(`HALF tespit | noMorePending: ${noMorePending} | hasPerfectAfterHalf: ${hasPerfectAfterHalf}`);

			if (hasPerfectAfterHalf) {
				const isOnTrack = intermediatesRef.current.has(cubejs.current.asString());
				dbgCorr(`  half+perfect | cubejs on-track: ${isOnTrack}`);
				if (!isOnTrack) {
					dbgCorr('  → Correction TETIKLENIYOR (half+perfect + off-track)');
					triggerSmartCorrection();
				} else {
					dbgCorr('  → Correction ATLANDI (half+perfect ama cubejs dogru yolda)');
				}
			} else if (noMorePending) {
				dbgCorr('  → 800ms timeout baslatiyor (son hamle yarim, ikinci yarisi bekleniyor)');
				if (halfMatchTimeoutRef.current) clearTimeout(halfMatchTimeoutRef.current);
				halfMatchTimeoutRef.current = setTimeout(() => {
					dbgCorr('  → 800ms TIMEOUT doldu — correction tetikleniyor');
					triggerSmartCorrection();
				}, 800);
			}
		}
	}

	function triggerSmartCorrection() {
		if (correctionDebounceRef.current) clearTimeout(correctionDebounceRef.current);
		if (!originalScrambleRef.current && scramble) originalScrambleRef.current = scramble;

		const gen = ++correctionGenRef.current;
		dbgCorr(`triggerSmartCorrection() CAGIRILDI | gen: ${gen}`);

		// Debounce 250ms to prevent lag during fast scrambling (15-20 TPS bursts)
		correctionDebounceRef.current = setTimeout(async () => {
			const scrambleToUse = originalScrambleRef.current;
			if (!scrambleToUse) return;

			const prefix = initialSyncMovesRef.current || [];

			// Ref kullan — setTimeout closure'da stale state onlenir
			let currentSmartTurns = smartTurnsRef.current;
			let allRawUserMoves = [...prefix, ...currentSmartTurns.map(t => t.turn)];

			dbgCorr(`[gen:${gen}] 250ms debounce PATLADI | prefix: [${prefix.join(' ')}] | smartTurns: ${currentSmartTurns.length}`,
				`\n  kullanici hamleleri: [${allRawUserMoves.join(' ')}]`,
				`\n  originalScramble: ${scrambleToUse}`);

			// Async: runs Cube.solve() in Web Worker — no main thread blocking
			let correctionMoves = await computeCorrectionPathAsync(scrambleToUse, allRawUserMoves);

			// Discard stale result if a newer correction was triggered
			if (gen !== correctionGenRef.current) {
				dbgCorr(`[gen:${gen}] IPTAL — yeni gen: ${correctionGenRef.current}`);
				return;
			}

			dbgCorr(`[gen:${gen}] 1. solve sonucu: [${correctionMoves.join(' ')}] (${correctionMoves.length} hamle)`);

			// BLE batch (8ms) + Redux dispatch + React render icin bekle.
			// Double move'un ikinci yarisi bu sure icinde gelebilir.
			await new Promise(resolve => setTimeout(resolve, 50));
			if (gen !== correctionGenRef.current) {
				dbgCorr(`[gen:${gen}] IPTAL (50ms sonrasi) — yeni gen: ${correctionGenRef.current}`);
				return;
			}

			// Re-snapshot: async solve sirasinda yeni hamle geldiyse (double-move ikinci yarisi)
			// guncel hamlelerle tekrar hesapla — stale offset onlenir
			const latestTurns = smartTurnsRef.current;
			if (latestTurns.length !== currentSmartTurns.length) {
				dbgCorr(`[gen:${gen}] RE-SNAPSHOT: ${currentSmartTurns.length} → ${latestTurns.length} hamle`,
					`\n  yeni hamleler: [${latestTurns.slice(currentSmartTurns.length).map(t => t.turn).join(' ')}]`);
				currentSmartTurns = latestTurns;
				allRawUserMoves = [...prefix, ...currentSmartTurns.map(t => t.turn)];
				correctionMoves = await computeCorrectionPathAsync(scrambleToUse, allRawUserMoves);
				if (gen !== correctionGenRef.current) return;
				dbgCorr(`[gen:${gen}] 2. solve sonucu: [${correctionMoves.join(' ')}] (${correctionMoves.length} hamle)`);
			}

			// Facelets-based dogrulama: replay sonucu fiziksel durumla tutarli mi?
			// ONEMLI: GAN kuplerde FACELETS event'i sadece baglanti ve sessizlik (1.5s) sirasinda gelir.
			// Aktif karistirmada FACELETS guncellenmez — stale veri ile karsilastirmak
			// false "BLE MOVE KAYBI" algilar ve YANLIS correction path hesaplar.
			// Bu yuzden sadece FACELETS taze oldugunda (son 500ms icinde guncellendi) karsilastir.
			const physicalFacelets = smartCurrentStateRef.current;
			const faceletsAge = Date.now() - lastFaceletsTimeRef.current;
			if (physicalFacelets && correctionMoves.length > 0 && faceletsAge < 500) {
				const replayedCube = new Cube();
				for (const m of allRawUserMoves) replayedCube.move(m);

				if (replayedCube.asString() !== physicalFacelets) {
					dbgCorr(`[gen:${gen}] BLE MOVE KAYBI TESPIT (taze FACELETS) — facelets-based correction`,
						`\n  replayed: ${replayedCube.asString().slice(0, 27)}...`,
						`\n  physical: ${physicalFacelets.slice(0, 27)}...`,
						`\n  facelets age: ${faceletsAge}ms`);
					correctionMoves = await computeCorrectionPathAsync(
						scrambleToUse, allRawUserMoves, physicalFacelets
					);
					if (gen !== correctionGenRef.current) return;
					currentSmartTurns = smartTurnsRef.current;
					dbgCorr(`[gen:${gen}] Facelets-based sonuc: [${correctionMoves.join(' ')}] (${correctionMoves.length} hamle)`);
				}
			} else if (physicalFacelets && correctionMoves.length > 0 && faceletsAge >= 500) {
				dbgCorr(`[gen:${gen}] Facelets STALE (${faceletsAge}ms) — replay-based correction kullaniliyor`);
			}

			if (correctionMoves.length === 0) {
				dbgCorr(`[gen:${gen}] SCRAMBLE TAMAMLANDI (correction sonucu bos — kup hedefte)`);
				// Fiziksel kup hedefte — FACELETS safety net de yakalayacak
				setTimerParams({ smartCanStart: true });
				scrambleCompletedAtRef.current = new Date();
				setScrambleCompletedAt(scrambleCompletedAtRef.current);
				resetMoves(false, true);
				return;
			}

			const newScramble = correctionMoves.join(' ');

			if (newScramble !== scramble) {
				dbgCorr(`[gen:${gen}] YENi SCRAMBLE SET EDILIYOR`,
					`\n  eski scramble: ${scramble}`,
					`\n  yeni scramble: ${newScramble}`,
					`\n  smartTurnOffset: ${currentSmartTurns.length}`);
				setTimerParams({
					scramble: newScramble,
					smartTurnOffset: currentSmartTurns.length,
					originalScramble: scrambleToUse,
				});
			} else {
				dbgCorr(`[gen:${gen}] Scramble degismedi — set etme gereksiz`);
			}
		}, 250);
	}

	function resetMoves(markSolved: boolean = false, isScrambleFinish: boolean = false, endTimestamp?: number) {
		dbgReset(`resetMoves() | markSolved: ${markSolved} | isScrambleFinish: ${isScrambleFinish} | endTimestamp: ${endTimestamp || 'yok'} | isSolveEnd: ${!!timeStartedAt}`);
		// In-flight async correction'lari iptal et — stale correction'in
		// tamamlanmis scramble state'ini uzerine yazmasini onler
		if (correctionDebounceRef.current) {
			clearTimeout(correctionDebounceRef.current);
			correctionDebounceRef.current = null;
		}
		if (halfMatchTimeoutRef.current) {
			clearTimeout(halfMatchTimeoutRef.current);
			halfMatchTimeoutRef.current = null;
		}
		correctionGenRef.current++;

		const isSolveEnd = !!timeStartedAt;

		if (isSolveEnd) {
			// endTimestamp: Safety net'ten geliyorsa son hamle zamanını kullan (sessizlik gecikmesini çıkar)
			const finalTimeMilli = endTimestamp && timeStartedAt
				? endTimestamp - timeStartedAt.getTime()
				: null;
			dbgTimer(`TIMER STOP | finalTimeMilli: ${finalTimeMilli} | endTimestamp: ${endTimestamp} | timeStartedAt: ${timeStartedAt?.getTime()} | gecikme: ${endTimestamp ? Date.now() - endTimestamp : 'N/A'}ms`);
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

			// Faz takibi icin: scramble bittigindeki kup durumunu kaydet
			// Bu, LiveAnalysisOverlay'in dogru baslangic durumundan analiz yapmasini saglar
			const scrambledState = cubejs.current.asString();
			setStartState(scrambledState);
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

		// NOT: Gyro basis SIFIRLANMIYOR. Referans projede de (gan-cube-sample) basis
		// tum session boyunca korunuyor. Sadece yeni BLE baglantisi veya kullanici
		// "Reset Gyro" butonu ile sifirlanir. Bu sayede sanal kup her zaman
		// fiziksel kupun gercek orientasyonunu yansitir.

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
			smartCurrentState: null,
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
