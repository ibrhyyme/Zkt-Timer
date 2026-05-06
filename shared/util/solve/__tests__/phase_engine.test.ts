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
import Cube from 'cubejs';

function turnsFromMoves(moves: string[], stepMs = 100): SolveTurn[] {
	return moves.map((turn, i) => ({ turn, timestamp: i * stepMs }));
}

/** Solved cube'a hamle dizisini uygulayip start state donderir. */
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

describe('analyzePhases — kismi-cozum subsetleri (333cfop>oll, >pll vb.)', () => {
	// Subset solve'larinda scramble cube'u zaten kismi-cozulu getirir, kullanici sadece
	// kalan fazlari hareket eder. Pre-populate logic'i sayesinde OLL/PLL identification
	// chain'i (`beforeOLLState = phaseEndStates.f2l_4`, `beforePLLState = phaseEndStates.oll`)
	// dolu kalir → case identification calisir.

	it('PLL-only: cube cross+F2L+OLL cozulu, sadece PLL hamleleri yapilir → PLL transition + identification', () => {
		// PLL T-perm scramble: solved cube'a inverse T-perm uygulayip baslangic alalim.
		// T-perm: R U R' U' R' F R2 U' R' U' R U R' F'
		// Inverse: F R U' R' U R U R2 F' R U R U' R'  (R2 self-inverse oldugu icin R2 kalir)
		const tPermInverse = ["F", "R", "U'", "R'", "U", "R", "U", "R2", "F'", "R", "U", "R", "U'", "R'"];
		const startState = startStateFromScramble(tPermInverse.join(' '));

		// Kullanici sadece PLL'i cozer (T-perm)
		const userMoves = ["R", "U", "R'", "U'", "R'", "F", "R2", "U'", "R'", "U'", "R", "U", "R'", "F'"];
		const result = analyzePhases(turnsFromMoves(userMoves), startState);

		// Sadece PLL transition uretilmeli (cross/f2l/oll yok)
		const pllTransition = result.transitions.find((t) => t.phase === 'pll');
		expect(pllTransition).toBeDefined();
		expect(pllTransition?.skipped).toBe(false);

		// Cross/F2L/OLL transition uretilmemeli (zaten cozulu geldi, kullanici hareket etmedi)
		expect(result.transitions.find((t) => t.phase === 'cross')).toBeUndefined();
		expect(result.transitions.find((t) => t.phase === 'oll')).toBeUndefined();

		// KRITIK: PLL identification calismali — pre-populate fix'inin amaci budur
		expect(result.pllIdentified).toBeDefined();
		expect(result.pllIdentified?.key).toBeDefined();
	});

	it('OLL-only: cube cross+F2L cozulu, OLL+PLL hamleleri yapilir → her ikisi identification', () => {
		// Sune (OLL 27) + T-perm (PLL) inverse uygulayalim.
		// Sune: R U R' U R U2 R'
		// T-perm: R U R' U' R' F R2 U' R' U' R U R' F'
		const allInverse = [
			// inverse T-perm (PLL once)
			"F", "R", "U'", "R'", "U", "R", "U", "R2", "F'", "R", "U", "R", "U'", "R'",
			// inverse Sune (sonra OLL)
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

		// OLL ve PLL transition uretilmeli
		expect(result.transitions.find((t) => t.phase === 'oll')).toBeDefined();
		expect(result.transitions.find((t) => t.phase === 'pll')).toBeDefined();
		// Cross/F2L transition uretilmemeli
		expect(result.transitions.find((t) => t.phase === 'cross')).toBeUndefined();

		// KRITIK: hem OLL hem PLL identification calismali
		expect(result.ollIdentified).toBeDefined();
		expect(result.pllIdentified).toBeDefined();
	});

	it('full WCA 333: hicbir pre-populate, mevcut davranis korunur (regression check)', () => {
		// Kapsamli scramble + kapsamli cozum simulasyonu yerine, sadece pre-populate
		// logic'inin tam scramble durumunda numCompleted=0 ile no-op oldugunu dogrula.
		const fullScramble = "F R U2 L' B' D2 F2 R' U' R2 D L F2 R B' L U2 D R'";
		const startState = startStateFromScramble(fullScramble);

		// Cube full scramble durumunda — initial.progress 7 olmali → numCompleted = 0
		// → hicbir phase pre-populate edilmez. Pre-populate ekleme bu durumda davranisi
		// degistirmez.
		const result = analyzePhases([], startState);
		expect(result.transitions).toHaveLength(0);
		// Identification yok cunku hic transition yok
		expect(result.ollIdentified).toBeUndefined();
		expect(result.pllIdentified).toBeUndefined();
	});
});
