import { countMoves, fitReferenceText, scrambleLinesBudget, SCRAMBLE_LINE_HEIGHT_RATIO } from '../fit_scramble';

describe('fitReferenceText', () => {
	it('makes every move as wide as the widest, so only the count matters', () => {
		expect(fitReferenceText("R U2 F' D")).toBe('WW WW WW WW');
		expect(fitReferenceText("B' R' D2 R2 B")).toBe(fitReferenceText("F2 L U2 D' R"));
	});

	it('keeps line breaks (Megaminx)', () => {
		expect(fitReferenceText("R++ D-- U\nR-- D++ U'")).toBe('WWW WWW WWW\nWWW WWW WWW');
	});

	it('is empty for an empty scramble', () => {
		expect(fitReferenceText('  ')).toBe('');
	});

	it('pads a shorter scramble to the most moves seen, so the size holds', () => {
		expect(fitReferenceText("R U2 F'", 5)).toBe('WW WW WW WW WW');
		expect(fitReferenceText("R U2 F'", 2)).toBe('WW WW WW');
		expect(fitReferenceText("R U\nF' D", 5)).toBe('WW WW\nWW WW WW');
	});
});

describe('countMoves', () => {
	it('counts moves across lines and extra spaces', () => {
		expect(countMoves("R  U2 F'\nD ")).toBe(4);
		expect(countMoves('')).toBe(0);
	});
});
import { countWrappedLines, wrappedBlockHeight } from '../../../../util/text-fit';

// Measured in Chrome on a 1280x800 screen with wide rails and a bottom module bar: the
// timer area is 359 px high, the content 437 px, of which the scramble field is 210 px
// (four lines at 30 px plus 18 px of padding and border).
const AREA = 359;
const CONTENT = 437;
const FIELD = 210;
const CHROME = 18;

describe('scrambleLinesBudget', () => {
	it('leaves the lines what the rest of the content does not take', () => {
		expect(scrambleLinesBudget(AREA, CONTENT, FIELD, CHROME)).toBe(AREA - (CONTENT - FIELD) - CHROME);
	});

	it('is the same whatever height the field had when measured', () => {
		// The rest of the content does not change with the field, so neither does the budget.
		const taller = scrambleLinesBudget(AREA, CONTENT + 40, FIELD + 40, CHROME);
		expect(taller).toBe(scrambleLinesBudget(AREA, CONTENT, FIELD, CHROME));
	});

	it('is never negative', () => {
		expect(scrambleLinesBudget(100, 400, 50, CHROME)).toBe(0);
		expect(scrambleLinesBudget(100, 40, 50, -5)).toBe(100);
	});

	it('takes four 30 px lines out of the budget but fits three 20 px lines', () => {
		const budget = scrambleLinesBudget(AREA, CONTENT, FIELD, CHROME);
		expect(wrappedBlockHeight(4, 30, SCRAMBLE_LINE_HEIGHT_RATIO)).toBeGreaterThan(budget);
		expect(wrappedBlockHeight(3, 20, SCRAMBLE_LINE_HEIGHT_RATIO)).toBeLessThanOrEqual(budget);
	});

	it('works with the line counter it is paired with', () => {
		// A 20 move scramble, monospaced at 0.6 em, in a 280 px wide field.
		const text = "F' D' R2 U' L' B L F2 R2 U B2 D2 R2 L2 B2 D R' L2 F2 U";
		const at = (size: number) => countWrappedLines(text, (t) => t.length * size * 0.6, size * 0.6, 280);
		expect(at(30)).toBeGreaterThan(at(20));
	});
});
