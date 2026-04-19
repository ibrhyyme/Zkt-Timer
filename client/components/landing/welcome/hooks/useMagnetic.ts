import {useEffect, useRef} from 'react';

interface UseMagneticOptions {
	strength?: number; // ne kadar cekilecek (px cinsinden max deplasman)
	radius?: number; // bu yariçapa girince etki baslar
}

export function useMagnetic<T extends HTMLElement = HTMLElement>(
	options: UseMagneticOptions = {}
) {
	const {strength = 18, radius = 140} = options;
	const ref = useRef<T>(null);

	useEffect(() => {
		if (typeof window === 'undefined') return;
		if (window.matchMedia('(hover: none)').matches) return;

		const el = ref.current;
		if (!el) return;

		let raf = 0;

		const onMove = (e: MouseEvent) => {
			const rect = el.getBoundingClientRect();
			const cx = rect.left + rect.width / 2;
			const cy = rect.top + rect.height / 2;
			const dx = e.clientX - cx;
			const dy = e.clientY - cy;
			const dist = Math.sqrt(dx * dx + dy * dy);

			if (dist > radius) {
				if (raf) cancelAnimationFrame(raf);
				raf = requestAnimationFrame(() => {
					el.style.transform = '';
				});
				return;
			}

			const pull = 1 - dist / radius; // 0-1 arasi
			const tx = (dx / radius) * strength * pull;
			const ty = (dy / radius) * strength * pull;

			if (raf) cancelAnimationFrame(raf);
			raf = requestAnimationFrame(() => {
				el.style.transform = `translate(${tx}px, ${ty}px)`;
			});
		};

		const onLeave = () => {
			if (raf) cancelAnimationFrame(raf);
			el.style.transform = '';
		};

		window.addEventListener('mousemove', onMove, {passive: true});
		window.addEventListener('mouseout', onLeave);

		return () => {
			if (raf) cancelAnimationFrame(raf);
			window.removeEventListener('mousemove', onMove);
			window.removeEventListener('mouseout', onLeave);
			el.style.transform = '';
		};
	}, [strength, radius]);

	return ref;
}
