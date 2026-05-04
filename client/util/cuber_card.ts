// Cuber Card: 1080x1080 paylasilabilir kart olusturur
// Profil sayfasindan tetiklenir, PNG data URL doner

export interface CuberCardData {
	username: string;
	fullName?: string;
	avatarUrl?: string | null;
	countryIso2?: string | null;
	wcaId?: string | null;
	competitionCount?: number | null;
	goldMedals?: number | null;
	silverMedals?: number | null;
	bronzeMedals?: number | null;
	records?: {event: string; single?: number; average?: number}[];
}

const SIZE = 1080;

export async function generateCuberCardDataUrl(data: CuberCardData): Promise<string> {
	const canvas = document.createElement('canvas');
	canvas.width = SIZE;
	canvas.height = SIZE;
	const ctx = canvas.getContext('2d');
	if (!ctx) throw new Error('Canvas context unavailable');

	// Arka plan — dark gradient
	const bg = ctx.createLinearGradient(0, 0, SIZE, SIZE);
	bg.addColorStop(0, '#0f1419');
	bg.addColorStop(0.5, '#1a2332');
	bg.addColorStop(1, '#0a0e13');
	ctx.fillStyle = bg;
	ctx.fillRect(0, 0, SIZE, SIZE);

	// Dekorativ blur daireler
	drawGlowCircle(ctx, 200, 200, 300, 'rgba(99, 102, 241, 0.15)');
	drawGlowCircle(ctx, SIZE - 200, SIZE - 200, 350, 'rgba(236, 72, 153, 0.12)');

	// Watermark - sag alt
	ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
	ctx.font = 'bold 28px Arial, sans-serif';
	ctx.textAlign = 'right';
	ctx.fillText('zktimer.app', SIZE - 50, SIZE - 50);

	// Avatar daire ust orta
	const avatarSize = 220;
	const avatarX = SIZE / 2;
	const avatarY = 200;

	if (data.avatarUrl) {
		try {
			const img = await loadImage(data.avatarUrl);
			ctx.save();
			ctx.beginPath();
			ctx.arc(avatarX, avatarY, avatarSize / 2, 0, Math.PI * 2);
			ctx.closePath();
			ctx.clip();
			ctx.drawImage(img, avatarX - avatarSize / 2, avatarY - avatarSize / 2, avatarSize, avatarSize);
			ctx.restore();
		} catch {
			drawAvatarPlaceholder(ctx, avatarX, avatarY, avatarSize, data.username);
		}
	} else {
		drawAvatarPlaceholder(ctx, avatarX, avatarY, avatarSize, data.username);
	}

	// Avatar etrafinda halka
	ctx.beginPath();
	ctx.arc(avatarX, avatarY, avatarSize / 2 + 6, 0, Math.PI * 2);
	ctx.lineWidth = 4;
	ctx.strokeStyle = 'rgba(99, 102, 241, 0.6)';
	ctx.stroke();

	// Isim
	const displayName = data.fullName || data.username;
	ctx.fillStyle = '#ffffff';
	ctx.font = 'bold 56px Arial, sans-serif';
	ctx.textAlign = 'center';
	ctx.fillText(truncate(displayName, 28), SIZE / 2, avatarY + avatarSize / 2 + 80);

	// Ulke + WCA ID
	let subtitleParts: string[] = [];
	if (data.countryIso2) subtitleParts.push(`${countryFlag(data.countryIso2)} ${data.countryIso2}`);
	if (data.wcaId) subtitleParts.push(data.wcaId);
	if (subtitleParts.length) {
		ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
		ctx.font = '32px Arial, sans-serif';
		ctx.fillText(subtitleParts.join('  ·  '), SIZE / 2, avatarY + avatarSize / 2 + 130);
	}

	// Stat blogu — yarisma + madalyalar
	const statY = 540;
	const statBoxes: {label: string; value: string; color: string}[] = [];
	if (typeof data.competitionCount === 'number') {
		statBoxes.push({label: 'YARIŞMA', value: String(data.competitionCount), color: '#6366f1'});
	}
	if (typeof data.goldMedals === 'number') {
		statBoxes.push({label: 'ALTIN', value: String(data.goldMedals), color: '#fbbf24'});
	}
	if (typeof data.silverMedals === 'number') {
		statBoxes.push({label: 'GÜMÜŞ', value: String(data.silverMedals), color: '#cbd5e1'});
	}
	if (typeof data.bronzeMedals === 'number') {
		statBoxes.push({label: 'BRONZ', value: String(data.bronzeMedals), color: '#d97706'});
	}

	if (statBoxes.length > 0) {
		drawStatBoxes(ctx, SIZE, statY, statBoxes);
	}

	// Rekorlar — alt yari
	const records = (data.records || []).slice(0, 4);
	if (records.length > 0) {
		const recordsStartY = 760;
		ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
		ctx.font = 'bold 24px Arial, sans-serif';
		ctx.textAlign = 'center';
		ctx.fillText('REKORLAR', SIZE / 2, recordsStartY);

		drawRecordRows(ctx, SIZE, recordsStartY + 40, records);
	}

	return canvas.toDataURL('image/png');
}

function drawGlowCircle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
	const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
	grad.addColorStop(0, color);
	grad.addColorStop(1, 'rgba(0,0,0,0)');
	ctx.fillStyle = grad;
	ctx.beginPath();
	ctx.arc(x, y, r, 0, Math.PI * 2);
	ctx.fill();
}

