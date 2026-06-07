import {jsPDF} from 'jspdf';

/**
 * One competitor's scorecard entry. Scorecards intentionally do NOT include
 * scrambles — those are printed separately (scramble_pdf.ts). A WCA scorecard
 * is the paper a judge writes each attempt on, then a scoretaker enters into
 * the system. So every result/signature cell is left blank for handwriting.
 */
export interface ScorecardEntry {
	registrantId: string | number; // competition-local seat number ("#3")
	name: string;
}

export interface ScorecardPdfOptions {
	competitionName: string;
	eventName: string;
	eventId: string;
	roundNumber: number;
	groupLabel?: string;
	attemptCount: number; // BO1=1, BO2=2, BO3/MO3=3, AO5=5
	extraCount?: number; // blank extra-attempt rows, default 2
	cutoff?: string; // pre-formatted "1:00" or ''
	timeLimit?: string; // pre-formatted "10:00" or ''
	entries: ScorecardEntry[]; // competitors; if empty, `blankCount` blank cards are produced
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
 * Draw a single scorecard inside the box (x, y, w, h).
 * `entry` null → a fully blank card (manual fill-in / spare).
 */
function drawScorecard(
	pdf: jsPDF,
	opts: ScorecardPdfOptions,
	entry: ScorecardEntry | null,
	x: number,
	y: number,
	w: number,
	h: number
): void {
	const pad = 4;
	const innerW = w - pad * 2;

	// Outer border
	pdf.setDrawColor('#333333');
	pdf.setLineWidth(0.4);
	pdf.rect(x, y, w, h);

	let cy = y + pad + 3;

	// Competition name (small, grey)
	pdf.setFont('helvetica', 'normal');
	pdf.setFontSize(8);
	pdf.setTextColor('#777777');
	pdf.text(truncate(pdf, opts.competitionName, innerW), x + pad, cy);
	cy += 5;

	// Event · Round · Group (bold)
	pdf.setFont('helvetica', 'bold');
	pdf.setFontSize(11);
	pdf.setTextColor('#000000');
	const sub = `${opts.eventName} · R${opts.roundNumber}${opts.groupLabel ? ` · ${opts.groupLabel}` : ''}`;
	pdf.text(truncate(pdf, sub, innerW), x + pad, cy);
	cy += 5;

	// Cutoff / time limit (small)
	if (opts.cutoff || opts.timeLimit) {
		pdf.setFont('helvetica', 'normal');
		pdf.setFontSize(7.5);
		pdf.setTextColor('#555555');
		const parts: string[] = [];
		if (opts.cutoff) parts.push(`Cutoff ${opts.cutoff}`);
		if (opts.timeLimit) parts.push(`Limit ${opts.timeLimit}`);
		pdf.text(parts.join('     '), x + pad, cy);
		cy += 4.5;
	} else {
		cy += 0.5;
	}

	// Competitor: seat id (bold) + name
	pdf.setTextColor('#000000');
	pdf.setFont('helvetica', 'bold');
	pdf.setFontSize(10);
	const idStr = entry ? `#${entry.registrantId}` : '#____';
	pdf.text(idStr, x + pad, cy + 1.5);
	const idW = pdf.getTextWidth(idStr) + 3;
	pdf.setFont('helvetica', 'normal');
	pdf.setFontSize(10);
	pdf.text(entry ? truncate(pdf, entry.name, innerW - idW) : '', x + pad + idW, cy + 1.5);
	cy += 5.5;

	// Divider
	pdf.setDrawColor('#999999');
	pdf.setLineWidth(0.2);
	pdf.line(x + pad, cy, x + w - pad, cy);
	cy += 1.5;

	// Table geometry
	const tableX = x + pad;
	const tableW = innerW;
	const seqW = 8;
	const sigW = 17; // judge + competitor signature columns
	const resultW = tableW - seqW - sigW * 2;

	const colSeqX = tableX;
	const colResX = tableX + seqW;
	const colJudgeX = colResX + resultW;
	const colCompX = colJudgeX + sigW;

	// Column header
	pdf.setFont('helvetica', 'bold');
	pdf.setFontSize(6.5);
	pdf.setTextColor('#666666');
	pdf.text('#', colSeqX + seqW / 2, cy + 3, {align: 'center'});
	pdf.text('Result', colResX + 2, cy + 3);
	pdf.text('Judge', colJudgeX + 2, cy + 3);
	pdf.text('Comp', colCompX + 2, cy + 3);
	cy += 4.5;

	// Attempt rows + extras
	const rows: string[] = [];
	for (let i = 1; i <= opts.attemptCount; i++) rows.push(String(i));
	const extras = opts.extraCount ?? 2;
	for (let e = 1; e <= extras; e++) rows.push(`E${e}`);

	// Fit rows in remaining card height, capped so cells stay handwriting-friendly.
	const bottom = y + h - pad;
	const available = bottom - cy;
	const rowH = Math.max(6, Math.min(9, available / rows.length));

	pdf.setTextColor('#000000');
	for (const r of rows) {
		pdf.setDrawColor('#bbbbbb');
		pdf.setLineWidth(0.15);
		pdf.rect(colSeqX, cy, seqW, rowH);
		pdf.rect(colResX, cy, resultW, rowH);
		pdf.rect(colJudgeX, cy, sigW, rowH);
		pdf.rect(colCompX, cy, sigW, rowH);
		// Extra rows get a lighter seq tint cue via italic
		const isExtra = r.startsWith('E');
		pdf.setFont('helvetica', isExtra ? 'italic' : 'bold');
		pdf.setFontSize(8);
		pdf.setTextColor(isExtra ? '#888888' : '#000000');
		pdf.text(r, colSeqX + seqW / 2, cy + rowH / 2 + 1.3, {align: 'center'});
		cy += rowH;
	}
}

/**
 * Build & download a competitor scorecards PDF — A4 portrait, 4 cards per page
 * (2×2). One card per competitor (sorted by name, seat numbered) plus a couple
 * of blank spares; if there are no competitors, a sheet of blank cards.
 */
export function generateScorecardsPdf(opts: ScorecardPdfOptions): void {
	const pdf = new jsPDF({orientation: 'portrait', unit: 'mm', format: 'a4'});
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
		drawScorecard(pdf, opts, entry, slot.x, slot.y, cardW, cardH);
	});

	const safe = (s: string) => s.replace(/[^\w.-]+/g, '_');
	pdf.save(
		`${safe(opts.competitionName)}-${safe(opts.eventId)}-R${opts.roundNumber}${
			opts.groupLabel ? `-${safe(opts.groupLabel)}` : ''
		}-scorecards.pdf`
	);
}
