/**
 * PLL preview data — top face stickers (post-scramble, pre-PLL state) +
 * permutation cycles.
 *
 * Top face shown in cstimer convention as solved (yellow); explanatory sticker
 * info in 4 side strips. Arrows show direction of 3-cycles on top face
 * (e.g., Aa/Ab/G perms, piece rotations).
 *
 * Data source: cstimer pllImgParam table (cube science facts: sticker layout
 * + permutation cycles). Render code entirely original.
 *
 * stickers (12 chars): side strip identifying sticker letters, ordered:
 *   - 0..2: front strip (along top face's bottom edge, left → right)
 *   - 3..5: right strip (along right edge, top → bottom)
 *   - 6..8: back strip (along top edge, right → left)
 *   - 9..11: left strip (along left edge, bottom → top)
 *
 * arrows: top face index pairs. Index 0..8 row-major (0=top-left,
 *   2=top-right, 4=center, 6=bottom-left, 8=bottom-right). Each arrow is bidirectional
 *   (commutative: PLLArrowView automatically adds inverse or shows both when
 *   2-element list).
 */

export interface PLLData {
	stickers: string;
	arrows: number[][];
}

export const PLL_DATA: Record<string, PLLData> = {
	H:  { stickers: 'BFBRLRFBFLRL', arrows: [[1, 7], [3, 5]] },
	Ua: { stickers: 'BRBRLRFFFLBL', arrows: [[3, 7], [7, 5], [5, 3]] },
	Ub: { stickers: 'BLBRBRFFFLRL', arrows: [[3, 5], [5, 7], [7, 3]] },
	Z:  { stickers: 'LFLBRBRBRFLF', arrows: [[1, 5], [3, 7]] },
	Aa: { stickers: 'LBBRRLBFRFLF', arrows: [[0, 2], [2, 6], [6, 0]] },
	Ab: { stickers: 'RBFLRRFFLBLB', arrows: [[0, 6], [6, 8], [8, 0]] },
	E:  { stickers: 'LBRFRBRFLBLF', arrows: [[0, 6], [2, 8]] },
	F:  { stickers: 'BFRFRBRBFLLL', arrows: [[1, 7], [2, 8]] },
	Ga: { stickers: 'BRRFLBRBFLFL', arrows: [] },
	Gb: { stickers: 'BFRFBBRLFLRL', arrows: [] },
	Gc: { stickers: 'BFRFLBRRFLBL', arrows: [] },
	Gd: { stickers: 'BLRFFBRBFLRL', arrows: [] },
	Ja: { stickers: 'BBRFFBRRFLLL', arrows: [[1, 5], [2, 8]] },
	Jb: { stickers: 'LBBRLLBRRFFF', arrows: [[2, 8], [5, 7]] },
	Na: { stickers: 'FBBRLLBFFLRR', arrows: [[2, 6], [3, 5]] },
	Nb: { stickers: 'BBFLLRFFBRRL', arrows: [[0, 8], [3, 5]] },
	Ra: { stickers: 'LLBRBLBFRFRF', arrows: [[1, 3], [2, 8]] },
	Rb: { stickers: 'RBFLFRFLLBRB', arrows: [[2, 8], [3, 7]] },
	T:  { stickers: 'BBRFLBRFFLRL', arrows: [[2, 8], [3, 5]] },
	V:  { stickers: 'BBFLFRFRBRLL', arrows: [[0, 8], [1, 5]] },
	Y:  { stickers: 'BBFLRRFLBRFL', arrows: [[0, 8], [1, 3]] },
};

/**
 * caseName ('J-Perm (b)', 'T-Perm', 'E-Perm') → PLL key ('Jb', 'T', 'E').
 * Backend generates caseName via lookupCaseName() from algorithms.ts entry.name.
 */
export function pllNameFromCaseName(caseName: string): string | null {
	if (!caseName) return null;
	// Trim + remove backend "PLL " prefix if present
	const clean = caseName.replace(/^PLL\s+/i, '').trim();
	// "J-Perm (b)" → ["J", "b"]
	const m = clean.match(/^([A-Za-z])-?Perm\s*(?:\(([a-d])\))?/i);
	if (!m) return null;
	const letter = m[1].toUpperCase();
	const variant = m[2] ? m[2].toLowerCase() : '';
	const key = letter + variant;
	return PLL_DATA[key] ? key : null;
}
