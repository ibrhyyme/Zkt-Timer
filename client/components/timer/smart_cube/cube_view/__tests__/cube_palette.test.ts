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
	const STOCK_HEX = Object.values(STOCK).map(([r, g, b]) => (r << 16) | (g << 8) | b);
	const hexOf = (rgb: readonly number[]) => (rgb[0] << 16) | (rgb[1] << 8) | rgb[2];

	// One PG3D sticker, with the renderer's own dim rule reduced to its shape: half
	// brightness for every colour, except pure white, which gets a light grey.
	function fakeStickerDef(origColor: number) {
		return {
			origColor,
			maskColor: origColor,
			setStickeringMask(_filler: unknown, faceletMask: string) {
				if (faceletMask !== 'dim') this.maskColor = this.origColor;
				else this.maskColor = this.origColor === 0xffffff ? 0xdddddd : (this.origColor >> 1) & 0x7f7f7f;
			},
		};
	}

	// Shaped like cubing.js's PG3D: stickers[orbit][orientation][piece], each with the
	// stock colour it was built from, plus the two-halves colour buffer.
	function fakeScene(colors: Uint8Array, pos: number, opts: {mask?: object} = {}) {
		const drawn = {array: colors.subarray(0, pos), needsUpdate: false};
		const unrelated = {array: new Uint8Array(18), needsUpdate: false};
		const defs = STOCK_HEX.map(fakeStickerDef);
		const setStickeringMask = jest.fn();
		const puzzle: any = {
			stickers: {CORNERS: [defs.slice(0, 3)], EDGES: [defs.slice(3)]},
			filler: {colors, pos},
			params: opts.mask ? {stickeringMask: opts.mask} : {},
			setStickeringMask,
			traverse(cb: (o: any) => void) {
				cb(this);
				cb({geometry: {attributes: {color: drawn}}});
				cb({geometry: {attributes: {color: unrelated}}});
			},
		};
		const root = {traverse: (cb: (o: any) => void) => puzzle.traverse(cb)};
		return {root, puzzle, defs, drawn, unrelated, setStickeringMask};
	}

	it('recolours once, then reports it is already done', () => {
		const buf = stockBuffer();
		const {root} = fakeScene(buf, buf.length / 2);
		const done = new WeakSet<object>();

		expect(recolorPuzzle(root, done)).toBe('applied');
		expect(recolorPuzzle(root, done)).toBe('already-applied');
	});

	// Every repaint and every stickering mask is derived from origColor, so it has to
	// carry the new palette too, not just the bytes on screen.
	it("rewrites each sticker's source colour to the palette", () => {
		const buf = stockBuffer();
		const {root, defs} = fakeScene(buf, buf.length / 2);

		recolorPuzzle(root, new WeakSet());

		const red = defs[Object.keys(STOCK).indexOf('red')];
		expect(red.origColor).toBe(hexOf(STICKER_PALETTE.red));
		expect(defs.every((d) => !STOCK_HEX.includes(d.origColor))).toBe(true);
	});

	it('flags only the GPU attributes that share the colour storage', () => {
		const buf = stockBuffer();
		const {root, drawn, unrelated} = fakeScene(buf, buf.length / 2);

		recolorPuzzle(root, new WeakSet());

		expect(drawn.needsUpdate).toBe(true);
		expect(unrelated.needsUpdate).toBe(false);
	});

	// The trainer greys out irrelevant stickers with a mask. PG3D recomputes masked
	// colours from origColor, so the fix is to patch origColor FIRST and then re-apply
	// the same mask — the renderer then regenerates everything from the new palette.
	it('re-applies an active stickering mask after patching the source colours', () => {
		const buf = stockBuffer();
		const mask = {orbits: {}};
		const {root, defs, setStickeringMask} = fakeScene(buf, buf.length / 2, {mask});

		let coloursAtCall: number[] = [];
		setStickeringMask.mockImplementation(() => {
			coloursAtCall = defs.map((d) => d.origColor);
		});

		expect(recolorPuzzle(root, new WeakSet())).toBe('applied');
		expect(setStickeringMask).toHaveBeenCalledWith(mask);
		// Patched before the mask was re-applied, or it would regenerate neon.
		expect(coloursAtCall.every((c) => !STOCK_HEX.includes(c))).toBe(true);
	});

	// PLL with white on top (the trainer's default) dims the whole top face. The
	// renderer's light grey for dimmed white only fires for pure white; without help the
	// off-white palette would turn that face a flat mid-grey.
	describe('dimmed white', () => {
		const WHITE = Object.keys(STOCK).indexOf('white');
		const RED = Object.keys(STOCK).indexOf('red');

		function maskedScene(faceletMask: string) {
			const buf = stockBuffer();
			const scene = fakeScene(buf, buf.length / 2, {mask: {orbits: {}}});
			// What PG3D.setStickeringMask does: every sticker recomputes its colour.
			scene.setStickeringMask.mockImplementation(() => {
				for (const d of scene.defs) d.setStickeringMask(null, faceletMask);
			});
			return scene;
		}

		it("keeps the renderer's light grey instead of going mid-grey", () => {
			const {root, defs} = maskedScene('dim');
			recolorPuzzle(root, new WeakSet());

			expect(defs[WHITE].maskColor).toBe(0xdddddd);
			// Only borrowed for the calculation: the sticker is still the palette white.
			expect(defs[WHITE].origColor).toBe(hexOf(STICKER_PALETTE.white));
		});

		it('still holds when the trainer later switches to another case', () => {
			const {root, defs, setStickeringMask} = maskedScene('dim');
			recolorPuzzle(root, new WeakSet());
			defs[WHITE].maskColor = 0;

			setStickeringMask({orbits: {}});

			expect(defs[WHITE].maskColor).toBe(0xdddddd);
		});

		it('leaves other colours and undimmed white to the palette', () => {
			const dimmed = maskedScene('dim');
			recolorPuzzle(dimmed.root, new WeakSet());
			expect(dimmed.defs[RED].maskColor).toBe((hexOf(STICKER_PALETTE.red) >> 1) & 0x7f7f7f);

			const regular = maskedScene('regular');
			recolorPuzzle(regular.root, new WeakSet());
			expect(regular.defs[WHITE].maskColor).toBe(hexOf(STICKER_PALETTE.white));
		});
	});

	it('does not touch the buffer directly when a mask will regenerate it', () => {
		const buf = stockBuffer();
		const before = Uint8Array.from(buf);
		const {root} = fakeScene(buf, buf.length / 2, {mask: {orbits: {}}});

		recolorPuzzle(root, new WeakSet());

		expect(buf).toEqual(before);
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
		const {root, defs} = fakeScene(buf, buf.length / 3); // wrong split

		expect(recolorPuzzle(root, new WeakSet())).toBe('unrecognised');
		expect(buf).toEqual(before);
		expect(defs.map((d) => d.origColor)).toEqual(STOCK_HEX);
	});

	// Sticker source colours that are not a stock six-colour set (e.g. a puzzle that was
	// already recoloured by another path) must be left exactly as they are.
	it('leaves an unrecognised colour set untouched', () => {
		const buf = stockBuffer();
		const {root, defs} = fakeScene(buf, buf.length / 2);
		for (const d of defs) d.origColor = hexOf(STICKER_PALETTE.red);

		expect(recolorPuzzle(root, new WeakSet())).toBe('unrecognised');
		expect(defs.every((d) => d.origColor === hexOf(STICKER_PALETTE.red))).toBe(true);
	});
});
