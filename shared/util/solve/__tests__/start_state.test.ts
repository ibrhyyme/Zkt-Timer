/**
 * Start state resolution for reconstructions.
 *
 * A smart cube solve whose move list lost a packet (or got two turns reported in the
 * wrong order) still ends on a solved cube, but replaying the moves we hold from the
 * scramble state cannot get there. Every phase after the gap used to vanish, and with
 * no final phase the timer page hid the whole breakdown. These pin the cstimer-style
 * fallback (recons.js calcRecons: derive the start from the solution) and the cases
 * where it must NOT be used.
 */

import Cube from 'cubejs';
import { analyzePhases } from '../phase_engine';
import {
	faceletsSolved,
	replayEndsSolved,
	resolveAnalysisStartState,
	startStateFromScramble,
	startStateFromSolvedEnd,
} from '../start_state';
import { SolveTurn } from '../types';

const mv = (a: string) => a.trim().split(/\s+/).filter(Boolean);
const inv = (a: string) =>
	mv(a).reverse().map((m) => (m.endsWith("'") ? m.slice(0, -1) : m.endsWith('2') ? m : m + "'")).join(' ');

// Same construction as detect_method.test.ts: the solution is known phase by phase.
const CFOP_SOLVE = [
	"F R U' D2 L", "R U R'", "L' U' L", "R' U' R", "L U L'",
	"R U R' U R U2 R'", "R U R' U' R' F R2 U' R' U' R U R' F'",
];

function build(phases: string[]) {
	const scramble = inv(phases.join(' '));
	const startState = startStateFromScramble(scramble)!;
	const turns: SolveTurn[] = [];
	let t = 1000;
	for (const phase of phases) {
		t += 900;
		for (const m of mv(phase)) {
			turns.push({ turn: m, timestamp: t });
			t += 220;
		}
	}
	return { scramble, startState, turns };
}

const performed = (turns: SolveTurn[], start?: string) =>
	analyzePhases(turns, start, { method: 'cfop' }).transitions.map((t) => t.phase);

describe('resolveAnalysisStartState', () => {
	const { startState, turns } = build(CFOP_SOLVE);

	it('keeps the real start state for a complete solve', () => {
		const resolved = resolveAnalysisStartState({ turns, preferred: startState, endedSolved: true });
		expect(resolved).toEqual({ state: startState, derived: false });
		expect(performed(turns, startState)).toContain('pll');
	});

	const lostAt: Array<[string, number]> = [
		['the first move', 0],
		['a middle move', Math.floor(turns.length / 2)],
		['the final move', turns.length - 1],
	];

	for (const [label, index] of lostAt) {
		describe(`with ${label} lost`, () => {
			const lossy = turns.filter((_, i) => i !== index);

			it('cannot reach the last phase from the scramble state (the bug)', () => {
				expect(replayEndsSolved(startState, lossy)).toBe(false);
				expect(performed(lossy, startState)).not.toContain('pll');
			});

			it('falls back to the start derived from the solution, which reaches every phase', () => {
				const resolved = resolveAnalysisStartState({ turns: lossy, preferred: startState, endedSolved: true });
				expect(resolved.derived).toBe(true);
				expect(replayEndsSolved(resolved.state!, lossy)).toBe(true);

				const phases = performed(lossy, resolved.state);
				expect(phases).toContain('cross');
				expect(phases).toContain('pll');
				expect(phases).toHaveLength(7);
			});
		});
	}

	it('recovers a solve whose cube reported two turns in the wrong order', () => {
		const swapped = turns.slice();
		const i = swapped.findIndex((t, k) => t.turn === 'R' && swapped[k + 1]?.turn === 'U');
		[swapped[i], swapped[i + 1]] = [swapped[i + 1], swapped[i]];

		const resolved = resolveAnalysisStartState({ turns: swapped, preferred: startState, endedSolved: true });
		expect(resolved.derived).toBe(true);
		expect(performed(swapped, resolved.state)).toContain('pll');
	});

	it('never derives a start for a solve that did not end solved (DNF)', () => {
		const aborted = turns.slice(0, 20);
		const resolved = resolveAnalysisStartState({ turns: aborted, preferred: startState, endedSolved: false });
		expect(resolved).toEqual({ state: startState, derived: false });
	});

	it('derives the start when there is no preferred one', () => {
		const resolved = resolveAnalysisStartState({ turns, preferred: null, endedSolved: true });
		expect(resolved.derived).toBe(true);
		expect(resolved.state).toBe(startState);
	});

	it('keeps a partial-solve subset on its real start so pre-solved phases stay recognised', () => {
		// PLL-only drill: cross, F2L and OLL are already solved by the scramble.
		const pll = "R U R' U' R' F R2 U' R' U' R U R' F'";
		const subset = build([pll]);
		const resolved = resolveAnalysisStartState({
			turns: subset.turns,
			preferred: subset.startState,
			endedSolved: true,
		});
		expect(resolved).toEqual({ state: subset.startState, derived: false });
	});
});

describe('startStateFromSolvedEnd', () => {
	it('matches the scramble state when every move is present', () => {
		const { startState, turns } = build(CFOP_SOLVE);
		expect(startStateFromSolvedEnd(turns)).toBe(startState);
	});

	it('handles virtual cube wide and slice notation', () => {
		const turns = mv("Rw U 2-2Rw' U2' x").map((turn) => ({ turn }));
		const start = startStateFromSolvedEnd(turns)!;
		expect(replayEndsSolved(start, turns)).toBe(true);
	});
});

describe('faceletsSolved', () => {
	it('accepts a solved cube in any orientation', () => {
		const cube = new Cube();
		cube.move('x y');
		expect(faceletsSolved(cube.asString())).toBe(true);
	});

	it('rejects a cube that is one turn away', () => {
		const cube = new Cube();
		cube.move('U');
		expect(faceletsSolved(cube.asString())).toBe(false);
	});
});
