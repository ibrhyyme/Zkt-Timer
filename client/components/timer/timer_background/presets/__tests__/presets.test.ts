// The ready-made timer backgrounds: the list, the shader sources the renderer compiles,
// the theme colour parsing, and a name for every background in every language.

import fs from 'fs';
import path from 'path';
import {
	isPresetBackgroundId,
	PRESET_BACKGROUND_IDS,
	PRESET_VERTEX_SOURCE,
	presetFragmentSource,
} from '../preset_shaders';
import { isLightRgb, parseRgbTriplet } from '../theme_colors';

const LOCALES = ['tr', 'en', 'es', 'ru', 'zh'];

describe('preset background list', () => {
	it('has unique ids', () => {
		expect(new Set(PRESET_BACKGROUND_IDS).size).toBe(PRESET_BACKGROUND_IDS.length);
	});

	it('recognises its own ids only', () => {
		expect(isPresetBackgroundId('aurora')).toBe(true);
		expect(isPresetBackgroundId('Aurora')).toBe(false);
		expect(isPresetBackgroundId('')).toBe(false);
		expect(isPresetBackgroundId(null)).toBe(false);
		expect(isPresetBackgroundId(3)).toBe(false);
	});
});

describe('shader sources', () => {
	it('start with the WebGL2 version line, which must come first', () => {
		expect(PRESET_VERTEX_SOURCE.startsWith('#version 300 es\n')).toBe(true);
		for (const id of PRESET_BACKGROUND_IDS) {
			expect(presetFragmentSource(id).startsWith('#version 300 es\n')).toBe(true);
		}
	});

	it('give every background its scene and one main', () => {
		for (const id of PRESET_BACKGROUND_IDS) {
			const src = presetFragmentSource(id);
			expect(src.match(/vec3 scene\(vec2 fc\)/g)).toHaveLength(1);
			expect(src.match(/void main\(\)/g)).toHaveLength(1);
		}
	});

	it('read the noise corners through integers, so no GPU draws seams between cells', () => {
		for (const id of PRESET_BACKGROUND_IDS) {
			const src = presetFragmentSource(id);
			// Integers default to mediump in a fragment shader: 16 bits on many phones.
			expect(src).toContain('precision highp int;');
			const noise = src.slice(src.indexOf('float noise(vec2 p)'), src.indexOf('float fbm(vec2 p)'));
			expect(noise.match(/cornerHash\(/g)).toHaveLength(4);
			expect(noise).not.toMatch(/\bhash\(/);
		}
	});
});

describe('theme colours', () => {
	const fallback: [number, number, number] = [1, 2, 3];

	it('reads the triplets themes write, with or without spaces', () => {
		expect(parseRgbTriplet('18, 20, 28', fallback)).toEqual([18, 20, 28]);
		expect(parseRgbTriplet(' 255,255,255 ', fallback)).toEqual([255, 255, 255]);
	});

	it('falls back on anything else and clamps out-of-range values', () => {
		expect(parseRgbTriplet('', fallback)).toBe(fallback);
		expect(parseRgbTriplet(undefined, fallback)).toBe(fallback);
		expect(parseRgbTriplet('#ffffff', fallback)).toBe(fallback);
		expect(parseRgbTriplet('1, 2', fallback)).toBe(fallback);
		expect(parseRgbTriplet('300, -4, 10', fallback)).toEqual([255, 0, 10]);
	});

	it('tells the light themes from the dark ones', () => {
		expect(isLightRgb([255, 255, 255])).toBe(true);
		expect(isLightRgb([250, 247, 240])).toBe(true);
		expect(isLightRgb([18, 20, 28])).toBe(false);
		expect(isLightRgb([1, 22, 39])).toBe(false);
	});
});

describe('translations', () => {
	const KEYS = ['preset_bg', 'preset_bg_desc', 'preset_bg_none', 'preset_bg_motion', 'preset_bg_motion_desc'];

	it.each(LOCALES)('%s names every background and the settings rows', (lang) => {
		const file = path.join(__dirname, '../../../../../i18n/locales', lang, 'translation.json');
		const appearance = JSON.parse(fs.readFileSync(file, 'utf8')).appearance;
		for (const key of [...KEYS, ...PRESET_BACKGROUND_IDS.map((id) => `preset_bg_${id}`)]) {
			expect(typeof appearance[key]).toBe('string');
			expect(appearance[key].trim()).not.toBe('');
		}
	});
});
