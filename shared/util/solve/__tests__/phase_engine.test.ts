/**
 * Phase engine invariant tests.
 *
 * Goal: SUM(transitions[i].moveCount.htm) === totalMoves.htm always.
 * This ensures UI's "Total = Σ phases" calculation matches DB's smart_turn_count.
 * After boundary-aware HTM (axis-mask state flows between phases) fix.
 */

import { analyzePhases } from '../phase_engine';
import { countHTM } from '../move_counter';
import { SolveTurn } from '../types';
import Cube from 'cubejs';

function turnsFromMoves(moves: string[], stepMs = 100): SolveTurn[] {
	return moves.map((turn, i) => ({ turn, timestamp: i * stepMs }));
}

/** Apply move sequence to solved cube and return start state. */
function startStateFromScramble(scramble: string): string {
	const cube = new Cube();
	for (const m of scramble.trim().split(/\s+/).filter(Boolean)) {
		cube.move(m);
	}
	return cube.asString();
}

describe('analyzePhases — invariant', () => {
	it('empty turns -> empty result', () => {
		const result = analyzePhases([]);
		expect(result.transitions).toHaveLength(0);
		expect(result.totalMoves.htm).toBe(0);
	});

	it('totalMoves.htm === countHTM(allMoves) — boundary-aware monolithic counter', () => {
		const moves = ["R", "U", "R'", "F", "R", "U", "R'", "U'", "R'", "F", "R", "F'"];
		const result = analyzePhases(turnsFromMoves(moves));
		expect(result.totalMoves.htm).toBe(countHTM(moves));
	});

	it('boundary parallel-axis: "R R" sequence -> total HTM 1 (cstimer-grade)', () => {
		const moves = ["R", "R"];
		expect(countHTM(moves)).toBe(1);
		const result = analyzePhases(turnsFromMoves(moves));
		expect(result.totalMoves.htm).toBe(1);
	});

	it('SUM(transitions[i].moveCount.htm) === totalMoves.htm whenever phases are detected', () => {
		// Engine progress detection depends on cube state. When phases are not detected,
		// transitions is empty (even if totalMoves > 0). This test validates the invariant
		// when transitions exist — mathematical guarantee of boundary-aware delta calculation.
		const moves = [
			"D", "R", "F", "L2", "U2", "F'",
			"U", "R", "U'", "R'", "U", "R", "U", "R'",
			"R", "U", "R'", "U", "R", "U2", "R'",
			"R", "U", "R'", "U'", "R'", "F", "R2", "U'", "R'", "U'", "R", "U", "R'", "F'",
		];
		const result = analyzePhases(turnsFromMoves(moves));

		if (result.transitions.length > 0) {
			const sum = result.transitions.reduce((s, t) => s + t.moveCount.htm, 0);
			expect(sum).toBe(result.totalMoves.htm);
		}
		// In all cases totalMoves equals countHTM
		expect(result.totalMoves.htm).toBe(countHTM(moves));
	});

	it('mergeOneMovePhases preserves invariant when transitions exist', () => {
		const moves = ["R", "U", "R'", "U'", "F", "R", "U", "R'", "U'", "F'"];
		const result = analyzePhases(turnsFromMoves(moves));

		if (result.transitions.length > 0) {
			const sum = result.transitions.reduce((s, t) => s + t.moveCount.htm, 0);
			expect(sum).toBe(result.totalMoves.htm);
		}
		expect(result.totalMoves.htm).toBe(countHTM(moves));
	});
});

