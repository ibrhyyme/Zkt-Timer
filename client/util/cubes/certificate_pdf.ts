import {jsPDF} from 'jspdf';

/**
 * One podium certificate. `lines` are pre-translated by the caller (event name,
 * place, result) so this generator stays i18n-agnostic and pure — it only does
 * layout. `place` (1/2/3) drives the accent/medal color.
 */
export interface CertificateEntry {
	name: string;
	place: number;
	lines: string[];
}

export interface CertificatePdfOptions {
	title: string; // localized, e.g. "Başarı Sertifikası"
	competitionName: string;
	subtitle?: string; // pre-formatted date + location
	signerLabel?: string; // localized, e.g. "Organizatör"
	signerName?: string;
	footerNote?: string; // localized small print
	certificates: CertificateEntry[];
}

async function loadArrayBuffer(url: string): Promise<ArrayBuffer | null> {
	try {
		const r = await fetch(url);
		return await r.arrayBuffer();
	} catch {
		return null;
	}
}

async function loadAsDataUrl(url: string): Promise<string | null> {
	try {
		const r = await fetch(url);
		const blob = await r.blob();
		return await new Promise((resolve) => {
			const reader = new FileReader();
			reader.onloadend = () => resolve(reader.result as string);
			reader.onerror = () => resolve(null);
			reader.readAsDataURL(blob);
		});
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

// Medal accent per place; fallback to brand blue for non-podium (shouldn't happen).
const PLACE_COLOR: Record<number, string> = {
	1: '#f5c518', // gold
	2: '#b8b8b8', // silver
	3: '#cd7f32', // bronze
};

function drawCertificate(
	pdf: jsPDF,
	font: string,
	opts: CertificatePdfOptions,
	cert: CertificateEntry,
	pageW: number,
	pageH: number,
	logo: string | null
): void {
	const accent = PLACE_COLOR[cert.place] || '#3b82f6';

	// Double decorative frame.
	pdf.setDrawColor('#222222');
	pdf.setLineWidth(1.2);
	pdf.rect(10, 10, pageW - 20, pageH - 20);
	pdf.setDrawColor(accent);
	pdf.setLineWidth(0.5);
	pdf.rect(13, 13, pageW - 26, pageH - 26);

	// Accent top bar.
	pdf.setFillColor(accent);
	pdf.rect(13, 13, pageW - 26, 4, 'F');

	// Logo (centered, top).
	if (logo) {
		try {
			const logoW = 38;
			const logoH = 13;
			pdf.addImage(logo, 'PNG', (pageW - logoW) / 2, 26, logoW, logoH);
		} catch {
			// ignore logo failures
		}
	}

	let cy = 62;

	// Title.
	pdf.setFont(font, 'bold');
	pdf.setFontSize(30);
	pdf.setTextColor('#1a1a1a');
	pdf.text(opts.title, pageW / 2, cy, {align: 'center'});
	const tw = pdf.getTextWidth(opts.title);
	pdf.setDrawColor(accent);
	pdf.setLineWidth(0.8);
	pdf.line(pageW / 2 - tw / 2, cy + 3, pageW / 2 + tw / 2, cy + 3);

	cy += 24;

	// Competitor name (large, accent colored).
	pdf.setFont(font, 'bold');
	pdf.setFontSize(34);
	pdf.setTextColor(accent);
	pdf.text(cert.name, pageW / 2, cy, {align: 'center'});

	cy += 16;

	// Body lines.
	pdf.setFont(font, 'normal');
	pdf.setFontSize(14);
	pdf.setTextColor('#333333');
	for (const line of cert.lines) {
		pdf.text(line, pageW / 2, cy, {align: 'center'});
		cy += 8.5;
	}

	// Footer: competition + date/location (left), signature (right).
	const footY = pageH - 36;
	pdf.setFont(font, 'bold');
	pdf.setFontSize(12);
	pdf.setTextColor('#1a1a1a');
	pdf.text(opts.competitionName, 30, footY);
	if (opts.subtitle) {
		pdf.setFont(font, 'normal');
		pdf.setFontSize(9);
		pdf.setTextColor('#666666');
		pdf.text(opts.subtitle, 30, footY + 6);
	}

	// Signature line (right).
	const sigX2 = pageW - 30;
	const sigX1 = sigX2 - 70;
	pdf.setDrawColor('#999999');
	pdf.setLineWidth(0.3);
	pdf.line(sigX1, footY, sigX2, footY);
	const sigMidX = (sigX1 + sigX2) / 2;
	if (opts.signerName) {
		pdf.setFont(font, 'bold');
		pdf.setFontSize(10);
		pdf.setTextColor('#1a1a1a');
		pdf.text(opts.signerName, sigMidX, footY + 5, {align: 'center'});
	}
	if (opts.signerLabel) {
		pdf.setFont(font, 'normal');
		pdf.setFontSize(8);
		pdf.setTextColor('#666666');
		pdf.text(opts.signerLabel, sigMidX, footY + (opts.signerName ? 10 : 5), {align: 'center'});
	}

	// Small print.
	if (opts.footerNote) {
		pdf.setFont(font, 'normal');
		pdf.setFontSize(7);
		pdf.setTextColor('#aaaaaa');
		pdf.text(opts.footerNote, pageW / 2, pageH - 16, {align: 'center'});
	}
}

/**
 * Build & download podium certificates — A4 landscape, one certificate per page.
 * Turkish characters render correctly via embedded Roboto (falls back to
 * helvetica if the font assets fail to load).
 */
export async function generateCertificatesPdf(opts: CertificatePdfOptions): Promise<void> {
	const [regBuf, boldBuf, logo] = await Promise.all([
		loadArrayBuffer('/public/fonts/Roboto-Regular.ttf'),
		loadArrayBuffer('/public/fonts/Roboto-Bold.ttf'),
		loadAsDataUrl('/public/images/zkt-logo-dark.png'),
	]);

	const pdf = new jsPDF({orientation: 'landscape', unit: 'mm', format: 'a4'});
	const pageW = 297;
	const pageH = 210;

	const hasRoboto = !!regBuf && !!boldBuf;
	if (hasRoboto) {
		pdf.addFileToVFS('Roboto-Regular.ttf', bufToBase64(regBuf!));
		pdf.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
		pdf.addFileToVFS('Roboto-Bold.ttf', bufToBase64(boldBuf!));
		pdf.addFont('Roboto-Bold.ttf', 'Roboto', 'bold');
	}
	const font = hasRoboto ? 'Roboto' : 'helvetica';

	if (opts.certificates.length === 0) return;

	opts.certificates.forEach((cert, i) => {
		if (i > 0) pdf.addPage();
		drawCertificate(pdf, font, opts, cert, pageW, pageH, logo);
	});

	const safe = (s: string) => s.replace(/[^\w.-]+/g, '_');
	pdf.save(`${safe(opts.competitionName)}-certificates.pdf`);
}
