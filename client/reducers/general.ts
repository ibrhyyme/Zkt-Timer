import { GeneralAllParams } from '../util/hooks/useGeneral';
import { withDefaults } from './with_defaults';

const initialState: GeneralAllParams = {
	app_loaded: false,
	browser_session_id: null,
	mobile_mode: false,
	force_nav_collapsed: false,
	modals: [],
};

export default (state = initialState, action) => {
	switch (action.type) {
		case 'SET_GENERAL': {
			const { key, value } = action.payload;

			return {
				...state,
				[key]: value,
			};
		}
		// Both build a new array. App renders the list through useGeneral('modals'), which
		// only re-renders when the reference changes; pushing into the old array left the
		// selector nothing to notice, and modals showed up only because unrelated
		// re-renders happened to follow.
		case 'OPEN_MODAL': {
			return {
				...state,
				modals: [...state.modals, action.payload],
			};
		}
		case 'CLOSE_MODAL': {
			if (!state.modals.length) {
				return state;
			}

			return {
				...state,
				modals: state.modals.slice(0, -1),
			};
		}

		default: {
			return withDefaults(state, initialState);
		}
	}
};