function drawAvatarPlaceholder(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, name: string) {
	const grad = ctx.createLinearGradient(x - size / 2, y - size / 2, x + size / 2, y + size / 2);
	grad.addColorStop(0, '#6366f1');
	grad.addColorStop(1, '#ec4899');
	ctx.fillStyle = grad;
	ctx.beginPath();
	ctx.arc(x, y, size / 2, 0, Math.PI * 2);
	ctx.fill();

	const initial = (name || '?').charAt(0).toUpperCase();
	ctx.fillStyle = '#ffffff';
	ctx.font = 'bold 100px Arial, sans-serif';
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillText(initial, x, y);
	ctx.textBaseline = 'alphabetic';
}

function drawStatBoxes(
	ctx: CanvasRenderingContext2D,
	canvasW: number,
	y: number,
	boxes: {label: string; value: string; color: string}[],
) {
	const padding = 60;
	const totalW = canvasW - padding * 2;
	const boxW = totalW / boxes.length;
	const boxH = 130;

	boxes.forEach((box, i) => {
		const x = padding + boxW * i;
		const cx = x + boxW / 2;

		// Box arka plan
		ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
		roundRect(ctx, x + 10, y, boxW - 20, boxH, 16);
		ctx.fill();

		// Deger
		ctx.fillStyle = box.color;
		ctx.font = 'bold 60px Arial, sans-serif';
		ctx.textAlign = 'center';
		ctx.fillText(box.value, cx, y + 70);

		// Etiket
		ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
		ctx.font = 'bold 22px Arial, sans-serif';
		ctx.fillText(box.label, cx, y + 110);
	});
}

function drawRecordRows(
	ctx: CanvasRenderingContext2D,
	canvasW: number,
	y: number,
	records: {event: string; single?: number; average?: number}[],
) {
	const padding = 80;
	const rowH = 45;

	// Header
	ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
	ctx.font = 'bold 22px Arial, sans-serif';
	ctx.textAlign = 'left';
	ctx.fillText('EVENT', padding, y + 10);
	ctx.textAlign = 'right';
	ctx.fillText('TEKLİ', canvasW - padding - 200, y + 10);
	ctx.fillText('AO5', canvasW - padding, y + 10);

	records.forEach((r, i) => {
		const rowY = y + 50 + i * rowH;
		ctx.fillStyle = '#ffffff';
		ctx.font = 'bold 32px Arial, sans-serif';
		ctx.textAlign = 'left';
		ctx.fillText(r.event, padding, rowY);

		ctx.font = '32px Arial, sans-serif';
		ctx.textAlign = 'right';
		ctx.fillStyle = r.single ? '#ffffff' : 'rgba(255,255,255,0.3)';
		ctx.fillText(r.single ? formatCs(r.single) : '—', canvasW - padding - 200, rowY);
		ctx.fillStyle = r.average ? '#ffffff' : 'rgba(255,255,255,0.3)';
		ctx.fillText(r.average ? formatCs(r.average) : '—', canvasW - padding, rowY);
	});
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
	ctx.beginPath();
	ctx.moveTo(x + r, y);
	ctx.lineTo(x + w - r, y);
	ctx.arcTo(x + w, y, x + w, y + r, r);
	ctx.lineTo(x + w, y + h - r);
	ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
	ctx.lineTo(x + r, y + h);
	ctx.arcTo(x, y + h, x, y + h - r, r);
	ctx.lineTo(x, y + r);
	ctx.arcTo(x, y, x + r, y, r);
	ctx.closePath();
}

function loadImage(url: string): Promise<HTMLImageElement> {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.crossOrigin = 'anonymous';
		img.onload = () => resolve(img);
		img.onerror = reject;
		img.src = url;
	});
}

function truncate(s: string, max: number): string {
	if (s.length <= max) return s;
	return s.slice(0, max - 1) + '…';
}

function countryFlag(iso2: string): string {
	if (!iso2 || iso2.length !== 2) return '';
	const codePoints = iso2
		.toUpperCase()
		.split('')
		.map((c) => 0x1f1e6 - 65 + c.charCodeAt(0));
	return String.fromCodePoint(...codePoints);
}

function formatCs(centiseconds: number): string {
	if (!centiseconds) return '—';
	const minutes = Math.floor(centiseconds / 6000);
	const seconds = Math.floor((centiseconds % 6000) / 100);
	const cs = centiseconds % 100;
	if (minutes > 0) {
		return `${minutes}:${seconds.toString().padStart(2, '0')}.${cs.toString().padStart(2, '0')}`;
	}
	return `${seconds}.${cs.toString().padStart(2, '0')}`;
}

export async function shareOrDownloadCuberCard(dataUrl: string, filename: string): Promise<void> {
	if (typeof navigator !== 'undefined' && navigator.share && (navigator as any).canShare) {
		try {
			const blob = await (await fetch(dataUrl)).blob();
			const file = new File([blob], filename, {type: 'image/png'});
			if ((navigator as any).canShare({files: [file]})) {
				await navigator.share({files: [file], title: 'Cuber Card'});
				return;
			}
		} catch {
			// Native share basarisiz olursa download fallback
		}
	}

	const a = document.createElement('a');
	a.href = dataUrl;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
}
