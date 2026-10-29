/**
 * Time distribution labels double as the chart's band keys: two buckets with the same
 * label are drawn on the same spot. Buckets narrower than a second above 10 s all printed
 * whole seconds ("15-15" twice).
 */
jest.mock('../../../settings/query', () => ({getSetting: () => 2}));
jest.mock('../../query', () => ({fetchSolves: () => []}));

import {bucketEdgeLabel, bucketLayout, bucketTimes, distroSpan} from '../time_distro';

function labels(min: number, bucketSize: number, buckets: number): string[] {
	const out: string[] = [];
	for (let i = 0; i < buckets; i++) {
		const low = min + i * bucketSize;
		out.push(`${bucketEdgeLabel(low, bucketSize)}-${bucketEdgeLabel(low + bucketSize, bucketSize)}`);
	}
	return out;
}

describe('bucketEdgeLabel', () => {
	it('keeps whole seconds for buckets a second or wider', () => {
		expect(labels(12, 2, 4)).toEqual(['12-14', '14-16', '16-18', '18-20']);
	});

	it('gives every narrow bucket above 10 s its own label', () => {
		// 15 to 16 s in 7 buckets: 0.14 s each.
		const narrow = labels(15, 0.14, 7);
		expect(new Set(narrow).size).toBe(narrow.length);
	});

	it('gives every bucket its own label at the narrowest width the bucketing produces', () => {
		const narrowest = labels(15, 0.1, 10);
		expect(new Set(narrowest).size).toBe(narrowest.length);
	});

	it('keeps one decimal under 10 s, as before', () => {
		expect(bucketEdgeLabel(8.6, 1)).toBe('8.6');
		expect(bucketEdgeLabel(8, 1)).toBe('8');
	});

	it('keeps the half second of a 1.5 s bucket above 10 s', () => {
		// Whole seconds turned 11-12.5-14 into "11-12", "12-14".
		expect(labels(11, 1.5, 2)).toEqual(['11-12.5', '12.5-14']);
	});
});

// 12,800 solves around 12 s and one 1:31, the owner's 3x3 history in miniature.
function skewedTimes(): number[] {
	const times: number[] = [];
	for (let i = 0; i < 400; i++) {
		// 8 .. 16 s
		times.push(12 + 4 * Math.sin((i / 400) * Math.PI - Math.PI / 2) * (i % 2 ? 1 : 0.5));
	}
	times.push(91.4);
	return times.sort((a, b) => a - b);
}

describe('distroSpan', () => {
	it('leaves a lone slow outlier out of the span', () => {
		const [lo, hi] = distroSpan(skewedTimes());
		expect(lo).toBeGreaterThanOrEqual(8);
		expect(hi).toBeLessThan(20);
	});

	it('never reaches past the solves themselves', () => {
		expect(distroSpan([10, 11, 12])).toEqual([10, 12]);
		expect(distroSpan([12.3])).toEqual([12.3, 12.3]);
	});
});

describe('bucketLayout', () => {
	it('picks a round width that reaches the end of the span', () => {
		expect(bucketLayout(8.2, 16.2, 10)).toEqual({start: 8, step: 1});
		const {start, step} = bucketLayout(8.2, 16.2, 6);
		expect(step).toBe(1.5);
		expect(start + step * 6).toBeGreaterThanOrEqual(16.2);
	});

	it('handles solves that all took the same time', () => {
		const {start, step} = bucketLayout(12.3, 12.3, 4);
		expect(step).toBe(0.1);
		expect(start).toBeLessThanOrEqual(12.3);
		expect(start + step * 4).toBeGreaterThanOrEqual(12.3);
	});
});

describe('bucketTimes', () => {
	it('spreads a skewed history over its buckets instead of one bar', () => {
		const times = skewedTimes();
		const data = bucketTimes(times, 6);
		expect(data).toHaveLength(6);
		expect(data.reduce((sum, d) => sum + d.y, 0)).toBe(times.length);
		// No bar holds (almost) everything, as the first one did with min-max buckets.
		expect(Math.max(...data.map((d) => d.y))).toBeLessThan(times.length * 0.5);
		expect(data[data.length - 1].x).toMatch(/\+$/);
	});

	it('marks the first bucket open when it holds solves below its range', () => {
		const times = [2.1, ...Array.from({length: 40}, (_, i) => 12 + (i % 10) * 0.2)].sort((a, b) => a - b);
		const data = bucketTimes(times, 5);
		expect(data[0].x.startsWith('<')).toBe(true);
		expect(data.reduce((sum, d) => sum + d.y, 0)).toBe(times.length);
	});

	it('keeps closed ranges when nothing falls outside them', () => {
		expect(bucketTimes([10, 11, 12, 13, 14], 4)).toEqual([
			{x: '10-11', y: 1},
			{x: '11-12', y: 1},
			{x: '12-13', y: 1},
			{x: '13-14', y: 2},
		]);
	});

	it('gives every bucket its own label', () => {
		for (const buckets of [4, 5, 6, 7, 8, 9, 10]) {
			const data = bucketTimes(skewedTimes(), buckets);
			expect(new Set(data.map((d) => d.x)).size).toBe(buckets);
		}
	});

	it('returns nothing for no solves', () => {
		expect(bucketTimes([], 6)).toEqual([]);
	});
});
