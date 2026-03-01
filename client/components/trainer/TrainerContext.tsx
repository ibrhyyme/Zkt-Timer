import React, {createContext, useContext, useReducer, ReactNode} from 'react';
import type {
	TrainerSessionState,
	TrainerAction,
	TrainerContextType,
	TrainerOptions,
	CheckedAlgorithm,
} from './types';
import {algToId} from '../../util/trainer/algorithm_engine';
import {getBestTime} from './hooks/useAlgorithmData';

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
					currentAlgorithm: queue[0] || null,
					timerState: 'IDLE',
					currentTimerValue: 0,
				};
			}
			return {
				...state,
				currentAlgorithm: state.algorithmQueue[nextIdx],
				timerState: 'IDLE',
				currentTimerValue: 0,
			};
		}

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
	const [state, dispatch] = useReducer(trainerReducer, initialState);

	return (
		<TrainerContext.Provider value={{state, dispatch}}>
			{children}
		</TrainerContext.Provider>
	);
}
