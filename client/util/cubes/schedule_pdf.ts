import {jsPDF} from 'jspdf';

export interface SchedulePdfRow {
	time: string; // pre-formatted "10:00 – 11:00" or ''
	title: string;
}

export interface SchedulePdfDay {
	day: string; // pre-formatted day heading
	rows: SchedulePdfRow[];
}

export interface SchedulePdfOptions {
	competitionName: string;
	subtitle?: string; // date range + location
	heading: string; // localized "Program"
	days: SchedulePdfDay[];
}

const CDN_FONTS = '/public/fonts';

async function loadArrayBuffer(url: string): Promise<ArrayBuffer | null> {
	try {
		const r = await fetch(url);
		return await r.arrayBuffer();
	} catch {
		return null;
	}
}

function bufToBase64(buf: ArrayBuffer): string {
	const bytes = new Uint8Array(buf);
	let binary = '';
	for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
	return btoa(binary);
}

/**
 * Printable competition schedule — A4 portrait, day sections with time + title
 * rows. Roboto is embedded so Turkish characters render correctly.
 */
export async function generateSchedulePdf(opts: SchedulePdfOptions): Promise<void> {
	const [regBuf, boldBuf] = await Promise.all([
		loadArrayBuffer(`${CDN_FONTS}/Roboto-Regular.ttf`),
		loadArrayBuffer(`${CDN_FONTS}/Roboto-Bold.ttf`),
	]);

	const pdf = new jsPDF({orientation: 'portrait', unit: 'mm', format: 'a4'});
	const pageW = 210;
	const pageH = 297;
	const margin = 16;

	const hasRoboto = !!regBuf && !!boldBuf;
	if (hasRoboto) {
		pdf.addFileToVFS('Roboto-Regular.ttf', bufToBase64(regBuf!));
		pdf.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
		pdf.addFileToVFS('Roboto-Bold.ttf', bufToBase64(boldBuf!));
		pdf.addFont('Roboto-Bold.ttf', 'Roboto', 'bold');
	}
	const font = hasRoboto ? 'Roboto' : 'helvetica';

	let y = margin;

	pdf.setFont(font, 'bold');
	pdf.setFontSize(18);
	pdf.setTextColor('#1a1a1a');
	pdf.text(opts.competitionName, margin, y);
	y += 7;
	if (opts.subtitle) {
		pdf.setFont(font, 'normal');
		pdf.setFontSize(10);
		pdf.setTextColor('#555555');
		pdf.text(opts.subtitle, margin, y);
		y += 6;
	}
	pdf.setFont(font, 'bold');
	pdf.setFontSize(13);
	pdf.setTextColor('#1a1a1a');
	pdf.text(opts.heading, margin, y + 2);
	y += 8;

	for (const day of opts.days) {
		if (y > pageH - margin - 20) {
			pdf.addPage();
			y = margin;
		}
		if (day.day) {
			pdf.setFillColor('#eeeeee');
			pdf.rect(margin, y - 4.5, pageW - margin * 2, 7.5, 'F');
			pdf.setFont(font, 'bold');
			pdf.setFontSize(11);
			pdf.text(day.day, margin + 2, y);
			y += 7;
		}
		for (const row of day.rows) {
			if (y > pageH - margin) {
				pdf.addPage();
				y = margin;
			}
			pdf.setFont(font, 'bold');
			pdf.setFontSize(10);
			pdf.setTextColor('#1a1a1a');
			pdf.text(row.time || '—', margin + 2, y);
			pdf.setFont(font, 'normal');
			pdf.text(row.title, margin + 38, y);
			pdf.setDrawColor('#dddddd');
			pdf.setLineWidth(0.15);
			pdf.line(margin, y + 1.6, pageW - margin, y + 1.6);
			y += 6;
		}
		y += 3;
	}

	const safe = (s: string) => s.replace(/[^\w.-]+/g, '_');
	pdf.save(`${safe(opts.competitionName)}-schedule.pdf`);
}
