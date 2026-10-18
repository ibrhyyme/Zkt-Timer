import { formatSolveNumber, historyGridTemplate, SOLVE_NUMBER_GROUP, solveNumberColumnCh } from '../history_grid';

describe('formatSolveNumber', () => {
	it('leaves numbers up to four digits alone', () => {
		expect(formatSolveNumber(1)).toBe('1');
		expect(formatSolveNumber(130)).toBe('130');
		expect(formatSolveNumber(9999)).toBe('9999');
	});

	it('groups five digits and more with a narrow space, never a dot', () => {
		expect(formatSolveNumber(12007)).toBe(`12${SOLVE_NUMBER_GROUP}007`);
		expect(formatSolveNumber(1234567)).toBe(`1${SOLVE_NUMBER_GROUP}234${SOLVE_NUMBER_GROUP}567`);
		expect(formatSolveNumber(12007)).not.toContain('.');
	});
});

describe('solveNumberColumnCh', () => {
	it('grows with the longest number in the list', () => {
		expect(solveNumberColumnCh(0)).toBe(2);
		expect(solveNumberColumnCh(9)).toBe(2);
		expect(solveNumberColumnCh(130)).toBe(3);
		expect(solveNumberColumnCh(9999)).toBe(4);
		// "12 007": five digits plus half a digit for the narrow space
		expect(solveNumberColumnCh(12007)).toBe(5.5);
	});
});

describe('historyGridTemplate', () => {
	it('adds one column per average on the desktop', () => {
		expect(historyGridTemplate(30, 2, false)).toBe('calc(2ch + 16px) minmax(5.2em, 1.2fr) repeat(2, minmax(4.8em, 1fr))');
	});

	it('never writes repeat(0, ...), which is invalid CSS', () => {
		expect(historyGridTemplate(30, 0, false)).toBe('calc(2ch + 16px) minmax(5.2em, 1.2fr)');
	});

	it('is number, time and delete on a phone, whatever the column setting', () => {
		expect(historyGridTemplate(12007, 4, true)).toBe('calc(5.5ch + 12px) minmax(0, 1fr) 44px');
	});
});
