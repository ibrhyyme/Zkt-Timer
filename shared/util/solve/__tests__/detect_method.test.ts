/**
 * Automatic method detection.
 *
 * Solves are constructed by inverting a solved cube through a known sequence of
 * phases, so the method that produced each one is known before the detector runs.
 * Each scenario also asserts the constructed solve actually solves the cube —
 * an invalid setup would otherwise be "detected" as something meaningless.
 */

import Cube from 'cubejs';
import { detectSolveMethod } from '../detect_method';
import { isEOLineSolved } from '../methods/zz';
import { SolveMethod, SolveTurn } from '../types';

const mv = (a: string) => a.trim().split(/\s+/).filter(Boolean);
const inv = (a: string) =>
	mv(a).reverse().map((m) => (m.endsWith("'") ? m.slice(0, -1) : m.endsWith('2') ? m : m + "'")).join(' ');

function build(phases: string[]) {
	const start = new Cube();
	for (let i = phases.length - 1; i >= 0; i--) {
		for (const m of mv(inv(phases[i]))) start.move(m);
	}
	const startState = start.asString();

	const cube = Cube.fromString(startState);
	const turns: SolveTurn[] = [];
	let t = 1000;
	for (const phase of phases) {
		t += 900;
		for (const m of mv(phase)) {
			cube.move(m);
			turns.push({ turn: m, timestamp: t });
			t += 220;
		}
	}
	return { startState, turns, solved: cube.isSolved() };
}

const CFOP_SOLVE = [
	"F R U' D2 L", "R U R'", "L' U' L", "R' U' R", "L U L'",
	"R U R' U R U2 R'", "R U R' U' R' F R2 U' R' U' R U R' F'",
];
const ROUX_SOLVE = [
	"F R U' L D2 R' F'", "R U R' U' R U R'", "R U R' U R U2 R'", 'M2 U M2 U2 M2 U M2',
];
const ZZ_SOLVE = [
	"R U L' D", "L U' L' U L U' L'", "R U R' U' R U R'",
	"R U R' U' R' F R2 U' R' U' R U R' F'",
];

describe('detectSolveMethod', () => {
	const cases: Array<[string, string[], SolveMethod]> = [
		['CFOP solve', CFOP_SOLVE, 'cfop'],
		['Roux solve', ROUX_SOLVE, 'roux'],
		['ZZ solve', ZZ_SOLVE, 'zz'],
	];

	for (const [label, phases, expected] of cases) {
		it(`${label}: construction is valid`, () => {
			expect(build(phases).solved).toBe(true);
		});

		it(`${label}: detected as ${expected}, confidently`, () => {
			const { startState, turns } = build(phases);
			const d = detectSolveMethod(turns, startState);
			expect(d.method).toBe(expected);
			expect(d.confident).toBe(true);
		});
	}

	it('the ZZ scenario really does build an EOLine', () => {
		// Guards the ZZ case: a "ZZ" solve whose first phase does not orient edges
		// is not a ZZ solve, and detection would rightly refuse to call it one.
		const { startState } = build(ZZ_SOLVE);
		const c = Cube.fromString(startState);
		for (const m of mv(ZZ_SOLVE[0])) c.move(m);
		expect(isEOLineSolved(c)).toBe(true);
	});

	it('the winning method scores strictly higher than the others', () => {
		const { startState, turns } = build(ROUX_SOLVE);
		const d = detectSolveMethod(turns, startState);
		const others = d.scores.filter((s) => s.method !== d.method);
		for (const o of others) {
			expect(d.score).toBeGreaterThan(o.score);
		}
	});

	it('falls back rather than guessing when there is nothing to read', () => {
		const d = detectSolveMethod([], undefined, 'roux');
		expect(d.confident).toBe(false);
		expect(d.method).toBe('roux');
	});
});
