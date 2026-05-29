/**
 * useBreakpoint — matchMedia tabanli reactive breakpoint.
 * Referans `composables/useBreakpoint.js` portu.
 */
import {useEffect, useState} from 'react';

export function useBreakpoint(query: string): boolean {
	const [matches, setMatches] = useState<boolean>(() => {
		if (typeof window === 'undefined') return false;
		return window.matchMedia(query).matches;
	});

	useEffect(() => {
		if (typeof window === 'undefined') return;
		const mql = window.matchMedia(query);
		const update = (e: MediaQueryListEvent) => setMatches(e.matches);
		setMatches(mql.matches);
		mql.addEventListener('change', update);
		return () => mql.removeEventListener('change', update);
	}, [query]);

	return matches;
}
