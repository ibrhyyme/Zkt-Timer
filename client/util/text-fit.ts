// Canvas-based text measurement for finding the largest font size that fits a box.
// Pure/framework-agnostic: never writes to the visible DOM, so callers can compute
// a fit without any flash-of-wrong-size (unlike measuring via a live element's
// scrollHeight, which requires actually rendering each candidate size first).

export interface FitTextResult {
	fontSize: number;
	fits: boolean;
}

// Extra space the layout adds that a plain text node would not have.
//
// The default (both zero) describes a single text node, where the only thing
// between two words is a space character and the only thing between two lines is
// the line height. A wrapping flex container is not that: it puts a real gap
// between rows and between items, and measuring it as if it were plain text
// under-counts the lines and over-counts the space left, which ends with the
// last row clipped by the container's overflow.
export interface FitTextSpacing {
	/** Vertical space between wrapped rows (flex row-gap). */
	rowGap?: number;
	/** Horizontal space between items, replacing the width of a space character. */
	itemGap?: number;
}

/**
 * Height a wrapped block actually occupies. Exported so the arithmetic can be
 * tested without a canvas (jest runs in node, where there is none).
 */
export function wrappedBlockHeight(
	lines: number,
	fontSize: number,
	lineHeightRatio: number,
	rowGap = 0,
): number {
	return lines * (fontSize * lineHeightRatio) + Math.max(0, lines - 1) * rowGap;
}

/**
 * Greedy word wrap over a caller-supplied measurer. Pure, so it is testable on
 * its own; `simulateWrappedLineCount` is the canvas-backed wrapper around it.
 *
 * Treats '\n' as a forced break (matches CSS white-space: pre-wrap).
 */
export function countWrappedLines(
	text: string,
	measure: (token: string) => number,
	separatorWidth: number,
	maxWidth: number,
): number {
	let totalLines = 0;

	for (const paragraph of text.split('\n')) {
		if (!paragraph) {
			totalLines += 1;
			continue;
		}

		const tokens = paragraph.split(/\s+/).filter(Boolean);
		let lineWidth = 0;
		let linesInParagraph = 0;

		for (const token of tokens) {
			const tokenWidth = measure(token);

			if (lineWidth > 0 && lineWidth + separatorWidth + tokenWidth > maxWidth) {
				linesInParagraph += 1;
				lineWidth = tokenWidth;
			} else {
				lineWidth += (lineWidth > 0 ? separatorWidth : 0) + tokenWidth;
			}
		}

		// Last (or only) line of the paragraph
		linesInParagraph += 1;
		totalLines += linesInParagraph;
	}

	return totalLines || 1;
}

let measureCtx: CanvasRenderingContext2D | null | undefined;

function getMeasureContext(): CanvasRenderingContext2D | null {
	if (measureCtx !== undefined) return measureCtx;

	if (typeof OffscreenCanvas !== 'undefined') {
		measureCtx = new OffscreenCanvas(10, 10).getContext('2d') as unknown as CanvasRenderingContext2D | null;
	} else if (typeof document !== 'undefined') {
		measureCtx = document.createElement('canvas').getContext('2d');
	} else {
		measureCtx = null;
	}

	return measureCtx;
}

function simulateWrappedLineCount(
	ctx: CanvasRenderingContext2D,
	text: string,
	font: string,
	maxWidth: number,
	itemGap?: number,
): number {
	ctx.font = font;
	// Items in a gapped flex row are separated by the gap, not by a rendered
	// space character, and the two are not interchangeable: at 17px the gap here
	// is 10.5px while a space is around 4px.
	const separatorWidth = itemGap ?? ctx.measureText(' ').width;

	return countWrappedLines(text, (token) => ctx.measureText(token).width, separatorWidth, maxWidth);
}

export function findFitFontSize(
	text: string,
	fontFamily: string,
	fontWeight: string | number,
	maxFontSize: number,
	minFontSize: number,
	lineHeightRatio: number,
	maxWidth: number,
	maxHeight: number,
	spacing: FitTextSpacing = {},
): FitTextResult {
	const ctx = getMeasureContext();

	if (!ctx || !text || maxWidth <= 0 || maxHeight <= 0) {
		return { fontSize: maxFontSize, fits: true };
	}

	const { rowGap = 0, itemGap } = spacing;

	const fits = (size: number) => {
		const font = `${fontWeight} ${size}px ${fontFamily}`;
		const lines = simulateWrappedLineCount(ctx, text, font, maxWidth, itemGap);
		return wrappedBlockHeight(lines, size, lineHeightRatio, rowGap) <= maxHeight;
	};

	if (fits(maxFontSize)) return { fontSize: maxFontSize, fits: true };
	if (!fits(minFontSize)) return { fontSize: minFontSize, fits: false };

	let lo = minFontSize;
	let hi = maxFontSize;

	while (hi - lo > 1) {
		const mid = Math.floor((lo + hi) / 2);
		if (fits(mid)) {
			lo = mid;
		} else {
			hi = mid;
		}
	}

	return { fontSize: lo, fits: true };
}
