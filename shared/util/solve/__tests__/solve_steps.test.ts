/**
 * The breakdown the device works out for a stored solve, from the same code the server runs.
 *
 * Field report: a smart cube solve timed without a connection showed an empty solve card
 * (no solution, replay, phases or charts) because the breakdown came only from the server.
 */

import Cube from 'cubejs';
import { serializeSmartTurnsCompact } from '../../../smart_cube/parse_turns';
import {
	getSolveSteps,
	methodStepRowsFromSteps,
	solveNeedsStepRows,
	stepRowsForStoredSolve,
} from '../solve_steps';

const mv = (a: string) => a.trim().split(/\s+/).filter(Boolean);
const inv = (a: string) =>
	mv(a).reverse().map((m) => (m.endsWith("'") ? m.slice(0, -1) : m.endsWith('2') ? m : m + "'")).join(' ');

const CFOP_SOLVE = [
	"F R U' D2 L", "R U R'", "L' U' L", "R' U' R", "L U L'",
	"R U R' U R U2 R'", "R U R' U' R' F R2 U' R' U' R U R' F'",
];

/** A stored smart solve: compact moves as the timer saves them, offsets from the first move. */
function storedSolve(phases: string[]) {
	const scramble = inv(phases.join(' '));
	const cube = new Cube();
	for (const m of mv(scramble)) cube.move(m);

	const turns: { turn: string; completedAt: number }[] = [];
	let t = 0;
	for (const phase of phases) {
		t += 900;
		for (const m of mv(phase)) {
			cube.move(m);
			turns.push({ turn: m, completedAt: t });
			t += 220;
		}
	}
	expect(cube.isSolved()).toBe(true);

	return {
		id: 'solve-1',
		scramble,
		dnf: false,
		is_smart_cube: true,
		is_virtual_cube: false,
		smart_turns: serializeSmartTurnsCompact(turns, 0),
		turns,
	};
}

describe('stepRowsForStoredSolve', () => {
	it('gives a stored CFOP solve the rows the server would store', () => {
		const solve = storedSolve(CFOP_SOLVE);
		const rows = stepRowsForStoredSolve(solve, 'cfop');
		expect(rows).not.toBeNull();

		const names = rows!.map((r) => r.step_name);
		expect(names).toEqual(['cross', 'f2l', 'f2l_1', 'f2l_2', 'f2l_3', 'f2l_4', 'oll', 'pll']);
		// Ordered by step_index, as the server returns them
		expect(rows!.map((r) => r.step_index)).toEqual([...rows!.map((r) => r.step_index)].sort((a, b) => a - b));

		for (const row of rows!) {
			expect(row.solve_id).toBe('solve-1');
			expect(row.method_name).toBe('cfop');
			expect(typeof row.turns).toBe('string');
			expect(row.total_time).toBeGreaterThanOrEqual(0);
			expect(row.id).toBe(`local-solve-1-${row.step_name}`);
		}
		expect(rows!.filter((r) => r.parent_name === 'f2l').map((r) => r.step_name)).toEqual([
			'f2l_1', 'f2l_2', 'f2l_3', 'f2l_4',
		]);
	});

	it('matches the server path exactly (same engine, same row builder)', () => {
		const solve = storedSolve(CFOP_SOLVE);
		const device = stepRowsForStoredSolve(solve, 'auto', (name) => name)!;
		const server = methodStepRowsFromSteps(
			solve.id,
			getSolveSteps(solve.turns, solve.scramble, 'auto', undefined, { endedSolved: true }),
			(name) => name
		).sort((a, b) => a.step_index - b.step_index);
		expect(device).toEqual(server);
	});

	it('returns null when there are no moves to analyse', () => {
		expect(stepRowsForStoredSolve({ id: 'x', smart_turns: '' })).toBeNull();
		expect(stepRowsForStoredSolve({ id: 'x', smart_turns: null })).toBeNull();
		expect(stepRowsForStoredSolve({ id: 'x', smart_turns: 'garbage' })).toBeNull();
	});
});

describe('solveNeedsStepRows', () => {
	const base = { id: 's', smart_turns: 'R@0 U@100', is_smart_cube: true, is_virtual_cube: false };

	it('wants rows for a smart solve with moves and no breakdown, for Pro', () => {
		expect(solveNeedsStepRows(base, true)).toBe(true);
		expect(solveNeedsStepRows({ ...base, solve_method_steps: [] }, true)).toBe(true);
		expect(solveNeedsStepRows({ ...base, solve_method_steps: null }, true)).toBe(true);
	});

	it('keeps smart cube analysis behind Pro, virtual cube open to everyone', () => {
		expect(solveNeedsStepRows(base, false)).toBe(false);
		expect(solveNeedsStepRows({ ...base, is_smart_cube: false, is_virtual_cube: true }, false)).toBe(true);
	});

	it('never replaces a breakdown that is already there (the server is the authority)', () => {
		expect(solveNeedsStepRows({ ...base, solve_method_steps: [{}] }, true)).toBe(false);
	});

	it('skips solves without moves', () => {
		expect(solveNeedsStepRows({ ...base, smart_turns: null }, true)).toBe(false);
		expect(solveNeedsStepRows(null, true)).toBe(false);
		expect(solveNeedsStepRows({ ...base, is_smart_cube: false }, true)).toBe(false);
	});
});

describe('methodStepRowsFromSteps', () => {
	it('returns nothing for a failed analysis', () => {
		expect(methodStepRowsFromSteps('s', null, () => 'id')).toEqual([]);
	});

	it('skips empty steps and the method tag', () => {
		const rows = methodStepRowsFromSteps(
			's',
			{
				__method: 'roux',
				fb: { index: 0, parentName: null, skipped: false, turnsString: 'R U', turnCount: 2, time: 1.5, tps: 1.33, recognitionTime: 0.2 },
				sb: null,
			},
			() => 'id'
		);
		expect(rows).toEqual([
			{
				id: 'id',
				solve_id: 's',
				turn_count: 2,
				turns: 'R U',
				total_time: 1.5,
				parent_name: null,
				tps: 1.33,
				skipped: false,
				recognition_time: 0.2,
				oll_case_key: null,
				pll_case_key: null,
				case_key: null,
				case_set: null,
				method_name: 'roux',
				step_index: 0,
				step_name: 'fb',
			},
		]);
	});
});
