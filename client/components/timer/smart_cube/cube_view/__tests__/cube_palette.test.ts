import {buildPaletteMap, recolorPuzzle, remapColorBuffer, STICKER_PALETTE} from '../cube_palette';

// The stock colours cubing.js 0.56's PG3D writes for a 3x3, read out of a live
// renderer. If a cubing.js upgrade changes these, the recogniser still has to land
// each on its face; these are the values to re-check first.
const STOCK = {
	white: [255, 255, 255],
	yellow: [244, 244, 0],
	red: [255, 0, 0],
	blue: [34, 102, 255],
	orange: [255, 128, 0],
	green: [68, 238, 0],
} as const;

const BLACK = [0, 0, 0];

/** A PG3D-shaped buffer: every stock colour plus black, repeated in both halves. */
function stockBuffer(): Uint8Array {
	const oneHalf = [...Object.values(STOCK), BLACK, BLACK].flat();
	return Uint8Array.from([...oneHalf, ...oneHalf]);
}

const triplet = (buf: Uint8Array, i: number) => [buf[i * 3], buf[i * 3 + 1], buf[i * 3 + 2]];

describe('buildPaletteMap', () => {
	it('maps every stock colour to its palette colour', () => {
		const map = buildPaletteMap(stockBuffer())!;
		expect(map).not.toBeNull();
		const lookup = (rgb: readonly number[]) => map.get((rgb[0] << 16) | (rgb[1] << 8) | rgb[2]);
		expect(lookup(STOCK.white)).toEqual(STICKER_PALETTE.white);
		expect(lookup(STOCK.yellow)).toEqual(STICKER_PALETTE.yellow);
		expect(lookup(STOCK.red)).toEqual(STICKER_PALETTE.red);
		expect(lookup(STOCK.blue)).toEqual(STICKER_PALETTE.blue);
		expect(lookup(STOCK.orange)).toEqual(STICKER_PALETTE.orange);
		expect(lookup(STOCK.green)).toEqual(STICKER_PALETTE.green);
	});

	it('refuses a buffer that is not a six-colour cube', () => {
		const five = Uint8Array.from([...STOCK.white, ...STOCK.red, ...STOCK.blue, ...STOCK.green, ...STOCK.orange]);
		expect(buildPaletteMap(five)).toBeNull();
	});

	it('refuses when two colours would claim the same face', () => {
		// Two different reds: this is not a stock cube, so do not guess.
		const clash = Uint8Array.from([
			...STOCK.white, ...STOCK.yellow, ...STOCK.red, 250, 5, 5, ...STOCK.blue, ...STOCK.green,
		]);
		expect(buildPaletteMap(clash)).toBeNull();
	});
});

describe('remapColorBuffer', () => {
	it('recolours both halves and leaves the black body alone', () => {
		const buf = stockBuffer();
		const perHalf = buf.length / 3 / 2;
		remapColorBuffer(buf);

		for (const half of [0, perHalf]) {
			expect(triplet(buf, half + 0)).toEqual([...STICKER_PALETTE.white]);
			expect(triplet(buf, half + 2)).toEqual([...STICKER_PALETTE.red]);
			expect(triplet(buf, half + 5)).toEqual([...STICKER_PALETTE.green]);
			expect(triplet(buf, half + 6)).toEqual(BLACK);
		}
	});

	// The palette's red (235,66,66) is numerically nearer to orange than to red. A
	// nearest-face remap run twice turned every red sticker orange; keying on the exact
	// stock values means a second pass finds nothing to do.
	it('is idempotent — a second pass changes nothing and red stays red', () => {
		const buf = stockBuffer();
		remapColorBuffer(buf);
		const after = Uint8Array.from(buf);

		expect(remapColorBuffer(buf)).toBe(0);
		expect(buf).toEqual(after);
		expect(triplet(buf, 2)).toEqual([...STICKER_PALETTE.red]);
	});

	// What PG3D does on every turn: repaint the drawn half from the reference half.
	// Recolouring only the drawn half would be wiped out by the first move.
	it('survives the renderer repainting from its reference half', () => {
		const buf = stockBuffer();
		remapColorBuffer(buf);
		const half = buf.length / 2;

		// Simulate a turn moving the "red" sticker's colour into slot 0.
		buf.copyWithin(0, half + 2 * 3, half + 3 * 3);

		expect(triplet(buf, 0)).toEqual([...STICKER_PALETTE.red]);
	});
});

describe('recolorPuzzle', () => {
	function fakeScene(colors: Uint8Array, pos: number) {
		const drawn = {array: colors.subarray(0, pos), needsUpdate: false};
		const unrelated = {array: new Uint8Array(18), needsUpdate: false};
		const puzzle = {
			stickers: {},
			filler: {colors, pos},
			traverse(cb: (o: any) => void) {
				cb(this);
				cb({geometry: {attributes: {color: drawn}}});
				cb({geometry: {attributes: {color: unrelated}}});
			},
		};
		const root = {traverse: (cb: (o: any) => void) => puzzle.traverse(cb)};
		return {root, puzzle, drawn, unrelated};
	}

	it('recolours once, then reports it is already done', () => {
		const buf = stockBuffer();
		const {root} = fakeScene(buf, buf.length / 2);
		const done = new WeakSet<object>();

		expect(recolorPuzzle(root, done)).toBe('applied');
		expect(recolorPuzzle(root, done)).toBe('already-applied');
	});

	it('flags only the GPU attributes that share the colour storage', () => {
		const buf = stockBuffer();
		const {root, drawn, unrelated} = fakeScene(buf, buf.length / 2);

		recolorPuzzle(root, new WeakSet());

		expect(drawn.needsUpdate).toBe(true);
		expect(unrelated.needsUpdate).toBe(false);
	});

	it('keeps trying while the puzzle has not been built yet', () => {
		const empty = {traverse: (cb: (o: any) => void) => cb({})};
		expect(recolorPuzzle(empty, new WeakSet())).toBe('not-found');
	});

	// A cubing.js upgrade that changes the buffer layout must leave the cube alone,
	// not scribble over memory it no longer understands.
	it('fails closed when the buffer layout is not the expected two halves', () => {
		const buf = stockBuffer();
		const before = Uint8Array.from(buf);
		const {root} = fakeScene(buf, buf.length / 3); // wrong split

		expect(recolorPuzzle(root, new WeakSet())).toBe('unrecognised');
		expect(buf).toEqual(before);
	});
});
