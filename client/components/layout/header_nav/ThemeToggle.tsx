import React from 'react';
import { Sun, Moon } from 'phosphor-react';
import tinycolor from 'tinycolor2';
import block from '../../../styles/bem';
import './ThemeToggle.scss';
import { useSettings } from '../../../util/hooks/useSettings';
import { setSetting } from '../../../db/settings/update';
import { APP_THEME_PRESETS } from '../../../util/themes/theme_consts';
import { getAnyColorStringAsRgbString } from '../../../util/themes/theme_util';

const b = block('theme-toggle');

// Quick light/dark switch for the desktop header. Applies the free `light`/`dark`
// presets through the SAME path as the settings page (setSetting per color), so the
// change is live (updateThemeColors listens on settingsDbUpdatedEvent) and global
// (setSetting persists to the server). Mirrors ThemeOption.selectTheme().
function applyPreset(preset: 'light' | 'dark') {
	const values = APP_THEME_PRESETS[preset].values;
	for (const key of Object.keys(values)) {
		setSetting(key as any, (values as any)[key]);
	}
}

export default function ThemeToggle() {
	const bg = useSettings('background_color') as string;

	// Active mode from background luminance — works even on a Pro theme (a dark Pro
	// theme reads as dark, so the moon shows and one click drops to the light preset).
	const isLight = bg && bg !== 'undefined'
		? tinycolor(getAnyColorStringAsRgbString(bg)).isLight()
		: false;

	return (
		<button
			type="button"
			className={b()}
			aria-label={isLight ? 'Switch to dark theme' : 'Switch to light theme'}
			onClick={() => applyPreset(isLight ? 'dark' : 'light')}
		>
			{isLight ? <Sun weight="fill" size={18} /> : <Moon weight="fill" size={18} />}
		</button>
	);
}
