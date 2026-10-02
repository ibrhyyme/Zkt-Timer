import React, {useEffect, useRef} from 'react';
import {NOTATION_CHARS} from '../landing-data';

interface Props {
	text: string;
	className?: string;
	as?: 'h2' | 'h3';
}

// Frames per character swap. Swapping on every animation frame reads as noise; around
// twenty swaps a second reads as a scramble resolving.
const SWAP_MS = 48;

function scrambled(text: string, revealed: number): string {
	let out = '';
	for (let i = 0; i < text.length; i++) {
		const ch = text[i];
		// Spaces stay put so the words keep their outline while the letters resolve.
		out += i < revealed || ch === ' ' ? ch : NOTATION_CHARS[(Math.random() * NOTATION_CHARS.length) | 0];
	}
	return out;
}

/**
 * A section heading that arrives as cube notation and resolves into its words, the
 * way a scrambled cube resolves into a solved one.
 *
 * The server renders the real text, and so does any client that cannot or should not
 * animate: no IntersectionObserver, reduced motion, or a heading already on screen when
 * the page mounts. Screen readers always get the real text; the animated copy is hidden
 * from them.
 */
export default function NotationHeading({text, className, as: Tag = 'h2'}: Props) {
	const ref = useRef<HTMLSpanElement>(null);

	useEffect(() => {
		const el = ref.current;
		if (!el) return;
		if (!('IntersectionObserver' in window)) return;
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		if (el.getBoundingClientRect().top < window.innerHeight) return;

		// Hold the resolved height: notation letters are wider than most, and a heading
		// that re-wraps while it resolves would push the page around under the reader.
		const heading = el.parentElement as HTMLElement;
		heading.style.minHeight = `${heading.offsetHeight}px`;
		el.textContent = scrambled(text, 0);

		let raf = 0;
		const observer = new IntersectionObserver(
			([entry]) => {
				if (!entry.isIntersecting) return;
				observer.disconnect();

				const start = performance.now();
				const duration = Math.min(1100, 380 + text.length * 20);
				let lastSwap = 0;

				const tick = (now: number) => {
					const p = Math.min(1, (now - start) / duration);
					if (p === 1) {
						el.textContent = text;
						heading.style.minHeight = '';
						return;
					}
					if (now - lastSwap >= SWAP_MS) {
						lastSwap = now;
						// Ease out: most letters land early, the last few hold the suspense.
						const eased = 1 - Math.pow(1 - p, 2);
						el.textContent = scrambled(text, Math.floor(text.length * eased));
					}
					raf = requestAnimationFrame(tick);
				};
				raf = requestAnimationFrame(tick);
			},
			{rootMargin: '0px 0px -12% 0px'}
		);
		observer.observe(el);

		return () => {
			observer.disconnect();
			cancelAnimationFrame(raf);
			el.textContent = text;
			heading.style.minHeight = '';
		};
	}, [text]);

	return (
		<Tag className={className}>
			<span className="sr-only">{text}</span>
			{/* Keyed by the text: the effect swaps this span's text node out from under
			    React, so a language change has to mount a fresh span rather than patch a
			    node React no longer owns. */}
			<span key={text} ref={ref} aria-hidden="true">
				{text}
			</span>
		</Tag>
	);
}
