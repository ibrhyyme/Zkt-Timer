import { countWrappedLines, wrappedBlockHeight } from '../text-fit';

// The canvas-backed entry point (findFitFontSize) cannot run under jest's node
// environment, so the two pieces it is built from are tested directly. Between
// them they are the whole reason the smart-cube scramble was being clipped: the
// old model counted neither the gap between wrapped rows nor the gap between
// items, so it reported a block shorter and narrower than the one that rendered.

// A fixed-width measurer stands in for canvas metrics: every character is 10px.
const measure = (token: string) => token.length * 10;

describe('wrappedBlockHeight', () => {
	it('is just line height when nothing wraps', () => {
		expect(wrappedBlockHeight(1, 20, 1.4, 0)).toBe(28);
		// A single row has no gap below it, so row-gap cannot change the answer.
		expect(wrappedBlockHeight(1, 20, 1.4, 8)).toBe(28);
	});

	it('adds one row gap per break between rows', () => {
		expect(wrappedBlockHeight(2, 20, 1.4, 0)).toBe(56);
		expect(wrappedBlockHeight(2, 20, 1.4, 8)).toBe(64);
		expect(wrappedBlockHeight(3, 20, 1.4, 8)).toBe(100);
	});

	it('defaults to no gap, matching a plain text node', () => {
		expect(wrappedBlockHeight(3, 10, 1.5, 0)).toBe(wrappedBlockHeight(3, 10, 1.5));
	});

	it('reproduces the clipped case: two rows of 17px do not fit a 30px box', () => {
		// The container floor was 60px with 30px of padding, leaving 30px of content.
		const available = 30;
		const withoutGap = wrappedBlockHeight(2, 17, 1.4, 0); // 47.6 — already over
		const withGap = wrappedBlockHeight(2, 17, 1.4, 4.5); // 52.1 — further over
		expect(withoutGap).toBeGreaterThan(available);
		expect(withGap).toBeGreaterThan(withoutGap);
	});
});

describe('countWrappedLines', () => {
	it('keeps everything on one line when it fits', () => {
		expect(countWrappedLines('R U F', measure, 4, 500)).toBe(1);
	});

	it('wraps when the separator pushes the last token over', () => {
		// Three 10px tokens plus two separators. At 4px each the row is 38px and
		// fits a 40px box; at 12px each it is 54px and the last token wraps.
		expect(countWrappedLines('R U F', measure, 4, 40)).toBe(1);
		expect(countWrappedLines('R U F', measure, 12, 40)).toBe(2);
	});

	it('counts more rows for a flex gap than for a space of the same text', () => {
		const scramble = "R U R' U' F2 L D2 B' R2 U F R' B U2 L' D R F' L2 B2";
		// Widths are in the synthetic measurer's units, not device pixels. The ratio
		// is what matters: a space is roughly 4 units where the flex gap plus item
		// margin is 10.5, the same relationship as 17px Roboto Mono against
		// column-gap 0.5rem + margin-right 0.2rem.
		const asPlainText = countWrappedLines(scramble, measure, 4, 200);
		const asFlexRow = countWrappedLines(scramble, measure, 10.5, 200);
		// This is the whole bug in one assertion: the same scramble in the same box
		// needs more rows once the real gap is accounted for.
		expect(asPlainText).toBe(2);
		expect(asFlexRow).toBe(3);
	});

	it('treats a newline as a forced break', () => {
		expect(countWrappedLines('R U\nF D', measure, 4, 500)).toBe(2);
	});

	it('never reports zero rows for empty input', () => {
		expect(countWrappedLines('', measure, 4, 500)).toBe(1);
	});

	it('gives an over-long token its own row rather than looping forever', () => {
		expect(countWrappedLines('R UUUUUUUUUU F', measure, 4, 40)).toBe(3);
	});
});
