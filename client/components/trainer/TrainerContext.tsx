import React, {createContext, useContext, useReducer, useEffect, ReactNode} from 'react';
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
import {getSmartCubeManager} from '../../util/smart_cube/connection_manager';

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

const TrainerContext = createContext<TrainerContextType>({
	state: initialState,
	dispatch: () => {},
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

	// The trainer no longer owns a Connect instance. Every surface shares the app-level
	// manager, so a cube paired on the timer is already live when the trainer opens, and
	// leaving the trainer no longer strands an open link nobody can reach (the old code
	// abandoned its instance on unmount instead of disconnecting).
	//
	// This mirrors the manager's connection state into the trainer's own reducer, which the
	// trainer UI reads. The manager's Redux slice is the source; this is a view of it.
	useEffect(() => {
		const manager = getSmartCubeManager();

		let wasConnected = manager.getSnapshot().connected;

		const apply = (snapshot: ReturnType<typeof manager.getSnapshot>) => {
			if (wasConnected && !snapshot.connected) {
				// SMART_DISCONNECT resets the whole smart block (phase, match counters, camera
				// pad), so it fires only on the actual transition. Sending it for every
				// not-connected snapshot would wipe a live session the moment a scan started.
				wasConnected = false;
				dispatch({type: 'SMART_DISCONNECT'});
				return;
			}
			wasConnected = snapshot.connected;
			dispatch({
				type: 'SMART_CONNECTION',
				payload: {
					scanning: snapshot.scanning,
					connecting: snapshot.connecting,
					connected: snapshot.connected,
					scanError: snapshot.scanError,
					// Seeds the readout for a cube connected before the trainer opened; later
					// readings arrive through subscribeBattery below.
					battery: snapshot.batteryLevel,
				},
			});
		};

		// Seed from the current state first: the cube may already be connected from another page.
		apply(manager.getSnapshot());
		const unsubConnection = manager.subscribeConnection(apply);
		const unsubBattery = manager.subscribeBattery((level) =>
			dispatch({type: 'SMART_CONNECTION', payload: {battery: level}})
		);

		return () => {
			unsubConnection();
			unsubBattery();
		};
	}, [dispatch]);

	return (
		<TrainerContext.Provider value={{state, dispatch}}>
			{children}
		</TrainerContext.Provider>
	);
}
