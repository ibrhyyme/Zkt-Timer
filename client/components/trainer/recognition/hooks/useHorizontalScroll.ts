/**
 * useHorizontalScroll — preset carousel scroll state.
 * Referans `composables/useHorizontalScroll.js` portu.
 */
import {useCallback, useEffect, useRef, useState} from 'react';

export function useHorizontalScroll() {
	const scrollRef = useRef<HTMLDivElement | null>(null);
	const [canScrollLeft, setCanScrollLeft] = useState(false);
	const [canScrollRight, setCanScrollRight] = useState(false);

	const updateScrollState = useCallback(() => {
		const el = scrollRef.current;
		if (!el) return;
		setCanScrollLeft(el.scrollLeft > 0);
		setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
	}, []);

	const scrollBy = useCallback((dir: number) => {
		scrollRef.current?.scrollBy({left: dir * 200, behavior: 'smooth'});
	}, []);

	useEffect(() => {
		if (typeof window === 'undefined') return;
		updateScrollState();
		const el = scrollRef.current;
		el?.addEventListener('scroll', updateScrollState, {passive: true});
		window.addEventListener('resize', updateScrollState);
		return () => {
			el?.removeEventListener('scroll', updateScrollState);
			window.removeEventListener('resize', updateScrollState);
		};
	}, [updateScrollState]);

	return {scrollRef, canScrollLeft, canScrollRight, scrollBy, updateScrollState};
}
