import React, {createContext, useContext, useReducer, useRef, useEffect, ReactNode} from 'react';
import {useLocation} from 'react-router-dom';
import type {
	TrainerSessionState,
	TrainerAction,
	TrainerContextType,
	TrainerOptions,
	TrainerMode,
	TrainerView,
	CheckedAlgorithm,
	SmartPhase,
} from './types';
import {algToId} from '../../util/trainer/algorithm_engine';
import {parseTrainerPath} from '../../util/trainer/url/trainer_url';
import {getBestTime, getFailCount} from './hooks/useAlgorithmData';
import Connect from '../timer/smart_cube/bluetooth/connect';

const DEFAULT_OPTIONS: TrainerOptions = {
	randomOrder: true,
	prioritizeSlow: false,
	prioritizeFailed: false,
	selectLearning: false,
	randomizeAUF: true,
	autoLearnEnabled: true,
	autoLearnThreshold: 5,
	cubeSize: 280,
	wakeLockEnabled: true,
	flashingError: true,
	showCaseName: true,
	whiteOnBottom: false,
	showAllBleDevices: false,
	backView: 'none',
	topFace: 'U',
	frontFace: 'F',
};

function loadOptions(): TrainerOptions {
	// SSR guard: /trainer landing is public and server-rendered; localStorage is
	// undefined there. loadMode() already guards — keep this consistent.
	if (typeof window === 'undefined') return DEFAULT_OPTIONS;
	try {
		const raw = localStorage.getItem('trainer_options');
		if (raw) return {...DEFAULT_OPTIONS, ...JSON.parse(raw)};
	} catch {
		// ignore
	}
	return DEFAULT_OPTIONS;
}

function loadMode(): TrainerMode | null {
	if (typeof window === 'undefined') return null;
	try {
		const raw = localStorage.getItem('trainer_mode');
		if (raw === 'standard' || raw === 'smart' || raw === 'recognition' || raw === 'efficiency') return raw;
	} catch {
		// ignore
	}
	return null;
}

const SMART_DEFAULTS = {
	smartConnected: false,
	smartConnecting: false,
	smartScanning: false,
	smartScanError: null as string | null,
	smartBattery: null as number | null,
	smartPhase: 'idle' as SmartPhase,
	matchedMoveCount: 0,
	totalExpectedMoves: 0,
	badAlg: [] as string[],
	showCameraPad: false,
};

const savedMode = loadMode();

const initialState: TrainerSessionState = {
	view: savedMode ? 'selection' : 'landing',
	mode: savedMode,
	selectedCategory: '',
	selectedSubsets: [],
	checkedAlgorithms: [],
	algorithmQueue: [],
	currentAlgorithm: null,
	timerState: 'IDLE',
	currentTimerValue: 0,
	userAlg: [],
	originalUserAlg: [],
	isMoveMasked: false,
	options: loadOptions(),
	...SMART_DEFAULTS,
};

/**
 * Derives initial mode/view from URL path so a deep-linked mount lands directly in the
 * correct view (CLIENT-only first-mount optimization — the trainer is gated behind
 * app_loaded + FeatureGuard and never server-renders, so this is not an SSR/hydration concern).
 * Deep-link to a mode: on cold start, selection/alg not set, starts from 'selection'
 * (training/sub-view handled by URL sync hook + sub-contexts). bare/unknown path
 * → landing (mode picker); the last-used mode is intentionally NOT restored — /trainer
 * always shows the mode-picker, matching the nav button's expectation.
 */
function resolveInitialNav(pathname: string): {mode: TrainerMode | null; view: TrainerView} {
	const {mode} = parseTrainerPath(pathname);
	if (mode) return {mode, view: 'selection'};
	return {mode: null, view: 'landing'};
}

function makeInitialState(pathname: string): TrainerSessionState {
	const {mode, view} = resolveInitialNav(pathname);
	return {...initialState, mode, view, options: loadOptions()};
}

