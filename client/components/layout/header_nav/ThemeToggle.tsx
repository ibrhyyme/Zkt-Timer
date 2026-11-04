import React from 'react';
import { useTranslation } from 'react-i18next';
import { Sun, Moon } from 'phosphor-react';
import tinycolor from 'tinycolor2';
import block from '../../../styles/bem';
import './ThemeToggle.scss';
import { useSettings } from '../../../util/hooks/useSettings';
import { useMe } from '../../../util/hooks/useMe';
import { setSettings } from '../../../db/settings/update';
import { getSetting } from '../../../db/settings/query';
import { APP_THEME_PRESETS, PresetTheme } from '../../../util/themes/theme_consts';
import { getAnyColorStringAsRgbString } from '../../../util/themes/theme_util';

const b = block('theme-toggle');

type Mode = 'light' | 'dark';
type ThemeColors = PresetTheme['values'];

const THEME_KEYS: (keyof ThemeColors)[] = [
	'primary_color',
	'secondary_color',
	'text_color',
	'background_color',
	'button_color',
	'module_color',
];

// The last theme the user had on each side of the switch, per device. Without it the
// toggle dropped a chosen theme (Tokyo, a Pro preset, custom colours) for the plain
// Dark or Light preset, and the way back led to the plain preset too.
const MEMORY_KEY = 'zt_theme_toggle_memory';

function isLightColor(color: string): boolean {
	return tinycolor(getAnyColorStringAsRgbString(color)).isLight();
}

function readMemory(): Partial<Record<Mode, ThemeColors>> {
	try {
		const parsed = JSON.parse(localStorage.getItem(MEMORY_KEY) || '{}');
		return parsed && typeof parsed === 'object' ? parsed : {};
	} catch {
		return {};
	}
}

function writeMemory(memory: Partial<Record<Mode, ThemeColors>>) {
	try {
		localStorage.setItem(MEMORY_KEY, JSON.stringify(memory));
	} catch {
		// Storage full or blocked: the switch still works, it just falls back to the preset.
	}
}

function currentColors(): ThemeColors {
	const colors = {} as ThemeColors;
	for (const key of THEME_KEYS) {
		colors[key] = getSetting(key) as string;
	}
	return colors;
}

function isUsable(colors: ThemeColors | undefined, target: Mode): colors is ThemeColors {
	if (!colors || THEME_KEYS.some((key) => typeof colors[key] !== 'string' || !colors[key])) return false;
	return isLightColor(colors.background_color) === (target === 'light');
}

// Quick light/dark switch for the desktop header. Writes through the SAME path as the
// settings page, so the change is live (updateThemeColors listens on
// settingsDbUpdatedEvent) and global (persists to the server). Mirrors
// ThemeOption.selectTheme().
//
// All six colours go out as ONE setSettings call: they share a single prefs blob on
// the server, so writing them one by one raced and could persist half a preset (dark
// background with the light preset's near-black text = an unreadable page).
function switchTo(target: Mode) {
	const from: Mode = target === 'light' ? 'dark' : 'light';
	const memory = readMemory();
	memory[from] = currentColors();
	writeMemory(memory);

	const remembered = memory[target];
	setSettings(isUsable(remembered, target) ? remembered : APP_THEME_PRESETS[target].values);
}

export default function ThemeToggle() {
	const { t } = useTranslation();
	const me = useMe();
	const bg = useSettings('background_color') as string;

	// Active mode from background luminance — works even on a Pro theme (a dark Pro
	// theme reads as dark, so the moon shows and one click drops to the light preset).
	const isLight = bg && bg !== 'undefined' ? isLightColor(bg) : false;

	// Only an account picks a theme; a visitor stays on the fixed one (theme_lock.ts, E-106).
	if (!me) return null;

	return (
		<button
			type="button"
			className={b()}
			aria-label={isLight ? t('nav.switch_to_dark') : t('nav.switch_to_light')}
			onClick={() => switchTo(isLight ? 'dark' : 'light')}
		>
			{isLight ? <Sun weight="fill" size={18} /> : <Moon weight="fill" size={18} />}
		</button>
	);
}
