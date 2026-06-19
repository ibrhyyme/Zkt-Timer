import {jsPDF} from 'jspdf';
import {ensureRobotoFont} from './pdf_font';

/**
 * One competitor's scorecard entry. Scorecards intentionally do NOT include
 * scrambles — those are printed separately (scramble_pdf.ts). A WCA scorecard
 * is the paper a judge writes each attempt on, then a scoretaker enters into
 * the system. So every result/signature cell is left blank for handwriting.
 */
export interface ScorecardEntry {
	registrantId: string | number; // competition-local seat / registrant number
	name: string;
	wcaId?: string; // WCA / personal id, shown top-right (optional)
	group?: number; // group number from the round's COMPETITOR assignment
	station?: number; // table/station number from the assignment
}

export interface ScorecardPdfOptions {
	competitionName: string;
	eventName: string;
	eventId: string;
	roundNumber: number;
	attemptCount: number; // BO1=1, BO2=2, BO3/MO3=3, AO5=5
	extraCount?: number; // unused for layout; extra is a single delegate-signed row
	cutoff?: string; // pre-formatted "1:00" or ''
	timeLimit?: string; // pre-formatted "10:00" or ''
	entries: ScorecardEntry[]; // competitors; if empty, blank cards are produced
	blankCount?: number; // number of empty cards when there are no entries, default 8
}

// Trim a string with an ellipsis so it fits within maxWidth (mm) at the current font.
function truncate(pdf: jsPDF, text: string, maxWidth: number): string {
	if (!text) return '';
	if (pdf.getTextWidth(text) <= maxWidth) return text;
	let t = text;
	while (t.length > 1 && pdf.getTextWidth(t + '…') > maxWidth) {
		t = t.slice(0, -1);
	}
	return t + '…';
}

/**
 * Draw a single WCA-style scorecard inside the box (x, y, w, h):
 *   Competition title
 *   Event | Round | Group | Station   (labelled boxes)
 *   ID | Name                         (+ WCA id top-right)
 *   # | Scr | Result | Judge | Comp   (attempt rows)
 *   Extra attempt (Delegate initials ____)
 *   Cutoff / Time limit (bottom-right)
 * `entry` null → a fully blank card (manual fill-in / spare).
 */
