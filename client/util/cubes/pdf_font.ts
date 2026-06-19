import {jsPDF} from 'jspdf';

// jsPDF's built-in Helvetica is WinAnsi/Latin-1 only, so Turkish letters like
// ı (U+0131), ş, ğ, İ render as wrong/blank glyphs (e.g. "Çınar" -> "Ç1nar").
// Embedding Roboto (covers Latin Extended-A) fixes competition + competitor
// names across the generated competition PDFs. Mirrors the embed already used
// by certificate_pdf.ts / schedule_pdf.ts, centralised here.

async function loadArrayBuffer(url: string): Promise<ArrayBuffer | null> {
	try {
		const r = await fetch(url);
		if (!r.ok) return null;
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
 * Embed Roboto (Regular + Bold) into the doc and return the font family to use
 * in every setFont() call. Falls back to 'helvetica' if the assets can't be
 * fetched, so PDF generation never hard-fails — only Turkish glyphs degrade.
 *
 * Call once right after `new jsPDF(...)`, then pass the result to setFont.
 */
export async function ensureRobotoFont(pdf: jsPDF): Promise<string> {
	const [reg, bold] = await Promise.all([
		loadArrayBuffer('/public/fonts/Roboto-Regular.ttf'),
		loadArrayBuffer('/public/fonts/Roboto-Bold.ttf'),
	]);
	if (!reg || !bold) return 'helvetica';
	pdf.addFileToVFS('Roboto-Regular.ttf', bufToBase64(reg));
	pdf.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
	pdf.addFileToVFS('Roboto-Bold.ttf', bufToBase64(bold));
	pdf.addFont('Roboto-Bold.ttf', 'Roboto', 'bold');
	return 'Roboto';
}
