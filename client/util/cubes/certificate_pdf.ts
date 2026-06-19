import {jsPDF} from 'jspdf';

/**
 * Competition certificates — WCA-style layout, ZKT-branded (no WCA references).
 * Two kinds, both A4 landscape, one page per competitor:
 *  - Participation: every competitor + an Event/Result/Ranking table.
 *  - Podium: each event's top 3 ("... placed first/second/third ...").
 *
 * Layout: decorative competition name (Comic Neue) up top, a colored certifier
 * line, the big competitor name, the body, then three footer columns:
 * left = Zeka Küpü Türkiye logo + organizer, center = date + location,
 * right = sponsor (Beyoğlu) logo. Body fonts are Roboto so Turkish renders.
 */

export interface ParticipationResultRow {
	eventName: string;
	result: string; // pre-formatted (e.g. "12.34", "DNF")
	ranking: number;
}

export interface ParticipationCert {
	name: string;
	results: ParticipationResultRow[];
}

export interface PodiumCert {
	name: string;
	eventName: string;
	place: number; // 1 | 2 | 3
	result: string; // pre-formatted
}

// Pre-translated strings + meta, so the generator stays i18n-agnostic and pure.
export interface CertCommon {
	competitionName: string;
	dateText: string; // e.g. "7 - 8 Mar 2026"
	locationText: string; // e.g. "Ankara"
	organizerName: string;
	titleParticipation: string; // unused header text reserved
	certifyLine: string; // "{organizer}, Zeka Küpü Türkiye adına onaylar:" with {organizer} placeholder
	organizerLabel: string; // "Organizatör"
	sponsorLabel: string; // "Sponsor"
	participatedText: string; // "{comp} yarışmasına katıldı, sonuçları:" with {comp}
	colEvent: string;
	colResult: string;
	colRanking: string;
	placed: [string, string, string]; // [birinci, ikinci, üçüncü] / [first, second, third]
	podiumLine: string; // "{event} etkinliğinde {place} oldu" — {event}+{place} highlighted
	footerNote?: string;
}

const ACCENT = '#ff5722'; // competitor name (warm orange, WCA-like)
const HILITE = '#e23b3b'; // place + event highlight
const ORG_COLOR = '#1aa64b'; // organizer name in the certify line
const COMP_COLOR = '#8b3df0'; // competition name in the certify line
const INK = '#1a1a1a';
const SUB = '#555555';

async function loadArrayBuffer(url: string): Promise<ArrayBuffer | null> {
	try {
		const r = await fetch(url);
		if (!r.ok) return null;
		return await r.arrayBuffer();
	} catch {
		return null;
	}
}