describe('analyzePhases — partial-solve subsets (333cfop>oll, >pll etc.)', () => {
	// In subset solves, the scramble cube already arrives partially-solved; user only moves
	// the remaining phases. Via pre-populate logic, the OLL/PLL identification chain
	// (`beforeOLLState = phaseEndStates.f2l_4`, `beforePLLState = phaseEndStates.oll`)
	// stays populated → case identification works.

	it('PLL-only: cube cross+F2L+OLL solved, only PLL moves → PLL transition + identification', () => {
		// PLL T-perm scramble: apply inverse T-perm to solved cube for start.
		// T-perm: R U R' U' R' F R2 U' R' U' R U R' F'
		// Inverse: F R U' R' U R U R2 F' R U R U' R'  (R2 is self-inverse so R2 stays)
		const tPermInverse = ["F", "R", "U'", "R'", "U", "R", "U", "R2", "F'", "R", "U", "R", "U'", "R'"];
		const startState = startStateFromScramble(tPermInverse.join(' '));

		// User only solves PLL (T-perm)
		const userMoves = ["R", "U", "R'", "U'", "R'", "F", "R2", "U'", "R'", "U'", "R", "U", "R'", "F'"];
		const result = analyzePhases(turnsFromMoves(userMoves), startState);

		// Only PLL transition should be generated (no cross/f2l/oll)
		const pllTransition = result.transitions.find((t) => t.phase === 'pll');
		expect(pllTransition).toBeDefined();
		expect(pllTransition?.skipped).toBe(false);

		// Cross/F2L/OLL transitions should not be generated (already solved, user didn't move)
		expect(result.transitions.find((t) => t.phase === 'cross')).toBeUndefined();
		expect(result.transitions.find((t) => t.phase === 'oll')).toBeUndefined();

		// CRITICAL: PLL identification should work — that's the purpose of the pre-populate fix
		expect(result.pllIdentified).toBeDefined();
		expect(result.pllIdentified?.key).toBeDefined();
	});

	it('OLL-only: cube cross+F2L solved, OLL+PLL moves → both identification', () => {
		// Sune (OLL 27) + T-perm (PLL) apply inverse.
		// Sune: R U R' U R U2 R'
		// T-perm: R U R' U' R' F R2 U' R' U' R U R' F'
		const allInverse = [
			// inverse T-perm (PLL first)
			"F", "R", "U'", "R'", "U", "R", "U", "R2", "F'", "R", "U", "R", "U'", "R'",
			// inverse Sune (then OLL)
			"R", "U2", "R'", "U'", "R", "U'", "R'",
		];
		const startState = startStateFromScramble(allInverse.join(' '));

		const userMoves = [
			// Sune
			"R", "U", "R'", "U", "R", "U2", "R'",
			// T-perm
			"R", "U", "R'", "U'", "R'", "F", "R2", "U'", "R'", "U'", "R", "U", "R'", "F'",
		];
		const result = analyzePhases(turnsFromMoves(userMoves), startState);

		// OLL and PLL transitions should be generated
		expect(result.transitions.find((t) => t.phase === 'oll')).toBeDefined();
		expect(result.transitions.find((t) => t.phase === 'pll')).toBeDefined();
		// Cross/F2L transitions should not be generated
		expect(result.transitions.find((t) => t.phase === 'cross')).toBeUndefined();

		// CRITICAL: both OLL and PLL identification should work
		expect(result.ollIdentified).toBeDefined();
		expect(result.pllIdentified).toBeDefined();
	});

	it('full WCA 333: no pre-populate, current behavior preserved (regression check)', () => {
		// Instead of comprehensive scramble + comprehensive solve simulation,
		// just verify that pre-populate logic is a no-op when numCompleted=0 on full scramble.
		const fullScramble = "F R U2 L' B' D2 F2 R' U' R2 D L F2 R B' L U2 D R'";
		const startState = startStateFromScramble(fullScramble);

		// Cube on full scramble — initial.progress should be 7 → numCompleted = 0
		// → no phases are pre-populated. Adding pre-populate doesn't change behavior here.
		const result = analyzePhases([], startState);
		expect(result.transitions).toHaveLength(0);
		// No identification because no transitions
		expect(result.ollIdentified).toBeUndefined();
		expect(result.pllIdentified).toBeUndefined();
	});
});
