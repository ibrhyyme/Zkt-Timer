import {getTimeString} from '../../../util/time';
import {fetchSolves, FilterSolvesOptions} from '../query';

export interface TimeDistroBucket {
	x: string;
	y: number;
}

/** Decimals a bucket width needs to be written exactly: 2 for 2 s, 1 for 1.5 s or 0.2 s. */
function stepDecimals(step: number): number {
	for (let decimals = 0; decimals < 2; decimals += 1) {
		const scaled = step * 10 ** decimals;
		if (Math.abs(scaled - Math.round(scaled)) < 1e-6) return decimals;
	}
	return 2;
}

/**
 * A bucket edge as the chart prints it. Whole seconds above 10 s used to be the rule, so
 * buckets narrower than a second got the same label ("15-15" twice). The label is also
 * the chart's band key, so two such buckets were drawn on the same spot, one hidden behind
 * the other. The decimals now follow the bucket width as well, and a 1.5 s bucket keeps
 * its half second ("12.5", not "12").
 */
export function bucketEdgeLabel(edge: number, bucketSize: number): string {
	const value = Math.round(edge * 100) / 100;
	let dec = Math.max(value < 10 ? 1 : 0, stepDecimals(bucketSize));
	if (Math.floor(value) === value) {
		dec = 0;
	}

	return `${getTimeString(value, dec)}`;
}

/** Linear-interpolated quantile of an ascending list. */
function quantile(sorted: number[], q: number): number {
	const pos = (sorted.length - 1) * q;
	const base = Math.floor(pos);
	const next = sorted[base + 1];
	return next === undefined ? sorted[base] : sorted[base] + (pos - base) * (next - sorted[base]);
}

/**
 * The span the buckets cover: the box plot's whiskers (1.5 IQR past the quartiles), never
 * wider than the solves themselves. The span used to run from the fastest solve to the
 * slowest, so one 1:31 among 12,800 solves around 12 s stretched the buckets to ten
 * seconds each and put nearly every solve in the first bar. Solves outside the span still
 * count, in the first or the last bucket.
 */
export function distroSpan(sorted: number[]): [number, number] {
	const q1 = quantile(sorted, 0.25);
	const q3 = quantile(sorted, 0.75);
	const fence = 1.5 * (q3 - q1);
	return [Math.max(sorted[0], q1 - fence), Math.min(sorted[sorted.length - 1], q3 + fence)];
}

// Bucket widths in seconds. Edges are multiples of the width, so each one prints exactly;
// (max - min) / buckets gave widths like 1.5 s that whole-second labels turned into
// "11-12", "12-14".
const BUCKET_STEPS = [
	0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.8, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12, 15, 20, 30, 45, 60, 90, 120, 180, 300,
	600, 900, 1800, 3600,
];

/** The narrowest listed width whose `buckets` buckets, starting on a multiple of it, reach from `lo` to `hi`. */
export function bucketLayout(lo: number, hi: number, buckets: number): {start: number; step: number} {
	for (const step of BUCKET_STEPS) {
		const start = Math.floor(lo / step + 1e-9) * step;
		if (start + step * buckets >= hi - 1e-9) return {start, step};
	}

	const step = Math.ceil((hi - lo) / buckets / 3600) * 3600;
	return {start: Math.floor(lo / step) * step, step};
}

/**
 * Counts `sorted` (ascending, in seconds) into `buckets` bars. A first bucket that also
 * holds solves below its range reads "<9", a last one that holds solves above it "17+".
 */
export function bucketTimes(sorted: number[], buckets: number): TimeDistroBucket[] {
	if (!sorted.length || buckets < 1) {
		return [];
	}

	const [lo, hi] = distroSpan(sorted);
	const {start, step} = bucketLayout(lo, hi, buckets);
	const end = start + step * buckets;

	const counts: number[] = new Array(buckets).fill(0);
	for (const time of sorted) {
		const index = Math.floor((time - start) / step + 1e-9);
		counts[Math.min(buckets - 1, Math.max(0, index))] += 1;
	}

	const edge = (i: number) => bucketEdgeLabel(start + i * step, step);
	const openLow = sorted[0] < start - 1e-9;
	const openHigh = sorted[sorted.length - 1] > end + 1e-9;

	return counts.map((y, i) => {
		let x = `${edge(i)}-${edge(i + 1)}`;
		if (i === buckets - 1 && openHigh) {
			x = `${edge(i)}+`;
		} else if (i === 0 && openLow) {
			x = `<${edge(1)}`;
		}
		return {x, y};
	});
}

export function getTimeDistro(filter: FilterSolvesOptions, buckets: number): TimeDistroBucket[] {
	const solves = fetchSolves(
		{
			...filter,
			dnf: false,
			time: {
				$gt: 0,
			},
		},
		{
			sortBy: 'time',
		}
	);

	if (!solves || !solves.length) {
		return [];
	}

	return bucketTimes(
		solves.map((solve) => solve.time),
		buckets
	);
}
