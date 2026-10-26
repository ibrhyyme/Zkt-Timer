import {
	getCountingTimes,
	getNextSolveOutlook,
	getSampleStdDev,
	getTrimCount,
} from '../average/window_math';

const DNF = -1;

/** An average written out the slow way: sort, drop the ends, any DNF left is a DNF. */
function averageOf(times: number[], mean: boolean): number {
	const counted = getCountingTimes(times, mean);
	if (counted.some((t) => !isFinite(t))) return -1;
	return counted.reduce((a, b) => a + b, 0) / counted.length;
}

let seed = 7;
const rnd = () => {
	seed = (seed * 16807) % 2147483647;
	return seed / 2147483647;
};
const randomTime = () => (rnd() < 0.08 ? DNF : Math.round((8 + rnd() * 6) * 100) / 100);

describe('getTrimCount', () => {
	it('drops 5% rounded up from each end, nothing below five or for a mean', () => {
		expect(getTrimCount(3)).toBe(0);
		expect(getTrimCount(4)).toBe(0);
		expect(getTrimCount(5)).toBe(1);
		expect(getTrimCount(12)).toBe(1);
		expect(getTrimCount(25)).toBe(2);
		expect(getTrimCount(100)).toBe(5);
		expect(getTrimCount(1000)).toBe(50);
		expect(getTrimCount(12, true)).toBe(0);
	});
});

describe('getSampleStdDev', () => {
	it('is the n - 1 standard deviation csTimer shows', () => {
		expect(getSampleStdDev([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.138, 3);
		expect(getSampleStdDev([10, 10, 10])).toBe(0);
	});

	it('has no value for one time or with a DNF', () => {
		expect(getSampleStdDev([10])).toBeNull();
		expect(getSampleStdDev([10, Infinity, 11])).toBeNull();
	});

	it('of an ao5 counts the middle three', () => {
		expect(getSampleStdDev(getCountingTimes([9, 10, 11, 12, DNF]))).toBeCloseTo(1, 6);
	});
});

describe('getNextSolveOutlook', () => {
	it('gives csTimer\'s BPA and WPA for an ao5', () => {
		// Last four: 10, 11, 12, 13. A perfect fifth is trimmed: (10+11+12)/3. A DNF fifth is
		// trimmed instead: (11+12+13)/3.
		const outlook = getNextSolveOutlook([12, 10, 13, 11], 5, false, null);
		expect(outlook.best).toBeCloseTo(11, 6);
		expect(outlook.worst).toBeCloseTo(12, 6);
		expect(outlook.target).toBeNull();
	});

	it('makes a mo3\'s worst a DNF and its best the mean with a zero', () => {
		const outlook = getNextSolveOutlook([10, 11], 3, true, null);
		expect(outlook.best).toBeCloseTo(7, 6);
		expect(outlook.worst).toBe(-1);
	});

	it('names the time to beat for a new best ao5', () => {
		// Best ao5 11.5; last four 10, 11, 12, 13 -> next counts 11, 12 and x: x < 11.5*3 - 23
		const outlook = getNextSolveOutlook([10, 11, 12, 13], 5, false, 11.5);
		expect(outlook.target).toBeCloseTo(11.5, 6);
	});

	it('says never when even a perfect solve cannot beat the best, always when a DNF still does', () => {
		expect(getNextSolveOutlook([10, 11, 12, 13], 5, false, 10.5).target).toBe('never');
		expect(getNextSolveOutlook([10, 11, 12, 13], 5, false, 12.5).target).toBe('always');
		// Two DNFs among the four: every next ao5 is a DNF
		expect(getNextSolveOutlook([10, DNF, 12, DNF], 5, false, 11).target).toBe('never');
		// No valid best yet (every window a DNF): any next average that is not a DNF beats it
		expect(getNextSolveOutlook([10, 11, 12, DNF], 5, false, -1).target).toBe('always');
	});

	it('matches a brute force over random sessions', () => {
		for (const [count, mean] of [[5, false], [12, false], [25, false], [3, true], [5, true], [12, true]] as const) {
			for (let run = 0; run < 200; run++) {
				const previous = Array.from({length: count - 1}, randomTime);
				const best = 9 + rnd() * 4;
				const outlook = getNextSolveOutlook(previous, count, mean, best);

				const bpa = averageOf([...previous, 0.0000001], mean);
				if (bpa < 0) expect(outlook.best).toBe(-1);
				else expect(outlook.best).toBeCloseTo(bpa, 4);

				const wpa = averageOf([...previous, DNF], mean);
				if (wpa < 0) expect(outlook.worst).toBe(-1);
				else expect(outlook.worst).toBeCloseTo(wpa, 6);

				const beats = (x: number) => {
					const avg = averageOf([...previous, x], mean);
					return avg >= 0 && avg < best;
				};
				if (outlook.target === 'never') {
					for (let x = 0.01; x < 20; x += 0.37) expect(beats(x)).toBe(false);
				} else if (outlook.target === 'always') {
					expect(beats(30)).toBe(true);
					expect(beats(DNF)).toBe(true);
				} else {
					const target = outlook.target as number;
					expect(beats(target - 0.001)).toBe(true);
					expect(beats(target + 0.001)).toBe(false);
				}
			}
		}
	});
});
