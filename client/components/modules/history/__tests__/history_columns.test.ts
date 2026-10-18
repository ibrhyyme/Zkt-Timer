import {
	addHistoryColumn,
	DEFAULT_HISTORY_COLUMNS,
	historyColumnLabel,
	MAX_HISTORY_COLUMNS,
	moveHistoryColumn,
	parseHistoryColumnInput,
	removeHistoryColumn,
	sanitizeHistoryColumns,
} from '../history_columns';

describe('sanitizeHistoryColumns', () => {
	it('falls back to ao5 and ao12 when nothing is stored', () => {
		expect(sanitizeHistoryColumns(undefined)).toEqual(DEFAULT_HISTORY_COLUMNS);
		expect(sanitizeHistoryColumns(null)).toEqual(DEFAULT_HISTORY_COLUMNS);
	});

	it('keeps an empty list, since removing every column is allowed', () => {
		expect(sanitizeHistoryColumns([])).toEqual([]);
	});

	it('drops invalid sizes and duplicates and keeps the order', () => {
		expect(sanitizeHistoryColumns([12, 5, 12, 2, 10001, 1.5, '50', 'x'])).toEqual([12, 5, 50]);
	});

	it('caps the number of columns', () => {
		const many = Array.from({ length: 30 }, (_, i) => i + 3);
		expect(sanitizeHistoryColumns(many)).toHaveLength(MAX_HISTORY_COLUMNS);
	});
});

describe('column edits', () => {
	it('adds a column once', () => {
		expect(addHistoryColumn([5, 12], 100)).toEqual([5, 12, 100]);
		expect(addHistoryColumn([5, 12], 12)).toEqual([5, 12]);
		expect(addHistoryColumn([5, 12], 2)).toEqual([5, 12]);
	});

	it('removes by position', () => {
		expect(removeHistoryColumn([5, 12, 100], 1)).toEqual([5, 100]);
		expect(removeHistoryColumn([5], 4)).toEqual([5]);
	});

	it('moves a column within bounds only', () => {
		expect(moveHistoryColumn([5, 12, 100], 2, -1)).toEqual([5, 100, 12]);
		expect(moveHistoryColumn([5, 12, 100], 0, 1)).toEqual([12, 5, 100]);
		expect(moveHistoryColumn([5, 12, 100], 0, -1)).toEqual([5, 12, 100]);
		expect(moveHistoryColumn([5, 12, 100], 2, 1)).toEqual([5, 12, 100]);
	});
});

describe('labels and input', () => {
	it('labels trimmed averages ao and plain means mo', () => {
		expect(historyColumnLabel(5)).toBe('ao5');
		expect(historyColumnLabel(3)).toBe('mo3');
	});

	it('parses what a user types', () => {
		expect(parseHistoryColumnInput('42')).toBe(42);
		expect(parseHistoryColumnInput(' ao42 ')).toBe(42);
		expect(parseHistoryColumnInput('2')).toBeNull();
		expect(parseHistoryColumnInput('12.5')).toBeNull();
		expect(parseHistoryColumnInput('')).toBeNull();
	});
});
