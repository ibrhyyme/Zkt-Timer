import { useEffect, useRef, useState } from 'react';

export interface UseInViewOptions {
	threshold?: number | number[];
	rootMargin?: string;
	triggerOnce?: boolean;
	skip?: boolean;
}

/**
 * Custom hook for Intersection Observer API
 * Triggers animations when element enters viewport
 *
 * @param options - Configuration options for intersection observer
 * @returns { ref, isInView, hasTriggered } - Ref to attach to element, visibility state, and trigger state
 *
 * @example
 * const { ref, isInView } = useInView({ threshold: 0.2, triggerOnce: true });
 * <div ref={ref as any} className={isInView ? 'visible' : ''}>Content</div>
 */
export function useInView(options: UseInViewOptions = {}) {
	const {
		threshold = 0.1,
		rootMargin = '0px',
		triggerOnce = true,
		skip = false
	} = options;

	const ref = useRef<HTMLElement>(null);
	const [isInView, setIsInView] = useState(false);
	const [hasTriggered, setHasTriggered] = useState(false);

	useEffect(() => {
		const element = ref.current;

		if (!element || skip) return;
		if (triggerOnce && hasTriggered) return;

		// Fallback for browsers without IntersectionObserver
		if (!('IntersectionObserver' in window)) {
			setIsInView(true);
			return;
		}

		const observer = new IntersectionObserver(
			([entry]) => {
				const inView = entry.isIntersecting;

				if (inView) {
					setIsInView(true);
					if (triggerOnce) {
						setHasTriggered(true);
						observer.disconnect();
					}
				} else if (!triggerOnce) {
					setIsInView(false);
				}
			},
			{
				threshold,
				rootMargin
			}
		);

		observer.observe(element);

		return () => {
			observer.disconnect();
		};
	}, [threshold, rootMargin, triggerOnce, hasTriggered, skip]);

	return { ref, isInView, hasTriggered };
}
