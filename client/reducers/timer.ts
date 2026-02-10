import { TimerStore } from '../components/timer/@types/interfaces';

const smartState = {
	smartCubeConnected: false,
	smartCubeConnecting: false,
	smartCanStart: false,
	smartTurns: [],
	smartDeviceId: '',
	smartCurrentState: 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB',
	smartSolvedState: 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB',
	smartGyroQuaternion: null,
	smartGyroVelocity: null,
	smartGyroSupported: false,
	smartPickUpTime: 0,
	lastSmartMoveTime: 0,
	lastSmartSolveStats: null,
	originalScramble: '',
	smartTurnOffset: 0,
};

const defaultTimerState = {
	timeStartedAt: null,
	solving: false,
	spaceTimerStarted: 0,
	inspectionTimer: 0,
	startEnabled: false,
	manualTime: '',
	notification: null,
	editScramble: false,
	manualEntryErr: null,
	inInspection: false,
	scrambleLocked: false,
	sessionSolveCount: 0,
	heightSmall: false,
	dnfTime: false,
	addTwoToSolve: false,
	stackMatInit: false,
	canStart: false,

	disabled: false,
	scramble: ''
};

const initialState: TimerStore = {
	...defaultTimerState,
	...smartState,
};

// TODO revisit all of these
export default (state = initialState, action) => {
	switch (action.type) {
		case 'RESET_TIMER_PARAMS': {
			return {
				...state,
				...defaultTimerState,
				...smartState,
			};
		}

		case 'SET_TIMER_PARAM': {
			const { params } = action.payload;

			return {
				...state,
				...params,
			};
		}

		case 'TURN_SMART_CUBE': {
			const {
				payload: { turn, completedAt },
			} = action;
			const smartTurns = [...state.smartTurns];

			smartTurns.push({
				turn,
				completedAt,
			});

			const now = completedAt || Date.now();
			let newPickUpTime = state.smartPickUpTime;
			let { lastSmartMoveTime } = state;

			if (state.timeStartedAt) {
				// Timer is running
				if (state.smartTurns.length === 0 && newPickUpTime === 0) {
					newPickUpTime = (now - new Date(state.timeStartedAt).getTime()) / 1000;
				}
				lastSmartMoveTime = now;
			}

			return {
				...state,
				smartTurns,
				smartPickUpTime: newPickUpTime,
				lastSmartMoveTime,
			};
		}

		case 'TURN_SMART_CUBE_BATCH': {
			const { moves } = action.payload;
			if (!moves || moves.length === 0) return state;

			// Single immutable copy for batch
			const smartTurns = [...state.smartTurns, ...moves];

			// Calculate smartPickUpTime for first move
			const firstMove = moves[0];
			let newPickUpTime = state.smartPickUpTime;

			if (state.timeStartedAt) {
				// Timer is running
				if (state.smartTurns.length === 0 && newPickUpTime === 0) {
					const now = firstMove.completedAt || Date.now();
					newPickUpTime = (now - new Date(state.timeStartedAt).getTime()) / 1000;
				}
			}

			// Last move timestamp
			const lastMove = moves[moves.length - 1];
			const lastSmartMoveTime = state.timeStartedAt
				? (lastMove?.completedAt || Date.now())
				: state.lastSmartMoveTime;

			return {
				...state,
				smartTurns,
				smartPickUpTime: newPickUpTime,
				lastSmartMoveTime,
			};
		}

		case 'SET_TIMER_DISABLED': {
			const { disabled } = action.payload;

			return {
				...state,
				timerDisabled: disabled,
			};
		}

		case 'SET_START_ENABLED': {
			const { payload } = action;

			return {
				...state,
				startEnabled: payload,
			};
		}

		default: {
			return {
				...initialState,
				...state,
			};
		}
	}
};
