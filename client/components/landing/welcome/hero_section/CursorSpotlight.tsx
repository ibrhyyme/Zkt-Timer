import React, {useEffect, useRef} from 'react';
import './CursorSpotlight.scss';

export default function CursorSpotlight() {
	const ref = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (typeof window === 'undefined') return;
		// Touch cihazlarda spotlight gereksiz
		if (window.matchMedia('(hover: none)').matches) return;

		const el = ref.current;
		if (!el) return;

		let raf = 0;
		let tx = window.innerWidth / 2;
		let ty = window.innerHeight / 3;
		let cx = tx;
		let cy = ty;

		const onMove = (e: MouseEvent) => {
			tx = e.clientX;
			ty = e.clientY;
		};

		// Runs only while the spotlight is catching up with the pointer, and never while
		// the hero is off screen; it used to spin every frame for the life of the page.
		let visible = true;
		const tick = () => {
			// Lerp — yumusak takip
			cx += (tx - cx) * 0.12;
			cy += (ty - cy) * 0.12;
			el.style.setProperty('--sx', `${cx}px`);
			el.style.setProperty('--sy', `${cy}px`);
			const settled = Math.abs(tx - cx) < 0.5 && Math.abs(ty - cy) < 0.5;
			raf = settled || !visible ? 0 : requestAnimationFrame(tick);
		};
		const wake = () => {
			if (!raf && visible) raf = requestAnimationFrame(tick);
		};

		const onMoveAndWake = (e: MouseEvent) => {
			onMove(e);
			wake();
		};

		let observer: IntersectionObserver | null = null;
		if ('IntersectionObserver' in window) {
			observer = new IntersectionObserver(([entry]) => {
				visible = entry.isIntersecting;
				if (visible) wake();
			});
			observer.observe(el);
		}

		window.addEventListener('mousemove', onMoveAndWake, {passive: true});
		wake();

		return () => {
			window.removeEventListener('mousemove', onMoveAndWake);
			observer?.disconnect();
			cancelAnimationFrame(raf);
		};
	}, []);

	return <div ref={ref} className="zt-cursor-spotlight" aria-hidden />;
}
