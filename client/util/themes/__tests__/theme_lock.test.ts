import fs from 'fs';
import path from 'path';
import {APP_THEME_PRESETS} from '../theme_consts';
import {FIXED_THEME_PATH, isFixedThemePath, isLightThemePath, isThemeLocked, lockedThemeColors} from '../theme_lock';

// E-106: the login and signup scene and the landing page never follow the user's
// theme, and a visitor who is not signed in has no theme of their own.
describe('theme lock', () => {
	it('pins the fixed pages for a signed-in user', () => {
		for (const p of ['/login', '/signup', '/wca-signup', '/zkt-signup', '/welcome', '/signup/step']) {
			expect(isThemeLocked(p, true)).toBe(true);
		}
	});

	it('leaves every other page to the signed-in user', () => {
		for (const p of ['/timer', '/competitions', '/settings/appearance', '/welcomeback', '/loginx', '/']) {
			expect(isThemeLocked(p, true)).toBe(false);
		}
	});

	it('locks every page for a visitor', () => {
		for (const p of ['/timer', '/competitions', '/settings/appearance', '/login']) {
			expect(isThemeLocked(p, false)).toBe(true);
		}
	});

	// Owner, 2026-10-27: the landing page is white; the login scene and the rest stay dark.
	it('locks the landing page to the light theme and every other page to the dark one', () => {
		expect(lockedThemeColors('/welcome')).toEqual(APP_THEME_PRESETS.light.values);
		for (const p of ['/login', '/signup', '/links', '/timer', '/welcomeback', '/']) {
			expect(isLightThemePath(p)).toBe(false);
			expect(lockedThemeColors(p)).toEqual(APP_THEME_PRESETS.dark.values);
		}
	});

	// The <head> snapshot script runs before the bundle, so it carries its own copy of
	// the list. A page added to one place and not the others would flash the user's
	// theme on load (or never show it).
	it('the head snapshot scripts skip exactly the fixed pages', () => {
		const root = path.resolve(__dirname, '../../../..');
		const pages = FIXED_THEME_PATH.source.match(/\(([^)]*)\)/)[1].split('|');
		for (const file of ['server/html_template.ts', 'build-native-bundle.js']) {
			const src = fs.readFileSync(path.join(root, file), 'utf8');
			const list = src.match(/_p=location\.pathname\.split\('\/'\)\[1\];if\(_t&&\[([^\]]*)\]/);
			expect(list).not.toBeNull();
			const inline = list[1].split(',').map((s) => s.trim().replace(/'/g, ''));
			expect(inline.sort()).toEqual([...pages].sort());
		}
		for (const page of pages) expect(isFixedThemePath(`/${page}`)).toBe(true);
	});
});
