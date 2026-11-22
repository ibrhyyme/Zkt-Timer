import { AverageSeries, rankTimes, tableTrimCount } from '../table_engine';
import { computeRollingAverages } from '../../history/rolling_average';

// Seeded so a failure can be replayed.
function rng(seed: number) {
	let s = seed >>> 0;
	return () => {
		s = (s * 1664525 + 1013904223) >>> 0;
		return s / 2 ** 32;
	};
}

// Few distinct values, so equal averages (ties) happen often.
function randomTime(rand: () => number, dnfShare: number): number {
	if (rand() < dnfShare) return Infinity;
	return 8000 + Math.floor(rand() * 6) * 500;
}

interface Expected {
	current: number | null;
	best: { value: number; start: number } | null;
	worst: { value: number; start: number } | null;
}

// The solves grid's column (rolling_average.ts, tested on its own) read the slow way:
// every window, the first strictly better one wins, so the oldest window wins a tie.
function expected(times: number[], n: number, mean = false): Expected {
	const values = mean ? meanWindows(times, n) : computeRollingAverages(times, n);
	let best: Expected['best'] = null;
	let worst: Expected['worst'] = null;
	for (let end = n - 1; end < values.length; end++) {
		const value = values[end];
		if (!(value > 0)) continue;
		if (!best || value < best.value) best = { value, start: end - n + 1 };
		if (!worst || value > worst.value) worst = { value, start: end - n + 1 };
	}
	const last = values[values.length - 1];
	return { current: times.length >= n ? last : null, best, worst };
}

function meanWindows(times: number[], n: number): number[] {
	return times.map((_, end) => {
		if (end < n - 1) return Number.NaN;
		const window = times.slice(end - n + 1, end + 1);
		return window.includes(Infinity) ? -1 : window.reduce((a, b) => a + b, 0) / n / 1000;
	});
}

function check(series: AverageSeries, times: number[], mean = false) {
	const want = expected(times, series.n, mean);
	const close = (a: number | null | undefined, b: number | null | undefined) => {
		if (a === null || a === undefined || b === null || b === undefined) return expect(a ?? null).toBe(b ?? null);
		expect(a).toBeCloseTo(b, 9);
	};
	close(series.current, want.current);
	close(series.best?.value, want.best?.value);
	expect(series.best?.start ?? null).toBe(want.best?.start ?? null);
	close(series.worst?.value, want.worst?.value);
	expect(series.worst?.start ?? null).toBe(want.worst?.start ?? null);
	expect(series.hasWindow).toBe(times.length >= series.n);
}

function update(series: AverageSeries, times: number[]) {
	let ranks: Int32Array | null = null;
	series.update(times, () => (ranks = ranks || rankTimes(times)));
}

describe('tableTrimCount', () => {
	it('trims 5% rounded up from 5 solves on, nothing for a mean', () => {
		expect(tableTrimCount(1)).toBe(0);
		expect(tableTrimCount(3)).toBe(0);
		expect(tableTrimCount(5)).toBe(1);
		expect(tableTrimCount(12)).toBe(1);
		expect(tableTrimCount(25)).toBe(2);
		expect(tableTrimCount(100)).toBe(5);
		expect(tableTrimCount(1000)).toBe(50);
		expect(tableTrimCount(12, true)).toBe(0);
	});
});

describe('rankTimes', () => {
	it('ranks by time, ties and DNFs by position', () => {
		expect(Array.from(rankTimes([9000, Infinity, 8000, 9000, Infinity]))).toEqual([2, 4, 1, 3, 5]);
		expect(Array.from(rankTimes([]))).toEqual([]);
	});
});

describe('AverageSeries', () => {
	it('matches the slow reading after a full pass, for every size the table offers', () => {
		const rand = rng(7);
		const times = Array.from({ length: 1200 }, () => randomTime(rand, 0.03));
		for (const n of [1, 3, 5, 12, 25, 50, 100, 200, 500, 1000]) {
			const series = new AverageSeries(n);
			update(series, times);
			check(series, times);
		}
	});

	it('stays exact through appends, edits and deletions at the end and in the middle', () => {
		const rand = rng(42);
		for (const n of [1, 3, 5, 12, 25]) {
			for (const mean of n >= 5 ? [false, true] : [false]) {
				const series = new AverageSeries(n, mean);
				let times: number[] = [];
				for (let step = 0; step < 400; step++) {
					const roll = rand();
					times = times.slice();
					if (roll < 0.55 || times.length < 3) {
						times.push(randomTime(rand, 0.08));
					} else if (roll < 0.7) {
						times[times.length - 1] = randomTime(rand, 0.3); // a +2 or DNF on the last solve
					} else if (roll < 0.8) {
						times.pop();
					} else if (roll < 0.9) {
						times[Math.floor(rand() * times.length)] = randomTime(rand, 0.1);
					} else if (roll < 0.95) {
						times.splice(Math.floor(rand() * times.length), 1);
					} else {
						times.splice(Math.floor(rand() * times.length), 0, randomTime(rand, 0.1));
					}
					update(series, times);
					check(series, times, mean);
				}
			}
		}
	});

	it('takes a long changed tail through the full pass and stays exact', () => {
		const rand = rng(3);
		const series = new AverageSeries(50);
		const first = Array.from({ length: 300 }, () => randomTime(rand, 0.02));
		update(series, first);
		const imported = first.concat(Array.from({ length: 900 }, () => randomTime(rand, 0.02)));
		update(series, imported);
		check(series, imported);
	});

	it('has no best when every window is a DNF, and no current before a full window', () => {
		const series = new AverageSeries(5);
		update(series, [8000, 9000, 10000]);
		expect(series.current).toBeNull();
		expect(series.hasWindow).toBe(false);

		update(series, [8000, Infinity, Infinity, 9000, 10000]);
		expect(series.current).toBe(-1);
		expect(series.best).toBeNull();
		expect(series.hasWindow).toBe(true);
	});

	it('reads a single: the last solve, the fastest and the slowest timed one', () => {
		const series = new AverageSeries(1);
		update(series, [9000, 8000, Infinity, 8000, 12000, Infinity]);
		expect(series.current).toBe(-1);
		expect(series.best).toEqual({ value: 8, start: 1 });
		expect(series.worst).toEqual({ value: 12, start: 4 });
	});
});
