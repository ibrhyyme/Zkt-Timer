import {jsPDF} from 'jspdf';
import {ensureRobotoFont} from './pdf_font';

// Pre-formatted result row. The caller formats times/ranks (via shared helpers)
// so this generator stays dependency-free and only handles layout/pagination.
export interface ResultPdfRow {
	rank: string; // "1" or "-"
	name: string;
	country?: string; // ISO2 code, e.g. "TR" (emoji flags don't render in jsPDF fonts)
	attempts: string[]; // already formatted ("12.34" / "DNF" / "")
	best: string;
	average: string;
}

export interface ResultsPdfOptions {
	competitionName: string;
	eventName: string;
	roundNumber: number;
	attemptCount: number;
	hasAverage: boolean;
	rows: ResultPdfRow[];
}

/**
 * Render a round's results to an A4 portrait table (WCA-live style ordering:
 * rank, name, country, attempts, best, average) and trigger a download.
 */
export async function generateResultsPdf(opts: ResultsPdfOptions): Promise<void> {
	const pdf = new jsPDF({orientation: 'portrait', unit: 'mm', format: 'a4'});
	const font = await ensureRobotoFont(pdf);
	const pageWidth = 210;
	const pageHeight = 297;
	const margin = 12;
	const usableWidth = pageWidth - margin * 2;

	// Column widths (mm). Attempts share the remaining space evenly.
	const rankW = 10;
	const countryW = 12;
	const bestW = 18;
	const avgW = opts.hasAverage ? 18 : 0;
	const nameW = 46;
	const attemptsTotal = usableWidth - rankW - nameW - countryW - bestW - avgW;
	const attemptW = opts.attemptCount > 0 ? attemptsTotal / opts.attemptCount : 0;

	const xRank = margin;
	const xName = xRank + rankW;
	const xCountry = xName + nameW;
	const xAttempts = xCountry + countryW;
	const xBest = xAttempts + attemptsTotal;
	const xAvg = xBest + bestW;

	let y = margin;

	function header() {
		pdf.setFont(font, 'bold');
		pdf.setFontSize(15);
		pdf.text(opts.competitionName, margin, y);
		y += 6.5;
		pdf.setFont(font, 'normal');
		pdf.setFontSize(11);
		pdf.text(`${opts.eventName} — Round ${opts.roundNumber}`, margin, y);
		y += 7;
		columnHeader();
	}

	function columnHeader() {
		pdf.setFont(font, 'bold');
		pdf.setFontSize(8.5);
		pdf.setTextColor('#333333');
		pdf.text('#', xRank, y);
		pdf.text('Competitor', xName, y);
		pdf.text('Nat', xCountry, y);
		for (let i = 0; i < opts.attemptCount; i++) {
			pdf.text(String(i + 1), xAttempts + i * attemptW + attemptW - 2, y, {align: 'right'});
		}
		pdf.text('Best', xBest + bestW - 2, y, {align: 'right'});
		if (opts.hasAverage) pdf.text('Average', xAvg + avgW - 2, y, {align: 'right'});
		y += 2;
		pdf.setDrawColor('#999999');
		pdf.setLineWidth(0.2);
		pdf.line(margin, y, pageWidth - margin, y);
		y += 4;
		pdf.setTextColor('#000000');
	}

	header();

	pdf.setFont(font, 'normal');
	pdf.setFontSize(9);

	for (const row of opts.rows) {
		// Page break when the next row would overflow the bottom margin.
		if (y > pageHeight - margin) {
			pdf.addPage();
			y = margin;
			header();
			pdf.setFont(font, 'normal');
			pdf.setFontSize(9);
		}

		pdf.text(row.rank, xRank, y);
		pdf.text(truncate(pdf, row.name, nameW - 2), xName, y);
		if (row.country) pdf.text(row.country, xCountry, y);
		for (let i = 0; i < opts.attemptCount; i++) {
			const a = row.attempts[i] ?? '';
			if (a) pdf.text(a, xAttempts + i * attemptW + attemptW - 2, y, {align: 'right'});
		}
		pdf.setFont(font, 'bold');
		pdf.text(row.best, xBest + bestW - 2, y, {align: 'right'});
		pdf.setFont(font, 'normal');
		if (opts.hasAverage) pdf.text(row.average, xAvg + avgW - 2, y, {align: 'right'});

		y += 5;
		pdf.setDrawColor('#eeeeee');
		pdf.setLineWidth(0.1);
		pdf.line(margin, y - 1.5, pageWidth - margin, y - 1.5);
	}

	const safe = (s: string) => s.replace(/[^\w.-]+/g, '_');
	pdf.save(`${safe(opts.competitionName)}-${safe(opts.eventName)}-R${opts.roundNumber}-results.pdf`);
}

// Trim a string with an ellipsis so it fits within maxWidth (mm) at the current font.
function truncate(pdf: jsPDF, text: string, maxWidth: number): string {
	if (pdf.getTextWidth(text) <= maxWidth) return text;
	let t = text;
	while (t.length > 1 && pdf.getTextWidth(t + '…') > maxWidth) {
		t = t.slice(0, -1);
	}
	return t + '…';
}
