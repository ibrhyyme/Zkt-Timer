/**
 * Sticker palette for the 3D cube views (our engine, cube_view/render/).
 *
 * The cubes are painted with the user's NxN face colours (useCubePalette); this is the shape
 * the renderer takes them in, and the app's own palette for anything not set.
 *
 * Until 2026-10-30 this file also recoloured cubing.js's PG3D colour buffer in place
 * (recolorPuzzle), since that renderer has no colour option. Every 2x2-7x7 view now draws
 * with our engine and the other puzzles never used it, so that code was removed.
 */

export type FaceColor = 'white' | 'yellow' | 'green' | 'blue' | 'red' | 'orange';
type RGB = readonly [number, number, number];
export type StickerPalette = Record<FaceColor, RGB>;

/** What the stickers are painted. Warm off-white rather than pure white, and no neon. */
export const STICKER_PALETTE: StickerPalette = {
	white: [236, 232, 226],
	yellow: [255, 230, 42],
	green: [26, 190, 87],
	blue: [61, 124, 224],
	red: [235, 66, 66],
	orange: [255, 128, 31],
};

/**
 * Turn the user's NxN face colours into the shape the renderer works in.
 *
 * The mapping is fixed, not guessed: the white sticker is always the U face, red always R,
 * and so on. That is what lets a user who paints "U" black end up with a black top face
 * rather than a black-ish everything. A colour that is not #rrggbb falls back to the palette's.
 *
 * Input order is palette.ts's NXN_FACES: U R F D L B.
 */
export function stickerPaletteFromFaceColors(hexes: string[]): StickerPalette {
	const rgb = (hex: string, fallback: RGB): RGB => {
		const n = /^#[0-9a-fA-F]{6}$/.test(hex || '') ? parseInt(hex.slice(1), 16) : -1;
		return n < 0 ? fallback : [(n >> 16) & 255, (n >> 8) & 255, n & 255];
	};
	return {
		white: rgb(hexes[0], STICKER_PALETTE.white),
		red: rgb(hexes[1], STICKER_PALETTE.red),
		green: rgb(hexes[2], STICKER_PALETTE.green),
		yellow: rgb(hexes[3], STICKER_PALETTE.yellow),
		orange: rgb(hexes[4], STICKER_PALETTE.orange),
		blue: rgb(hexes[5], STICKER_PALETTE.blue),
	};
}
