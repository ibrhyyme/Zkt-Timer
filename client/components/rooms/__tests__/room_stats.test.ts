import {computeRoomStats} from '../room_stats';
import type {FriendlyRoomSolveData} from '../../../../shared/friendly_room/types';

function solves(times: Array<number | 'DNF' | [number, '+2']>): FriendlyRoomSolveData[] {
	return times.map((t, i) => {
		if (t === 'DNF') return {time: 10, dnf: true, plus_two: false, scramble_index: i + 1};
		if (Array.isArray(t)) return {time: t[0], dnf: false, plus_two: true, scramble_index: i + 1};
		return {time: t, dnf: false, plus_two: false, scramble_index: i + 1};
	});
}

/** 1, 2, ..., n */
function range(n: number): number[] {
	return Array.from({length: n}, (_, i) => i + 1);
}

const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

describe('computeRoomStats', () => {
	it('returns null averages until there are enough solves', () => {
		const stats = computeRoomStats(solves([10, 11, 12, 13]));
		expect(stats.averages[5]).toEqual({current: null, best: null});
		expect(stats.bestSingle).toBe(10);
		expect(stats.lastSingle).toBe(13);
	});

	it('trims one from each end for ao5 and ao12', () => {
		const stats = computeRoomStats(solves([10, 20, 30, 40, 50]));
		expect(stats.averages[5].current).toBeCloseTo(30);
	});

	it('trims 5% from each end for the long averages, not one', () => {
		// ao25 drops 2 per side, ao50 3, ao100 5. The old room code dropped 1 at every length.
		expect(computeRoomStats(solves(range(25))).averages[25].current).toBeCloseTo(mean(range(25).slice(2, -2)));
		expect(computeRoomStats(solves(range(50))).averages[50].current).toBeCloseTo(mean(range(50).slice(3, -3)));
		expect(computeRoomStats(solves(range(100))).averages[100].current).toBeCloseTo(mean(range(100).slice(5, -5)));
	});

	it('counts one DNF as the worst solve instead of skipping it', () => {
		// Old behaviour ignored the DNF and averaged the last five successes (10, 11, 12, 13, 14).
		const stats = computeRoomStats(solves([10, 11, 12, 13, 'DNF']));
		expect(stats.averages[5].current).toBeCloseTo(mean([11, 12, 13]));
	});

	it('is a DNF average once DNFs outnumber what the trim can drop', () => {
		const stats = computeRoomStats(solves([10, 11, 12, 'DNF', 'DNF']));
		expect(stats.averages[5].current).toBe(-1);
		expect(stats.averages[5].best).toBe(-1);
	});

	it('applies +2 before averaging', () => {
		const stats = computeRoomStats(solves([10, 10, [10, '+2'], 10, 10]));
		// Sorted: 10 10 10 10 12, trimmed to 10 10 10.
		expect(stats.averages[5].current).toBeCloseTo(10);
		const plusTwoInMiddle = computeRoomStats(solves([9, [10, '+2'], 11, 13, 20]));
		expect(plusTwoInMiddle.averages[5].current).toBeCloseTo(mean([11, 12, 13]));
	});

	it('finds the best window, not just the latest one', () => {
		const stats = computeRoomStats(solves([10, 10, 10, 10, 10, 30, 30, 30, 30, 30]));
		expect(stats.averages[5].best).toBeCloseTo(10);
		expect(stats.averages[5].current).toBeCloseTo(30);
	});

	it('shows a DNF as the last single rather than the solve before it', () => {
		const stats = computeRoomStats(solves([10, 11, 'DNF']));
		expect(stats.lastSingle).toBe(-1);
		expect(stats.bestSingle).toBe(10);
	});

	it('orders by round even if the list arrives out of order', () => {
		const list = solves([10, 20, 30, 40, 50, 60]).reverse();
		// Latest five by round are 20..60, not the first five of the reversed array.
		expect(computeRoomStats(list).averages[5].current).toBeCloseTo(40);
	});

	it('treats a session of only DNFs as a DNF best single', () => {
		expect(computeRoomStats(solves(['DNF'])).bestSingle).toBe(-1);
		expect(computeRoomStats([]).bestSingle).toBeNull();
	});
});
