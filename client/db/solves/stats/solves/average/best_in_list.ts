import SortedArray from 'sorted-array';
import {getAverage} from './average';
import {Solve} from '../../../../../../server/schemas/Solve.schema';

// Pure, cache-less variant of average_pb.ts's window-min algorithm.
// Used for in-place calculation when list is already constrained (e.g., last N solves)
// without breaking average_pb's filterOptions-based cache key.
//
// List sort order doesn't matter — window slides, trimmed average taken from each window.
export function getBestAverageFromSolves(solves: Solve[], count: number): { time: number; solves: Solve[] } | null {
	if (!solves || solves.length < count || count < 3) {
		return null;
	}

	const firstSolves = solves.slice(0, count);
	const sortedTimes = new SortedArray(firstSolves.map((s) => s.time));

	let bestList: Solve[] = [...firstSolves];
	let best = getAverage(firstSolves);

	for (let i = 1; i <= solves.length - count; i++) {
		const dropSolve = solves[i - 1];
		const addSolve = solves[i + count - 1];

		sortedTimes.remove(dropSolve.time);
		sortedTimes.insert(addSolve.time);

		const avg = getAverage(sortedTimes.array);

		if (avg > 0 && (best <= 0 || avg < best)) {
			best = avg;
			bestList = solves.slice(i, i + count);
		}
	}

	if (best <= 0) return null;

	return {time: best, solves: bestList};
}
