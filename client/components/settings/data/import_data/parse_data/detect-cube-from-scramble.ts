// Scramble icerigine bakarak cube_type ve subset'i tespit eder.
// csTimer / Twisty Timer parser'i session-level scrType'i baz alir ama bir csTimer
// sezonunda kullanici farkli kuplerle cozum yapabilir. Bu helper her solve icin
// **gercek** scramble'a bakarak cube'u cikarir.
//
// Oncelik: spesifikten genele (sq1/minx/big cubes once, sonra 3x3/2x2 default).
// Tespit edilemezse null doner — caller session-level fallback'e dusebilir.

export interface DetectedBucket {
	cube_type: string;
	scramble_subset: string;
}

export function detectCubeFromScramble(scramble: string | null | undefined): DetectedBucket | null {
	if (!scramble) return null;
	const s = String(scramble).trim();
	if (!s) return null;

	// Square-1: / veya parantez/virgul iceriyor
	if (/[/(),]/.test(s)) return { cube_type: 'wca', scramble_subset: 'sq1' };

	// Megaminx: ++ veya -- cifte isaretler
	if (/(\+\+|--)/.test(s)) return { cube_type: 'wca', scramble_subset: 'minx' };

	// Clock: UR0+ DL3- ALL2+ tarzi pin notation
	if (/\b(ALL|UR|DR|UL|DL)[0-9]+[+-]/.test(s)) {
		return { cube_type: 'wca', scramble_subset: 'clock' };
	}

	// 6x6/7x7: 3-wide moves
	if (/3(Rw|Uw|Lw|Dw|Fw|Bw)/.test(s)) {
		const moveCount = s.split(/\s+/).filter(Boolean).length;
		return { cube_type: 'wca', scramble_subset: moveCount > 70 ? '777' : '666' };
	}

	// 4x4/5x5: 2-wide moves
	if (/(Rw|Uw|Lw|Dw|Fw|Bw)/.test(s)) {
		const moveCount = s.split(/\s+/).filter(Boolean).length;
		return { cube_type: 'wca', scramble_subset: moveCount > 50 ? '555' : '444' };
	}

	// Pyraminx: kucuk harf tweaker (u r b l) — buyuk harflerle birlikte
	if (/(^|\s)[ulrb]'?(\s|$)/.test(s)) {
		return { cube_type: 'wca', scramble_subset: 'pyram' };
	}

	const moves = s.split(/\s+/).filter(Boolean);

	// Skewb: kisa scramble (cogunlukla 7-9 hamle), sadece ULRBFxyz harfleri
	if (moves.length < 12 && /^[ULRBFxyz'2\s]+$/.test(s)) {
		// Skewb'de cogunlukla F yok ama xyz var; 3x3 de tek harfli yapabilir.
		// Eger xyz iceriyor ve cok kisa ise muhtemelen skewb.
		if (/[xyz]/.test(s) || moves.length <= 9) {
			return { cube_type: 'wca', scramble_subset: 'skewb' };
		}
	}

	// 2x2: kisa, sadece R U F (D, L, B yok; wide yok)
	if (moves.length <= 12 && /^[RUF'2\s]+$/.test(s)) {
		return { cube_type: 'wca', scramble_subset: '222' };
	}

	// 3x3 default
	return { cube_type: 'wca', scramble_subset: '333' };
}
