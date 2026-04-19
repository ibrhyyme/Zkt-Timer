import {useEffect, useState} from 'react';

export function useScrollProgress(): number {
	const [progress, setProgress] = useState(0);

	useEffect(() => {
		if (typeof window === 'undefined') return;

		let raf = 0;
		const calc = () => {
			const doc = document.documentElement;
			const scrollable = doc.scrollHeight - doc.clientHeight;
			const p = scrollable > 0 ? Math.min(1, Math.max(0, doc.scrollTop / scrollable)) : 0;
			setProgress(p);
		};

		const onScroll = () => {
			if (raf) cancelAnimationFrame(raf);
			raf = requestAnimationFrame(calc);
		};

		calc();
		window.addEventListener('scroll', onScroll, {passive: true});
		window.addEventListener('resize', calc);

		return () => {
			if (raf) cancelAnimationFrame(raf);
			window.removeEventListener('scroll', onScroll);
			window.removeEventListener('resize', calc);
		};
	}, []);

	return progress;
}
