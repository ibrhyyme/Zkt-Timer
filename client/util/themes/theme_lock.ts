import {APP_THEME_PRESETS} from './theme_consts';

/**
 * Where the user's own theme does not apply (E-106, owner's rule): the login and
 * signup scene, the landing page and the link-in-bio page (/links) always wear a fixed
 * theme, whatever the user picked, and a visitor who is not signed in has no theme to
 * pick at all.
 *
 * The same pattern is inlined in the <head> snapshot script (server/html_template.ts,
 * build-native-bundle.js), so a stored light snapshot is not painted on these pages
 * before the app starts. Keep the three in step.
 */
export const FIXED_THEME_PATH = /^\/(login|signup|wca-signup|zkt-signup|welcome|links)(\/|$)/;

/**
 * The landing page is the one fixed page on the light theme (owner, 2026-10-27: "the
 * landing page should be white"). Every other fixed page, and a visitor anywhere else,
 * stays on the default dark theme. Its stylesheet declares the same colours on the
 * page itself (Landing.scss, `--light`), so the server-rendered first paint is white
 * before this file runs.
 */
export const LIGHT_THEME_PATH = /^\/welcome(\/|$)/;

export const LOCKED_THEME_COLORS = APP_THEME_PRESETS.dark.values;

export const LOCKED_LIGHT_THEME_COLORS = APP_THEME_PRESETS.light.values;

export type ThemeColorKey = keyof typeof LOCKED_THEME_COLORS;

export function isFixedThemePath(pathname: string | null | undefined): boolean {
	return FIXED_THEME_PATH.test(pathname || '');
}

export function isLightThemePath(pathname: string | null | undefined): boolean {
	return LIGHT_THEME_PATH.test(pathname || '');
}

/** The colours a locked page wears: light on the landing page, dark everywhere else. */
export function lockedThemeColors(pathname: string | null | undefined): Record<ThemeColorKey, string> {
	return isLightThemePath(pathname) ? LOCKED_LIGHT_THEME_COLORS : LOCKED_THEME_COLORS;
}

export function isThemeLocked(pathname: string | null | undefined, signedIn: boolean): boolean {
	return !signedIn || isFixedThemePath(pathname);
}

export function isThemeColorKey(key: string): key is ThemeColorKey {
	return Object.prototype.hasOwnProperty.call(LOCKED_THEME_COLORS, key);
}
