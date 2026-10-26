/**
 * Arithmetic over a window of solve times, shared by the averages and the stats blocks.
 *
 * Pure on purpose (no solve DB, no cache), so every rule here is testable on plain numbers.
 * A time below zero is a DNF, the way the solve DB stores it.
 */

/**
 * Solves dropped from each end of an average of `count`: 5% rounded up, at least one, and
 * none below five solves (WCA and csTimer's default). A mean of N drops nothing.
 */
export function getTrimCount(count: number, mean = false): number {
	if (mean || count < 5) {
		return 0;
	}
	return Math.ceil(Math.max(1, count * 0.05));
}

// A DNF sorts after every time.
function sortValue(time: number): number {
	return time < 0 ? Infinity : time;
}

/** The times an average of `times.length` counts, fastest first, with the trimmed ends removed. A DNF is Infinity. */
export function getCountingTimes(times: number[], mean = false): number[] {
	const sorted = times.map(sortValue).sort((a, b) => a - b);
	const trim = getTrimCount(times.length, mean);
	return sorted.slice(trim, sorted.length - trim);
}

/**
 * Sample standard deviation (n - 1), the σ csTimer reports next to an average.
 * Null with fewer than two values or when one of them is a DNF.
 */
export function getSampleStdDev(values: number[]): number | null {
	if (values.length < 2 || values.some((v) => !isFinite(v) || v < 0)) {
		return null;
	}

	const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
	const squares = values.reduce((sum, v) => sum + (v - avg) ** 2, 0);
	return Math.sqrt(squares / (values.length - 1));
}

/** 'never': no next solve can beat the best. 'always': any next solve does. */
export type NextSolveTarget = number | 'never' | 'always';

export interface NextSolveOutlook {
	/** The next average if the next solve were perfect (csTimer's BPA). -1 when it is a DNF anyway. */
	best: number;
	/** The next average if the next solve were a DNF (WPA). -1 when that makes it a DNF. */
	worst: number;
	/** The time the next solve has to beat for a new best average. Null without a best to beat. */
	target: NextSolveTarget | null;
}

/**
 * What the next solve can do to the next average of `count`: csTimer's best and worst
 * possible average and its target time (TimeStat.getBWPA, TimeStat.getThres).
 *
 * `previous` holds the newest count - 1 times, which stay in the next window. `bestAverage`
 * is the best average of `count` so far: -1 when every window was a DNF, null when there has
 * not been a full window yet (then there is no target).
 *
 * The next solve x is either trimmed as the fastest, trimmed as the slowest, or counted.
 * The average is flat in the two trimmed ranges and rises linearly in between, so it meets
 * the best exactly once inside the counted range, where x = best * counted - (the rest).
 */
export function getNextSolveOutlook(
	previous: number[],
	count: number,
	mean: boolean,
	bestAverage: number | null
): NextSolveOutlook | null {
	if (count < 3 || previous.length !== count - 1) {
		return null;
	}

	const sorted = previous.map(sortValue).sort((a, b) => a - b);
	const trim = getTrimCount(count, mean);
	const counted = count - 2 * trim;

	// The previous times that count whatever x is (indices trim .. count - 2 - trim).
	let rest = 0;
	for (let i = trim; i <= count - 2 - trim; i++) {
		rest += sorted[i];
	}

	// x trimmed as the fastest pulls the time just below the counted range in; with nothing
	// trimmed, x itself counts and the best x is 0.
	const lowest = trim > 0 ? sorted[trim - 1] : 0;
	const best = (rest + lowest) / counted;
	// x trimmed as the slowest pulls the time just above the counted range in; with nothing
	// trimmed, a DNF counts and the average is a DNF.
	const worst = trim > 0 ? (rest + sorted[count - 1 - trim]) / counted : Infinity;

	let target: NextSolveTarget | null = null;
	if (bestAverage !== null) {
		if (!isFinite(best)) {
			target = 'never';
		} else if (bestAverage < 0) {
			target = 'always';
		} else if (best >= bestAverage) {
			target = 'never';
		} else if (worst < bestAverage) {
			target = 'always';
		} else {
			target = bestAverage * counted - rest;
		}
	}

	return {
		best: isFinite(best) ? best : -1,
		worst: isFinite(worst) ? worst : -1,
		target,
	};
}
