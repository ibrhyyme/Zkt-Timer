import {RefObject, useEffect} from 'react';

/**
 * Drives a progress bar from the document scroll position by writing its transform
 * directly, once per animation frame.
 *
 * It deliberately holds no React state. The previous version called setState on every
 * scroll frame from the page root, and in React 17 a setState inside requestAnimationFrame
 * renders synchronously, so the whole landing page re-rendered on every frame of a
 * scroll: measured at about 9 fps on 2026-09-30. The bar is the only thing that needs
 * the value, so only the bar is touched.
 */
export function useScrollProgress(barRef: RefObject<HTMLElement>): void {
	useEffect(() => {
		const bar = barRef.current;
		if (!bar) return;

		let raf = 0;
		const calc = () => {
			raf = 0;
			const doc = document.documentElement;
			const scrollable = doc.scrollHeight - doc.clientHeight;
			const p = scrollable > 0 ? Math.min(1, Math.max(0, doc.scrollTop / scrollable)) : 0;
			bar.style.transform = `scaleX(${p})`;
		};

		const onScroll = () => {
			if (!raf) raf = requestAnimationFrame(calc);
		};

		calc();
		window.addEventListener('scroll', onScroll, {passive: true});
		window.addEventListener('resize', onScroll);

		return () => {
			if (raf) cancelAnimationFrame(raf);
			window.removeEventListener('scroll', onScroll);
			window.removeEventListener('resize', onScroll);
		};
	}, [barRef]);
}
