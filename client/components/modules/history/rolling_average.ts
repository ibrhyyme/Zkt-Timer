/**
 * Rolling aoN for every solve in a list, the numbers behind the solves grid's average
 * columns (cstimer's "ao5 / ao12 per row").
 *
 * Rules, identical to the rest of the app (db/solves/stats/solves/average/average.ts) and
 * to cstimer's default "p5" trimming (Referans/cstimer-master/src/js/stats/timestat.js):
 *  - fewer than 5 solves in the window: a plain mean, nothing trimmed (mo3);
 *  - 5 or more: ceil(5% of N) trimmed from each end, which is 1 for ao5 to ao20;
 *  - a DNF sorts as the slowest time; more DNFs than the trimmed slow end makes the
 *    whole average a DNF.
 *
 * Speed. A list can hold 12k+ solves and a column can be ao5000, so recomputing every
 * window from scratch (sort N per row) is out. The window slides instead: one sorted
 * array, one binary insert and one binary removal per solve, and the trimmed sum comes
 * from a running total minus the few trimmed values at each end. Times are kept as whole
 * milliseconds so that running total never drifts.
 *
 * On top of that RollingAverageColumn remembers where it stopped: a new solve appended to
 * the end only costs one more slide, and a full recompute happens only when an older
 * solve changed (penalty, delete, filter switch).
 */

/** Marks a window that has no average yet (fewer solves than N). */
export const NO_AVERAGE = Number.NaN;
/** Marks a DNF average. Same convention as the rest of the app. */
export const DNF_AVERAGE = -1;

const DNF_MS = Number.POSITIVE_INFINITY;

/** Solves trimmed from EACH end of an aoN. */
export function averageTrimCount(n: number): number {
	if (n < 5) return 0;
	return Math.ceil(n * 0.05);
}

/** Seconds (negative = DNF) to the integer milliseconds the window works in. */
export function toWindowTime(seconds: number): number {
	if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) return DNF_MS;
	return Math.round(seconds * 1000);
}

function lowerBound(arr: number[], value: number): number {
	let lo = 0;
	let hi = arr.length;
	while (lo < hi) {
		const mid = (lo + hi) >>> 1;
		if (arr[mid] < value) lo = mid + 1;
		else hi = mid;
	}
	return lo;
}

class SlidingWindow {
	private sorted: number[] = [];
	private finiteSum = 0;
	private finiteCount = 0;

	constructor(private readonly n: number, private readonly trim: number) {}

	insert(value: number) {
		this.sorted.splice(lowerBound(this.sorted, value), 0, value);
		if (value !== DNF_MS) {
			this.finiteSum += value;
			this.finiteCount++;
		}
	}

	remove(value: number) {
		const index = lowerBound(this.sorted, value);
		if (index >= this.sorted.length || this.sorted[index] !== value) return;
		this.sorted.splice(index, 1);
		if (value !== DNF_MS) {
			this.finiteSum -= value;
			this.finiteCount--;
		}
	}

	/** The average of a full window, in seconds, or DNF_AVERAGE. */
	average(): number {
		const { n, trim, sorted } = this;
		const dnfCount = n - this.finiteCount;
		if (dnfCount > trim) return DNF_AVERAGE;

		let trimmed = 0;
		for (let i = 0; i < trim; i++) trimmed += sorted[i];
		// The slow end is the DNFs first, then the slowest finite times.
		const slowFinite = trim - dnfCount;
		for (let i = 0; i < slowFinite; i++) trimmed += sorted[this.finiteCount - 1 - i];

		return (this.finiteSum - trimmed) / (n - 2 * trim) / 1000;
	}

	clone(): SlidingWindow {
		const copy = new SlidingWindow(this.n, this.trim);
		copy.sorted = this.sorted.slice();
		copy.finiteSum = this.finiteSum;
		copy.finiteCount = this.finiteCount;
		return copy;
	}
}

/**
 * One average column. `update` takes the list's window times (toWindowTime) oldest
 * first and returns the aoN ending at each solve, same order: NO_AVERAGE while fewer
 * than N solves exist, DNF_AVERAGE for a DNF average, seconds otherwise.
 */
export class RollingAverageColumn {
	readonly n: number;
	private readonly trim: number;
	private times: number[] = [];
	private results: number[] = [];
	private window: SlidingWindow;

	constructor(n: number) {
		this.n = Math.max(1, Math.floor(n));
		this.trim = averageTrimCount(this.n);
		this.window = new SlidingWindow(this.n, this.trim);
	}

	update(times: number[]): number[] {
		const previous = this.times;
		let appendOnly = times.length >= previous.length;
		for (let i = 0; appendOnly && i < previous.length; i++) {
			if (previous[i] !== times[i]) appendOnly = false;
		}

		if (!appendOnly) {
			this.window = new SlidingWindow(this.n, this.trim);
			this.results = [];
			this.times = [];
		} else if (times.length === previous.length) {
			return this.results;
		}

		// Never mutate the array that was handed out last time: React state may hold it.
		const results = this.results.slice();
		const window = this.window.clone();
		for (let i = this.times.length; i < times.length; i++) {
			window.insert(times[i]);
			if (i >= this.n) window.remove(times[i - this.n]);
			results.push(i >= this.n - 1 ? window.average() : NO_AVERAGE);
		}

		this.window = window;
		this.results = results;
		this.times = times.slice();
		return results;
	}
}

/** One-shot helper for callers without a cache, and for tests. */
export function computeRollingAverages(times: number[], n: number): number[] {
	return new RollingAverageColumn(n).update(times);
}

/** Index of the best (lowest) real average in a column, or -1 when there is none. */
export function bestAverageIndex(results: number[]): number {
	let best = -1;
	for (let i = 0; i < results.length; i++) {
		const value = results[i];
		if (!(value > 0)) continue;
		if (best === -1 || value < results[best]) best = i;
	}
	return best;
}
