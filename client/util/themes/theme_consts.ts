export const Preset = [
	'dark',
	'light',
	'tokyo',
	'norman',
	'save_the_bees',
	'night_owl',
	'cyberpunk',
	'phd_student',
	'graphite',
	'forest',
	'wine',
	'ember',
	'slate',
	'plum',
	'abyss',
	'mono',
	'paper',
	'mint',
	'sky',
	'rose',
	'lavender',
] as const;
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
	name: string;
	proOnly?: boolean;
}
export type PresetThemeValues = Record<PresetKey, PresetTheme>;

export const APP_THEME_PRESETS: PresetThemeValues = {
	dark: {
		name: 'Dark',
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
		values: {
			background_color: '255, 255, 255',
			button_color: '212, 212, 212',
			module_color: '242, 243, 245',
			primary_color: '36, 107, 253',
			secondary_color: '65, 176, 88',
			text_color: '26, 29, 33',
		},
	},
	cyberpunk: {
		name: 'Cyberpunk',
		proOnly: true,
		values: {
			background_color: '0, 0, 0',
			button_color: '28, 49, 35',
			module_color: '0, 7, 1',
			primary_color: '240, 255, 43',
			secondary_color: '30, 255, 242',
			text_color: '86, 255, 75',
		},
	},
	tokyo: {
		name: 'Tokyo',
		proOnly: true,
		values: {
			background_color: '26, 27, 39',
			button_color: '43, 45, 82',
			module_color: '22, 22, 31',
			primary_color: '255, 66, 15',
			secondary_color: '135, 100, 235',
			text_color: '255, 255, 255',
		},
	},
	norman: {
		name: 'Norman',
		proOnly: true,
		values: {
			background_color: '41, 45, 62',
			button_color: '108, 141, 212',
			module_color: '36, 40, 55',
			primary_color: '126, 87, 194',
			secondary_color: '248, 197, 103',
			text_color: '255, 255, 255',
		},
	},
	save_the_bees: {
		name: 'Save the Bees',
		proOnly: true,
		values: {
			background_color: '241, 243, 245',
			button_color: '193, 204, 216',
			module_color: '222, 226, 228',
			primary_color: '255, 195, 80',
			secondary_color: '55, 158, 255',
			text_color: '3, 10, 63',
		},
	},
	night_owl: {
		name: 'Night Owl',
		proOnly: true,
		values: {
			background_color: '1, 22, 39',
			button_color: '14, 80, 134',
			module_color: '1, 18, 32',
			primary_color: '49, 145, 181',
			secondary_color: '255, 198, 93',
			text_color: '255, 255, 255',
		},
	},
	phd_student: {
		name: 'The PhD Student',
		proOnly: true,
		values: {
			background_color: '254, 63, 255',
			button_color: '144, 78, 0',
			module_color: '0, 13, 255',
			primary_color: '0, 36, 109',
			secondary_color: '89, 255, 123',
			text_color: '255, 228, 7',
		},
	},
	graphite: {
		name: 'Graphite',
		proOnly: true,
		values: {
			background_color: '24, 24, 27',
			button_color: '39, 39, 43',
			module_color: '17, 17, 19',
			primary_color: '245, 158, 11',
			secondary_color: '74, 222, 128',
			text_color: '244, 244, 245',
		},
	},
	forest: {
		name: 'Forest',
		proOnly: true,
		values: {
			background_color: '15, 27, 23',
			button_color: '27, 44, 38',
			module_color: '10, 19, 16',
			primary_color: '52, 211, 153',
			secondary_color: '250, 204, 21',
			text_color: '236, 245, 240',
		},
	},
	wine: {
		name: 'Wine',
		proOnly: true,
		values: {
			background_color: '32, 17, 24',
			button_color: '52, 28, 39',
			module_color: '23, 12, 17',
			primary_color: '244, 114, 182',
			secondary_color: '125, 211, 252',
			text_color: '252, 240, 245',
		},
	},
	ember: {
		name: 'Ember',
		proOnly: true,
		values: {
			background_color: '28, 20, 16',
			button_color: '46, 33, 27',
			module_color: '20, 14, 11',
			primary_color: '251, 146, 60',
			secondary_color: '134, 239, 172',
			text_color: '250, 240, 232',
		},
	},
	slate: {
		name: 'Slate',
		proOnly: true,
		values: {
			background_color: '30, 36, 46',
			button_color: '45, 54, 68',
			module_color: '22, 27, 35',
			primary_color: '125, 211, 252',
			secondary_color: '253, 186, 116',
			text_color: '235, 240, 246',
		},
	},
	plum: {
		name: 'Plum',
		proOnly: true,
		values: {
			background_color: '30, 20, 44',
			button_color: '49, 34, 71',
			module_color: '22, 14, 33',
			primary_color: '192, 132, 252',
			secondary_color: '94, 234, 212',
			text_color: '243, 237, 252',
		},
	},
	abyss: {
		name: 'Abyss',
		proOnly: true,
		values: {
			background_color: '8, 28, 34',
			button_color: '17, 46, 54',
			module_color: '5, 20, 25',
			primary_color: '45, 212, 191',
			secondary_color: '253, 224, 71',
			text_color: '226, 244, 246',
		},
	},
	mono: {
		name: 'Mono',
		proOnly: true,
		values: {
			background_color: '10, 10, 10',
			button_color: '32, 32, 32',
			module_color: '0, 0, 0',
			primary_color: '245, 245, 245',
			secondary_color: '163, 163, 163',
			text_color: '245, 245, 245',
		},
	},
	paper: {
		name: 'Paper',
		proOnly: true,
		values: {
			background_color: '250, 247, 240',
			button_color: '228, 221, 206',
			module_color: '242, 237, 226',
			primary_color: '180, 83, 9',
			secondary_color: '20, 108, 52',
			text_color: '41, 37, 31',
		},
	},
	mint: {
		name: 'Mint',
		proOnly: true,
		values: {
			background_color: '238, 247, 243',
			button_color: '205, 227, 217',
			module_color: '226, 240, 234',
			primary_color: '4, 120, 87',
			secondary_color: '30, 64, 175',
			text_color: '12, 38, 30',
		},
	},
	sky: {
		name: 'Sky',
		proOnly: true,
		values: {
			background_color: '238, 244, 251',
			button_color: '205, 219, 236',
			module_color: '226, 235, 246',
			primary_color: '29, 78, 216',
			secondary_color: '180, 83, 9',
			text_color: '15, 30, 54',
		},
	},
	rose: {
		name: 'Rose',
		proOnly: true,
		values: {
			background_color: '252, 241, 244',
			button_color: '236, 208, 218',
			module_color: '247, 229, 235',
			primary_color: '190, 24, 93',
			secondary_color: '14, 116, 144',
			text_color: '62, 15, 34',
		},
	},
	lavender: {
		name: 'Lavender',
		proOnly: true,
		values: {
			background_color: '243, 240, 252',
			button_color: '216, 208, 240',
			module_color: '234, 229, 248',
			primary_color: '109, 40, 217',
			secondary_color: '4, 120, 87',
			text_color: '33, 22, 64',
		},
	},
};

const DEFAULT_THEME: PresetKey = 'dark';

export function coercePresetKey(k?: string | null): PresetKey {
	if (k && Preset.includes(k as PresetKey)) return k as PresetKey;
	return DEFAULT_THEME;
}
