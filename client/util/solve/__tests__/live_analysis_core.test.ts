/**
 * The finished ladder drawn from a solve's stored rows has to be the ladder the live
 * analysis draws from the same moves: the overlay switched from its own post-solve
 * analysis to the stored breakdown, which is what the solve card and the phase analysis
 * module read.
 */

import Cube from 'cubejs';
import { serializeSmartTurnsCompact } from '../../../../shared/smart_cube/parse_turns';
import { stepRowsForStoredSolve } from '../../../../shared/util/solve/solve_steps';
import { startStateFromScramble } from '../../../../shared/util/solve/start_state';
import { analyzeCurrentState, liveResultFromStepRows } from '../live_analysis_core';

const mv = (a: string) => a.trim().split(/\s+/).filter(Boolean);
const inv = (a: string) =>
	mv(a).reverse().map((m) => (m.endsWith("'") ? m.slice(0, -1) : m.endsWith('2') ? m : m + "'")).join(' ');

const CFOP_SOLVE = [
	"F R U' D2 L", "R U R'", "L' U' L", "R' U' R", "L U L'",
	"R U R' U R U2 R'", "R U R' U' R' F R2 U' R' U' R U R' F'",
];

function storedSolve(phases: string[]) {
	const scramble = inv(phases.join(' '));
	const cube = new Cube();
	for (const m of mv(scramble)) cube.move(m);

	const turns: { turn: string; completedAt: number; time: number }[] = [];
	let t = 0;
	for (const phase of phases) {
		t += 900;
		for (const m of mv(phase)) {
			cube.move(m);
			turns.push({ turn: m, completedAt: t, time: t });
			t += 220;
		}
	}
	expect(cube.isSolved()).toBe(true);

	return {
		solve: {
			id: 'solve-1',
			scramble,
			dnf: false,
			is_smart_cube: true,
			is_virtual_cube: false,
			smart_turns: serializeSmartTurnsCompact(turns, 0),
		},
		turns,
	};
}

const close = (a: number | undefined, b: number | undefined) => {
	expect(a).not.toBeUndefined();
	expect(b).not.toBeUndefined();
	expect(Math.abs((a as number) - (b as number))).toBeLessThan(1e-6);
};

describe('liveResultFromStepRows', () => {
	it('draws the same CFOP ladder as the live analysis of the same moves', () => {
		const { solve, turns } = storedSolve(CFOP_SOLVE);
		const live = analyzeCurrentState(turns as any, startStateFromScramble(solve.scramble), 'cfop');
		const stored = liveResultFromStepRows(stepRowsForStoredSolve(solve, 'cfop'))!;

		expect(stored).not.toBeNull();
		expect(stored.method).toBe('cfop');
		expect(stored.currentPhase).toBe(live.currentPhase);
		expect(stored.isSolved).toBe(true);
		expect(stored.crossSolved).toBe(live.crossSolved);
		expect(stored.f2lCount).toBe(live.f2lCount);
		expect(stored.ollIdentified).toBe(live.ollIdentified);
		expect(stored.pllIdentified).toBe(live.pllIdentified);

		close(stored.times.cross, live.times.cross);
		close(stored.times.f2l, live.times.f2l);
		close(stored.times.oll, live.times.oll);
		close(stored.times.pll, live.times.pll);
		live.times.f2l_pairs!.forEach((pair, i) => close(stored.times.f2l_pairs![i], pair));

		for (const id of stored.stepOrder) {
			close(stored.stepSplits[id], live.stepSplits[id]);
			expect(stored.steps[id].moveCount.htm).toBe(live.steps[id].moveCount.htm);
			expect(Math.abs(stored.steps[id].recognitionMs - live.steps[id].recognitionMs)).toBeLessThan(1e-3);
		}
	});

	it('carries the two-look steps when the rows are made with them', () => {
		const { solve, turns } = storedSolve(CFOP_SOLVE);
		const live = analyzeCurrentState(turns as any, startStateFromScramble(solve.scramble), 'cfop2');
		const stored = liveResultFromStepRows(stepRowsForStoredSolve(solve, 'cfop2'))!;

		expect(stored.method).toBe('cfop2');
		expect(stored.isSolved).toBe(true);
		close(stored.times.oll_eo, live.times.oll_eo);
		close(stored.times.pll_cp, live.times.pll_cp);
		close(stored.times.pll, live.times.pll);
	});

	it('names cases from the legacy OLL/PLL columns of older rows', () => {
		const { solve } = storedSolve(CFOP_SOLVE);
		const rows = stepRowsForStoredSolve(solve, 'cfop')!.map((r) => ({
			...r,
			case_key: null,
			case_set: null,
		}));
		const fromLegacy = liveResultFromStepRows(rows)!;
		const fromNew = liveResultFromStepRows(stepRowsForStoredSolve(solve, 'cfop'))!;
		expect(fromLegacy.ollIdentified).toBe(fromNew.ollIdentified);
		expect(fromLegacy.pllIdentified).toBe(fromNew.pllIdentified);
	});

	it('has nothing to draw without rows', () => {
		expect(liveResultFromStepRows(null)).toBeNull();
		expect(liveResultFromStepRows([])).toBeNull();
	});
});
