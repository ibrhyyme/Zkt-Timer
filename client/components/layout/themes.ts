
import tinycolor from 'tinycolor2';
import {AllSettings, getSetting} from '../../db/settings/query';
import {getAnyColorStringAsRawRgbString, getAnyColorStringAsRgbString} from '../../util/themes/theme_util';

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
			setDocProp(cssVar, getAnyColorStringAsRawRgbString(color));

			const themeKeys = [
				'background_color',
				'module_color',
				'button_color',
				'text_color',
				'primary_color',
				'secondary_color',
			];
			if (themeKeys.includes(key)) {
				const tc = tinycolor(getAnyColorStringAsRgbString(color));

				const themeColor = getThemeBackgroundColor(tc);
				const themeColorOpposite = getThemeBackgroundColor(tc, true);
				const themeKey = key.replace('_color', '');

				setDocProp(`--theme-${themeKey}`, themeColor);
				setDocProp(`--theme-${themeKey}-opposite`, themeColorOpposite);
			}
		}
	}

	saveThemeSnapshot(isLight);
}

function getThemeBackgroundColor(color: tinycolorInstance, opposite: boolean = false): string {
	if ((color.isDark() && !opposite) || (!color.isDark() && opposite)) {
		return '0, 0, 0';
	} else {
		return '255, 255, 255';
	}
}
