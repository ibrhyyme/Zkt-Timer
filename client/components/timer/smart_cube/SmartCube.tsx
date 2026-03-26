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

	const smartCubeSize = useSettings('smart_cube_size');

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

	const targetFaceletsRef = useRef<string | null>(null);
	const compressorRef = useRef(new IncrementalCompressor());




	// Reset incremental state when scramble or offset changes (new correction applied)
	useEffect(() => {
		dbgCorr(`COMPRESSOR RESET | scramble: ${scramble?.slice(0, 40)}... | offset: ${smartTurnOffset}`);
		compressorRef.current.reset();
		validationCacheRef.current.lastValidatedLength = 0;
		// Yeni scramble geldiginde eski scramble completion'i gecersiz — timer yanlislikla baslamasin
		scrambleCompletedAtRef.current = null;
	}, [scramble, smartTurnOffset]);

	// Inspection timeout → dnfTime:true olunca scramble completion ref'i temizle
	// ve kupu coz moduna gec (timer baslamasin, kullanici kupu cozsun)
	useEffect(() => {
		if (dnfTime && !timeStartedAt) {
			scrambleCompletedAtRef.current = null;
			setNeedsCubeReset(true);
			setTimerParams({ smartCanStart: false, lastSmartSolveStats: null, smartUndoMoves: null });
		}
	}, [dnfTime]);

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

				// Arka plana gecildiginde render loop'u durdur, on plana donulunce baslat
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

				// Scramble hamleleriyle init et — FACELETS'e guvenme
				// (bazi kup modellerinde FACELETS parsing hatali olabiliyor, move tracking daha guvenilir)
				const targetScramble = originalScrambleRef.current || preservedScrambleRef.current;
				const moves = targetScramble.split(' ').filter(m => m.trim());
				for (const move of moves) {
					cubejs.current.move(move);
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

		// Correction modunda kup cozulduyse → orijinal scramble'a don
		// Senaryo: karisik kup baglandi → correction path gosterildi → kullanici tamamlayamadi
		// (TOO_MANY) → kupu cozdu → simdi orijinal scramble'i cozulmus kupten takip etsin
		if (smartCurrentState === DEFAULT_SOLVED_STATE && originalScramble && scramble !== originalScramble) {
			dbgSync('Kup correction sirasinda cozuldu — orijinal scramble restore ediliyor');
			setTimerParams({
				scramble: originalScramble,
				smartTurnOffset: smartTurns.length,
				smartUndoMoves: null,
			});
			return;
		}

		if (smartCurrentState === targetFaceletsRef.current) {
			dbgFace('FACELETS SCRAMBLE SAFETY NET tetiklendi — fiziksel kup hedefte (useEffect)',
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
		// Correction mode'dayken reconnect olursa tekrar calismamali
		// BLE disconnect/reconnect initialSyncDoneRef'i resetler ama bu guard yeni correction'i engeller
		if (originalScramble && scramble !== originalScramble) return;
		initialSyncDoneRef.current = true;

		const SOLVED = DEFAULT_SOLVED_STATE;
		const currentFacelets = smartCurrentState;

		// Kup cozukse — orijinal scramble'i oldugu gibi kullan, TwistyPlayer solved (alg='')
		if (currentFacelets === SOLVED) {
			dbgSync('Kup COZULMUS baglandi — sync gerekmez');

			return;
		}
		// FACELETS solved degil — karisik kup baglanmis olabilir VEYA FACELETS parsing hatali.
		// Bazi GAN modellerinde (orn. GAN 12) FACELETS byte offset'leri farkli olabiliyor,
		// bu da cozulmus kupu karisik olarak gosteriyor. Correction path hesaplamak yerine
		// solved olarak devam et. Gercekten karisiksa kullanici "Cozulmus olarak isaretle" butonunu kullanabilir.
		dbgSync(`FACELETS ≠ SOLVED (${currentFacelets.slice(0, 18)}...) — correction path atlanıyor`);
	}, [smartCubeConnected, smartCurrentState]);

	// Disconnect olunca initial sync'i resetle (reconnect'te tekrar calissin)
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

	// Arka planda BLE pil yoklamasini durdur, on planda yeniden baslat
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

		if (scrambleCompletedAtRef.current) {
			dbgTimer('TIMER START — scramble onceden tamamlanmis, ilk hamle geldi');
			const firstSolveTurn = currentTurns[currentTurns.length - 1];
			startTimer(firstSolveTurn?.completedAt);
			let it = (new Date().getTime() - scrambleCompletedAtRef.current.getTime()) / 1000;
			it = Math.floor(it * 100) / 100;

			scrambleCompletedAtRef.current = null;

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
			// Move matcher eslesti — cubejs ile dogrula (FACELETS lag'inden bagimsiz)
			// cubejs her hamle event'inde senkron guncellenir, FACELETS 1+ batch geride kalabilir
			if (smartCubeConnected && targetFaceletsRef.current) {
				const cubejsState = cubejs.current.asString();
				if (cubejsState !== targetFaceletsRef.current) {
					// BLE move kaybi — FACELETS safety net yakalayacak
					dbgMatch('MATCHED ama cubejs UYUSMUYOR — FACELETS safety net bekleniyor',
						`\n  cubejs:  ${cubejsState.slice(0, 27)}...`,
						`\n  target:  ${targetFaceletsRef.current.slice(0, 27)}...`);
					return;
				}
				// cubejs eslesti — FACELETS geride olsa bile guvenli
			}
			dbgMatch('SCRAMBLE TAMAMLANDI (move matcher + cubejs onayladi)');

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
			// Yanlis hamle tespit — undo sirasini hesapla ve goster
			const firstWrongIdx = matchStatus.indexOf('wrong');
			const wrongUserMoves = userMoves.slice(firstWrongIdx);

			if (wrongUserMoves.length > 7) {
				// 8+ yanlis hamle — kupu coz mesaji goster
				dbgCorr(`WRONG tespit | ${wrongUserMoves.length} yanlis hamle — TOO_MANY`);
				setTimerParams({ smartUndoMoves: ['TOO_MANY'] });
			} else {
				const undoSequence = wrongUserMoves.slice().reverse().map(invertMove);
				dbgCorr(`WRONG tespit | undo sirasi: [${undoSequence.join(' ')}]`);
				setTimerParams({ smartUndoMoves: undoSequence });
			}
		} else if (matchStatus.includes('half')) {
			// Yarim esleme — turuncu renk yeterli bilgi veriyor
			setTimerParams({ smartUndoMoves: null });
		} else {
			// Hepsi perfect veya pending — undo temizle
			setTimerParams({ smartUndoMoves: null });
		}
	}

	function resetMoves(markSolved: boolean = false, isScrambleFinish: boolean = false, endTimestamp?: number) {
		dbgReset(`resetMoves() | markSolved: ${markSolved} | isScrambleFinish: ${isScrambleFinish} | endTimestamp: ${endTimestamp || 'yok'} | isSolveEnd: ${!!timeStartedAt}`);

		const isSolveEnd = !!timeStartedAt;

		if (isSolveEnd) {
			// Per-solve post-solve linear fit: cstimer tsLinearFix / gan-cube-sample cubeTimestampLinearFit ile aynı yaklaşım
			// Çözüm hamlelerinin (cubeTimestamp, localTimestamp) çiftleri üzerinde linear regression yaparak
			// her hamlenin zamanını yeniden hesaplar — pre-solve tahminden çok daha doğru
			const { correctedMoves, finalTimeMs } = cubeTimestampLinearFit(
				smartTurns,
				timeStartedAt.getTime()
			);

			let finalTimeMilli: number | null = Math.round(finalTimeMs);

			// Fallback: linear fit sonucu geçersizse ham fark kullan
			if (finalTimeMilli <= 0 && endTimestamp && timeStartedAt) {
				finalTimeMilli = endTimestamp - timeStartedAt.getTime();
			}

			dbgTimer(`TIMER STOP (linear fit) | finalTimeMilli: ${finalTimeMilli} | moves: ${correctedMoves.length}`);
			endTimer(context, finalTimeMilli, {
				inspection_time: inspectionTime,
				smart_device_id: smartDeviceId,
				is_smart_cube: true,
				smart_turn_count: correctedMoves.length,
				smart_turns: JSON.stringify(correctedMoves),
			});

			// Düzeltilmiş evre analizi: LiveAnalysisOverlay'in doğru süreleri göstermesi için
			// correctedMoves.completedAt linear fit ile düzeltilmiş — ham timestamp'lerden daha doğru
			try {
				const correctedTurns = correctedMoves.map(m => ({ ...m, time: m.completedAt }));
				const correctedAnalysis = analyzeCurrentState(correctedTurns, startState);
				const tps = finalTimeMilli > 0
					? Number((correctedMoves.length / (finalTimeMilli / 1000)).toFixed(2))
					: 0;
				setTimerParams({
					lastSmartSolveStats: { turns: correctedMoves.length, tps, correctedAnalysis }
				});
			} catch (e) {
				// Analiz başarısız olursa endTimer'daki basit stats yeterli
			}
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
			smartTurnOffset: 0,
			smartUndoMoves: null,
			// isSolveEnd ise smartTurns/smartPickUpTime/lastSmartMoveTime endTimer'da zaten reset edildi
			// Tekrar set edersek useEffect([smartTurns]) gereksiz yere ikinci kez tetiklenir
			...(isSolveEnd
				? { originalScramble: '' }
				: { smartTurns: [], smartPickUpTime: 0, lastSmartMoveTime: 0 }),
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

	function markCubeAsSolved() {
		resetMoves(true);

		// Force state to solved
		setTimerParams({
			smartCurrentState: DEFAULT_SOLVED_STATE,
			smartPhysicallySolved: true,
		});

		// Correction mode'daysa orijinal scramble'i restore et
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

		// _trackerCube'u da solved'a resetle
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
	const showCubeMismatch = needsCubeReset && !timeStartedAt && cubeResetFromAbort;

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
