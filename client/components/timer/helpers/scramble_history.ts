/**
 * Scramble navigation (Previous / Next): the last few scrambles and which one is shown.
 *
 * Pure so it can be tested without a store. The state lives in the timer store, not in
 * the component that draws the buttons: the timer swaps its desktop layout
 * (TimerScramble) for its mobile one (TimerControls) at 1024px, a tablet crosses that
 * on every rotation, and component state reset there, which left Previous dead.
 */

/** How far back Previous can go from the newest scramble. */
export const MAX_HISTORY_BACK_STEPS = 2;

export interface ScrambleHistory {
	history: string[];
	index: number;
}

export const EMPTY_SCRAMBLE_HISTORY: ScrambleHistory = {history: [], index: -1};

/**
 * Records a scramble that just appeared. One already at the current position is a
 * scramble the user navigated to, or the same scramble seen again by the other layout
 * after a swap, so there is nothing to add. Anything after the current position is
 * dropped, the way a browser drops forward history, and only the newest
 * MAX_HISTORY_BACK_STEPS + 1 are kept.
 */
export function appendScramble(state: ScrambleHistory, scramble: string): ScrambleHistory {
	if (!scramble || state.history[state.index] === scramble) {
		return state;
	}

	let history = [...state.history.slice(0, state.index + 1), scramble];
	if (history.length > MAX_HISTORY_BACK_STEPS + 1) {
		history = history.slice(-(MAX_HISTORY_BACK_STEPS + 1));
	}

	return {history, index: history.length - 1};
}

export function canGoPrevious(state: ScrambleHistory): boolean {
	const minIndex = Math.max(0, state.history.length - 1 - MAX_HISTORY_BACK_STEPS);
	return state.index > minIndex;
}

/** Whether Next steps forward through the history instead of generating a new scramble. */
export function hasNextInHistory(state: ScrambleHistory): boolean {
	return state.index < state.history.length - 1;
}
