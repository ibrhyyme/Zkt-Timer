import { RefObject, useRef, useState } from 'react';
import useIsomorphicLayoutEffect from '../../../util/hooks/useIsomorphicLayoutEffect';
import { NAV_LABELS_SHOWN, NavLabelFit, nextNavLabelFit } from './nav_label_fit';

function px(value: string): number {
	const n = parseFloat(value);
	return Number.isFinite(n) ? n : 0;
}

/**
 * The row's content width: its groups at their natural width, the gaps and the padding.
 * The left group may shrink below its content (min-width: 0), so its scrollWidth is read,
 * not its box.
 */
function contentWidth(row: HTMLElement): number {
	const style = getComputedStyle(row);
	const kids = Array.from(row.children) as HTMLElement[];
	let width = px(style.paddingLeft) + px(style.paddingRight);
	for (const kid of kids) {
		width += kid.scrollWidth;
	}
	return width + px(style.columnGap) * Math.max(0, kids.length - 1);
}

/**
 * Whether Önceki and Sonraki show their labels on the mobile action row (nav_label_fit.ts).
 * Decided before paint, so a row that has no room never flashes the labels. Measured again
 * when the row changes size and when the language changes.
 */
export function useNavLabelFit(rowRef: RefObject<HTMLElement>, enabled: boolean, language: string): boolean {
	const [fit, setFit] = useState<NavLabelFit>(NAV_LABELS_SHOWN);
	const fitRef = useRef(fit);
	fitRef.current = fit;

	// Another language, other label widths: show them and measure again.
	useIsomorphicLayoutEffect(() => {
		setFit(NAV_LABELS_SHOWN);
	}, [language]);

	useIsomorphicLayoutEffect(() => {
		const row = rowRef.current;
		if (!enabled || !row) return;

		const measure = () => {
			const current = fitRef.current;
			const next = nextNavLabelFit(current, row.clientWidth, current.shown ? contentWidth(row) : null);
			if (next !== current) {
				setFit(next);
			}
		};

		measure();
		if (typeof ResizeObserver === 'undefined') return;
		const observer = new ResizeObserver(measure);
		observer.observe(row);
		return () => observer.disconnect();
	}, [enabled, fit.shown, language]);

	return !enabled || fit.shown;
}
