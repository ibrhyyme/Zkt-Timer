// DNF and +2 share on the Stats page: one decimal, rounded. Flooring above 1% showed 243 +2s
// out of 12 452 solves (1.95%) as "1%".

jest.mock('../init', () => ({getSolveDb: () => null}));

import {solveSharePercent} from '../stats/sub_stats';

describe('solveSharePercent', () => {
	it('rounds instead of flooring above 1%', () => {
		expect(solveSharePercent(243, 12452)).toBe(2);
		expect(solveSharePercent(240, 12002)).toBe(2);
		expect(solveSharePercent(1234, 10000)).toBe(12.3);
	});

	it('keeps one decimal below 1%', () => {
		expect(solveSharePercent(22, 13000)).toBe(0.2);
		expect(solveSharePercent(110, 12452)).toBe(0.9);
	});

	it('is 0 for no solves or none counted', () => {
		expect(solveSharePercent(0, 500)).toBe(0);
		expect(solveSharePercent(0, 0)).toBe(0);
	});

	it('is 100 when every solve counts', () => {
		expect(solveSharePercent(7, 7)).toBe(100);
	});
});
