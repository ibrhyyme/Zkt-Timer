/**
 * Algorithm Trainer reducer (standard and smart study, category selection and set study).
 *
 * Kept apart from TrainerContext.tsx (which owns persistence and the smart cube bridge) so the
 * state rules are testable in node. Side effects stay out: the one exception is the existing
 * `trainer_mode` write of SET_MODE / SET_VIEW landing, guarded for environments without storage.
 *
 * Card identity is `category::name` (checkedKey). Algorithm text is not unique: the library has
 * cases in different categories with the same algorithm (PLL Y perm and 2-Look PLL No Matching),
 * and a mixed set can hold both. Statistics still key by the text (algToId), on purpose.
 */
import type {
	CheckedAlgorithm,
	SmartPhase,
	TrainerAction,
	TrainerMode,
	TrainerOptions,
	TrainerSessionState,
	TrainerView,
} from './types';
import {algToId} from '../../util/trainer/algorithm_engine';
import {checkedKey, filterForMode} from '../../util/trainer/set_queue';
import {getBestTime, getFailCount} from './hooks/useAlgorithmData';

export const SMART_DEFAULTS = {
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

const SMART_RESET = {
	smartPhase: 'idle' as SmartPhase,
	matchedMoveCount: 0,
	totalExpectedMoves: 0,
	badAlg: [] as string[],
};

export function createTrainerState(
	options: TrainerOptions,
	nav: {mode: TrainerMode | null; view: TrainerView; pendingSetCode?: string | null}
): TrainerSessionState {
	return {
		view: nav.view,
		mode: nav.mode,
		selectedCategory: '',
		selectedSubsets: [],
		checkedAlgorithms: [],
		algorithmQueue: [],
		currentAlgorithm: null,
		activeSet: null,
		pendingSetCode: nav.pendingSetCode ?? null,
		timerState: 'IDLE',
		currentTimerValue: 0,
		userAlg: [],
		originalUserAlg: [],
		isMoveMasked: false,
		options,
		...SMART_DEFAULTS,
	};
}

export function buildQueue(algorithms: CheckedAlgorithm[], options: TrainerOptions): CheckedAlgorithm[] {
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

/** Everything a study session holds; cleared when the session ends. */
const CLEARED_STUDY = {
	currentAlgorithm: null,
	checkedAlgorithms: [] as CheckedAlgorithm[],
	algorithmQueue: [] as CheckedAlgorithm[],
	activeSet: null,
	pendingSetCode: null,
	timerState: 'IDLE' as const,
	currentTimerValue: 0,
	userAlg: [] as string[],
	originalUserAlg: [] as string[],
	...SMART_RESET,
};

function writeTrainerMode(mode: TrainerMode | null) {
	try {
		if (mode) localStorage.setItem('trainer_mode', mode);
		else localStorage.removeItem('trainer_mode');
	} catch {
		// No storage (private mode, node): the URL carries the mode anyway.
	}
}

function indexOfCard(queue: CheckedAlgorithm[], card: CheckedAlgorithm | null): number {
	if (!card) return -1;
	const key = checkedKey(card);
	return queue.findIndex((a) => checkedKey(a) === key);
}

export function trainerReducer(state: TrainerSessionState, action: TrainerAction): TrainerSessionState {
	switch (action.type) {
		case 'SET_CATEGORY':
			return {
				...state,
				selectedCategory: action.payload,
				selectedSubsets: [],
				checkedAlgorithms: [],
				algorithmQueue: [],
				currentAlgorithm: null,
				activeSet: null,
				pendingSetCode: null,
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
			const key = action.payload;
			const updated = state.checkedAlgorithms.filter((a) => checkedKey(a) !== key);
			const queue = buildQueue(updated, state.options);
			const current =
				state.currentAlgorithm && checkedKey(state.currentAlgorithm) === key
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
			// Entering a trainer (from the hub, or another entry). A running set study ends here.
			writeTrainerMode(action.payload);
			return {
				...state,
				mode: action.payload,
				view: 'selection',
				activeSet: null,
				pendingSetCode: null,
			};

		case 'SET_STUDY_MODE': {
			// The mode switch: only the mode changes, view and queue stay. A set study re-filters
			// its cards in TrainerProvider (filterForMode), not here. Locked while the timer runs.
			if (state.timerState === 'RUNNING') return state;
			const mode = action.payload;
			const remember = action.remember !== false && state.options.lastMode !== mode;
			if (state.mode === mode && !remember) return state;
			return {
				...state,
				mode,
				options: remember ? {...state.options, lastMode: mode} : state.options,
			};
		}

		case 'START_SET_STUDY': {
			const {set, items} = action.payload;
			const cards = filterForMode(items, state.mode);
			const queue = buildQueue(cards, state.options);
			return {
				...state,
				...CLEARED_STUDY,
				view: 'training',
				// A set study has no selector category; the toolbar reads the card's category first.
				selectedCategory: '',
				selectedSubsets: [],
				activeSet: {...set, items},
				checkedAlgorithms: cards,
				algorithmQueue: queue,
				currentAlgorithm: queue[0] ? {...queue[0]} : null,
			};
		}

		case 'SET_STUDY_ROWS': {
			if (!state.activeSet) return state;
			const cards = action.payload;
			const queue = buildQueue(cards, state.options);
			const keep = indexOfCard(cards, state.currentAlgorithm) !== -1;
			if (keep) {
				return {...state, checkedAlgorithms: cards, algorithmQueue: queue};
			}
			return {
				...state,
				checkedAlgorithms: cards,
				algorithmQueue: queue,
				currentAlgorithm: queue[0] ? {...queue[0]} : null,
				timerState: 'IDLE',
				currentTimerValue: 0,
				...SMART_RESET,
			};
		}

		case 'SET_PENDING_SET':
			if (action.payload === null) return {...state, pendingSetCode: null};
			// Cold open of a set study link: the training screen shows a loading state until
			// START_SET_STUDY arrives (or the loader gives up and sends the user to the set page).
			return {
				...state,
				...CLEARED_STUDY,
				view: 'training',
				pendingSetCode: action.payload,
			};

		case 'SET_VIEW': {
			const view = action.payload;
			// The hub and the Trainers page sit above every trainer: no mode is open there.
			if (view === 'landing' || view === 'modes') {
				writeTrainerMode(null);
				return {
					...state,
					...CLEARED_STUDY,
					view,
					mode: null,
					selectedCategory: '',
					selectedSubsets: [],
					badAlg: [],
				};
			}
			if (view === 'training') return {...state, view};

			// Leaving the study screen ends the session (back from training clears the selection,
			// as it always did; a set study's cards never leak into the selector). Moving between
			// the selector and the set tabs keeps what the selector had checked.
			const endsStudy = state.view === 'training' || state.activeSet !== null || state.pendingSetCode !== null;
			if (!endsStudy) return {...state, view};
			return {...state, ...CLEARED_STUDY, view};
		}

		case 'SET_OPTIONS': {
			// Persisted by TrainerProvider's options effect (device copy + server), not here:
			// a reducer must stay free of side effects.
			const newOptions = {...state.options, ...action.payload};
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
			// The alternative picker swaps the CURRENT card's algorithm. Matched by card key so a
			// second case with the same text (other category, same set) keeps its own algorithm.
			const {oldAlg, newAlg} = action.payload;
			const cur = state.currentAlgorithm;
			const targetKey = cur && cur.algorithm === oldAlg ? checkedKey(cur) : null;
			const matches = (a: CheckedAlgorithm) =>
				targetKey !== null ? checkedKey(a) === targetKey && a.algorithm === oldAlg : a.algorithm === oldAlg;
			const swap = (a: CheckedAlgorithm) => (matches(a) ? {...a, algorithm: newAlg} : a);
			return {
				...state,
				currentAlgorithm: cur && matches(cur) ? {...cur, algorithm: newAlg} : cur,
				checkedAlgorithms: state.checkedAlgorithms.map(swap),
				algorithmQueue: state.algorithmQueue.map(swap),
				// The full row list too, or a mode switch would bring the old algorithm back.
				activeSet: state.activeSet ? {...state.activeSet, items: state.activeSet.items.map(swap)} : null,
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

			const currentIdx = indexOfCard(state.algorithmQueue, state.currentAlgorithm);
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
			const prevIdx = indexOfCard(state.algorithmQueue, state.currentAlgorithm);
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
