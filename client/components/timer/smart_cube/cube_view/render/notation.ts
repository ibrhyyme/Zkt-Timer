/**
 * Move notation for the cube renderer.
 *
 * Smart cubes only ever report face turns, but the view also replays setups and big-cube
 * scrambles, so the full block set is accepted: faces, slices, wide turns and whole-cube
 * rotations, each with '', ', 2 or 2', and on faces a layer prefix: "2R" (the second layer
 * alone), "3Rw" (three layers), "2-3Rw" (layers two to three). Anything else is rejected
 * rather than guessed.
 */

export type Axis = 0 | 1 | 2;

/**
 * Which layers along the axis turn. Positions run from `lo` to `hi` (-1..1 on a 3x3,
 * -0.5..0.5 on a 2x2, -3..3 on a 7x7), so the same move works on every size. A wide turn
 * without a prefix is two layers, never the whole cube: on a 2x2 it is the face turn. A slice
 * (M, E, S) is everything between the two faces: nothing on a 2x2, the two middle layers on
 * a 4x4.
 */
export type LayerSelector = 'hi' | 'lo' | 'mid' | 'wideHi' | 'wideLo' | 'all';

export interface ParsedMove {
	axis: Axis;
	layers: LayerSelector;
	/** Quarter turns about the positive axis, right-handed. Sign carries the direction. */
	quarters: number;
	/**
	 * Layers counted from the turning face, 1 the outermost, both ends included: "2R" is
	 * [2, 2], "3Rw" [1, 3], "2-3Rw" [2, 3]. Left out without a prefix: the selector's own rule.
	 */
	depth?: [number, number];
}

// Clockwise as seen from that face, expressed about the positive axis: U turns the top
// layer by -90 degrees about +y, D (seen from below) by +90.
const BASE: Record<string, { axis: Axis; layers: LayerSelector; dir: 1 | -1 }> = {
	U: { axis: 1, layers: 'hi', dir: -1 },
	D: { axis: 1, layers: 'lo', dir: 1 },
	R: { axis: 0, layers: 'hi', dir: -1 },
	L: { axis: 0, layers: 'lo', dir: 1 },
	F: { axis: 2, layers: 'hi', dir: -1 },
	B: { axis: 2, layers: 'lo', dir: 1 },
	// Slices follow the face they share a direction with: E with D, M with L, S with F.
	E: { axis: 1, layers: 'mid', dir: 1 },
	M: { axis: 0, layers: 'mid', dir: 1 },
	S: { axis: 2, layers: 'mid', dir: -1 },
	x: { axis: 0, layers: 'all', dir: -1 },
	y: { axis: 1, layers: 'all', dir: -1 },
	z: { axis: 2, layers: 'all', dir: -1 },
	u: { axis: 1, layers: 'wideHi', dir: -1 },
	d: { axis: 1, layers: 'wideLo', dir: 1 },
	r: { axis: 0, layers: 'wideHi', dir: -1 },
	l: { axis: 0, layers: 'wideLo', dir: 1 },
	f: { axis: 2, layers: 'wideHi', dir: -1 },
	b: { axis: 2, layers: 'wideLo', dir: 1 },
};

const MOVE_RE = /^(?:(\d)(?:-(\d))?)?([URFDLB]w|[URFDLBEMSxyzurfdlb])([123]?)(')?$/;

export function parseMove(text: string): ParsedMove | null {
	const m = MOVE_RE.exec((text || '').trim());
	if (!m) return null;
	const [, fromText, toText, letters, amountText, prime] = m;
	// "Rw" is the same move as "r".
	const face = letters.length === 2 ? letters[0].toLowerCase() : letters;
	const base = BASE[face];
	const amount = amountText ? Number(amountText) : 1;
	let quarters = base.dir * amount * (prime ? -1 : 1);
	// R3 is R'. Kept within -2..2 so an animation never spins the long way round.
	quarters = ((quarters % 4) + 4) % 4;
	if (quarters === 3) quarters = -1;
	if (quarters === 2 && (prime ? -1 : 1) * base.dir < 0) quarters = -2;
	const move: ParsedMove = { axis: base.axis, layers: base.layers, quarters };
	if (fromText) {
		// Layer prefixes belong to faces and wide turns only.
		const wide = base.layers === 'wideHi' || base.layers === 'wideLo';
		if (!wide && base.layers !== 'hi' && base.layers !== 'lo') return null;
		const from = Number(fromText);
		const to = toText ? Number(toText) : from;
		if (from < 1 || to < from) return null;
		// "3Rw": layers one to three; "2R": the second layer alone; "2-3Rw": two to three.
		move.depth = wide && !toText ? [1, from] : [from, to];
	}
	return move;
}

/** Does the layer at `value` (on an axis spanning lo..hi) take part in the move? */
export function layerTurns(move: ParsedMove, value: number, lo: number, hi: number): boolean {
	const eps = 1e-6;
	const size = Math.round(hi - lo) + 1;
	// 1 for the outermost layer on that side.
	const fromHi = Math.round(hi - value) + 1;
	const fromLo = Math.round(value - lo) + 1;
	const within = (n: number, [from, to]: [number, number]) => n >= from && n <= to;
	const wideDepth: [number, number] = [1, Math.min(2, size - 1)];
	switch (move.layers) {
		case 'hi':
			return within(fromHi, move.depth ?? [1, 1]);
		case 'lo':
			return within(fromLo, move.depth ?? [1, 1]);
		case 'wideHi':
			return within(fromHi, move.depth ?? wideDepth);
		case 'wideLo':
			return within(fromLo, move.depth ?? wideDepth);
		case 'mid':
			return value > lo + eps && value < hi - eps;
		case 'all':
			return true;
	}
}
