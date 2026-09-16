
import tinycolor from 'tinycolor2';
import {AllSettings, getSetting} from '../../db/settings/query';
import {getAnyColorStringAsRawRgbString, getAnyColorStringAsRgbString} from '../../util/themes/theme_util';
import {normalizeSolveListColor, SOLVE_LIST_COLOR_KEYS, SOLVE_LIST_COLOR_VARS} from '../../util/themes/solve_list_colors';

const userDefinedColorsVar: Partial<Record<string, string>> = {
	primary_color: '--primary-color',
	secondary_color: '--secondary-color',
	background_color: '--background-color',
	module_color: '--module-color',
	text_color: '--text-color',
	button_color: '--button-color',
};

// localStorage key — read by the inline <head> script for FOUC prevention
const THEME_SNAPSHOT_KEY = 'zkt_theme';

// Short keys for the snapshot to keep localStorage payload tiny
const CSS_VAR_TO_SNAPSHOT_KEY: Record<string, string> = {
	'--background-color': 'bg',
	'--module-color': 'mod',
	'--button-color': 'btn',
	'--text-color': 'txt',
	'--primary-color': 'pri',
	'--secondary-color': 'sec',
};

function getHtmlTag() {
	return document.getElementsByTagName('html')[0];
}

function setDocProp(key: string, value: string) {
	getHtmlTag().style.setProperty(key, value);
}

// Theme colour keys also drive a derived "on this colour" pair (see getThemeBackgroundColor
// below) used where text sits on top of the colour itself (e.g. the active quick-settings
// tab). Shared by the persisted apply loop and the drag-preview path so both stay in sync.
const THEME_DERIVED_KEYS: (keyof AllSettings)[] = [
	'background_color',
	'module_color',
	'button_color',
	'text_color',
	'primary_color',
	'secondary_color',
];

function applyColorCssVar(key: keyof AllSettings, color: string) {
	const cssVar = userDefinedColorsVar[key];
	if (!cssVar) return;

	setDocProp(cssVar, getAnyColorStringAsRawRgbString(color));

	if (THEME_DERIVED_KEYS.includes(key)) {
		const tc = tinycolor(getAnyColorStringAsRgbString(color));
		const themeColor = getThemeBackgroundColor(tc);
		const themeColorOpposite = getThemeBackgroundColor(tc, true);
		const themeKey = key.replace('_color', '');
		setDocProp(`--theme-${themeKey}`, themeColor);
		setDocProp(`--theme-${themeKey}-opposite`, themeColorOpposite);
	}
}

function saveThemeSnapshot(isLight: boolean) {
	try {
		const html = getHtmlTag();
		const snapshot: Record<string, string | boolean> = {light: isLight};
		for (const [cssVar, shortKey] of Object.entries(CSS_VAR_TO_SNAPSHOT_KEY)) {
			const val = html.style.getPropertyValue(cssVar);
			if (val) snapshot[shortKey] = val;
		}
		localStorage.setItem(THEME_SNAPSHOT_KEY, JSON.stringify(snapshot));
	} catch (_) {
		// localStorage may not be available (private browsing edge cases)
	}
}

export function updateThemeColors() {
	getHtmlTag().classList.add('app-html');

	const colorKeys = Object.keys(userDefinedColorsVar) as (keyof AllSettings)[];

	// Always apply theme-light/dark class unconditionally — the <head> inline script may
	// have pre-filled CSS variables so the color !== currentPc check below can skip this.
	const bgColor = getSetting('background_color') as string;
	let isLight = false;
	if (bgColor && bgColor !== 'undefined') {
		const bgTc = tinycolor(getAnyColorStringAsRgbString(bgColor));
		if (bgTc.isDark()) {
			getHtmlTag().classList.remove('theme-light');
			getHtmlTag().classList.add('theme-dark');
		} else {
			isLight = true;
			getHtmlTag().classList.remove('theme-dark');
			getHtmlTag().classList.add('theme-light');
		}
	}

	for (const key of colorKeys) {
		const color = getSetting(key) as string;

		if (!color || color === 'undefined') {
			continue; // Something probably went wrong. Skip otherwise we get runtime errors.
		}

		const cssVar = userDefinedColorsVar[key];
		const currentPc = getHtmlTag().style.getPropertyValue(cssVar);

		if (color !== currentPc) {
			applyColorCssVar(key, color);
		}
	}

	applySolveListColors();

	saveThemeSnapshot(isLight);
}

// Live-preview a single theme colour while a picker is being dragged, WITHOUT touching the
// settings store: no local-db write, no server sync, no localStorage theme snapshot. Used
// by ThemeOptions so dragging a colour slider repaints the app instantly but only persists
// (via setSetting -> updateThemeColors, which reapplies the same variable) once the picker
// closes. Writing to the store on every drag step used to fire a server mutation per pixel.
export function previewThemeColor(key: keyof AllSettings, colorRgb: string) {
	if (!colorRgb) return;
	applyColorCssVar(key, colorRgb);
}

// The solve list colours are optional overrides (see util/themes/solve_list_colors.ts).
// Unlike the theme colours above, an unset one has to REMOVE its variable: the list's
// stylesheet falls back to the theme colour only while the variable is absent. They
// stay out of the head snapshot, since the list only renders once the app has loaded.
function applySolveListColors() {
	const html = getHtmlTag();
	for (const key of SOLVE_LIST_COLOR_KEYS) {
		const cssVar = SOLVE_LIST_COLOR_VARS[key];
		const rgb = normalizeSolveListColor(getSetting(key));
		if (rgb) {
			html.style.setProperty(cssVar, rgb);
		} else {
			html.style.removeProperty(cssVar);
		}
	}
}

function getThemeBackgroundColor(color: tinycolorInstance, opposite: boolean = false): string {
	if ((color.isDark() && !opposite) || (!color.isDark() && opposite)) {
		return '0, 0, 0';
	} else {
		return '255, 255, 255';
	}
}
