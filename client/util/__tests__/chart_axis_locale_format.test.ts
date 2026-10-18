import {labelStride, pickTimeAxisTicks} from '../chart_axis';
import {
	durationUnits,
	formatDayMonth,
	formatDurationText,
	formatInteger,
	formatPercent,
	formatShortDate,
	intlLocale,
} from '../locale_format';

describe('pickTimeAxisTicks', () => {
	it('keeps whole seconds above 10 s so labels do not repeat (2.7-f)', () => {
		const {values, decimals} = pickTimeAxisTicks([11, 11.5, 12, 12.5, 13, 13.5, 14]);
		expect(values).toEqual([11, 12, 13, 14]);
		expect(decimals).toBe(0);
	});

	it('uses one decimal for half-second steps below 10 s', () => {
		const {values, decimals} = pickTimeAxisTicks([7, 7.5, 8, 8.5]);
		expect(values).toEqual([7, 7.5, 8, 8.5]);
		expect(decimals).toBe(1);
	});

	it('falls back to the step when there are not two whole ticks', () => {
		expect(pickTimeAxisTicks([10.2, 10.4, 10.6, 10.8]).decimals).toBe(1);
		expect(pickTimeAxisTicks([1.05, 1.1, 1.15]).decimals).toBe(2);
		expect(pickTimeAxisTicks([]).values).toEqual([]);
	});
});

describe('labelStride', () => {
	it('thins long range labels on narrow bars', () => {
		// "13.3-15.4" is 9 characters, about 65 px, on 40 px bars: every second label
		expect(labelStride(['13.3-15.4', '15.4-17.5'], 40)).toBe(2);
	});

	it('shows every label when they fit', () => {
		expect(labelStride(['24.09', '25.09'], 60)).toBe(1);
		expect(labelStride([], 10)).toBe(1);
	});
});

describe('locale_format', () => {
	it('groups thousands the Turkish way in Turkish, whatever the browser', () => {
		expect(formatInteger(12450, 'tr')).toBe('12.450');
		expect(formatInteger(12450, 'en')).toBe('12,450');
	});

	it('writes percentages the Turkish way', () => {
		expect(formatPercent(0.2, 'tr')).toBe('%0,2');
		expect(formatPercent(0, 'tr')).toBe('%0');
		expect(formatPercent(0.2, 'en')).toBe('0.2%');
	});

	it('writes dates day first in Turkish', () => {
		const date = new Date(2023, 8, 15);
		expect(formatShortDate(date, 'tr')).toBe('15.09.2023');
		expect(formatShortDate(date, 'en')).toBe('09/15/2023');
		// CLDR's Turkish day-month pattern is dd/MM; what matters is the day coming first
		expect(formatDayMonth(date, 'tr')).toMatch(/^15\D09$/);
	});

	it('maps region tags and unknown languages', () => {
		expect(intlLocale('tr-TR')).toBe('tr-TR');
		expect(intlLocale('de')).toBe('en-US');
	});

	it('picks at most three units and drops seconds past an hour', () => {
		const day = 86400;
		expect(durationUnits(day + 15 * 3600 + 37 * 60 + 12)).toEqual([
			{unit: 'days', value: 1},
			{unit: 'hours', value: 15},
			{unit: 'minutes', value: 37},
		]);
		expect(durationUnits(2 * 3600 + 30)).toEqual([{unit: 'hours', value: 2}]);
		expect(durationUnits(37 * 60 + 12)).toEqual([
			{unit: 'minutes', value: 37},
			{unit: 'seconds', value: 12},
		]);
		expect(durationUnits(day + 37 * 60)).toEqual([
			{unit: 'days', value: 1},
			{unit: 'minutes', value: 37},
		]);
		expect(durationUnits(0)).toEqual([{unit: 'seconds', value: 0}]);
	});

	it('keeps each number with its unit so a narrow card never leaves a unit alone', () => {
		const units: Record<string, string> = {
			'stats_page.duration_days': 'gün',
			'stats_page.duration_hours': 'sa',
			'stats_page.duration_minutes': 'dk',
			'stats_page.duration_seconds': 'sn',
		};
		const t = (key: string, o: any) => `${o.count} ${units[key]}`;
		const text = formatDurationText(86400 + 22 * 3600 + 40 * 60, t);
		expect(text).toBe('1\u00A0gün 22\u00A0sa 40\u00A0dk');
		expect(text.split(' ')).toEqual(['1\u00A0gün', '22\u00A0sa', '40\u00A0dk']);
	});
});
