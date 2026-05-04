/**
 * Phase engine invariant tests.
 *
 * Hedef: SUM(transitions[i].moveCount.htm) === totalMoves.htm her zaman.
 * Bu, UI'daki "Toplam = Σ phases" hesabinin DB'deki smart_turn_count ile
 * eslesmesini garanti eder. Boundary-aware HTM (axis-mask state phase'ler
 * arasi akar) duzeltmesi sonrasi.
 */

import { analyzePhases } from '../phase_engine';
import { countHTM } from '../move_counter';
import { SolveTurn } from '../types';

function turnsFromMoves(moves: string[], stepMs = 100): SolveTurn[] {
	return moves.map((turn, i) => ({ turn, timestamp: i * stepMs }));
}

describe('analyzePhases — invariant', () => {
	it('empty turns -> empty result', () => {
		const result = analyzePhases([]);
		expect(result.transitions).toHaveLength(0);
		expect(result.totalMoves.htm).toBe(0);
	});

	it('totalMoves.htm === countHTM(allMoves) — boundary-aware monolitik counter', () => {
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
		// Engine progress detection cube state'ine baglidir. Phase'ler tespit edilmediginde
		// transitions bos olur (totalMoves > 0 olsa bile). Bu test transitions varsa
		// invariant'i dogrular — boundary-aware delta hesabinin matematiksel garantisi.
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
		// Her durumda totalMoves countHTM ile esit
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
