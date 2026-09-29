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
 *
 * The cube's reported facelets used to be on this list. They live in their own slice now
 * (reducers/smart_cube.ts), which the timer context never carried in the first place, so
 * they cannot reach it and do not need excluding here.
 */
export const FAST_TIMER_FIELDS = [
	'smartTurns',
	'lastSmartMoveTime',
	'smartPickUpTime',
	'smartMatchStatus',
	'smartUndoMoves',
	'inspectionTimer',
] as const;

export type FastTimerField = typeof FAST_TIMER_FIELDS[number];

/**
 * Scramble navigation state (helpers/scramble_history.ts). Not fast, but no context
 * reader needs it: only the navigation hooks read it, through useTimerStore. It changes
 * right after `scramble` does, so carrying it in the context would render the whole timer
 * page a second time for every new scramble.
 */
export const SCRAMBLE_NAV_FIELDS = ['scrambleBucket', 'scrambleHistory', 'scrambleHistoryIndex'] as const;

export type ScrambleNavField = typeof SCRAMBLE_NAV_FIELDS[number];

export type StableTimerStore = Omit<TimerStore, FastTimerField | ScrambleNavField>;

const NOT_IN_CONTEXT = new Set<string>([...FAST_TIMER_FIELDS, ...SCRAMBLE_NAV_FIELDS]);

/**
 * The timer slice without the fast fields and the scramble navigation fields.
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
		if (!NOT_IN_CONTEXT.has(key)) {
			stable[key] = timer[key];
		}
	}

	return stable as StableTimerStore;
}
