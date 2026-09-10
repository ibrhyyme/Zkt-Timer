/**
 * Sticker palette for the 3D smart-cube view.
 *
 * cubing.js's PG3D renderer ships a neon palette (pure #ffffff white, pure #ff0000
 * red, a lime #44ee00 green) that makes the cube read like a toy. It offers no public
 * option to change sticker colours, so this recolours the renderer's colour buffer
 * directly. Kept apart from the component so the buffer logic can be tested without
 * a WebGL context.
 *
 * HOW PG3D STORES COLOUR — the part that makes this safe or not:
 * Every sticker lives in one Uint8Array of raw RGB bytes (`filler.colors`), split into
 * two equal halves. The first half is what is drawn. The second half is a reference
 * copy of each sticker's original colour, and on every move PG3D repaints the drawn
 * half by `copyWithin`-ing from that reference half. So recolouring only the drawn
 * half would be undone by the first turn; recolouring BOTH halves makes the new
 * palette survive every move, which is verified in the tests below.
 *
 * This reaches into cubing.js internals, so it is written to fail closed: if the
 * buffer does not look exactly as described (a cubing.js upgrade changed the layout),
 * nothing is touched and the cube simply keeps its stock colours.
 */

export type FaceColor = 'white' | 'yellow' | 'green' | 'blue' | 'red' | 'orange';
type RGB = readonly [number, number, number];

/** What the stickers are painted. Warm off-white rather than pure white, and no neon. */
export const STICKER_PALETTE: Record<FaceColor, RGB> = {
	white: [236, 232, 226],
	yellow: [255, 230, 42],
	green: [26, 190, 87],
	blue: [61, 124, 224],
	red: [235, 66, 66],
	orange: [255, 128, 31],
};

// Idealised face colours, used only to recognise which face each of the renderer's
// stock colours belongs to. The stock colours are well-separated primaries, so each
// lands unambiguously on one of these.
const CANONICAL: Record<FaceColor, RGB> = {
	white: [255, 255, 255],
	yellow: [255, 255, 0],
	green: [0, 255, 0],
	blue: [0, 0, 255],
	red: [255, 0, 0],
	orange: [255, 128, 0],
};

const FACES = Object.keys(CANONICAL) as FaceColor[];

const key = (r: number, g: number, b: number) => (r << 16) | (g << 8) | b;

function nearestFace(r: number, g: number, b: number): FaceColor {
	let best: FaceColor = 'white';
	let bestDist = Infinity;
	for (const face of FACES) {
		const [R, G, B] = CANONICAL[face];
		const d = (r - R) ** 2 + (g - G) ** 2 + (b - B) ** 2;
		if (d < bestDist) {
			bestDist = d;
			best = face;
		}
	}
	return best;
}

/**
 * Map each of the renderer's stock colours to its palette colour, or null if the
 * buffer is not a stock six-colour cube.
 *
 * The map is keyed on the EXACT stock byte values found in the buffer, and only those
 * are ever rewritten. Matching every colour to its nearest face instead would not be
 * idempotent: the palette's own red (235,66,66) is numerically closer to orange than to
 * red, so a second pass would turn every red sticker orange. Keying on the stock values
 * means an already-recoloured buffer finds nothing to rewrite.
 */
export function buildPaletteMap(colors: Uint8Array): Map<number, RGB> | null {
	const distinct = new Map<number, RGB>();
	for (let i = 0; i + 2 < colors.length; i += 3) {
		const r = colors[i];
		const g = colors[i + 1];
		const b = colors[i + 2];
		if (r === 0 && g === 0 && b === 0) continue; // the black cube body is left alone
		distinct.set(key(r, g, b), [r, g, b]);
	}
	if (distinct.size !== FACES.length) return null;

	const map = new Map<number, RGB>();
	const claimed = new Set<FaceColor>();
	for (const [k, [r, g, b]] of distinct) {
		const face = nearestFace(r, g, b);
		// Two stock colours landing on the same face means this is not the buffer we
		// think it is (or it was already recoloured). Refuse rather than guess.
		if (claimed.has(face)) return null;
		claimed.add(face);
		map.set(k, STICKER_PALETTE[face]);
	}
	return map;
}

/**
 * Rewrite the stock colours in a PG3D colour buffer, both halves. Returns how many
 * RGB triplets changed; 0 means the buffer was left exactly as it was.
 */
export function remapColorBuffer(colors: Uint8Array): number {
	const map = buildPaletteMap(colors);
	if (!map) return 0;

	let changed = 0;
	for (let i = 0; i + 2 < colors.length; i += 3) {
		const next = map.get(key(colors[i], colors[i + 1], colors[i + 2]));
		if (!next) continue;
		colors[i] = next[0];
		colors[i + 1] = next[1];
		colors[i + 2] = next[2];
		changed++;
	}
	return changed;
}

/** The cubing.js puzzle object, found by shape because its class name is not exported. */
interface PG3DLike {
	stickers: unknown;
	filler: {colors: Uint8Array; pos: number};
	traverse: (cb: (o: any) => void) => void;
}

function findPuzzle(root: {traverse: (cb: (o: any) => void) => void}): PG3DLike | null {
	let found: PG3DLike | null = null;
	root.traverse((o: any) => {
		if (found || !o) return;
		const f = o.filler;
		if (o.stickers && f && f.colors instanceof Uint8Array && typeof f.pos === 'number') {
			found = o as PG3DLike;
		}
	});
	return found;
}

export type RecolorResult = 'applied' | 'already-applied' | 'not-found' | 'unrecognised';

/**
 * Recolour the puzzle inside a TwistyPlayer scene, once per puzzle instance.
 *
 * `done` remembers puzzles already recoloured. The puzzle is normally built once and
 * kept across resets, but if cubing.js ever rebuilds it the new instance is recoloured
 * too instead of silently reverting to neon.
 */
export function recolorPuzzle(
	root: {traverse: (cb: (o: any) => void) => void},
	done: WeakSet<object>
): RecolorResult {
	const puzzle = findPuzzle(root);
	if (!puzzle) return 'not-found';
	if (done.has(puzzle)) return 'already-applied';

	const {colors, pos} = puzzle.filler;
	// The two-halves layout is the whole reason this works. Anything else: hands off.
	if (colors.length !== pos * 2 || colors.length % 3 !== 0) {
		done.add(puzzle);
		return 'unrecognised';
	}

	const changed = remapColorBuffer(colors);
	done.add(puzzle);
	if (changed === 0) return 'unrecognised';

	// The GPU copy only refreshes when told to. Only attributes that are views onto the
	// same storage need it; the renderer's other small meshes are unrelated.
	puzzle.traverse((o: any) => {
		const attr = o?.geometry?.attributes?.color;
		if (attr && attr.array && attr.array.buffer === colors.buffer) attr.needsUpdate = true;
	});
	return 'applied';
}
