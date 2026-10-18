import {
	averageTrimCount,
	bestAverageIndex,
	computeRollingAverages,
	DNF_AVERAGE,
	RollingAverageColumn,
	toWindowTime,
} from '../rolling_average';

// Straightforward reference: sort each window and trim, the way cstimer's runAvgMean and
// the app's getAverage do it. The sliding implementation must agree with it everywhere.
function bruteForce(seconds: number[], n: number): number[] {
	const out: number[] = [];
	const trim = averageTrimCount(n);
	for (let i = 0; i < seconds.length; i++) {
		if (i < n - 1) {
			out.push(Number.NaN);
			continue;
		}
		const window = seconds.slice(i - n + 1, i + 1).map(toWindowTime).sort((a, b) => a - b);
		const dnf = window.filter((t) => t === Infinity).length;
		if (dnf > trim) {
			out.push(DNF_AVERAGE);
			continue;
		}
		const kept = window.slice(trim, n - trim);
		out.push(kept.reduce((s, t) => s + t, 0) / kept.length / 1000);
	}
	return out;
}

function expectSame(actual: number[], expected: number[]) {
	expect(actual.length).toBe(expected.length);
	for (let i = 0; i < expected.length; i++) {
		if (Number.isNaN(expected[i])) expect(actual[i]).toBeNaN();
		else expect(actual[i]).toBeCloseTo(expected[i], 9);
	}
}

// Deterministic pseudo random so a failure is reproducible.
function makeTimes(count: number, dnfRate: number, seed = 7): number[] {
	let s = seed;
	const rand = () => {
		s = (s * 1103515245 + 12345) % 2147483648;
		return s / 2147483648;
	};
	return Array.from({ length: count }, () => (rand() < dnfRate ? -1 : Math.round((8 + rand() * 10) * 1000) / 1000));
}

describe('averageTrimCount', () => {
	it('follows the WCA and cstimer 5% rule', () => {
		expect(averageTrimCount(3)).toBe(0);
		expect(averageTrimCount(4)).toBe(0);
		expect(averageTrimCount(5)).toBe(1);
		expect(averageTrimCount(12)).toBe(1);
		expect(averageTrimCount(20)).toBe(1);
		expect(averageTrimCount(25)).toBe(2);
		expect(averageTrimCount(50)).toBe(3);
		expect(averageTrimCount(100)).toBe(5);
		expect(averageTrimCount(1000)).toBe(50);
	});
});

describe('computeRollingAverages', () => {
	it('computes a WCA ao5 per row', () => {
		const result = computeRollingAverages([10, 12, 11, 9, 13, 8].map(toWindowTime), 5);
		expect(result[3]).toBeNaN();
		// 10 12 11 9 13 -> drop 9 and 13 -> (10+12+11)/3
		expect(result[4]).toBeCloseTo(11, 9);
		// 12 11 9 13 8 -> drop 8 and 13 -> (12+11+9)/3
		expect(result[5]).toBeCloseTo(32 / 3, 9);
	});

	it('counts one DNF as the trimmed worst and two as a DNF average', () => {
		const one = computeRollingAverages([10, -1, 11, 9, 12].map(toWindowTime), 5);
		expect(one[4]).toBeCloseTo(11, 9);
		const two = computeRollingAverages([10, -1, 11, -1, 12].map(toWindowTime), 5);
		expect(two[4]).toBe(DNF_AVERAGE);
	});

	it('keeps mo3 a plain mean where any DNF is a DNF', () => {
		expect(computeRollingAverages([10, 11, 12].map(toWindowTime), 3)[2]).toBeCloseTo(11, 9);
		expect(computeRollingAverages([10, -1, 12].map(toWindowTime), 3)[2]).toBe(DNF_AVERAGE);
	});

	it('does not drift on decimals', () => {
		const result = computeRollingAverages([12.88, 13.6, 13.48, 12.51, 13.18].map(toWindowTime), 5);
		expect(result[4]).toBeCloseTo((12.88 + 13.48 + 13.18) / 3, 9);
	});

	it.each([5, 12, 25, 50, 100, 3])('matches a sort-every-window reference for ao%i', (n) => {
		const seconds = makeTimes(600, 0.04, n);
		expectSame(computeRollingAverages(seconds.map(toWindowTime), n), bruteForce(seconds, n));
	});

	it('handles windows full of DNFs', () => {
		const seconds = makeTimes(300, 0.5, 3);
		expectSame(computeRollingAverages(seconds.map(toWindowTime), 12), bruteForce(seconds, 12));
	});
});

describe('RollingAverageColumn', () => {
	it('only slides forward when solves are appended', () => {
		const seconds = makeTimes(200, 0.05);
		const column = new RollingAverageColumn(12);
		column.update(seconds.slice(0, 150).map(toWindowTime));
		const after = column.update(seconds.map(toWindowTime));
		expectSame(after, bruteForce(seconds, 12));
	});

	it('recomputes when an older solve changes', () => {
		const seconds = makeTimes(100, 0);
		const column = new RollingAverageColumn(5);
		const before = column.update(seconds.map(toWindowTime));
		const changed = seconds.slice();
		changed[40] = -1;
		const after = column.update(changed.map(toWindowTime));
		expectSame(after, bruteForce(changed, 5));
		// The array handed out earlier is left as it was.
		expectSame(before, bruteForce(seconds, 5));
	});

	it('recomputes when solves are removed', () => {
		const seconds = makeTimes(80, 0.05);
		const column = new RollingAverageColumn(5);
		column.update(seconds.map(toWindowTime));
		const fewer = seconds.slice(0, 60);
		expectSame(column.update(fewer.map(toWindowTime)), bruteForce(fewer, 5));
	});

	it('returns the same array when nothing changed', () => {
		const times = makeTimes(50, 0).map(toWindowTime);
		const column = new RollingAverageColumn(5);
		const first = column.update(times);
		expect(column.update(times.slice())).toBe(first);
	});

	it('stays fast on a 12k list with large windows', () => {
		const times = makeTimes(12000, 0.02).map(toWindowTime);
		const started = Date.now();
		for (const n of [5, 12, 100, 1000, 5000]) new RollingAverageColumn(n).update(times);
		expect(Date.now() - started).toBeLessThan(3000);
	});
});

describe('bestAverageIndex', () => {
	it('ignores missing and DNF averages', () => {
		expect(bestAverageIndex([Number.NaN, DNF_AVERAGE, 12, 11.5, 13])).toBe(3);
		expect(bestAverageIndex([Number.NaN, DNF_AVERAGE])).toBe(-1);
	});
});