function buildQueue(algorithms: CheckedAlgorithm[], options: TrainerOptions): CheckedAlgorithm[] {
	let queue = [...algorithms];

	// Prioritize Failed (primary) + Prioritize Slow (tie-break) combined in single sort
	if (options.prioritizeFailed || options.prioritizeSlow) {
		queue.sort((a, b) => {
			if (options.prioritizeFailed) {
				const failDiff =
					getFailCount(algToId(b.algorithm)) - getFailCount(algToId(a.algorithm));
				if (failDiff !== 0) return failDiff;
			}
			if (options.prioritizeSlow) {
				const aTime = getBestTime(algToId(a.algorithm)) ?? Infinity;
				const bTime = getBestTime(algToId(b.algorithm)) ?? Infinity;
				return bTime - aTime;
			}
			return 0;
		});
	}

	// Random Order: shuffle (overrides sort-based prioritization)
	if (options.randomOrder) {
		for (let i = queue.length - 1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i + 1));
			[queue[i], queue[j]] = [queue[j], queue[i]];
		}
	}

	return queue;
}

const SMART_RESET = {
	smartPhase: 'idle' as SmartPhase,
	matchedMoveCount: 0,
	totalExpectedMoves: 0,
	badAlg: [] as string[],
};

function trainerReducer(state: TrainerSessionState, action: TrainerAction): TrainerSessionState {
	switch (action.type) {
		case 'SET_CATEGORY':
			return {
				...state,
				selectedCategory: action.payload,
				selectedSubsets: [],
				checkedAlgorithms: [],
				algorithmQueue: [],
				currentAlgorithm: null,
				timerState: 'IDLE',
				currentTimerValue: 0,
			};

		case 'SET_SUBSETS':
			return {...state, selectedSubsets: action.payload};

		case 'SET_CHECKED_ALGORITHMS': {
			const queue = buildQueue(action.payload, state.options);
			return {
				...state,
				checkedAlgorithms: action.payload,
				algorithmQueue: queue,
				currentAlgorithm: queue[0] || null,
				timerState: 'IDLE',
				currentTimerValue: 0,
			};
		}

		case 'ADD_CHECKED_ALGORITHM': {
			const updated = [...state.checkedAlgorithms, action.payload];
			const queue = buildQueue(updated, state.options);
			return {
				...state,
				checkedAlgorithms: updated,
				algorithmQueue: queue,
				currentAlgorithm: state.currentAlgorithm || queue[0] || null,
			};
		}

		case 'REMOVE_CHECKED_ALGORITHM': {
			const updated = state.checkedAlgorithms.filter((a) => a.algorithm !== action.payload);
			const queue = buildQueue(updated, state.options);
			const current =
				state.currentAlgorithm?.algorithm === action.payload
					? queue[0] || null
					: state.currentAlgorithm;
			return {
				...state,
				checkedAlgorithms: updated,
				algorithmQueue: queue,
				currentAlgorithm: current,
			};
		}

		case 'SET_CURRENT_ALGORITHM':
			return {
				...state,
				currentAlgorithm: action.payload,
				timerState: 'IDLE',
				currentTimerValue: 0,
				...SMART_RESET,
			};

		case 'SET_ALGORITHM_QUEUE':
			return {...state, algorithmQueue: action.payload};

		case 'SET_TIMER_STATE':
			return {...state, timerState: action.payload};

		case 'SET_TIMER_VALUE':
			return {...state, currentTimerValue: action.payload};

		case 'SET_USER_ALG':
			return {...state, userAlg: action.payload};

		case 'SET_ORIGINAL_USER_ALG':
			return {...state, originalUserAlg: action.payload};

		case 'SET_MOVE_MASKED':
			return {...state, isMoveMasked: action.payload};

		case 'SET_MODE':
			localStorage.setItem('trainer_mode', action.payload);
			return {
				...state,
				mode: action.payload,
				view: 'selection',
			};

		case 'SET_VIEW':
			if (action.payload === 'landing') {
				try { localStorage.removeItem('trainer_mode'); } catch {}
				return {
					...state,
					view: 'landing',
					mode: null,
					selectedCategory: '',
					selectedSubsets: [],
					currentAlgorithm: null,
					checkedAlgorithms: [],
					algorithmQueue: [],
					timerState: 'IDLE',
					currentTimerValue: 0,
					userAlg: [],
					originalUserAlg: [],
					badAlg: [],
					...SMART_RESET,
				};
			}
			if (action.payload === 'selection') {
				return {
					...state,
					view: 'selection',
					currentAlgorithm: null,
					checkedAlgorithms: [],
					algorithmQueue: [],
					timerState: 'IDLE',
					currentTimerValue: 0,
					userAlg: [],
					originalUserAlg: [],
					badAlg: [],
					...SMART_RESET,
				};
			}
			return {...state, view: action.payload};

		case 'SET_OPTIONS': {
			const newOptions = {...state.options, ...action.payload};
			localStorage.setItem('trainer_options', JSON.stringify(newOptions));
			const newQueue = buildQueue(state.checkedAlgorithms, newOptions);
			return {...state, options: newOptions, algorithmQueue: newQueue};
		}

		case 'RESET_TRAINING':
			return {
				...state,
				timerState: 'IDLE',
				currentTimerValue: 0,
			};

		case 'SWAP_ALGORITHM': {
			const {oldAlg, newAlg} = action.payload;
			return {
				...state,
				currentAlgorithm: state.currentAlgorithm?.algorithm === oldAlg
					? {...state.currentAlgorithm, algorithm: newAlg}
					: state.currentAlgorithm,
				checkedAlgorithms: state.checkedAlgorithms.map((a) =>
					a.algorithm === oldAlg ? {...a, algorithm: newAlg} : a
				),
				algorithmQueue: state.algorithmQueue.map((a) =>
					a.algorithm === oldAlg ? {...a, algorithm: newAlg} : a
				),
				timerState: 'IDLE',
				currentTimerValue: 0,
				...SMART_RESET,
			};
		}

		case 'ADVANCE_ALGORITHM': {
			// Single card: repeat same algorithm (no queue rebuild, no cycling risk)
			// Create new reference with spread — needed to trigger smart cube useEffect
			if (state.algorithmQueue.length <= 1) {
				return {
					...state,
					currentAlgorithm: state.currentAlgorithm ? {...state.currentAlgorithm} : null,
					timerState: 'IDLE',
					currentTimerValue: 0,
					...SMART_RESET,
				};
			}

			const currentIdx = state.algorithmQueue.findIndex(
				(a) => a.algorithm === state.currentAlgorithm?.algorithm
			);
			let nextIdx = currentIdx + 1;
			if (nextIdx >= state.algorithmQueue.length) {
				// Rebuild queue
				const queue = buildQueue(state.checkedAlgorithms, state.options);
				return {
					...state,
					algorithmQueue: queue,
					currentAlgorithm: queue[0] ? {...queue[0]} : null,
					timerState: 'IDLE',
					currentTimerValue: 0,
					...SMART_RESET,
				};
			}
			return {
				...state,
				currentAlgorithm: {...state.algorithmQueue[nextIdx]},
				timerState: 'IDLE',
				currentTimerValue: 0,
				...SMART_RESET,
			};
		}

		case 'PREVIOUS_ALGORITHM': {
			const prevIdx = state.algorithmQueue.findIndex(
				(a) => a.algorithm === state.currentAlgorithm?.algorithm
			);
			if (prevIdx <= 0) {
				// At queue start, wrap to end
				const last = state.algorithmQueue[state.algorithmQueue.length - 1];
				return {
					...state,
					currentAlgorithm: last ? {...last} : null,
					timerState: 'IDLE',
					currentTimerValue: 0,
					...SMART_RESET,
				};
			}
			return {
				...state,
				currentAlgorithm: {...state.algorithmQueue[prevIdx - 1]},
				timerState: 'IDLE',
				currentTimerValue: 0,
				...SMART_RESET,
			};
		}

		// Smart Cube Actions
		case 'SMART_CONNECTION':
			return {
				...state,
				...(action.payload.scanning !== undefined && {smartScanning: action.payload.scanning}),
				...(action.payload.connecting !== undefined && {smartConnecting: action.payload.connecting}),
				...(action.payload.connected !== undefined && {smartConnected: action.payload.connected}),
				...(action.payload.scanError !== undefined && {smartScanError: action.payload.scanError}),
				...(action.payload.battery !== undefined && {smartBattery: action.payload.battery}),
			};

		case 'SMART_SET_PHASE':
			return {...state, smartPhase: action.payload};

		case 'SET_MATCHED_MOVE_COUNT':
			return {...state, matchedMoveCount: action.payload};

		case 'SET_TOTAL_EXPECTED_MOVES':
			return {...state, totalExpectedMoves: action.payload};

		case 'SET_BAD_ALG':
			return {...state, badAlg: action.payload};

		case 'SMART_DISCONNECT':
			return {
				...state,
				...SMART_DEFAULTS,
			};

		case 'SET_CAMERA_PAD':
			return {...state, showCameraPad: action.payload};

		default:
			return state;
	}
}

