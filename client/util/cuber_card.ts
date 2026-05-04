// Cuber Card capture utility — html2canvas tabanli
// CuberCardCanvas component'i hidden DOM element olarak render edilir,
// bu fonksiyon o elementin snapshot'ini alir ve PNG data URL doner

import html2canvas from 'html2canvas';

export async function captureCuberCard(element: HTMLElement): Promise<string> {
	// Cubing icon webfont yuklenmesini bekle — yoksa kareler bos cikar
	if (typeof document !== 'undefined' && (document as any).fonts?.ready) {
		await (document as any).fonts.ready;
	}

	const canvas = await html2canvas(element, {
		width: 1080,
		height: 1080,
		scale: 1,
		useCORS: true,
		allowTaint: false,
		backgroundColor: null,
		logging: false,
	});

	return canvas.toDataURL('image/png');
}

export async function shareOrDownloadCuberCard(dataUrl: string, filename: string): Promise<void> {
	const isMobile = typeof navigator !== 'undefined' &&
		/iPhone|iPad|iPod|Android/i.test(navigator.userAgent || '');

	// Mobil + native share API destekliyorsa share sheet aç
	if (isMobile && typeof navigator !== 'undefined' && navigator.share && (navigator as any).canShare) {
		try {
			const blob = await (await fetch(dataUrl)).blob();
			const file = new File([blob], filename, {type: 'image/png'});
			if ((navigator as any).canShare({files: [file]})) {
				await navigator.share({files: [file]});
				return;
			}
		} catch {
			// Share basarisiz olursa download fallback'ine dus
		}
	}

	// Masaustu VEYA mobilde share basarisiz: direkt download
	const a = document.createElement('a');
	a.href = dataUrl;
	a.download = filename;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
}
