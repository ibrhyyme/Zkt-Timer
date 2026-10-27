/**
 * Method detection on the server's write path.
 *
 * The client's chosen method stopped reaching the server on 2026-08-31 and getSolveSteps
 * fell back to CFOP for every smart solve. The server now asks for 'auto' when nothing is
 * sent, and a reindex passes the solve's stored method as the fallback, so these pin down
 * both behaviours with solves whose method is known by construction.
 */

import Cube from 'cubejs';
import { getSolveSteps } from '../solve_method';

const mv = (a: string) => a.trim().split(/\s+/).filter(Boolean);
const inv = (a: string) =>
	mv(a).reverse().map((m) => (m.endsWith("'") ? m.slice(0, -1) : m.endsWith('2') ? m : m + "'")).join(' ');

/** Scramble = the whole solution undone; turns carry increasing timestamps per phase. */
function build(phases: string[]) {
	const solution = phases.join(' ');
	const scramble = inv(solution);

	const cube = new Cube();
	for (const m of mv(scramble)) cube.move(m);

	const turns: any[] = [];
	let t = 1000;
	for (const phase of phases) {
		t += 900;
		for (const m of mv(phase)) {
			cube.move(m);
			turns.push({ turn: m, time: t, completedAt: t });
			t += 220;
		}
	}
	return { scramble, turns, solved: cube.isSolved() };
}

// Same constructions as shared/util/solve/__tests__/detect_method.test.ts
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

describe("getSolveSteps with 'auto'", () => {
	const cases: Array<[string, string[], string]> = [
		['CFOP', CFOP_SOLVE, 'cfop'],
		['Roux', ROUX_SOLVE, 'roux'],
		['ZZ', ZZ_SOLVE, 'zz'],
	];

	for (const [label, phases, expected] of cases) {
		it(`analyses a ${label} solve as ${expected}`, () => {
			const { scramble, turns, solved } = build(phases);
			expect(solved).toBe(true);
			const steps = getSolveSteps(turns, scramble, 'auto') as any;
			expect(steps.__method).toBe(expected);
		});
	}

	it('an explicit method is still respected', () => {
		const { scramble, turns } = build(ROUX_SOLVE);
		expect((getSolveSteps(turns, scramble, 'cfop') as any).__method).toBe('cfop');
	});
});

describe('getSolveSteps fallback', () => {
	it('keeps the given method when detection is not confident', () => {
		// Four moves from solved: every method's ladder looks equally complete
		const { scramble, turns } = build(["R U R' U'"]);
		const steps = getSolveSteps(turns, scramble, 'auto', 'zz') as any;
		expect(steps.__method).toBe('zz');
	});

	it('falls back to CFOP when no fallback is given', () => {
		const { scramble, turns } = build(["R U R' U'"]);
		expect((getSolveSteps(turns, scramble, 'auto') as any).__method).toBe('cfop');
	});
});