function drawScorecard(
	pdf: jsPDF,
	opts: ScorecardPdfOptions,
	entry: ScorecardEntry | null,
	x: number,
	y: number,
	w: number,
	h: number,
	font: string
): void {
	const pad = 4;
	const innerW = w - pad * 2;
	const left = x + pad;
	const right = x + w - pad;
	const bottom = y + h - pad;

	const ink = '#222222';
	const sub = '#666666';

	// Outer border
	pdf.setDrawColor(ink);
	pdf.setLineWidth(0.4);
	pdf.rect(x, y, w, h);

	let cy = y + 6.5;

	// Competition name (bold, centered)
	pdf.setFont(font, 'bold');
	pdf.setFontSize(11);
	pdf.setTextColor(ink);
	pdf.text(truncate(pdf, opts.competitionName, innerW), x + w / 2, cy, {align: 'center'});
	cy += 4;

	// --- Meta table: Event | Round | Group | Station ---
	const metaH = 8.5;
	const stationW = 13;
	const groupW = 13;
	const roundW = 13;
	const eventW = innerW - stationW - groupW - roundW;
	const exX = left;
	const rdX = left + eventW;
	const grX = rdX + roundW;
	const stX = grX + groupW;

	pdf.setFont(font, 'normal');
	pdf.setFontSize(6);
	pdf.setTextColor(sub);
	pdf.text('Event', exX + 1.5, cy + 2.6);
	pdf.text('Round', rdX + 1.5, cy + 2.6);
	pdf.text('Group', grX + 1.5, cy + 2.6);
	pdf.text('Station', stX + 1.5, cy + 2.6);
	cy += 3.6;

	pdf.setDrawColor(ink);
	pdf.setLineWidth(0.3);
	pdf.rect(exX, cy, eventW, metaH);
	pdf.rect(rdX, cy, roundW, metaH);
	pdf.rect(grX, cy, groupW, metaH);
	pdf.rect(stX, cy, stationW, metaH);

	pdf.setTextColor(ink);
	pdf.setFont(font, 'normal');
	pdf.setFontSize(9);
	const midY = cy + metaH / 2 + 1.6;
	pdf.text(truncate(pdf, opts.eventName, eventW - 3), exX + 2, midY);
	pdf.text(String(opts.roundNumber), rdX + roundW / 2, midY, {align: 'center'});
	pdf.setFont(font, 'bold');
	pdf.text(entry?.group != null ? String(entry.group) : '', grX + groupW / 2, midY, {align: 'center'});
	pdf.text(entry?.station != null ? String(entry.station) : '', stX + stationW / 2, midY, {align: 'center'});
	cy += metaH + 1;

	// --- ID + Name row (+ WCA id top-right) ---
	pdf.setFont(font, 'normal');
	pdf.setFontSize(6);
	pdf.setTextColor(sub);
	pdf.text('ID', left + 1.5, cy + 2.6);
	pdf.text('Name', left + 15, cy + 2.6);
	if (entry?.wcaId) {
		pdf.text(entry.wcaId, right - 0.5, cy + 2.6, {align: 'right'});
	}
	cy += 3.6;

	const idNameH = 8;
	const idW = 12;
	pdf.setDrawColor(ink);
	pdf.setLineWidth(0.3);
	pdf.rect(left, cy, idW, idNameH);
	pdf.rect(left + idW, cy, innerW - idW, idNameH);
	pdf.setTextColor(ink);
	pdf.setFont(font, 'bold');
	pdf.setFontSize(9);
	pdf.text(entry ? `${entry.registrantId}` : '', left + idW / 2, cy + idNameH / 2 + 1.6, {align: 'center'});
	pdf.setFont(font, 'normal');
	pdf.text(
		entry ? truncate(pdf, entry.name, innerW - idW - 4) : '',
		left + idW + 2,
		cy + idNameH / 2 + 1.6
	);
	cy += idNameH + 2.5;

	// --- Result table: # | Scr | Result | Judge | Comp ---
	const numW = 8;
	const scrW = 12;
	const sigW = 15;
	const resultW = innerW - numW - scrW - sigW * 2;
	const cNum = left;
	const cScr = cNum + numW;
	const cRes = cScr + scrW;
	const cJud = cRes + resultW;
	const cComp = cJud + sigW;

	// Header
	pdf.setFont(font, 'bold');
	pdf.setFontSize(6.5);
	pdf.setTextColor(sub);
	pdf.text('Scr', cScr + scrW / 2, cy + 2.6, {align: 'center'});
	pdf.text('Result', cRes + 2, cy + 2.6);
	pdf.text('Judge', cJud + sigW / 2, cy + 2.6, {align: 'center'});
	pdf.text('Comp', cComp + sigW / 2, cy + 2.6, {align: 'center'});
	cy += 4;

	const rows: string[] = [];
	for (let i = 1; i <= opts.attemptCount; i++) rows.push(String(i));

	// Reserve space at the bottom for the extra-attempt row + limit line.
	const bottomReserve = 17;
	const tableBottom = bottom - bottomReserve;
	const rowH = Math.max(7, Math.min(11, (tableBottom - cy) / rows.length));

	pdf.setDrawColor(ink);
	pdf.setLineWidth(0.2);
	for (const r of rows) {
		pdf.rect(cNum, cy, numW, rowH);
		pdf.rect(cScr, cy, scrW, rowH);
		pdf.rect(cRes, cy, resultW, rowH);
		pdf.rect(cJud, cy, sigW, rowH);
		pdf.rect(cComp, cy, sigW, rowH);
		pdf.setFont(font, 'bold');
		pdf.setFontSize(10);
		pdf.setTextColor(ink);
		pdf.text(r, cNum + numW / 2, cy + rowH / 2 + 1.5, {align: 'center'});
		cy += rowH;
	}

	// --- Extra attempt (delegate-signed) ---
	cy += 2;
	pdf.setFont(font, 'normal');
	pdf.setFontSize(6.5);
	pdf.setTextColor(ink);
	pdf.text('Extra attempt (Delegate initials ____)', left, cy + 2);
	cy += 3;
	const exRowH = 7;
	pdf.setDrawColor(ink);
	pdf.setLineWidth(0.2);
	pdf.rect(cNum, cy, numW, exRowH);
	pdf.rect(cScr, cy, scrW, exRowH);
	pdf.rect(cRes, cy, resultW, exRowH);
	pdf.rect(cJud, cy, sigW, exRowH);
	pdf.rect(cComp, cy, sigW, exRowH);
	pdf.setFont(font, 'bold');
	pdf.setFontSize(11);
	pdf.text('–', cNum + numW / 2, cy + exRowH / 2 + 1.5, {align: 'center'});
	cy += exRowH;

	// --- Cutoff / time limit (bottom-right) ---
	if (opts.cutoff || opts.timeLimit) {
		pdf.setFont(font, 'normal');
		pdf.setFontSize(7);
		pdf.setTextColor(sub);
		const parts: string[] = [];
		if (opts.cutoff) parts.push(`Cutoff: ${opts.cutoff}`);
		if (opts.timeLimit) parts.push(`Time limit: ${opts.timeLimit}`);
		pdf.text(parts.join('    '), right, bottom - 0.5, {align: 'right'});
	}
}

/**
 * Build & download a competitor scorecards PDF — A4 portrait, 4 cards per page
 * (2×2). One card per competitor (group/station seating order when assigned,
 * else name-sorted) plus a couple of blank spares; if there are no competitors,
 * a sheet of blank cards.
 */
export async function generateScorecardsPdf(opts: ScorecardPdfOptions): Promise<void> {
	const pdf = new jsPDF({orientation: 'portrait', unit: 'mm', format: 'a4'});
	const font = await ensureRobotoFont(pdf);
	const pageWidth = 210;
	const pageHeight = 297;
	const margin = 10;
	const gutter = 6;

	const cardW = (pageWidth - margin * 2 - gutter) / 2;
	const cardH = (pageHeight - margin * 2 - gutter) / 2;

	// Card slot positions (2×2).
	const slots = [
		{x: margin, y: margin},
		{x: margin + cardW + gutter, y: margin},
		{x: margin, y: margin + cardH + gutter},
		{x: margin + cardW + gutter, y: margin + cardH + gutter},
	];

	// Build the card list: real entries, else blanks.
	const cards: (ScorecardEntry | null)[] =
		opts.entries.length > 0
			? [...opts.entries, null, null] // +2 spare blanks for late/extra
			: Array.from({length: opts.blankCount ?? 8}).map(() => null);

	cards.forEach((entry, i) => {
		const slotIndex = i % 4;
		if (i > 0 && slotIndex === 0) pdf.addPage();
		const slot = slots[slotIndex];
		drawScorecard(pdf, opts, entry, slot.x, slot.y, cardW, cardH, font);
	});

	const safe = (s: string) => s.replace(/[^\w.-]+/g, '_');
	pdf.save(`${safe(opts.competitionName)}-${safe(opts.eventId)}-R${opts.roundNumber}-scorecards.pdf`);
}
