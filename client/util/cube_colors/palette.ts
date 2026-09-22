/**
 * One source for every sticker colour the app draws.
 *
 * Before this, each drawing surface carried its own hard-coded hexes: the Square-1 net, the
 * Clock face, the FTO net, the PDF export and the 3D smart-cube view all had their own, and
 * nothing connected them. A user who wanted a black Square-1 top face had nowhere to ask for
 * it. Everything a user can recolour is declared here, defaults included, so the settings
 * screen has one list to render and every renderer has one place to read.
 *
 * Shapes are flat string arrays rather than objects because that is what the settings store
 * holds (`AllSettings` values are plain JSON in the platform prefs blob) and what the
 * renderers index into. The face order of each array is fixed and documented; changing an
 * order silently repaints everyone's saved palette, so treat these as append-only.
 */

import { DEFAULT_FACE_COLORS, FACE_NAMES } from '../cubes/cube_state';

/** NxN face order, matching `cube_state.ts` and WCA convention. */
export const NXN_FACES = FACE_NAMES; // U R F D L B

/** WCA colour scheme: white top, yellow bottom, green front. */
export const DEFAULT_NXN_COLORS: string[] = NXN_FACES.map((f) => DEFAULT_FACE_COLORS[f]);

/**
 * Square-1 face order, U R F D L B.
 *
 * Its defaults are not the NxN ones: cstimer draws Square-1 held yellow-up / white-down, and
 * the port kept that so a scramble read against cstimer matches sticker for sticker.
 */
export const SQ1_FACES = ['U', 'R', 'F', 'D', 'L', 'B'] as const;
export const DEFAULT_SQ1_COLORS: string[] = ['#ffff00', '#ff8000', '#00c000', '#ffffff', '#ff0000', '#0000ff'];

/**
 * Clock has no stickers. Its five colours are the parts of the drawing, in the order the
 * settings screen lists them: dial frame, front dial face, back dial face, hand, raised pin.
 */
export const CLOCK_PARTS = ['frame', 'face_front', 'face_back', 'hand', 'pin_up'] as const;
export const DEFAULT_CLOCK_COLORS: string[] = ['#ff0000', '#3377bb', '#55ccff', '#ffff00', '#885500'];

/**
 * FTO octahedron faces in the order `poly3dlib`'s geometry numbers them: U, R, L, F, D, Bl,
 * Br, B. The defaults are cstimer's `colfto`, already remapped by that library's face map.
 */
export const FTO_FACES = ['U', 'R', 'L', 'F', 'D', 'Bl', 'Br', 'B'] as const;
export const DEFAULT_FTO_COLORS: string[] = [
	'#ffffff', '#ff0000', '#880088', '#00dd00', '#ffff00', '#ffaa00', '#bbbbbb', '#0000ff',
];

/**
 * The outline every net and dial is drawn with.
 *
 * It is a palette entry rather than a constant because of the case that prompted all of
 * this: a user turning the Square-1 white face black gets a cube whose piece borders vanish,
 * since the borders were a fixed `#000`. Making the outline settable is the only way that
 * choice stays legible.
 */
export const DEFAULT_OUTLINE_COLOR = '#000000';

export interface CubePalette {
	nxn: string[];
	sq1: string[];
	clock: string[];
	fto: string[];
	outline: string;
}

export const DEFAULT_PALETTE: CubePalette = {
	nxn: DEFAULT_NXN_COLORS,
	sq1: DEFAULT_SQ1_COLORS,
	clock: DEFAULT_CLOCK_COLORS,
	fto: DEFAULT_FTO_COLORS,
	outline: DEFAULT_OUTLINE_COLOR,
};

/**
 * What `cube_face_colors` held while it had no UI.
 *
 * The setting existed in `AllSettings` long before anything read it, and
 * `collectPlatformPrefs()` collects every platform setting whether or not it is used — so
 * this value sits saved in the prefs blob of every account created before the Colors
 * section shipped. Once the renderers started reading the setting, that saved value won
 * over the new default and those users opened the timer to a green top face.
 *
 * Nobody chose these colours: there was no way to. Matching the array exactly and handing
 * back the default is therefore safe, and it is done on read rather than by rewriting the
 * setting, so nothing is written to a user's account behind their back.
 */
const LEGACY_UNSET_NXN_COLORS = ['#43ff43', '#ff9826', '#ffffff', '#246bfd', '#ff4343', '#ffff49'];

/** Replace the never-chosen legacy array with the real default. Any other value is kept. */
export function migrateLegacyNxnColors(colors: string[]): string[] {
	const isLegacy =
		colors.length === LEGACY_UNSET_NXN_COLORS.length &&
		colors.every((c, i) => c === LEGACY_UNSET_NXN_COLORS[i]);
	return isLegacy ? DEFAULT_NXN_COLORS : colors;
}

const HEX = /^#[0-9a-fA-F]{6}$/;

/**
 * Fall back to the default for anything that is not a `#rrggbb` string, entry by entry.
 *
 * Saved settings survive app versions and arrive from another device's prefs blob, so a
 * palette can be the wrong length or hold a stale value. Repairing per entry rather than
 * rejecting the whole array means one bad colour costs one colour, not the user's scheme.
 */
export function sanitizeColors(value: unknown, defaults: string[]): string[] {
	const arr = Array.isArray(value) ? value : [];
	return defaults.map((fallback, i) => sanitizeColor(arr[i], fallback));
}

/**
 * Always lowercase, including the fallback. Callers compare these arrays against known
 * palettes (see `migrateLegacyNxnColors`), and a mix of cases in one array turns those
 * comparisons into a coin toss depending on which entries happened to be valid.
 */
export function sanitizeColor(value: unknown, fallback: string): string {
	const hex = typeof value === 'string' && HEX.test(value) ? value : fallback;
	return hex.toLowerCase();
}

/** `#rrggbb` to the packed 0xRRGGBB form the poly3d renderers index colours by. */
export function hexToInt(hex: string): number {
	return parseInt(hex.slice(1), 16);
}

/** Packed 0xRRGGBB to `#rrggbb`. */
export function intToHex(value: number): string {
	return '#' + (value & 0xffffff).toString(16).padStart(6, '0');
}

/** `#rrggbb` to the [r, g, b] byte triplet the 3D colour buffer is written in. */
export function hexToRgb(hex: string): [number, number, number] {
	const n = hexToInt(hex);
	return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
