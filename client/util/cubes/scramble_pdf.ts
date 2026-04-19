import {jsPDF} from 'jspdf';
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
	groupLabel?: string; // "Set A" / "Grup 1" vb.
	scrambles: ScrambleRow[];
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

/**
 * Build & download the scramble PDF. File name based on competition + event + round.
 */
export function generateScramblePdf(opts: ScramblePdfOptions): void {
	const pdf = new jsPDF({unit: 'mm', format: 'a4'});
	const pageWidth = 210;
	const pageHeight = 297;
	const margin = 15;
	const contentWidth = pageWidth - margin * 2;

	const cubeSize = cubeSizeForEvent(opts.eventId);

	// Header
	pdf.setFontSize(10);
	pdf.setTextColor('#666666');
	pdf.text(opts.competitionName, margin, margin);
	pdf.text(
		`${opts.eventName} · Round ${opts.roundNumber}${opts.groupLabel ? ` · ${opts.groupLabel}` : ''}`,
		pageWidth - margin,
		margin,
		{align: 'right'}
	);
	pdf.setDrawColor('#999999');
	pdf.setLineWidth(0.3);
	pdf.line(margin, margin + 3, pageWidth - margin, margin + 3);

	// Layout constants — keep scramble text and cube diagram clearly separated.
	const numCol = 10; // mm, attempt number column
	const cubeCol = cubeSize > 0 ? 45 : 0; // mm, cube net width on the right
	const gap = 10; // mm, safe gap between scramble text and cube diagram
	const scrambleCol = contentWidth - numCol - cubeCol - gap;

	let cursorY = margin + 10;

	pdf.setTextColor('#000000');

	for (const row of opts.scrambles) {
		// Cube net height = (3 face widths) × (cubeCol / (4 × size)) × size = 0.75 × cubeCol
		const cubeHeight = cubeSize > 0 ? (cubeCol * 3) / 4 : 0;

		// Scramble text: bold courier 13pt. Wrap to scramble column.
		pdf.setFontSize(13);
		pdf.setFont('courier', 'bold');
		const wrapped = pdf.splitTextToSize(row.scrambleString, scrambleCol);
		const lineHeight = 6; // mm @ 13pt
		const textHeight = wrapped.length * lineHeight;

		// Row tall enough for whichever is taller + 10mm vertical padding.
		const rowHeight = Math.max(cubeHeight, textHeight) + 12;

		if (cursorY + rowHeight > pageHeight - margin) {
			pdf.addPage();
			cursorY = margin + 10;
		}

		// Row divider on top
		pdf.setDrawColor('#cccccc');
		pdf.setLineWidth(0.25);
		pdf.line(margin, cursorY, pageWidth - margin, cursorY);

		// Vertically centre the row contents inside rowHeight.
		const innerY = cursorY + 6;

		// Attempt number (bigger, bolder)
		pdf.setFontSize(18);
		pdf.setFont('helvetica', 'bold');
		const normalCount = opts.scrambles.filter((s) => !s.isExtra).length;
		const label = row.isExtra ? `E${row.attemptNumber - normalCount}` : String(row.attemptNumber);
		// Centre number vertically in the row
		const textBlockHeight = Math.max(cubeHeight, textHeight);
		pdf.text(label, margin, innerY + textBlockHeight / 2);

		// Scramble — bold courier, vertically centred
		pdf.setFontSize(13);
		pdf.setFont('courier', 'bold');
		const textStartY = innerY + (textBlockHeight - textHeight) / 2 + lineHeight - 1;
		pdf.text(wrapped, margin + numCol, textStartY);

		// Cube diagram — strictly on the right edge, separated by `gap`
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
	pdf.setFont('helvetica', 'italic');
	pdf.text(
		`ZKT Unofficial · Generated ${new Date().toLocaleString()}`,
		pageWidth / 2,
		pageHeight - 8,
		{align: 'center'}
	);

	const filename = `${opts.competitionName}-${opts.eventId}-R${opts.roundNumber}${opts.groupLabel ? `-${opts.groupLabel}` : ''}.pdf`
		.replace(/\s+/g, '_');
	pdf.save(filename);
}

// Re-export for convenience.
export {FACE_NAMES};
