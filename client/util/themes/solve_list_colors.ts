import {AllSettings} from '../../db/settings/query';
import {getAnyColorStringAsRgb} from './theme_util';

/**
 * The two solve list colours (Appearance > Lists): a normal time and a PB.
 *
 * Each is an optional override of a theme colour. Unset (null) it follows the theme,
 * which is what the list always did: a time in the secondary colour, a PB in the
 * primary one. themes.ts turns a set colour into the CSS variable below, and
 * HistorySolveRow.scss reads that variable with the theme colour as its fallback, so a
 * cleared setting has to remove the variable rather than write something into it.
 */

export type SolveListColorKey = 'solve_time_color' | 'solve_pb_color';

export const SOLVE_LIST_COLOR_KEYS: SolveListColorKey[] = ['solve_time_color', 'solve_pb_color'];

export const SOLVE_LIST_COLOR_VARS: Record<SolveListColorKey, string> = {
	solve_time_color: '--solve-time-color',
	solve_pb_color: '--solve-pb-color',
};

/** The theme colour each one falls back to while unset. */
export const SOLVE_LIST_COLOR_THEME_FALLBACK: Record<SolveListColorKey, keyof AllSettings> = {
	solve_time_color: 'secondary_color',
	solve_pb_color: 'primary_color',
};

/**
 * Below this contrast against the module colour the settings row warns. Deliberately
 * low: the default green on the light theme's modules sits around 2.5 and reads fine,
 * so this only catches a colour that all but disappears (yellow on white is about 1.1).
 */
export const SOLVE_LIST_MIN_CONTRAST = 2;

/**
 * A stored or picked colour as the "r, g, b" triplet the theme variables hold, or null
 * when there is nothing usable (unset, empty, or not a colour).
 */
export function normalizeSolveListColor(value: unknown): string | null {
	const rgb = parseRgb(value);
	return rgb ? rgb.join(', ') : null;
}

function parseRgb(value: unknown): [number, number, number] | null {
	if (typeof value !== 'string' || !value.trim()) {
		return null;
	}

	let rgb: {r: number; g: number; b: number} | null = null;
	try {
		rgb = getAnyColorStringAsRgb(value.trim());
	} catch {
		return null;
	}

	if (!rgb || ![rgb.r, rgb.g, rgb.b].every((c) => Number.isInteger(c) && c >= 0 && c <= 255)) {
		return null;
	}

	return [rgb.r, rgb.g, rgb.b];
}

// WCAG 2 relative luminance
function luminance([r, g, b]: [number, number, number]): number {
	const channel = (c: number) => {
		const s = c / 255;
		return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
	};
	return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio (1 to 21) between two colours in any form normalizeSolveListColor accepts. */
export function solveListColorContrast(color: unknown, background: unknown): number | null {
	const fg = parseRgb(color);
	const bg = parseRgb(background);
	if (!fg || !bg) {
		return null;
	}
	const a = luminance(fg);
	const b = luminance(bg);
	return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
