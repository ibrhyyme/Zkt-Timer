import type { TimerStore } from '../@types/interfaces';

/**
 * Timer-slice fields that change several times a second: on every smart cube move, and on
 * every inspection tick.
 *
 * They are kept out of TimerContext on purpose. Timer used to hand the whole slice down
 * through the context, so every move re-rendered everything under it, header pickers,
 * footer modules and stats included, none of which shows move data. A component that
 * shows one of these fields subscribes to it itself (useTimerStore), and code that acts on
 * one at a single moment reads it from the store (getTimerStore).
 *
 * A field belongs here only if it changes that often. Moving one in means every reader of
 * it through the context has to switch; ITimerContext omits these keys, so tsc lists them.
 */
export const FAST_TIMER_FIELDS = [
	'smartTurns',
	'smartCurrentState',
	'smartStateSeq',
	'smartPhysicallySolved',
	'lastSmartMoveTime',
	'smartPickUpTime',
	'smartMatchStatus',
	'smartUndoMoves',
	'inspectionTimer',
] as const;

export type FastTimerField = typeof FAST_TIMER_FIELDS[number];

export type StableTimerStore = Omit<TimerStore, FastTimerField>;

const FAST = new Set<string>(FAST_TIMER_FIELDS);

/**
 * The timer slice without the fast fields.
 *
 * Builds a new object on every call, so pair it with shallowEqual: an update that touched
 * only fast fields then compares equal, and the subscriber neither re-renders nor gets a
 * new object (useSelector hands back the previous one when the two compare equal).
 * Runs on the server too, so it must stay free of browser APIs.
 */
export function selectStableTimerStore(state: { timer?: TimerStore } | null | undefined): StableTimerStore {
	const timer = (state?.timer || {}) as Record<string, unknown>;
	const stable: Record<string, unknown> = {};

	for (const key of Object.keys(timer)) {
		if (!FAST.has(key)) {
			stable[key] = timer[key];
		}
	}

	return stable as StableTimerStore;
}
