import { SmartCubeStore } from '../components/timer/@types/interfaces';
import { withDefaults } from './with_defaults';

export const DEFAULT_SOLVED_FACELETS = 'UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB';

/**
 * Smart cube connection state.
 *
 * Deliberately NOT part of the timer slice: RESET_TIMER_PARAMS fires when the timer page
 * unmounts, and while these fields lived there every navigation reported the cube as
 * disconnected. The connection belongs to the app, not to one route.
 *
 * Written only by client/util/smart_cube/connection_manager.ts.
 */
const initialState: SmartCubeStore = {
	smartCubeConnected: false,
	smartReconnecting: false,
	smartDeviceId: '',
	smartDeviceName: null,
	smartCubeBatteryLevel: null,
	smartGyroSupported: false,
	smartCurrentState: null,
	smartStateSeq: 0,
	smartPhysicallySolved: false,
	smartSolvedState: DEFAULT_SOLVED_FACELETS,
};

/**
 * Adopt a reported cube state.
 *
 * The cube repeats its FACELETS roughly once a second, so an unchanged state is dropped
 * here rather than re-rendering every listener for nothing. `smartStateSeq` is what a
 * listener watches when it needs to react to the repeat as well.
 */
function applyFacelets(state: SmartCubeStore, facelets: string | null): SmartCubeStore {
	if (!facelets || facelets === state.smartCurrentState) return state;

	return {
		...state,
		smartCurrentState: facelets,
		smartStateSeq: (state.smartStateSeq || 0) + 1,
		smartPhysicallySolved: facelets === state.smartSolvedState,
	};
}

export default (state = initialState, action) => {
	switch (action.type) {
		case 'SET_SMART_CUBE_PARAM': {
			const { params } = action.payload;

			return {
				...state,
				...params,
			};
		}

		case 'TURN_SMART_CUBE_BATCH': {
			// The facelets half of the move batch. Moves land in the timer slice from the same
			// action on purpose: combineReducers runs both reducers for one dispatch, so no
			// listener can ever observe the new cube state without the moves that produced it.
			// Two separate dispatches is what once let a state update overtake its own moves and
			// made the last scramble move read as the first solve move.
			const { moves, facelets } = action.payload;
			if (!moves || moves.length === 0) return state;
			return applyFacelets(state, facelets);
		}

		case 'SMART_CUBE_FACELETS': {
			return applyFacelets(state, action.payload.facelets);
		}

		default: {
			return withDefaults(state, initialState);
		}
	}
};
