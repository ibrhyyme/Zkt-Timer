import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

if (typeof window !== 'undefined') {
	gsap.registerPlugin(ScrollTrigger);
}

export interface ScrollTriggerConfig {
	from: gsap.TweenVars;
	to: gsap.TweenVars;
	start?: string;
	end?: string;
	scrub?: boolean | number;
	toggleActions?: string;
	markers?: boolean;
}

/**
 * GSAP ScrollTrigger hook for scroll-driven animations.
 * Automatically cleans up on unmount.
 *
 * @example
 * const ref = useGsapScrollTrigger<HTMLDivElement>({
 *   from: { opacity: 0, y: 50 },
 *   to: { opacity: 1, y: 0 },
 *   start: 'top 80%',
 * });
 * <div ref={ref}>Content</div>
 */
export function useGsapScrollTrigger<T extends HTMLElement>(config: ScrollTriggerConfig) {
	const ref = useRef<T>(null);

	useEffect(() => {
		const el = ref.current;
		if (!el) return;

		const {
			from,
			to,
			start = 'top 85%',
			end,
			scrub = false,
			toggleActions = 'play none none none',
			markers = false,
		} = config;

		const tween = gsap.fromTo(el, from, {
			...to,
			scrollTrigger: {
				trigger: el,
				start,
				end,
				scrub,
				toggleActions: scrub ? undefined : toggleActions,
				markers,
			},
		});

		return () => {
			tween.scrollTrigger?.kill();
			tween.kill();
		};
	}, []);

	return ref;
}

/**
 * GSAP ScrollTrigger for child elements with stagger.
 *
 * @example
 * const ref = useGsapStagger<HTMLDivElement>('.card', {
 *   from: { opacity: 0, y: 40 },
 *   to: { opacity: 1, y: 0, stagger: 0.1 },
 * });
 * <div ref={ref}><div className="card">...</div></div>
 */
export function useGsapStagger<T extends HTMLElement>(
	childSelector: string,
	config: ScrollTriggerConfig
) {
	const ref = useRef<T>(null);

	useEffect(() => {
		const container = ref.current;
		if (!container) return;

		const children = container.querySelectorAll(childSelector);
		if (!children.length) return;

		const {
			from,
			to,
			start = 'top 85%',
			end,
			scrub = false,
			toggleActions = 'play none none none',
		} = config;

		const tween = gsap.fromTo(children, from, {
			...to,
			scrollTrigger: {
				trigger: container,
				start,
				end,
				scrub,
				toggleActions: scrub ? undefined : toggleActions,
			},
		});

		return () => {
			tween.scrollTrigger?.kill();
			tween.kill();
		};
	}, []);

	return ref;
}

/**
 * GSAP parallax effect tied to scroll position.
 *
 * @example
 * const ref = useGsapParallax<HTMLDivElement>({ y: -100 });
 */
export function useGsapParallax<T extends HTMLElement>(
	toVars: gsap.TweenVars,
	start = 'top bottom',
	end = 'bottom top'
) {
	const ref = useRef<T>(null);

	useEffect(() => {
		const el = ref.current;
		if (!el) return;

		const tween = gsap.to(el, {
			...toVars,
			ease: 'none',
			scrollTrigger: {
				trigger: el,
				start,
				end,
				scrub: true,
			},
		});

		return () => {
			tween.scrollTrigger?.kill();
			tween.kill();
		};
	}, []);

	return ref;
}
