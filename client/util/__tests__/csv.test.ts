import {buildCsv, csvCell} from '../csv';

describe('csvCell', () => {
	it('leaves plain values alone', () => {
		expect(csvCell('GAN 356')).toBe('GAN 356');
		expect(csvCell(42)).toBe('42');
		expect(csvCell(null)).toBe('');
		expect(csvCell(undefined)).toBe('');
	});

	it('quotes separators, quotes and line breaks', () => {
		expect(csvCell('a,b')).toBe('"a,b"');
		expect(csvCell('say "hi"')).toBe('"say ""hi"""');
		expect(csvCell('line\nbreak')).toBe('"line\nbreak"');
	});

	it('defuses strings a spreadsheet would run as formulas', () => {
		expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
		expect(csvCell('+1')).toBe("'+1");
		expect(csvCell('-cmd')).toBe("'-cmd");
		expect(csvCell('@SUM(A1)')).toBe("'@SUM(A1)");
	});

	it('keeps real negative numbers numeric', () => {
		expect(csvCell(-3.5)).toBe('-3.5');
	});
});

describe('buildCsv', () => {
	it('starts with a BOM and keeps Turkish letters', () => {
		const csv = buildCsv(['username', 'cube'], [['şüğıöç', 'İzmir, Iğdır']]);
		expect(csv.charCodeAt(0)).toBe(0xfeff);
		expect(csv.slice(1)).toBe('username,cube\r\nşüğıöç,"İzmir, Iğdır"');
	});
});
