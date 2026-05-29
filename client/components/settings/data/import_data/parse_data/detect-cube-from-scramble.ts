// Detects cube_type and subset by examining scramble content.
// The csTimer / Twisty Timer parser bases on session-level scrType, but in a csTimer
// season a user can solve with different cubes. This helper examines the **actual**
// scramble for each solve to extract the cube.
//
// Priority: specific to general (sq1/minx/big cubes first, then 3x3/2x2 default).
// If not detected, returns null — caller can fall back to session-level.

export interface DetectedBucket {
	cube_type: string;
	scramble_subset: string;
}

export function detectCubeFromScramble(scramble: string | null | undefined): DetectedBucket | null {
	if (!scramble) return null;
	const s = String(scramble).trim();
	if (!s) return null;

	// Square-1: contains / or parentheses/commas
	if (/[/(),]/.test(s)) return { cube_type: 'wca', scramble_subset: 'sq1' };

	// Megaminx: ++ or -- double signs
	if (/(\+\+|--)/.test(s)) return { cube_type: 'wca', scramble_subset: 'minx' };

	// Clock: UR0+ DL3- ALL2+ style pin notation
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

	// Pyraminx: lowercase tweaker (u r b l) — together with uppercase letters
	if (/(^|\s)[ulrb]'?(\s|$)/.test(s)) {
		return { cube_type: 'wca', scramble_subset: 'pyram' };
	}

	const moves = s.split(/\s+/).filter(Boolean);

	// Skewb: short scramble (usually 7-9 moves), only ULRBF x y z letters
	if (moves.length < 12 && /^[ULRBFxyz'2\s]+$/.test(s)) {
		// Skewb usually has no F but has xyz; 3x3 can have single letters.
		// If it contains xyz and very short, probably skewb.
		if (/[xyz]/.test(s) || moves.length <= 9) {
			return { cube_type: 'wca', scramble_subset: 'skewb' };
		}
	}

	// 2x2: short, only R U F (no D, L, B; no wide moves)
	if (moves.length <= 12 && /^[RUF'2\s]+$/.test(s)) {
		return { cube_type: 'wca', scramble_subset: '222' };
	}

	// 3x3 default
	return { cube_type: 'wca', scramble_subset: '333' };
}
