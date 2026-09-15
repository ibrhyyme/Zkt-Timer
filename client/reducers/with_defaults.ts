/**
 * The `default:` branch shared by every slice reducer.
 *
 * Hands the incoming state back untouched when it already has every key of the
 * slice's initial state. Returning a fresh copy there made every dispatched action
 * look like a change to every slice, so a selector returning a slice (or anything
 * built from one) re-rendered its component on actions that had nothing to do with it.
 *
 * The fill-in stays for the one case that needs it: state handed over by SSR
 * (window.__STORE__) or an older cached page can lack keys added to initialState since.
 * Runs on the server too, so it must stay free of browser APIs.
 */
export function withDefaults<S extends object>(state: S, initialState: S): S {
	if (state == null) {
		return {...initialState};
	}

	for (const key of Object.keys(initialState)) {
		if (!(key in state)) {
			return {...initialState, ...state};
		}
	}

	return state;
}
