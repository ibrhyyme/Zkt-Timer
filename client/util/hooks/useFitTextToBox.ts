import { DependencyList, RefObject, useCallback, useRef, useState } from 'react';
import useIsomorphicLayoutEffect from './useIsomorphicLayoutEffect';
import { findFitFontSize } from '../text-fit';

interface UseFitTextToBoxOptions {
	text: string;
	maxFontSize: number;
	minFontSize?: number;
	lineHeightRatio?: number;
	enabled?: boolean;
	deps?: DependencyList;
}

interface UseFitTextToBoxResult {
	containerRef: RefObject<HTMLDivElement>;
	textRef: RefObject<HTMLDivElement>;
	fontSize: number;
	overflowing: boolean;
}

// Fits `text` to the available space of `containerRef` by shrinking font size,
// without ever rendering an intermediate (too-large) size — the fit is computed
// off-DOM via canvas measurement (see util/text-fit.ts) and committed in a single
// state update inside a layout effect, so it's resolved before the browser paints.
export function useFitTextToBox(options: UseFitTextToBoxOptions): UseFitTextToBoxResult {
	const {
		text,
		maxFontSize,
		minFontSize = 8,
		lineHeightRatio = 1.4,
		enabled = true,
		deps = [],
	} = options;

	const containerRef = useRef<HTMLDivElement>(null);
	const textRef = useRef<HTMLDivElement>(null);

	const [fontSize, setFontSize] = useState(maxFontSize);
	const [overflowing, setOverflowing] = useState(false);

	const runFit = useCallback(() => {
		const container = containerRef.current;
		const textEl = textRef.current;

		// Keep the last fitted size while the text is briefly empty (the next/prev
		// scramble buttons blank it before the new one is generated). Resetting to
		// maxFontSize here would render the next scramble oversized for a frame
		// whenever the refit below is skipped for a not-yet-laid-out container.
		if (!enabled || !container || !textEl || !text) {
			setOverflowing(false);
			return;
		}

		// clientHeight includes the container's padding, but the text only gets the
		// content box — subtract it, or the last line renders under the padding and
		// gets clipped by overflow: hidden.
		const containerStyle = getComputedStyle(container);
		const paddingY = (parseFloat(containerStyle.paddingTop) || 0) + (parseFloat(containerStyle.paddingBottom) || 0);
		const paddingX = (parseFloat(containerStyle.paddingLeft) || 0) + (parseFloat(containerStyle.paddingRight) || 0);

		const availableWidth = textEl.clientWidth || (container.clientWidth - paddingX);
		const availableHeight = container.clientHeight - paddingY;

		if (availableWidth <= 0 || availableHeight <= 0) return;

		const computed = getComputedStyle(textEl);
		const result = findFitFontSize(
			text,
			computed.fontFamily,
			computed.fontWeight,
			maxFontSize,
			minFontSize,
			lineHeightRatio,
			availableWidth,
			availableHeight,
		);

		setFontSize(result.fontSize);
		setOverflowing(!result.fits);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [text, maxFontSize, minFontSize, lineHeightRatio, enabled]);

	// eslint-disable-next-line react-hooks/exhaustive-deps
	useIsomorphicLayoutEffect(() => { runFit(); }, [runFit, ...deps]);

	useIsomorphicLayoutEffect(() => {
		const container = containerRef.current;
		if (!container || typeof ResizeObserver === 'undefined') return;

		const ro = new ResizeObserver(() => { runFit(); });
		ro.observe(container);
		return () => ro.disconnect();
	}, [runFit]);

	// Webfonts load async (Roboto Mono comes from Google Fonts with display=swap).
	// Until one lands, canvas measureText silently reports the fallback font's
	// metrics, so any fit computed before that is measuring the wrong typeface —
	// refit once fonts settle.
	useIsomorphicLayoutEffect(() => {
		if (typeof document === 'undefined' || !document.fonts) return;

		let cancelled = false;
		document.fonts.ready.then(() => { if (!cancelled) runFit(); });

		const onLoadingDone = () => runFit();
		document.fonts.addEventListener('loadingdone', onLoadingDone);

		return () => {
			cancelled = true;
			document.fonts.removeEventListener('loadingdone', onLoadingDone);
		};
	}, [runFit]);

	return { containerRef, textRef, fontSize, overflowing };
}
