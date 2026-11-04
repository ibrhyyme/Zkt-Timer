import {splitTime, timeWidthEm} from '../time_shape';

describe('splitTime', () => {
	it('splits seconds from the decimals', () => {
		expect(splitTime('12.34')).toEqual({whole: '12', point: '.', fraction: '34'});
		expect(splitTime('0.000')).toEqual({whole: '0', point: '.', fraction: '000'});
	});

	it('keeps the minutes with the whole part', () => {
		expect(splitTime('1:02.34')).toEqual({whole: '1:02', point: '.', fraction: '34'});
	});

	it('leaves words, marks and countdowns whole', () => {
		for (const text of ['DNF', '+2', '15', '12', '', 'Solving...', 'v1.2a']) {
			expect(splitTime(text)).toEqual({whole: text, point: '', fraction: ''});
		}
	});
});

describe('timeWidthEm', () => {
	it('gives a one-second time the same room as a ten-second one', () => {
		expect(timeWidthEm('1.23')).toBeCloseTo(timeWidthEm('12.34'));
		expect(timeWidthEm('0.00')).toBeCloseTo(timeWidthEm('12.34'));
	});

	it('is narrower than the plain monospace time it replaced', () => {
		// "12.34" took five full 0.6 em cells before the csTimer shape.
		expect(timeWidthEm('12.34')).toBeLessThan(0.6 * 5);
	});

	it('grows with a minute in front', () => {
		expect(timeWidthEm('1:02.34')).toBeGreaterThan(timeWidthEm('12.34'));
	});
});
