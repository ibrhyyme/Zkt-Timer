import type { VrcMove } from './types';

/**
 * Keyboard mapping. Port of twistynnn.js:348-424 and help.js:222-256.
 *
 * This is the whole point of the feature, so it is transcribed literally: the
 * same 36 keys, producing the same moves, with the same slice-offset behaviour.
 * Nothing is added and nothing is renamed.
 *
 * Note there are no double-turn keys. A double is two presses.
 */

/** Keys that shift the slice offsets rather than turning anything. */
export const KEY_OSL_DEC = 51; // '3'
export const KEY_OSL_INC = 52; // '4'
export const KEY_OSR_INC = 55; // '7'
export const KEY_OSR_DEC = 56; // '8'
export const KEY_SPACE = 32;
export const KEY_ESCAPE = 27;

export const SLICE_OFFSET_KEYS = [KEY_OSL_DEC, KEY_OSL_INC, KEY_OSR_INC, KEY_OSR_DEC, KEY_SPACE];

/** Arrow keys rotate the camera. twisty.js:195-218. Values are [dTheta, dPhi]. */
export const ARROW_CAMERA_DELTAS: Record<number, [number, number]> = {
	37: [1, 0], // left
	38: [0, 1], // up
	39: [-1, 0], // right
	40: [0, -1], // down
};

/**
 * The move key map.
 *
 * @param oSl left-hand slice offset, 1 by default
 * @param oSr right-hand slice offset, 1 by default
 * @param iSi cube dimension
 *
 * The offsets widen which layer the R/L family and the M slice address, which is
 * how one key set covers 2x2 through 11x11. They are rebuilt whenever an offset
 * changes, exactly as the reference does.
 */
export function generateCubeKeyMapping(oSl: number, oSr: number, iSi: number): Record<number, VrcMove> {
	return {
		73: [1, oSr, 'R', 1], // I  R
		75: [1, oSr, 'R', -1], // K  R'
		87: [1, 1, 'B', 1], // W  B
		79: [1, 1, 'B', -1], // O  B'
		83: [1, 1, 'D', 1], // S  D
		76: [1, 1, 'D', -1], // L  D'
		68: [1, oSl, 'L', 1], // D  L
		69: [1, oSl, 'L', -1], // E  L'
		74: [1, 1, 'U', 1], // J  U
		70: [1, 1, 'U', -1], // F  U'
		72: [1, 1, 'F', 1], // H  F
		71: [1, 1, 'F', -1], // G  F'
		186: [1, iSi, 'U', 1], // ;  y
		65: [1, iSi, 'U', -1], // A  y'
		85: [1, oSr + 1, 'R', 1], // U  r
		82: [1, oSl + 1, 'L', -1], // R  l'
		77: [1, oSr + 1, 'R', -1], // M  r'
		86: [1, oSl + 1, 'L', 1], // V  l
		84: [1, iSi, 'L', -1], // T  x
		89: [1, iSi, 'R', 1], // Y  x
		78: [1, iSi, 'R', -1], // N  x'
		66: [1, iSi, 'L', 1], // B  x'
		190: [oSr + 1, oSr + 1, 'R', 1], // .  M'
		88: [oSl + 1, oSl + 1, 'L', -1], // X  M'
		53: [oSl + 1, oSl + 1, 'L', 1], // 5  M
		54: [oSr + 1, oSr + 1, 'R', -1], // 6  M
		49: [2, iSi - 1, 'F', -1], // 1  S'
		50: [2, iSi - 1, 'U', -1], // 2  E
		57: [2, iSi - 1, 'U', 1], // 9  E'
		48: [2, iSi - 1, 'F', 1], // 0  S
		80: [1, iSi, 'F', 1], // P  z
		81: [1, iSi, 'F', -1], // Q  z'
		90: [1, 2, 'D', 1], // Z  d
		67: [1, 2, 'U', -1], // C  u'
		188: [1, 2, 'U', 1], // ,  u
		191: [1, 2, 'D', -1], // /  d'
	};
}

/**
 * Apply a slice-offset key. Returns the new offsets, clamped the way the
 * reference clamps them (twistynnn.js:399-419). Space resets both to 1.
 *
 * Returns null when the key is not an offset key, so callers can fall through.
 */
export function applySliceOffsetKey(
	keyCode: number,
	oSl: number,
	oSr: number,
	iSi: number
): { oSl: number; oSr: number } | null {
	switch (keyCode) {
		case KEY_OSL_DEC:
			return { oSl: Math.max(1, oSl - 1), oSr };
		case KEY_OSL_INC:
			return { oSl: Math.min(oSl + 1, iSi - 1), oSr };
		case KEY_OSR_INC:
			return { oSl, oSr: Math.min(oSr + 1, iSi - 1) };
		case KEY_OSR_DEC:
			return { oSl, oSr: Math.max(1, oSr - 1) };
		case KEY_SPACE:
			return { oSl: 1, oSr: 1 };
		default:
			return null;
	}
}

/**
 * Keyboard layout remapping. Port of help.js `genCodeMap` / `getMappedCode`.
 *
 * The strings are the 47 printable keys of the main block in physical order.
 * A dvorak or colemak user presses the key that sits where qwerty's 'I' sits but
 * their browser reports a different keyCode, so the map translates back by
 * physical position.
 */
export const KEYBOARD_LAYOUTS: Record<string, string> = {
	qwerty: "`1234567890-=qwertyuiop[]\\asdfghjkl;'zxcvbnm,./",
	dvorak: "`1234567890[]',.pyfgcrl/=\\aoeuidhtns-;qjkxbmwvz",
	colemak: "`1234567890-=qwfpgjluy;[]\\arstdhneio'zxcvbkm,./",
};

/** ASCII punctuation to its JS keyCode. help.js `char2code`. */
const CHAR_TO_CODE: Record<number, number> = {
	96: 192,
	45: 189,
	61: 187,
	91: 219,
	93: 221,
	92: 220,
	59: 186,
	39: 222,
	44: 188,
	46: 190,
	47: 191,
};

export type CodeMap = Record<number, number>;

/**
 * Build the remap table for a layout, which may be a known name or a raw 47-char
 * string. Returns an empty map for qwerty, making `mapKeyCode` a no-op.
 */
export function generateCodeMap(layout: string): CodeMap {
	const layout0 = KEYBOARD_LAYOUTS.qwerty.toUpperCase();
	const target = (KEYBOARD_LAYOUTS[layout] || layout).toUpperCase();

	const codeMap: CodeMap = {};
	for (let i = 0; i < layout0.length; i++) {
		let raw = layout0.charCodeAt(i);
		let cur = target.charCodeAt(i);
		raw = CHAR_TO_CODE[raw] || raw;
		cur = CHAR_TO_CODE[cur] || cur;
		if (raw !== cur) {
			codeMap[cur] = raw;
		}
		// Firefox reports semicolon as 59 rather than 186.
		if (cur === 186) {
			codeMap[59] = raw;
		}
	}
	return codeMap;
}

/** Translate a physical keyCode through the layout map. help.js:222-224. */
export function mapKeyCode(keyCode: number, codeMap: CodeMap): number {
	return codeMap[keyCode] || keyCode;
}
