/**
 * Move notation for the smart-cube renderer.
 *
 * Smart cubes only ever report face turns, but the view also replays setups, so the full
 * outer-block set is accepted: faces, slices, wide turns and whole-cube rotations, each
 * with '', ', 2 or 2'. Anything else is rejected rather than guessed.
 */

export type Axis = 0 | 1 | 2;

/**
 * Which layers along the axis turn. Positions run from `lo` to `hi` (-1..1 on a 3x3,
 * -0.5..0.5 on a 2x2), so the same move works on both sizes. A 2x2 has no middle layer:
 * its slices turn nothing and its wide turns are the face turn.
 */
export type LayerSelector = 'hi' | 'lo' | 'mid' | 'wideHi' | 'wideLo' | 'all';

export interface ParsedMove {
	axis: Axis;
	layers: LayerSelector;
	/** Quarter turns about the positive axis, right-handed. Sign carries the direction. */
	quarters: number;
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

const MOVE_RE = /^([URFDLB]w|[URFDLBEMSxyzurfdlb])([123]?)(')?$/;

export function parseMove(text: string): ParsedMove | null {
	const m = MOVE_RE.exec((text || '').trim());
	if (!m) return null;
	// "Rw" is the same move as "r".
	const face = m[1].length === 2 ? m[1][0].toLowerCase() : m[1];
	const base = BASE[face];
	const amount = m[2] ? Number(m[2]) : 1;
	let quarters = base.dir * amount * (m[3] ? -1 : 1);
	// R3 is R'. Kept within -2..2 so an animation never spins the long way round.
	quarters = ((quarters % 4) + 4) % 4;
	if (quarters === 3) quarters = -1;
	if (quarters === 2 && (m[3] ? -1 : 1) * base.dir < 0) quarters = -2;
	return { axis: base.axis, layers: base.layers, quarters };
}

/** Does a layer at `value` (on an axis spanning lo..hi) take part in the move? */
export function layerTurns(layers: LayerSelector, value: number, lo: number, hi: number): boolean {
	const eps = 1e-6;
	switch (layers) {
		case 'hi':
			return value > hi - eps;
		case 'lo':
			return value < lo + eps;
		case 'mid':
			return value > lo + eps && value < hi - eps;
		case 'wideHi':
			return value > lo + eps;
		case 'wideLo':
			return value < hi - eps;
		case 'all':
			return true;
	}
}
