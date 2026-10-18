import {useEffect, useState} from 'react';

/**
 * True once `active` has stayed true for `delayMs`. Loading placeholders wait on
 * it: data kept on the device arrives within a few milliseconds, and a skeleton
 * that flashes for one frame before the table reads as a slow page.
 */
export function useDelayedFlag(active: boolean, delayMs = 300): boolean {
	const [due, setDue] = useState(false);
	useEffect(() => {
		if (!active) {
			setDue(false);
			return;
		}
		const id = setTimeout(() => setDue(true), delayMs);
		return () => clearTimeout(id);
	}, [active, delayMs]);
	return active && due;
}
