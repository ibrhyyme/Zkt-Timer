// The theme colours a ready-made background is drawn with. Themes write them on <html> as
// RGB triplets ("18, 20, 28"), see components/layout/themes.ts.

export type Rgb = [number, number, number];

export interface PresetPalette {
	bg: Rgb;
	mod: Rgb;
	pri: Rgb;
	sec: Rgb;
	txt: Rgb;
	/** A light background: the scene tints instead of glowing. */
	light: boolean;
}

// The Dark theme, for a variable that is missing or unreadable.
const FALLBACK: Omit<PresetPalette, 'light'> = {
	bg: [18, 20, 28],
	mod: [12, 13, 23],
	pri: [36, 107, 253],
	sec: [65, 176, 88],
	txt: [255, 255, 255],
};

export function parseRgbTriplet(value: string | null | undefined, fallback: Rgb): Rgb {
	const parts = String(value ?? '')
		.split(',')
		.map((part) => part.trim())
		.filter((part) => part !== '')
		.map(Number);
	if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return fallback;
	return parts.map((n) => Math.min(255, Math.max(0, n))) as Rgb;
}

export function isLightRgb([r, g, b]: Rgb): boolean {
	return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.55;
}

/** Reads the theme as it is on screen right now, a colour being dragged in the picker included. */
export function readThemePalette(): PresetPalette {
	const style = getComputedStyle(document.documentElement);
	const read = (name: string, fallback: Rgb) => parseRgbTriplet(style.getPropertyValue(name), fallback);
	const bg = read('--background-color', FALLBACK.bg);
	return {
		bg,
		mod: read('--module-color', FALLBACK.mod),
		pri: read('--primary-color', FALLBACK.pri),
		sec: read('--secondary-color', FALLBACK.sec),
		txt: read('--text-color', FALLBACK.txt),
		light: isLightRgb(bg),
	};
}

/** Calls back when the theme colours on <html> change. Returns the unsubscribe. */
export function watchThemePalette(onChange: () => void): () => void {
	const observer = new MutationObserver(onChange);
	observer.observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'class'] });
	return () => observer.disconnect();
}
