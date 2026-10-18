// Session row summary (K-13): best and mean come from the most solved bucket only, so a 3x3
// session with a few PLL drills no longer shows a 1.16 PLL as its best.

jest.mock('../init', () => ({getSolveDb: () => null}));
jest.mock('../../../util/cubes/util', () => ({getCubeTypeInfoById: () => null}));

import {summarizeSessionSolves} from '../query';

const solve = (cube_type: string, scramble_subset: string | null, time: number, ended_at: number, dnf = false) => ({
	cube_type,
	scramble_subset,
	time,
	ended_at,
	dnf,
});

describe('summarizeSessionSolves', () => {
	it('is empty for an empty session', () => {
		expect(summarizeSessionSolves([])).toEqual({count: 0, best: null, average: null, bucketCount: 0, topBucket: null});
	});

	it('takes best and mean from the most solved bucket, counts every solve', () => {
		const summary = summarizeSessionSolves([
			solve('wca', '333', 10, 1),
			solve('wca', '333', 12, 2),
			solve('wca', '333', 0, 3, true),
			solve('333cfop', 'pll', 1.16, 4),
			solve('333cfop', 'pll', 1.4, 5),
		]);
		expect(summary.count).toBe(5);
		expect(summary.bucketCount).toBe(2);
		expect(summary.topBucket).toEqual({cube_type: 'wca', scramble_subset: '333'});
		expect(summary.best).toBe(10);
		expect(summary.average).toBe(11);
	});

	it('breaks a tie with the bucket solved most recently', () => {
		const summary = summarizeSessionSolves([
			solve('wca', '333', 10, 1),
			solve('333cfop', 'pll', 1.5, 9),
		]);
		expect(summary.topBucket).toEqual({cube_type: '333cfop', scramble_subset: 'pll'});
		expect(summary.best).toBe(1.5);
	});

	it('treats an empty subset and null as one bucket', () => {
		const summary = summarizeSessionSolves([solve('222', '', 3, 1), solve('222', null, 5, 2)]);
		expect(summary.bucketCount).toBe(1);
		expect(summary.topBucket).toEqual({cube_type: '222', scramble_subset: null});
		expect(summary.average).toBe(4);
	});

	it('has no best or mean when the top bucket holds only DNFs', () => {
		const summary = summarizeSessionSolves([solve('wca', '333', 0, 1, true), solve('wca', '333', 0, 2, true)]);
		expect(summary.best).toBeNull();
		expect(summary.average).toBeNull();
	});
});
