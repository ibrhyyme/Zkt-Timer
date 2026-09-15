/**
 * Tells a genuinely new solve landing on top of the history list apart from a
 * filter swap, a scroll-triggered re-render, or the initial load — the three
 * cases where the top id can also change without a solve having just been added.
 *
 * Pure so it can be unit tested without touching React or LokiJS: History.tsx keeps
 * one ref of the last state this returned and feeds it back in on every render (the
 * same "detect on this pass, remember for the rest" shape ScrambleMoveList's
 * baselineRef uses), mutating during render rather than in an effect so the row
 * that mounts because of the new solve already carries the flag on its first paint
 * — an effect would only see it a tick later, after the entrance had already run.
 */

export interface NewestArrivalState {
	topId: string | null;
	filterKey: string;
}

export interface NewestArrivalResult {
	/** The id to animate this render, or null if nothing just arrived. */
	arrivalId: string | null;
	/** State to remember for the next call. */
	next: NewestArrivalState;
}

/**
 * @param prev State from the previous call, or null on the very first one (initial
 * load never animates — there is nothing to compare against).
 * @param currentTopId The current list's top solve id (newest first), or null when
 * the list is empty.
 * @param filterKey A stable serialization of the active filter. Comparing by this
 * rather than object identity matters: callers that build a filter object inline on
 * every render would otherwise look "changed" on every call, and a genuine filter
 * change (which can also swap the top id) must re-baseline silently instead of
 * being read as a new solve.
 */
export function detectNewestArrival(
	prev: NewestArrivalState | null,
	currentTopId: string | null,
	filterKey: string
): NewestArrivalResult {
	const next: NewestArrivalState = { topId: currentTopId, filterKey };

	if (!prev) {
		return { arrivalId: null, next };
	}

	if (filterKey !== prev.filterKey) {
		return { arrivalId: null, next };
	}

	if (currentTopId && currentTopId !== prev.topId) {
		return { arrivalId: currentTopId, next };
	}

	return { arrivalId: null, next };
}
