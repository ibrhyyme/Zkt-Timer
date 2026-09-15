import {
	normalizeSolveListColor,
	SOLVE_LIST_COLOR_THEME_FALLBACK,
	SOLVE_LIST_COLOR_VARS,
	SOLVE_LIST_MIN_CONTRAST,
	solveListColorContrast,
} from '../solve_list_colors';
import {APP_THEME_PRESETS} from '../theme_consts';

describe('normalizeSolveListColor', () => {
	it('gives the "r, g, b" triplet the theme variables hold', () => {
		expect(normalizeSolveListColor('65, 176, 88')).toBe('65, 176, 88');
		expect(normalizeSolveListColor('65,176,88')).toBe('65, 176, 88');
		expect(normalizeSolveListColor('#ff0000')).toBe('255, 0, 0');
	});

	it('reads unset or broken values as "follow the theme"', () => {
		expect(normalizeSolveListColor(null)).toBeNull();
		expect(normalizeSolveListColor(undefined)).toBeNull();
		expect(normalizeSolveListColor('')).toBeNull();
		expect(normalizeSolveListColor('not a colour')).toBeNull();
		expect(normalizeSolveListColor('1, 2')).toBeNull();
		expect(normalizeSolveListColor('300, 0, 0')).toBeNull();
		expect(normalizeSolveListColor(42)).toBeNull();
	});
});

describe('solve list colour fallbacks', () => {
	it('fall back to the colours the list always used', () => {
		expect(SOLVE_LIST_COLOR_THEME_FALLBACK).toEqual({
			solve_time_color: 'secondary_color',
			solve_pb_color: 'primary_color',
		});
		expect(SOLVE_LIST_COLOR_VARS.solve_time_color).toBe('--solve-time-color');
		expect(SOLVE_LIST_COLOR_VARS.solve_pb_color).toBe('--solve-pb-color');
	});
});

describe('solveListColorContrast', () => {
	const dark = APP_THEME_PRESETS.dark.values;
	const light = APP_THEME_PRESETS.light.values;

	it('does not flag the default colours on either built-in theme', () => {
		for (const theme of [dark, light]) {
			expect(solveListColorContrast(theme.secondary_color, theme.module_color)).toBeGreaterThanOrEqual(SOLVE_LIST_MIN_CONTRAST);
			expect(solveListColorContrast(theme.primary_color, theme.module_color)).toBeGreaterThanOrEqual(SOLVE_LIST_MIN_CONTRAST);
		}
	});

	it('flags a colour that all but disappears', () => {
		expect(solveListColorContrast('255, 255, 80', light.module_color)).toBeLessThan(SOLVE_LIST_MIN_CONTRAST);
		expect(solveListColorContrast('15, 16, 26', dark.module_color)).toBeLessThan(SOLVE_LIST_MIN_CONTRAST);
	});

	it('is the WCAG ratio', () => {
		expect(solveListColorContrast('255, 255, 255', '0, 0, 0')).toBeCloseTo(21, 5);
		expect(solveListColorContrast('0, 0, 0', '255, 255, 255')).toBeCloseTo(21, 5);
		expect(solveListColorContrast('#777777', '#777777')).toBeCloseTo(1, 5);
	});

	it('has nothing to say about an unusable colour', () => {
		expect(solveListColorContrast(null, dark.module_color)).toBeNull();
	});
});
