/**
 * Maps the move notations Zkt-Timer stores onto the subset cubejs understands:
 * face turns URFDLB, wide turns urfdlb, slices MES and rotations xyz, each with
 * no suffix, "'" or "2".
 *
 * Smart cubes only ever report face turns, so this is a no-op for them. The virtual
 * cube does not: its move2str (client/util/virtual_cube/notation.ts) writes wide
 * turns as "Rw" and the single middle layer of a 3x3 as the layer range "2-2Rw".
 * cubejs rejects both, and the phase engine used to skip every move it rejected,
 * so a virtual solve with one wide or slice turn drifted from the real cube state
 * and lost the phases after it. Custom scrambles typed by users hit the same wall
 * with "Rw" and "U2'".
 */

/** The single middle layer of a 3x3, turned in the direction of the given face. */
const INNER_LAYER: Record<string, string> = {
	R: "M'",
	L: 'M',
	U: "E'",
	D: 'E',
	F: 'S',
	B: "S'",
};

/** The whole cube, turned in the direction of the given face. */
const WHOLE_CUBE: Record<string, string> = {
	R: 'x',
	L: "x'",
	U: 'y',
	D: "y'",
	F: 'z',
	B: "z'",
};

/** Applies a power suffix ('', "'", '2') to a base move that may itself be primed. */
function withPower(base: string, power: string): string {
	const letter = base[0];
	const basePrimed = base.endsWith("'");
	if (power === '2') return letter + '2';
	const primed = power === "'" ? !basePrimed : basePrimed;
	return primed ? letter + "'" : letter;
}

/**
 * One move in, one cubejs-compatible move out. Anything it does not recognise is
 * returned trimmed and unchanged, so callers keep their existing "skip what cubejs
 * rejects" behaviour for genuinely invalid input.
 */
export function normalizeMove(raw: string): string {
	let move = (raw || '').trim().replace(/[’‘`]/g, "'");
	if (!move) return move;

	// A half turn has no direction: "U2'" and "U'2" are both "U2".
	move = move.replace(/^(.*?)(?:2'|'2)$/, '$12');

	// Inner layer range on a 3x3: "2-2Rw" is the middle slice.
	const inner = /^2-2([URFDLB])w(['2]?)$/.exec(move);
	if (inner) return withPower(INNER_LAYER[inner[1]], inner[2]);

	// Three layers of a 3x3 is the whole cube.
	const whole = /^3([URFDLB])w(['2]?)$/.exec(move);
	if (whole) return withPower(WHOLE_CUBE[whole[1]], whole[2]);

	// Two outer layers: "Rw" / "2Rw" are what cubejs calls "r".
	const wide = /^2?([URFDLB])w(['2]?)$/.exec(move);
	if (wide) return wide[1].toLowerCase() + wide[2];

	return move;
}

/**
 * Inverse of a single normalized move: R -> R', R' -> R, R2 -> R2. Rotations, wide
 * turns and slices invert the same way.
 */
export function invertNormalizedMove(move: string): string {
	if (move.endsWith("'")) return move.slice(0, -1);
	if (move.endsWith('2')) return move;
	return move + "'";
}
