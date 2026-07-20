// Canvas-based text measurement for finding the largest font size that fits a box.
// Pure/framework-agnostic: never writes to the visible DOM, so callers can compute
// a fit without any flash-of-wrong-size (unlike measuring via a live element's
// scrollHeight, which requires actually rendering each candidate size first).

export interface FitTextResult {
	fontSize: number;
	fits: boolean;
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

// Greedy word-wrap simulation. Treats '\n' as a forced break (matches CSS white-space: pre-wrap).
function simulateWrappedLineCount(ctx: CanvasRenderingContext2D, text: string, font: string, maxWidth: number): number {
	ctx.font = font;
	const spaceWidth = ctx.measureText(' ').width;

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
			const tokenWidth = ctx.measureText(token).width;

			if (lineWidth > 0 && lineWidth + spaceWidth + tokenWidth > maxWidth) {
				linesInParagraph += 1;
				lineWidth = tokenWidth;
			} else {
				lineWidth += (lineWidth > 0 ? spaceWidth : 0) + tokenWidth;
			}
		}

		// Last (or only) line of the paragraph
		linesInParagraph += 1;
		totalLines += linesInParagraph;
	}

	return totalLines || 1;
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
): FitTextResult {
	const ctx = getMeasureContext();

	if (!ctx || !text || maxWidth <= 0 || maxHeight <= 0) {
		return { fontSize: maxFontSize, fits: true };
	}

	const fits = (size: number) => {
		const font = `${fontWeight} ${size}px ${fontFamily}`;
		const lines = simulateWrappedLineCount(ctx, text, font, maxWidth);
		return lines * (size * lineHeightRatio) <= maxHeight;
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
