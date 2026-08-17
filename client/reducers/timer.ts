import { TimerStore } from '../components/timer/@types/interfaces';

const smartState = {
	smartCubeConnected: false,
	smartCubeConnecting: false,
	smartCubeScanning: false,
	smartCubeScanError: null,
	smartScanDevices: [],
	smartCubeConnectStep: null,
	smartCanStart: false,
	smartTurns: [],
	smartDeviceId: '',
	smartCurrentState: null,
	smartSolvedState: 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB',
	smartGyroQuaternion: null,
	smartGyroVelocity: null,
	smartGyroSupported: false,
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
	smartStateSeq: 0,
	smartPhysicallySolved: false,
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
			const { moves, facelets } = action.payload;
			if (!moves || moves.length === 0) return state;

			// Fiziksel küp çözüldüyse ve timer çalışıyorsa, yeni hamle kabul etme
			// (sessizlik penceresi sırasında gelen ekstra hamleleri engeller)
			if (state.smartPhysicallySolved && state.timeStartedAt) {
				return state;
			}

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

			// Cube state that belongs to these moves, applied in the same update so no
			// listener can observe the new state without the moves that caused it.
			const statePatch: Partial<TimerStore> = {};
			if (facelets && facelets !== state.smartCurrentState) {
				statePatch.smartCurrentState = facelets;
				statePatch.smartStateSeq = (state.smartStateSeq || 0) + 1;
				statePatch.smartPhysicallySolved = facelets === state.smartSolvedState;
			}

			return {
				...state,
				smartTurns,
				smartPickUpTime: newPickUpTime,
				lastSmartMoveTime,
				...statePatch,
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
