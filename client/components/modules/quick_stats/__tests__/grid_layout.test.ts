import { fitValueFontSize, pickStatsGrid } from '../grid_layout';

describe('pickStatsGrid', () => {
	it('puts every block in a row, only the last one shorter', () => {
		for (let count = 1; count <= 16; count++) {
			const { columns, rows } = pickStatsGrid(count, 520, 300);
			expect(rows.reduce((a, b) => a + b, 0)).toBe(count);
			expect(rows.slice(0, -1).every((r) => r === columns)).toBe(true);
			expect(rows[rows.length - 1]).toBeLessThanOrEqual(columns);
		}
	});

	it('lays a wide module out in more columns than a tall one', () => {
		const wide = pickStatsGrid(8, 900, 180);
		const tall = pickStatsGrid(8, 260, 600);
		expect(wide.columns).toBeGreaterThan(tall.columns);
		expect(wide.columns).toBe(4);
		// One column of eight rows gives larger digits here (37px) than two columns (32px)
		expect(tall.columns).toBe(1);
	});

	it('never makes cells narrower than the longest caption, except in one column', () => {
		// 360px fits three columns by the numbers alone, which cut "Session best ao12" short
		expect(pickStatsGrid(8, 360, 250).columns).toBe(3);
		expect(pickStatsGrid(8, 360, 250, 0, 150).columns).toBe(2);
		expect(pickStatsGrid(8, 200, 600, 0, 400).columns).toBe(1);
	});

	it('lets captions truncate rather than shrink the values below a readable size', () => {
		// Whole captions would mean one column of eight 29px rows: 12px digits
		expect(pickStatsGrid(8, 250, 234, 0, 150).columns).toBe(2);
	});

	it('falls back to two columns before the module is measured', () => {
		expect(pickStatsGrid(8, 0, 0)).toEqual({ columns: 2, rows: [2, 2, 2, 2] });
		expect(pickStatsGrid(1, 0, 0)).toEqual({ columns: 1, rows: [1] });
		expect(pickStatsGrid(0, 400, 300)).toEqual({ columns: 0, rows: [] });
	});

	it('prefers a full grid when several counts reach the same font', () => {
		// A large module reaches the font cap with 2 or 3 columns; 2 leaves no empty slot.
		const { columns, rows } = pickStatsGrid(4, 1600, 1200);
		expect(columns).toBe(2);
		expect(rows).toEqual([2, 2]);
	});
});

describe('fitValueFontSize', () => {
	it('shrinks for a longer value and stays within its bounds', () => {
		expect(fitValueFontSize(200, 120, 7)).toBeLessThan(fitValueFontSize(200, 120, 5));
		expect(fitValueFontSize(10, 10, 7)).toBe(12);
		expect(fitValueFontSize(5000, 5000, 5)).toBe(72);
	});
});