async function loadAsDataUrl(url: string): Promise<string | null> {
	try {
		const r = await fetch(url);
		if (!r.ok) return null;
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

interface Fonts {
	body: string; // Roboto (Turkish-safe) or helvetica fallback
	display: string; // Comic Neue (playful) or body fallback
}

interface Assets {
	fonts: Fonts;
	zktLogo: string | null;
	sponsorLogo: string | null;
}

async function loadAssets(pdf: jsPDF): Promise<Assets> {
	const [robReg, robBold, comicBold, comicReg, zktLogo, sponsorLogo] = await Promise.all([
		loadArrayBuffer('/public/fonts/Roboto-Regular.ttf'),
		loadArrayBuffer('/public/fonts/Roboto-Bold.ttf'),
		loadArrayBuffer('/public/fonts/ComicNeue-Bold.ttf'),
		loadArrayBuffer('/public/fonts/ComicNeue-Regular.ttf'),
		loadAsDataUrl('/public/images/zkt-logo-dark.png'),
		loadAsDataUrl('/public/images/sponsors/beyoglu.png'),
	]);

	let body = 'helvetica';
	if (robReg && robBold) {
		pdf.addFileToVFS('Roboto-Regular.ttf', bufToBase64(robReg));
		pdf.addFont('Roboto-Regular.ttf', 'Roboto', 'normal');
		pdf.addFileToVFS('Roboto-Bold.ttf', bufToBase64(robBold));
		pdf.addFont('Roboto-Bold.ttf', 'Roboto', 'bold');
		body = 'Roboto';
	}

	let display = body;
	if (comicBold && comicReg) {
		pdf.addFileToVFS('ComicNeue-Bold.ttf', bufToBase64(comicBold));
		pdf.addFont('ComicNeue-Bold.ttf', 'ComicNeue', 'bold');
		pdf.addFileToVFS('ComicNeue-Regular.ttf', bufToBase64(comicReg));
		pdf.addFont('ComicNeue-Regular.ttf', 'ComicNeue', 'normal');
		display = 'ComicNeue';
	}

	return {fonts: {body, display}, zktLogo, sponsorLogo};
}

interface Seg {
	text: string;
	color?: string;
	bold?: boolean;
}

// Draw a single centered line made of differently-colored segments.
function drawColoredCenter(
	pdf: jsPDF,
	font: string,
	segs: Seg[],
	centerX: number,
	y: number,
	fontSize: number
): void {
	pdf.setFontSize(fontSize);
	let total = 0;
	for (const s of segs) {
		pdf.setFont(font, s.bold ? 'bold' : 'normal');
		total += pdf.getTextWidth(s.text);
	}
	let x = centerX - total / 2;
	for (const s of segs) {
		pdf.setFont(font, s.bold ? 'bold' : 'normal');
		pdf.setTextColor(s.color || INK);
		pdf.text(s.text, x, y);
		x += pdf.getTextWidth(s.text);
	}
}

// Split a template ("{event} ... {place} ...") into colored segments. `vars`
// maps a placeholder name → Seg; the surrounding plain text uses `defColor`.
function parseTemplate(template: string, vars: Record<string, Seg>, defColor: string): Seg[] {
	const out: Seg[] = [];
	const re = /\{(\w+)\}/g;
	let last = 0;
	let m: RegExpExecArray | null;
	while ((m = re.exec(template)) !== null) {
		if (m.index > last) out.push({text: template.slice(last, m.index), color: defColor});
		const v = vars[m[1]];
		if (v) out.push(v);
		last = re.lastIndex;
	}
	if (last < template.length) out.push({text: template.slice(last), color: defColor});
	return out;
}

// Decorative competition title (Comic Neue, wide letter spacing), wrapped to
// at most two centered lines. Returns the y after the title block.
function drawTitle(pdf: jsPDF, display: string, name: string, pageW: number, top: number): number {
	pdf.setFont(display, 'bold');
	pdf.setTextColor(INK);
	let size = 38;
	const maxW = pageW - 60;
	const charSpace = 1.2;
	const widthOf = (t: string) => {
		pdf.setFontSize(size);
		return pdf.getTextWidth(t) + charSpace * Math.max(0, t.length - 1);
	};
	// One line if it fits, else split into two on a space near the middle.
	if (widthOf(name) <= maxW) {
		pdf.setFontSize(size);
		pdf.text(name, pageW / 2, top, {align: 'center', charSpace});
		return top + 6;
	}
	// Split.
	const words = name.split(' ');
	let best = Math.ceil(words.length / 2);
	const line1 = words.slice(0, best).join(' ');
	const line2 = words.slice(best).join(' ');
	while (size > 22 && (widthOf(line1) > maxW || widthOf(line2) > maxW)) size -= 2;
	pdf.setFontSize(size);
	pdf.text(line1, pageW / 2, top, {align: 'center', charSpace});
	pdf.text(line2, pageW / 2, top + size * 0.42, {align: 'center', charSpace});
	return top + size * 0.42 + 6;
}

// Three footer columns: organizer (+ZKT logo), date/location, sponsor logo.
function drawFooter(pdf: jsPDF, a: Assets, opts: CertCommon, pageW: number, pageH: number): void {
	const baseY = pageH - 18;
	const {body, display} = a.fonts;

	// Left — ZKT logo above organizer name + label.
	const leftX = 48;
	if (a.zktLogo) {
		try {
			pdf.addImage(a.zktLogo, 'PNG', leftX - 18, baseY - 44, 36, 36);
		} catch {
			/* ignore */
		}
	}
	pdf.setFont(body, 'bold');
	pdf.setFontSize(11);
	pdf.setTextColor(INK);
	pdf.text(opts.organizerName, leftX, baseY, {align: 'center'});
	pdf.setFont(body, 'normal');
	pdf.setFontSize(9);
	pdf.setTextColor(SUB);
	pdf.text(opts.organizerLabel, leftX, baseY + 5, {align: 'center'});

	// Center — date + location (Comic Neue).
	pdf.setFont(display, 'bold');
	pdf.setFontSize(15);
	pdf.setTextColor(INK);
	pdf.text(opts.dateText, pageW / 2, baseY - 4, {align: 'center'});
	pdf.text(opts.locationText, pageW / 2, baseY + 4, {align: 'center'});

	// Right — sponsor logo (Beyoğlu is portrait 348x802) + label.
	const rightX = pageW - 48;
	if (a.sponsorLogo) {
		try {
			const h = 38;
			const w = h * (348 / 802); // keep aspect ratio
			pdf.addImage(a.sponsorLogo, 'PNG', rightX - w / 2, baseY - 46, w, h);
		} catch {
			/* ignore */
		}
	}
	pdf.setFont(body, 'normal');
	pdf.setFontSize(9);
	pdf.setTextColor(SUB);
	pdf.text(opts.sponsorLabel, rightX, baseY + 2, {align: 'center'});

	if (opts.footerNote) {
		pdf.setFont(body, 'normal');
		pdf.setFontSize(7);
		pdf.setTextColor('#aaaaaa');
		pdf.text(opts.footerNote, pageW / 2, pageH - 6, {align: 'center'});
	}
}

// Shared top half: title, certify line, big competitor name. Returns y for body.
function drawHeader(
	pdf: jsPDF,
	a: Assets,
	opts: CertCommon,
	competitorName: string,
	pageW: number
): number {
	const {body, display} = a.fonts;

	let y = drawTitle(pdf, display, opts.competitionName, pageW, 34);
	y += 16;

	// Certify line — organizer name highlighted within the localized template.
	drawColoredCenter(
		pdf,
		body,
		parseTemplate(opts.certifyLine, {organizer: {text: opts.organizerName, color: ORG_COLOR, bold: true}}, SUB),
		pageW / 2,
		y,
		13
	);
	y += 16;

	// Competitor name — big, warm orange.
	pdf.setFont(body, 'bold');
	pdf.setFontSize(30);
	pdf.setTextColor(ACCENT);
	pdf.text(competitorName, pageW / 2, y, {align: 'center'});
	return y + 12;
}

function placeWord(opts: CertCommon, place: number): string {
	return opts.placed[place - 1] || `${place}.`;
}

function drawPodiumBody(
	pdf: jsPDF,
	a: Assets,
	opts: CertCommon,
	cert: PodiumCert,
	pageW: number,
	y: number
): void {
	const {body} = a.fonts;
	// "{event} etkinliğinde {place} oldu" — event + place highlighted (order is
	// language-driven via the template).
	drawColoredCenter(
		pdf,
		body,
		parseTemplate(
			opts.podiumLine,
			{
				event: {text: cert.eventName, color: HILITE, bold: true},
				place: {text: placeWord(opts, cert.place), color: HILITE, bold: true},
			},
			INK
		),
		pageW / 2,
		y + 6,
		17
	);
	// Result line.
	pdf.setFont(body, 'normal');
	pdf.setFontSize(14);
	pdf.setTextColor(SUB);
	pdf.text(cert.result, pageW / 2, y + 16, {align: 'center'});
}

function drawParticipationBody(
	pdf: jsPDF,
	a: Assets,
	opts: CertCommon,
	cert: ParticipationCert,
	pageW: number,
	y: number
): void {
	const {body} = a.fonts;
	// "{comp} yarışmasına katıldı, sonuçları:" — competition name highlighted.
	drawColoredCenter(
		pdf,
		body,
		parseTemplate(opts.participatedText, {comp: {text: opts.competitionName, color: COMP_COLOR, bold: true}}, INK),
		pageW / 2,
		y + 4,
		12
	);

	// Results table — 3 columns, centered.
	const tableW = 130;
	const x0 = (pageW - tableW) / 2;
	const cEvent = x0;
	const cResult = x0 + 78;
	const cRank = x0 + 110;
	let ty = y + 14;

	// Header row.
	pdf.setFont(body, 'bold');
	pdf.setFontSize(10);
	pdf.setTextColor(INK);
	pdf.text(opts.colEvent, cEvent, ty);
	pdf.text(opts.colResult, cResult, ty);
	pdf.text(opts.colRanking, cRank, ty);
	ty += 1.5;
	pdf.setDrawColor('#999999');
	pdf.setLineWidth(0.3);
	pdf.line(x0, ty, x0 + tableW, ty);
	ty += 5;

	pdf.setFont(body, 'normal');
	pdf.setFontSize(10);
	for (const r of cert.results) {
		pdf.setTextColor(INK);
		pdf.text(r.eventName, cEvent, ty);
		pdf.text(r.result, cResult, ty);
		pdf.text(String(r.ranking), cRank, ty);
		ty += 1.5;
		pdf.setDrawColor('#e5e5e5');
		pdf.setLineWidth(0.15);
		pdf.line(x0, ty, x0 + tableW, ty);
		ty += 4.5;
	}
}

export async function generatePodiumCertificates(opts: CertCommon, certs: PodiumCert[]): Promise<void> {
	if (certs.length === 0) return;
	const pdf = new jsPDF({orientation: 'landscape', unit: 'mm', format: 'a4'});
	const pageW = 297;
	const pageH = 210;
	const assets = await loadAssets(pdf);

	certs.forEach((cert, i) => {
		if (i > 0) pdf.addPage();
		const y = drawHeader(pdf, assets, opts, cert.name, pageW);
		drawPodiumBody(pdf, assets, opts, cert, pageW, y);
		drawFooter(pdf, assets, opts, pageW, pageH);
	});

	const safe = (s: string) => s.replace(/[^\w.-]+/g, '_');
	pdf.save(`${safe(opts.competitionName)}-podyum-sertifikalari.pdf`);
}

export async function generateParticipationCertificates(
	opts: CertCommon,
	certs: ParticipationCert[]
): Promise<void> {
	if (certs.length === 0) return;
	const pdf = new jsPDF({orientation: 'landscape', unit: 'mm', format: 'a4'});
	const pageW = 297;
	const pageH = 210;
	const assets = await loadAssets(pdf);

	certs.forEach((cert, i) => {
		if (i > 0) pdf.addPage();
		const y = drawHeader(pdf, assets, opts, cert.name, pageW);
		drawParticipationBody(pdf, assets, opts, cert, pageW, y);
		drawFooter(pdf, assets, opts, pageW, pageH);
	});

	const safe = (s: string) => s.replace(/[^\w.-]+/g, '_');
	pdf.save(`${safe(opts.competitionName)}-katilim-sertifikalari.pdf`);
}