const defaultConnectRef = {current: null as any};

const TrainerContext = createContext<TrainerContextType>({
	state: initialState,
	dispatch: () => {},
	connectRef: defaultConnectRef,
});

export function useTrainerContext() {
	return useContext(TrainerContext);
}

interface TrainerProviderProps {
	children: ReactNode;
}

export function TrainerProvider({children}: TrainerProviderProps) {
	// Initial state derived from URL path so a deep-linked mount lands directly in the right view
	// (client-only first-mount optimization; trainer is gated behind app_loaded/FeatureGuard and
	// never server-renders — not an SSR/hydration concern).
	const location = useLocation();
	const [state, dispatch] = useReducer(trainerReducer, location.pathname, makeInitialState);
	const connectRef = useRef(new Connect());

	// Set up base BLE callbacks at Provider level
	useEffect(() => {
		const conn = connectRef.current;

		// Connect instance callbacks (scanning/connecting/error — called from Connect)
		conn.alertScanning = () => dispatch({type: 'SMART_CONNECTION', payload: {scanning: true, scanError: null}});
		conn.alertConnecting = () => dispatch({type: 'SMART_CONNECTION', payload: {scanning: false, connecting: true}});
		conn.alertScanError = (msg: string) => dispatch({type: 'SMART_CONNECTION', payload: {scanning: false, scanError: msg}});
		conn.alertDisconnected = () => dispatch({type: 'SMART_DISCONNECT'});

		// _initCube override: cube class (GAN/Giiker/Particula) inherits from SmartCube base class
		// with its own callbacks. These callbacks go to Redux/setTimerParams.
		// For Trainer, we need to redirect these callbacks to TrainerContext dispatch.
		// Set callbacks BEFORE cube.init() because init() adds event listeners
		// and alertConnected/alertCubeState may be called immediately.
		conn._initCube = async (device: any) => {
			// Determine cube class (Connect._initCube logic)
			let cube: any;
			const GAN = (await import('../timer/smart_cube/bluetooth/gan')).default;
			const Giiker = (await import('../timer/smart_cube/bluetooth/giiker')).default;
			const Particula = (await import('../timer/smart_cube/bluetooth/particula')).default;

			if (device.name.startsWith('Gi') || device.name.startsWith('Mi Smart Magic Cube')) {
				cube = new Giiker(device, conn.adapter);
			} else if (device.name.toLowerCase().startsWith('gan')) {
				cube = new GAN(device, conn.adapter);
			} else if (device.name.startsWith('GoCube') || device.name.startsWith('Rubiks')) {
				cube = new Particula(device, conn.adapter);
			}

			if (!cube) return;

			conn.activeCube = cube;

			// Set callbacks BEFORE init()
			cube.alertConnected = async (server: any) => {
				let dev;
				try {
					const exists = await conn.smartCubeInDb(server);
					dev = exists || await conn.addSmartCubeToDb(server.device.name, server.device.id);
				} catch {
					dev = {id: server.device.id, name: server.device.name, device_id: server.device.id};
				}
				dispatch({type: 'SMART_CONNECTION', payload: {connecting: false, connected: true}});
			};
			cube.alertDisconnected = () => dispatch({type: 'SMART_DISCONNECT'});
			cube.alertBatteryLevel = (level: number) => dispatch({type: 'SMART_CONNECTION', payload: {battery: level}});
			cube.alertTurnCube = (move: string) => {
				conn.alertTurnCube?.(move);
			};
			cube.alertTurnCubeBatch = (moves: any[]) => {
				conn.alertTurnCubeBatch?.(moves);
			};
			cube.alertCubeState = (facelets: string) => {
				conn.alertCubeState?.(facelets);
			};

			// _onCubeCreated callback (for gyro subscription)
			if ((conn as any)._onCubeCreated) (conn as any)._onCubeCreated(cube);

			await cube.init();
		};
	}, [dispatch]);

	return (
		<TrainerContext.Provider value={{state, dispatch, connectRef}}>
			{children}
		</TrainerContext.Provider>
	);
}
