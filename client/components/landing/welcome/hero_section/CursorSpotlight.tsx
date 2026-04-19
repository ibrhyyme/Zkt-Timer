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

		const tick = () => {
			// Lerp — yumusak takip
			cx += (tx - cx) * 0.12;
			cy += (ty - cy) * 0.12;
			el.style.setProperty('--sx', `${cx}px`);
			el.style.setProperty('--sy', `${cy}px`);
			raf = requestAnimationFrame(tick);
		};

		window.addEventListener('mousemove', onMove, {passive: true});
		raf = requestAnimationFrame(tick);

		return () => {
			window.removeEventListener('mousemove', onMove);
			cancelAnimationFrame(raf);
		};
	}, []);

	return <div ref={ref} className="cd-cursor-spotlight" aria-hidden />;
}
