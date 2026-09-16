import {FilterSolvesOptions} from '../../../db/solves/query';
import {getDailyGoalStorage} from './storage';
import {getRoomDailyCounts} from './room-solves';
import {getDeletedDailyCounts} from './deleted-solves';

/**
 * The per-day counts that sit on top of the solve DB for everything the daily goal
 * counts: Friendly Room solves and solves deleted since, each only while its own toggle
 * ("Odalardaki çözümleri say" / "Silinen çözümleri de say") is on.
 *
 * One place, because every view that shows a goal has to count the same things the goal
 * does. The activity heatmap and the solves-per-day bars both read it; the goal progress
 * itself uses the today-only counterparts in progress.ts.
 */

/** Adds per-day count maps together. Undefined when there is nothing to add. */
export function mergeDailyCounts(...maps: (Map<string, number> | undefined)[]): Map<string, number> | undefined {
	const present = maps.filter(Boolean);
	if (present.length <= 1) return present[0];

	const merged = new Map<string, number>();
	for (const map of present) {
		for (const [key, count] of map) {
			merged.set(key, (merged.get(key) || 0) + count);
		}
	}
	return merged;
}

/**
 * Extra per-day counts for a solve filter, or undefined when both toggles are off.
 *
 * The bucket is read off the filter the way the solve query matches solves: a cube type
 * narrows to it, and a subset (an explicit null included) narrows to that exact subset.
 * A session filter is NOT honoured — room solves have no session and the deleted tally
 * does not record one — so callers scoped to a single session decide for themselves
 * whether to ask at all.
 */
export function getExtraDailyCounts(filter: FilterSolvesOptions): Map<string, number> | undefined {
	const storage = getDailyGoalStorage();
	if (!storage.count_room_solves && !storage.count_deleted_solves) {
		return undefined;
	}

	const cubeType = typeof filter.cube_type === 'string' ? filter.cube_type : undefined;

	const rawSubset = filter.scramble_subset;
	let subset: string | null | undefined;
	if (typeof rawSubset === 'string') subset = rawSubset;
	else if (rawSubset === null) subset = null;

	const room = storage.count_room_solves ? getRoomDailyCounts(cubeType, subset ?? null) : undefined;
	const deleted = storage.count_deleted_solves ? getDeletedDailyCounts(cubeType, subset) : undefined;

	return mergeDailyCounts(room, deleted);
}
