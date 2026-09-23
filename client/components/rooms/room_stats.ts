/**
 * The numbers in a friendly room's bottom panel: last and best single, and the current and
 * best average of each length.
 *
 * This used to be computed inline in FriendlyRoom with its own rules, and those rules were
 * wrong in two ways that only showed once longer averages were wanted:
 *  - DNFs were filtered out before averaging, so an "ao5" was really the mean of the last
 *    five successful solves, however many DNFs sat between them.
 *  - Every length trimmed exactly one best and one worst. WCA trims 5% from each end, so an
 *    ao50 drops three and an ao100 five.
 * It now goes through the same `getAverage` the timer's own stats use, so a room average and
 * a timer average over the same solves are the same number.
 */

import {getAverage} from '../../db/solves/stats/solves/average/average';
import {getBestAverageFromSolves} from '../../db/solves/stats/solves/average/best_in_list';
import type {Solve} from '../../../server/schemas/Solve.schema';
import type {FriendlyRoomSolveData} from '../../../shared/friendly_room/types';

/** Average lengths shown in the room panel, in display order. */
export const ROOM_AVERAGE_COUNTS = [5, 12, 25, 50, 100] as const;
export type RoomAverageCount = typeof ROOM_AVERAGE_COUNTS[number];

/**
 * Every value is in seconds. `-1` means DNF, exactly as `getTimeString` renders it, and
 * `null` means there are not enough solves yet.
 */
export interface RoomStats {
	lastSingle: number | null;
	bestSingle: number | null;
	averages: Record<RoomAverageCount, {current: number | null; best: number | null}>;
}

/** A room solve as the average code expects it: +2 applied, DNF as a negative time. */
function toTime(solve: FriendlyRoomSolveData): number {
	if (solve.dnf) return -1;
	return solve.plus_two ? solve.time + 2 : solve.time;
}

export function computeRoomStats(solves: FriendlyRoomSolveData[]): RoomStats {
	// Chronological by round. The server already sends them this way; sorting a copy keeps
	// an optimistic client-side append from ever putting a solve in the wrong window.
	const ordered = [...(solves || [])].sort((a, b) => a.scramble_index - b.scramble_index);
	const times = ordered.map(toTime);

	const valid = times.filter((t) => t >= 0);
	const bestSingle = valid.length ? Math.min(...valid) : times.length ? -1 : null;
	const lastSingle = times.length ? times[times.length - 1] : null;

	// best_in_list works on objects carrying `time`; it reads nothing else from them.
	const timeObjects = times.map((time) => ({time}) as unknown as Solve);

	const averages = {} as RoomStats['averages'];
	for (const count of ROOM_AVERAGE_COUNTS) {
		if (times.length < count) {
			averages[count] = {current: null, best: null};
			continue;
		}

		// getAverage sorts its argument in place, so it gets its own copy.
		const current = getAverage(times.slice(-count));
		const best = getBestAverageFromSolves(timeObjects, count);

		averages[count] = {
			current: current > 0 ? current : -1,
			// Enough solves but no window without too many DNFs: the best average is a DNF.
			best: best ? best.time : -1,
		};
	}

	return {lastSingle, bestSingle, averages};
}
