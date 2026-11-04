import {
	buildDayRows,
	buildMatrix,
	buildMonthAcrossYears,
	buildYearRows,
	daysInMonth,
	peakRow,
	percentChange,
	previousMonthCount,
	reportYears,
	sumRows,
} from '../growth_report';

const NOW = {year: 2026, month: 11};

// Data starts in March 2024; 2025-07 has no signups at all (a gap, not missing data).
const MONTHS = [
	{key: '2024-03', count: 5, activated: 2, pro: 0},
	{key: '2024-11', count: 10, activated: 6, pro: 1},
	{key: '2025-03', count: 20, activated: 10, pro: 2},
	{key: '2025-11', count: 40, activated: 30, pro: 4},
	{key: '2026-03', count: 30, activated: 12, pro: 3},
	{key: '2026-10', count: 50, activated: 25, pro: 5},
	{key: '2026-11', count: 8, activated: 3, pro: 1},
];

describe('reportYears', () => {
	it('runs from now back to the first year of data, newest first', () => {
		expect(reportYears(MONTHS, NOW)).toEqual([2026, 2025, 2024]);
	});

	it('is just this year for an empty series', () => {
		expect(reportYears([], NOW)).toEqual([2026]);
	});
});

describe('buildMatrix', () => {
	const rows = buildMatrix(MONTHS, NOW);

	it('leaves months before the data and after now empty', () => {
		const y2024 = rows.find((r) => r.year === 2024)!;
		expect(y2024.cells.slice(0, 2)).toEqual([null, null]);
		expect(y2024.cells[2]).toBe(5);
		const y2026 = rows.find((r) => r.year === 2026)!;
		expect(y2026.cells[11]).toBeNull();
		expect(y2026.cells[10]).toBe(8);
	});

	it('shows a month with no rows as 0, not empty', () => {
		expect(rows.find((r) => r.year === 2025)!.cells[6]).toBe(0);
	});

	it('totals each year', () => {
		expect(rows.map((r) => [r.year, r.total])).toEqual([
			[2026, 88],
			[2025, 60],
			[2024, 15],
		]);
	});
});

describe('buildYearRows', () => {
	it('lists the months that happened, with the same month a year earlier', () => {
		const rows = buildYearRows(MONTHS, 2025, NOW, true);
		expect(rows).toHaveLength(12);
		const march = rows[2];
		expect(march).toMatchObject({key: '2025-03', count: 20, previous: 5, activated: 10, pro: 2, partial: false});
		// January 2024 precedes the data, so January 2025 has nothing to compare with.
		expect(rows[0].previous).toBeNull();
	});

	it('stops at the current month and marks it as running', () => {
		const rows = buildYearRows(MONTHS, 2026, NOW, true);
		expect(rows).toHaveLength(11);
		expect(rows[10]).toMatchObject({key: '2026-11', partial: true, previous: 40});
	});

	it('starts at the first month of data', () => {
		const rows = buildYearRows(MONTHS, 2024, NOW, false);
		expect(rows[0].key).toBe('2024-03');
		expect(rows[0].activated).toBeNull();
	});
});

describe('buildMonthAcrossYears', () => {
	it('lists the month in every year it happened, newest first', () => {
		const rows = buildMonthAcrossYears(MONTHS, 3, NOW, true);
		expect(rows.map((r) => [r.key, r.count, r.previous])).toEqual([
			['2026', 30, 20],
			['2025', 20, 5],
			['2024', 5, null],
		]);
	});

	it('skips a year where the month is still ahead', () => {
		expect(buildMonthAcrossYears(MONTHS, 12, NOW, false).map((r) => r.key)).toEqual(['2025', '2024']);
	});
});

describe('buildDayRows', () => {
	const today = {year: 2026, month: 11, day: 4};
	const days = [
		{key: '2026-11-01', count: 3, activated: 1, pro: 0},
		{key: '2026-11-04', count: 5, activated: 2, pro: 1},
	];

	it('fills every day up to today and marks today as running', () => {
		const rows = buildDayRows(days, 2026, 11, today, true);
		expect(rows.map((r) => r.count)).toEqual([3, 0, 0, 5]);
		expect(rows[3].partial).toBe(true);
		expect(rows.every((r) => r.previous === null)).toBe(true);
	});

	it('shows a past month in full', () => {
		expect(buildDayRows([], 2024, 2, today, false)).toHaveLength(29);
	});

	it('has nothing for a month still ahead', () => {
		expect(buildDayRows([], 2026, 12, today, false)).toEqual([]);
	});
});

describe('sumRows', () => {
	it('compares only finished months against last year', () => {
		const totals = sumRows(buildYearRows(MONTHS, 2026, NOW, true), true);
		expect(totals.count).toBe(88);
		expect(totals.activated).toBe(40);
		expect(totals.pro).toBe(9);
		// Finished 2026 months: 30 + 50 = 80 against 20 + 0 = 20 a year earlier (+300%).
		// The running November (8 vs 40) stays out of it.
		expect(totals.change).toBe(300);
		expect(totals.previous).toBe(60);
	});

	it('has no change when there is nothing a year back', () => {
		expect(sumRows(buildYearRows(MONTHS, 2024, NOW, false), false).change).toBeNull();
	});
});

describe('small helpers', () => {
	it('percentChange', () => {
		expect(percentChange(15, 10)).toBe(50);
		expect(percentChange(5, 0)).toBeNull();
		expect(percentChange(5, null)).toBeNull();
		expect(percentChange(1, 3)).toBe(-66.7);
	});

	it('peakRow takes the first highest and ignores zeros', () => {
		expect(peakRow([{count: 0}, {count: 4}, {count: 4}])).toEqual({count: 4});
		expect(peakRow([{count: 0}])).toBeNull();
	});

	it('previousMonthCount wraps the year and stops before the data', () => {
		expect(previousMonthCount(MONTHS, 2025, 12)).toBe(40);
		expect(previousMonthCount(MONTHS, 2025, 1)).toBe(0);
		expect(previousMonthCount(MONTHS, 2024, 3)).toBeNull();
	});

	it('daysInMonth', () => {
		expect(daysInMonth(2024, 2)).toBe(29);
		expect(daysInMonth(2026, 11)).toBe(30);
	});
});
