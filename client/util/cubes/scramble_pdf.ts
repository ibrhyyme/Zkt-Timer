import {jsPDF} from 'jspdf';
import {ensureRobotoFont} from './pdf_font';
import {applyScramble, DEFAULT_FACE_COLORS, FACE_NAMES, CubeState} from './cube_state';

export interface ScrambleRow {
	attemptNumber: number;
	isExtra: boolean;
	scrambleString: string;
}

export interface ScramblePdfOptions {
	competitionName: string;
	eventName: string;
	eventId: string; // "333", "222" etc.
	roundNumber: number;
	groupLabel?: string; // "Set A" / "Grup 1" vb. (single-set mode)
	scrambles?: ScrambleRow[]; // single round-level set
	// Per-group sets — one A4 page per group (WCA parity: every group has its own
	// distinct scrambles). When provided & non-empty, takes precedence over
	// `scrambles`.
	groups?: Array<{label: string; scrambles: ScrambleRow[]}>;
}

// Map WCA event id → cube side length (0 if not a cube).
const EVENT_CUBE_SIZE: Record<string, number> = {
	'222': 2,
	'333': 3,
	'333oh': 3,
	'333bf': 3,
	'333fm': 3,
	'333mbf': 3,
	'444': 4,
	'444bf': 4,
	'555': 5,
	'555bf': 5,
	'666': 6,
	'777': 7,
};

function cubeSizeForEvent(eventId: string): number {
	return EVENT_CUBE_SIZE[eventId] ?? 0;
}

/**
 * Draw a cube net (unfolded T-layout) onto the given jsPDF at (x, y) with the
 * requested total width in mm. Returns the drawn height in mm so the caller
 * knows where to continue.
 *
 *      [U]
 *  [L] [F] [R] [B]
 *      [D]
 *
 * Each face is `size × size` stickers.
 */
function drawCubeNet(
	pdf: jsPDF,
	state: CubeState,
	x: number,
	y: number,
	totalWidth: number
): number {
	const {size, faces} = state;
	// Net spans 4 face-widths horizontally (L F R B). Each face = size × stickerSize.
	const stickerSize = totalWidth / (4 * size);
	const faceWidth = stickerSize * size;

	function drawFace(faceIdx: number, fx: number, fy: number) {
		const arr = faces[faceIdx];
		for (let r = 0; r < size; r++) {
			for (let c = 0; c < size; c++) {
				const letter = arr[r * size + c];
				const color = DEFAULT_FACE_COLORS[letter] || '#888';
				pdf.setFillColor(color);
				pdf.setDrawColor('#222222');
				pdf.setLineWidth(0.15);
				pdf.rect(
					fx + c * stickerSize,
					fy + r * stickerSize,
					stickerSize,
					stickerSize,
					'FD'
				);
			}
		}
	}

	// U row
	drawFace(0, x + faceWidth, y);
	// L F R B row
	drawFace(4, x, y + faceWidth); // L
	drawFace(2, x + faceWidth, y + faceWidth); // F
	drawFace(1, x + faceWidth * 2, y + faceWidth); // R
	drawFace(5, x + faceWidth * 3, y + faceWidth); // B
	// D row
	drawFace(3, x + faceWidth, y + faceWidth * 2);

	return faceWidth * 3; // total height
}

interface PageMeta {
	competitionName: string;
	eventName: string;
	roundNumber: number;
	groupLabel?: string;
}

/**
 * Render ONE A4 page: header + all attempts (normal + extra) for a single set,
 * laid out so everything fits on the page (no pagination within a set) + footer.
 */
