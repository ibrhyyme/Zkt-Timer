/**
 * Puts text on the clipboard: the async Clipboard API, or the hidden textarea copy where it
 * is missing or refused (older WebViews, an http origin). False when neither worked.
 */
export async function copyText(text: string): Promise<boolean> {
	try {
		if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
			await navigator.clipboard.writeText(text);
			return true;
		}
	} catch {
		// fall through to the textarea copy
	}
	try {
		const area = document.createElement('textarea');
		area.value = text;
		area.setAttribute('readonly', '');
		area.style.position = 'fixed';
		area.style.opacity = '0';
		document.body.appendChild(area);
		area.select();
		const ok = document.execCommand('copy');
		document.body.removeChild(area);
		return ok;
	} catch {
		return false;
	}
}
