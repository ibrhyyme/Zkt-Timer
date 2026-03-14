import React, {createContext, useContext, useReducer, useRef, useEffect, ReactNode} from 'react';
import type {
	TrainerSessionState,
	TrainerAction,
	TrainerContextType,
	TrainerOptions,
	CheckedAlgorithm,
	SmartPhase,
} from './types';
import {algToId} from '../../util/trainer/algorithm_engine';
import {getBestTime} from './hooks/useAlgorithmData';
import Connect from '../timer/smart_cube/bluetooth/connect';

const DEFAULT_OPTIONS: TrainerOptions = {
	randomOrder: true,
	prioritizeSlow: false,
	selectLearning: false,
	randomizeAUF: true,
	topFace: 'U',
	frontFace: 'F',
};

function loadOptions(): TrainerOptions {
	try {
		const raw = localStorage.getItem('trainer_options');
		if (raw) return {...DEFAULT_OPTIONS, ...JSON.parse(raw)};
	} catch {
		// ignore
	}
	return DEFAULT_OPTIONS;
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
};

const initialState: TrainerSessionState = {
	view: 'selection',
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

function buildQueue(algorithms: CheckedAlgorithm[], options: TrainerOptions): CheckedAlgorithm[] {
	let queue = [...algorithms];

	// Prioritize Slow: slowest best-time first
	if (options.prioritizeSlow) {
		queue.sort((a, b) => {
			const aTime = getBestTime(algToId(a.algorithm)) ?? Infinity;
			const bTime = getBestTime(algToId(b.algorithm)) ?? Infinity;
			return bTime - aTime;
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

		case 'SET_VIEW':
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
			return {...state, options: newOptions};
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
	const [state, dispatch] = useReducer(trainerReducer, initialState);
	const connectRef = useRef(new Connect());

	// Temel BLE callback'leri Provider seviyesinde kur
	useEffect(() => {
		const conn = connectRef.current;

		// Connect instance callback'leri (scanning/connecting/error — bunlar Connect'ten cagirilir)
		conn.alertScanning = () => dispatch({type: 'SMART_CONNECTION', payload: {scanning: true, scanError: null}});
		conn.alertConnecting = () => dispatch({type: 'SMART_CONNECTION', payload: {scanning: false, connecting: true}});
		conn.alertScanError = (msg: string) => dispatch({type: 'SMART_CONNECTION', payload: {scanning: false, scanError: msg}});
		conn.alertDisconnected = () => dispatch({type: 'SMART_DISCONNECT'});

		// _initCube override: kup sinifi (GAN/Giiker/Particula) SmartCube base class'indan
		// kendi callback'lerini inherit ediyor. Bu callback'ler Redux/setTimerParams'a gidiyor.
		// Trainer icin bu callback'leri TrainerContext dispatch'e yonlendirmemiz gerekiyor.
		// Callback'leri cube.init() ONCESINDE set etmeliyiz cunku init() icinde event
		// listener'lar ekleniyor ve alertConnected/alertCubeState hemen cagirilabilir.
		conn._initCube = async (device: any) => {
			// Kup sinifini belirle (Connect._initCube mantigi)
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

			// Callback'leri init() ONCESINDE set et
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

			// _onCubeCreated callback (gyro subscription icin)
			if (conn._onCubeCreated) conn._onCubeCreated(cube);

			await cube.init();
		};
	}, [dispatch]);

	return (
		<TrainerContext.Provider value={{state, dispatch, connectRef}}>
			{children}
		</TrainerContext.Provider>
	);
}
