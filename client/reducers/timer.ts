import { TimerStore } from '../components/timer/@types/interfaces';
import { withDefaults } from './with_defaults';

// Solve- and session-scoped smart cube state only. Everything the CONNECTION owns
// (connected, device, battery, gyro support, reported facelets, solved state) lives in
// reducers/smart_cube.ts, because RESET_TIMER_PARAMS below wipes this object on every
// timer unmount and that used to take a live Bluetooth cube down with it.
const smartState = {
	smartCubeConnecting: false,
	smartCubeScanning: false,
	smartCubeScanError: null,
	smartScanDevices: [],
	smartCubeConnectStep: null,
	smartCanStart: false,
	smartTurns: [],
	smartGyroQuaternion: null,
	smartGyroVelocity: null,
	smartPickUpTime: 0,
	lastSmartMoveTime: 0,
	lastSmartSolveStats: null,
	originalScramble: '',
	smartTurnOffset: 0,
	smartUndoMoves: null,
	// Per-move scramble match produced by the shared solve engine. The display reads this
	// instead of re-deriving it, so UI and engine can never disagree.
	smartMatchStatus: [],
	smartAbortVisible: false,
	smartNeedsCubeReset: false,
	smartOutOfSync: false,
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
	phaseSplits: [],
	virtualArmed: false,

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
				payload: { turn, completedAt, cubeTimestamp, localTimestamp },
			} = action;
			const smartTurns = [...state.smartTurns];

			smartTurns.push({
				turn,
				completedAt,
				cubeTimestamp: cubeTimestamp ?? null,
				localTimestamp: localTimestamp ?? null,
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

			// The "cube already solved while the timer runs" guard that used to sit here moved
			// into the connection manager: the two halves of the question now live in two
			// slices, and a reducer can only see its own. The manager drops the batch before
			// it is dispatched, so this branch never sees those moves at all.

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

			// The cube state that belongs to these moves is applied by reducers/smart_cube.ts
			// from this same action, so one dispatch still updates moves and state together.

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
			return withDefaults(state, initialState);
		}
	}
};
