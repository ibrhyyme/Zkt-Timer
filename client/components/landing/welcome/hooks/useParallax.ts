import { useState, useCallback } from 'react';
import { useWindowListener } from '../../../../util/hooks/useListener';

/**
 * Custom hook for scroll-based parallax effect
 * Uses requestAnimationFrame for optimized performance
 *
 * @param speed - Parallax speed multiplier (0.3 = slower, 1.0 = same speed as scroll)
 * @returns offset - Pixel offset to apply as translateY
 *
 * @example
 * const parallaxOffset = useParallax(0.3);
 * <div style={{ transform: `translateY(${parallaxOffset}px)` }}>Background</div>
 */
export function useParallax(speed: number = 0.5) {
	const [offset, setOffset] = useState(0);

	const handleScroll = useCallback(() => {
		// Use requestAnimationFrame for smooth 60fps performance
		window.requestAnimationFrame(() => {
			setOffset(window.pageYOffset * speed);
		});
	}, [speed]);

	useWindowListener('scroll', handleScroll, [speed]);

	return offset;
}