function drawScramblePage(
	pdf: jsPDF,
	meta: PageMeta,
	scrambles: ScrambleRow[],
	font: string,
	cubeSize: number
): void {
	const pageWidth = 210;
	const pageHeight = 297;
	const margin = 15;
	const contentWidth = pageWidth - margin * 2;

	// Header
	pdf.setFont(font, 'normal');
	pdf.setFontSize(10);
	pdf.setTextColor('#666666');
	pdf.text(meta.competitionName, margin, margin);
	pdf.text(
		`${meta.eventName} · Round ${meta.roundNumber}${meta.groupLabel ? ` · ${meta.groupLabel}` : ''}`,
		pageWidth - margin,
		margin,
		{align: 'right'}
	);
	pdf.setDrawColor('#999999');
	pdf.setLineWidth(0.3);
	pdf.line(margin, margin + 3, pageWidth - margin, margin + 3);

	if (scrambles.length === 0) return;

	// Layout — SINGLE PAGE: derive row height, cube size and scramble font so
	// every attempt (normal + extra) fits one A4. No pagination.
	const numCol = 10;
	const gap = 10;
	const headerBottom = margin + 10;
	const footerSpace = 10;
	const available = pageHeight - margin - footerSpace - headerBottom;
	const N = Math.max(1, scrambles.length);
	const rowHeight = available / N;
	const vPad = rowHeight * 0.18;

	// Cube net scaled to the row height (capped at the original 45mm).
	const cubeCol = cubeSize > 0 ? Math.min(45, ((rowHeight - vPad) * 4) / 3) : 0;
	const cubeHeight = (cubeCol * 3) / 4;
	const scrambleCol = contentWidth - numCol - cubeCol - gap;

	// Largest scramble font (<=13) whose tallest wrapped block still fits a row.
	let scrFont = 13;
	const maxTextH = rowHeight - vPad;
	while (scrFont > 7) {
		pdf.setFont('courier', 'bold');
		pdf.setFontSize(scrFont);
		let tallest = 0;
		for (const r of scrambles) {
			const w = pdf.splitTextToSize(r.scrambleString, scrambleCol);
			tallest = Math.max(tallest, w.length * scrFont * 0.46);
		}
		if (tallest <= maxTextH) break;
		scrFont -= 0.5;
	}
	const lineHeight = scrFont * 0.46;

	let cursorY = headerBottom;
	pdf.setTextColor('#000000');

	const normalCount = scrambles.filter((s) => !s.isExtra).length;
	for (const row of scrambles) {
		pdf.setFont('courier', 'bold');
		pdf.setFontSize(scrFont);
		const wrapped = pdf.splitTextToSize(row.scrambleString, scrambleCol);
		const textHeight = wrapped.length * lineHeight;

		// Row divider on top
		pdf.setDrawColor('#cccccc');
		pdf.setLineWidth(0.25);
		pdf.line(margin, cursorY, pageWidth - margin, cursorY);

		const innerY = cursorY + vPad / 2;
		const textBlockHeight = Math.max(cubeHeight, textHeight);

		// Attempt number (scaled to the row)
		pdf.setFontSize(Math.min(18, rowHeight * 0.45));
		pdf.setFont(font, 'bold');
		const label = row.isExtra ? `E${row.attemptNumber - normalCount}` : String(row.attemptNumber);
		pdf.text(label, margin, innerY + textBlockHeight / 2);

		// Scramble text (courier, ASCII)
		pdf.setFontSize(scrFont);
		pdf.setFont('courier', 'bold');
		const textStartY = innerY + (textBlockHeight - textHeight) / 2 + lineHeight - 1;
		pdf.text(wrapped, margin + numCol, textStartY);

		// Cube diagram on the right edge
		if (cubeSize > 0) {
			const state = applyScramble(cubeSize, row.scrambleString);
			const cubeX = pageWidth - margin - cubeCol;
			const cubeY = innerY + (textBlockHeight - cubeHeight) / 2;
			drawCubeNet(pdf, state, cubeX, cubeY, cubeCol);
		}

		cursorY += rowHeight;
	}

	// Footer
	pdf.setFontSize(8);
	pdf.setTextColor('#999999');
	pdf.setFont(font, 'normal');
	pdf.text(
		`ZKT Unofficial · Generated ${new Date().toLocaleString()}`,
		pageWidth / 2,
		pageHeight - 8,
		{align: 'center'}
	);
}

/**
 * Build & download the scramble PDF. One page per group when `groups` is given
 * (each group has its own distinct scrambles), otherwise a single page for the
 * flat `scrambles` set. File name based on competition + event + round.
 */
export async function generateScramblePdf(opts: ScramblePdfOptions): Promise<void> {
	const pdf = new jsPDF({unit: 'mm', format: 'a4'});
	const font = await ensureRobotoFont(pdf);
	const cubeSize = cubeSizeForEvent(opts.eventId);
	const meta = {
		competitionName: opts.competitionName,
		eventName: opts.eventName,
		roundNumber: opts.roundNumber,
	};

	const pages =
		opts.groups && opts.groups.length > 0
			? opts.groups
			: [{label: opts.groupLabel || '', scrambles: opts.scrambles || []}];

	pages.forEach((page, idx) => {
		if (idx > 0) pdf.addPage();
		drawScramblePage(pdf, {...meta, groupLabel: page.label}, page.scrambles, font, cubeSize);
	});

	const filename = `${opts.competitionName}-${opts.eventId}-R${opts.roundNumber}.pdf`.replace(
		/\s+/g,
		'_'
	);
	pdf.save(filename);
}

// Re-export for convenience.
export {FACE_NAMES};
