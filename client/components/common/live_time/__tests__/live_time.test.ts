import {rollTime, splitTime, timeWidthEm} from '../time_shape';

describe('rollTime', () => {
	it('marks only the digits that changed', () => {
		expect(rollTime('12.95', '13.24')).toEqual({
			whole: [
				{char: '1', from: null},
				{char: '3', from: '2'},
			],
			point: '.',
			fraction: [
				{char: '2', from: '9'},
				{char: '4', from: '5'},
			],
		});
	});

	it('lines the digits up from the right when the length changes', () => {
		expect(rollTime('9.50', '12.50')?.whole).toEqual([
			{char: '1', from: ''},
			{char: '2', from: '9'},
		]);
		expect(rollTime('12.50', '9.50')?.whole).toEqual([{char: '9', from: '2'}]);
		expect(rollTime('59.99', '1:03.24')?.whole).toEqual([
			{char: '1', from: ''},
			{char: ':', from: ''},
			{char: '0', from: '5'},
			{char: '3', from: '9'},
		]);
	});

	it('does not roll anything that is not a time', () => {
		expect(rollTime('DNF', '12.34')).toBeNull();
		expect(rollTime('12.34', '+2')).toBeNull();
		expect(rollTime('15', '14')).toBeNull();
	});
});

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
