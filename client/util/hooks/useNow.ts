import {useEffect, useState} from 'react';

/**
 * Returns Date.now() every N milliseconds, triggers re-render.
 * Default 60s. Used for ongoing/current activity highlights.
 */
export function useNow(intervalMs: number = 60000): number {
	const [now, setNow] = useState<number>(() => Date.now());

	useEffect(() => {
		if (typeof window === 'undefined') return;
		const id = setInterval(() => setNow(Date.now()), intervalMs);
		return () => clearInterval(id);
	}, [intervalMs]);

	return now;
}
