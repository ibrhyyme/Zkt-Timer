import {APP_THEME_PRESETS} from './theme_consts';

/**
 * Where the user's own theme does not apply (E-106, owner's rule): the login and
 * signup scene, the landing page and the link-in-bio page (/links) always wear the
 * default dark theme, whatever the user picked, and a visitor who is not signed in
 * has no theme to pick at all.
 *
 * The same pattern is inlined in the <head> snapshot script (server/html_template.ts,
 * build-native-bundle.js), so a stored light snapshot is not painted on these pages
 * before the app starts. Keep the three in step.
 */
export const FIXED_THEME_PATH = /^\/(login|signup|wca-signup|zkt-signup|welcome|links)(\/|$)/;

export const LOCKED_THEME_COLORS = APP_THEME_PRESETS.dark.values;

export type ThemeColorKey = keyof typeof LOCKED_THEME_COLORS;

export function isFixedThemePath(pathname: string | null | undefined): boolean {
	return FIXED_THEME_PATH.test(pathname || '');
}

export function isThemeLocked(pathname: string | null | undefined, signedIn: boolean): boolean {
	return !signedIn || isFixedThemePath(pathname);
}

export function isThemeColorKey(key: string): key is ThemeColorKey {
	return Object.prototype.hasOwnProperty.call(LOCKED_THEME_COLORS, key);
}
