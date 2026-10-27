/**
 * Stored breakdowns for solves whose move list is incomplete.
 *
 * A BLE packet lost during a smart cube solve left the stored steps without their last
 * phases: the server replayed the moves from the scramble state and never reached the
 * solved cube. A completed solve now falls back to the start derived from its moves
 * (cstimer's calcRecons), a DNF never does, and a failing engine no longer returns an
 * empty breakdown that callers would write over the existing one.
 */

import * as phaseEngine from '../../../../shared/util/solve/phase_engine';
import { getSolveSteps } from '../solve_method';

const mv = (a: string) => a.trim().split(/\s+/).filter(Boolean);
const inv = (a: string) =>
	mv(a).reverse().map((m) => (m.endsWith("'") ? m.slice(0, -1) : m.endsWith('2') ? m : m + "'")).join(' ');

const CFOP_SOLVE = [
	"F R U' D2 L", "R U R'", "L' U' L", "R' U' R", "L U L'",
	"R U R' U R U2 R'", "R U R' U' R' F R2 U' R' U' R U R' F'",
];

function build(phases: string[]) {
	const scramble = inv(phases.join(' '));
	const turns: any[] = [];
	let t = 1000;
	for (const phase of phases) {
		t += 900;
		for (const m of mv(phase)) {
			turns.push({ turn: m, completedAt: t });
			t += 220;
		}
	}
	return { scramble, turns };
}

const LAST_LAYER = ['oll', 'pll'];

describe('getSolveSteps start state', () => {
	const { scramble, turns } = build(CFOP_SOLVE);

	it('stores the same breakdown for a complete solve whether or not it may derive', () => {
		const withFallback = getSolveSteps(turns, scramble, 'cfop', undefined, { endedSolved: true });
		const without = getSolveSteps(turns, scramble, 'cfop', undefined, { endedSolved: false });
		expect(withFallback).toEqual(without);
		for (const step of LAST_LAYER) expect(withFallback![step]).toBeTruthy();
	});

	it('keeps OLL and PLL when the final move packet was lost', () => {
		const lossy = turns.slice(0, -1);
		const steps = getSolveSteps(lossy, scramble, 'cfop', undefined, { endedSolved: true });
		for (const step of LAST_LAYER) expect(steps![step]).toBeTruthy();
		expect(steps!.cross).toBeTruthy();
	});

	it('keeps OLL and PLL when a packet was lost mid-solve', () => {
		const lossy = turns.filter((_, i) => i !== 12);
		const steps = getSolveSteps(lossy, scramble, 'cfop', undefined, { endedSolved: true });
		for (const step of LAST_LAYER) expect(steps![step]).toBeTruthy();
	});

	it('does not invent the missing phases for a DNF', () => {
		const lossy = turns.slice(0, -1);
		const steps = getSolveSteps(lossy, scramble, 'cfop', undefined, { endedSolved: false });
		expect(steps!.pll).toBeNull();
	});

	it('defaults to not deriving, so a caller that forgets cannot invent a DNF breakdown', () => {
		const lossy = turns.slice(0, -1);
		expect(getSolveSteps(lossy, scramble, 'cfop')!.pll).toBeNull();
	});

	it('returns null when the engine fails instead of an empty breakdown', () => {
		const spy = jest.spyOn(phaseEngine, 'analyzePhases').mockImplementation(() => {
			throw new Error('boom');
		});
		try {
			expect(getSolveSteps(turns, scramble, 'cfop', undefined, { endedSolved: true })).toBeNull();
		} finally {
			spy.mockRestore();
		}
	});

	it('treats a negative offset as the start of the solve', () => {
		// Virtual cube inspection rotations used to be stored at absolute 0, i.e. about
		// -1.7e12 ms relative to the start, which made the first step 1.7 billion seconds.
		const rotated = [{ turn: 'y', completedAt: -1_700_000_000_000 }, ...turns];
		const steps = getSolveSteps(rotated, 'y ' + scramble, 'cfop', undefined, { endedSolved: true });
		expect(steps!.cross.time).toBeLessThan(60);
		expect(steps!.cross.time).toBeGreaterThan(0);
	});
});
