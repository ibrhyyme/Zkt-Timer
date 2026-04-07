import {useEffect, useState} from 'react';

/**
 * Her N saniyede bir Date.now() doner, re-render trigger eder.
 * Default 60s. Ongoing/current activity highlight'lari icin kullanilir.
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
