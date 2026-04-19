import { useEffect, useState } from 'react';

interface UseCountUpOptions {
	start?: number;
	duration?: number;
	active: boolean;
}

export function useCountUp(target: number, options: UseCountUpOptions) {
	const { start = 0, duration = 1800, active } = options;
	const [value, setValue] = useState(start);

	useEffect(() => {
		if (!active) return;
		if (typeof window === 'undefined') {
			setValue(target);
			return;
		}

		let frameId = 0;
		const startTs = performance.now();
		const from = start;
		const delta = target - from;

		const tick = (now: number) => {
			const elapsed = now - startTs;
			const progress = Math.min(1, elapsed / duration);
			// easeOutCubic
			const eased = 1 - Math.pow(1 - progress, 3);
			setValue(Math.round(from + delta * eased));
			if (progress < 1) {
				frameId = requestAnimationFrame(tick);
			}
		};

		frameId = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(frameId);
	}, [target, duration, start, active]);

	return value;
}
