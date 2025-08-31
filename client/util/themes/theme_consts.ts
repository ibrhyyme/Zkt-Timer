export const Preset = ['dark', 'light'] as const;
export type PresetKey = typeof Preset[number];

export interface PresetTheme {
	values: {
		primary_color: string;
		secondary_color: string;
		text_color: string;
		background_color: string;
		button_color: string;
		module_color: string;
	};
	proOnly: boolean;
	name: string;
}
export type PresetThemeValues = Record<PresetKey, PresetTheme>;

export const APP_THEME_PRESETS: PresetThemeValues = {
	dark: {
		name: 'Dark',
		proOnly: false,
		values: {
			background_color: '18, 20, 28',
			button_color: '30, 36, 44',
			module_color: '12, 13, 23',
			primary_color: '36, 107, 253',
			secondary_color: '65, 176, 88',
			text_color: '255, 255, 255',
		},
	},
	light: {
		name: 'Light',
		proOnly: false,
		values: {
			background_color: '255, 255, 255',
			button_color: '212, 212, 212',
			module_color: '242, 243, 245',
			primary_color: '36, 107, 253',
			secondary_color: '65, 176, 88',
			text_color: '26, 29, 33',
		},
	},
};

const DEFAULT_THEME: PresetKey = 'dark';
export const LEGACY_KEYS = new Set([
  'tokyo','norman','save_the_bees','night_owl','cyberpunk','phd_student'
]);

export function coercePresetKey(k?: string | null): PresetKey {
  if (k === 'light' || k === 'dark') return k;
  return DEFAULT_THEME;
}
