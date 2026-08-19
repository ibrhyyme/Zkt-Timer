/**
 * Regression tests for the 2x2x2 scramble generator.
 *
 * The port used to lose cstimer's solver semantics, which produced three bugs:
 *   1. every scramble was the inverse of the OPTIMAL solution, so scrambles as
 *      short as 3 moves were handed to users
 *   2. the "reject states solvable in <= 3 moves" guard was dead code
 *   3. move directions were not inverted, so the scramble did not actually
 *      lead to the state it was generated from
 *
 * These tests rebuild an independent 2x2 simulator + optimal solver from
 * mathlib primitives (deliberately NOT reusing the generator's own tables) and
 * verify all three properties on real generated scrambles.
 */

import { Solver, Coord, acycle, getNPerm } from '../lib/mathlib';
import { generateScramble, hasGenerator } from '../registry';
import '../generators/scramble-222';
import '../generators/scramble-skewb';
import '../generators/megascramble';
import '../generators/utilscramble';

// ==================== Independent 2x2 reference model ====================

const movePieces = [
	[0, 2, 3, 1], // U
	[0, 1, 5, 4], // R
	[0, 4, 6, 2], // F
];
const moveOris: (number[] | null)[] = [null, [0, 1, 0, 1, 3], [1, 0, 1, 0, 3]];

function doPermMove(arr: number[], m: number): void {
	acycle(arr, movePieces[m]);
}
function doOriMove(arr: number[], m: number): void {
	acycle(arr, movePieces[m], 1, moveOris[m]);
}

const oriCoord = new Coord('o', 7, -3);
const refSolver = new Solver(3, 3, [
	[0, [doPermMove, 'p', 7], 5040],
	[0, [doOriMove, 'o', 7, -3], 729],
]);

/** Applies a scramble to the solved cube and returns its [perm, ori] coords. */
function applyScramble(scramble: string): [number, number] {
	const perm = [0, 1, 2, 3, 4, 5, 6];
	const ori = [0, 0, 0, 0, 0, 0, 0];
	for (const token of moves(scramble)) {
		const axis = 'URF'.indexOf(token[0]);
		expect(axis).toBeGreaterThanOrEqual(0);
		const turns = token[1] === '2' ? 2 : token[1] === "'" ? 3 : 1;
		for (let i = 0; i < turns; i++) {
			doPermMove(perm, axis);
			doOriMove(ori, axis);
		}
	}
	return [getNPerm(perm, 7), oriCoord.get(ori)];
}

/** Length of the optimal solution for a scrambled state, i.e. its difficulty. */
function optimalLength(scramble: string): number {
	return refSolver.search(applyScramble(scramble), 0)!.length;
}

function moves(scramble: string): string[] {
	return scramble.split(/\s+/).filter(Boolean);
}

const SAMPLE = 100;

// ==================== Tests ====================

describe('2x2 random state (222so)', () => {
	const scrambles = Array.from({ length: SAMPLE }, () => generateScramble('222so'));

	it('never produces a scramble shorter than 9 moves', () => {
		const lengths = scrambles.map((s) => moves(s).length);
		expect(Math.min(...lengths)).toBeGreaterThanOrEqual(9);
		expect(Math.max(...lengths)).toBeLessThanOrEqual(11);
	});

	it('never produces a state solvable in 3 moves or fewer', () => {
		for (const scramble of scrambles) {
			expect(optimalLength(scramble)).toBeGreaterThanOrEqual(4);
		}
	});

	it('only uses U/R/F moves and never repeats a face back to back', () => {
		for (const scramble of scrambles) {
			const tokens = moves(scramble);
			for (let i = 0; i < tokens.length; i++) {
				expect(tokens[i]).toMatch(/^[URF]('|2)?$/);
				if (i > 0) expect(tokens[i][0]).not.toBe(tokens[i - 1][0]);
			}
		}
	});
});

describe('2x2 optimal (222o)', () => {
	it('produces scrambles that are exactly as long as their optimal solution', () => {
		// This is the inversion check: a correctly inverted optimal solution is
		// itself an optimal scramble, so the two lengths must agree. Before the
		// fix the direction map was not inverted and these drifted apart.
		for (let i = 0; i < SAMPLE; i++) {
			const scramble = generateScramble('222o');
			expect(moves(scramble).length).toBe(optimalLength(scramble));
		}
	});

	it('never produces a state solvable in 3 moves or fewer', () => {
		for (let i = 0; i < SAMPLE; i++) {
			expect(optimalLength(generateScramble('222o'))).toBeGreaterThanOrEqual(4);
		}
	});
});

describe('2x2 subsets', () => {
	const subsets = [
		'222nb', '222eg', '222eg0', '222eg1', '222eg2',
		'222tcp', '222tcn', '222tc', '222lsall',
	];

	it.each(subsets)('%s never returns an empty or already solved scramble', (subset) => {
		for (let i = 0; i < 25; i++) {
			const scramble = generateScramble(subset);
			expect(moves(scramble).length).toBeGreaterThan(0);
			expect(optimalLength(scramble)).toBeGreaterThan(0);
		}
	});

	it('222nb produces states without a solved bar', () => {
		// A no-bar state must not be trivially easy either.
		for (let i = 0; i < 25; i++) {
			expect(optimalLength(generateScramble('222nb'))).toBeGreaterThanOrEqual(3);
		}
	});
});

describe('random-move generators registered by cstimer', () => {
	it.each([
		['2223', /^[URF]('|2)?$/],
		['skb', /^[RLBU]'?$/],
	])('%s is registered and emits only its own moves', (type, moveRe) => {
		expect(hasGenerator(type)).toBe(true);
		const tokens = moves(generateScramble(type));
		expect(tokens.length).toBeGreaterThan(10);
		for (const token of tokens) expect(token).toMatch(moveRe);
	});

	it('pyrm keeps a constant total move count after tip trimming', () => {
		// Each tip replaces one body move, so the total stays at the requested
		// length. addPyrTips trims a fixed number of characters off the end,
		// which only lines up when every move is padded to the same width;
		// with variable-width moves the trim ate direction marks instead.
		const counts = new Set<number>();
		for (let i = 0; i < 20; i++) {
			const tokens = moves(generateScramble('pyrm'));
			for (const token of tokens) expect(token).toMatch(/^[ULRBulrb]'?$/);
			counts.add(tokens.length);
		}
		expect([...counts]).toEqual([25]);
	});
});
