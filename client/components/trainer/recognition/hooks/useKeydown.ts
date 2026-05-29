/**
 * useKeydown — `window.keydown` listener mount/unmount.
 * Referans `composables/useKeydown.js` portu.
 */
import {useEffect} from 'react';

export function useKeydown(handler: (e: KeyboardEvent) => void, options?: AddEventListenerOptions | boolean): void {
	useEffect(() => {
		if (typeof window === 'undefined') return;
		window.addEventListener('keydown', handler, options);
		return () => window.removeEventListener('keydown', handler, options);
	}, [handler, options]);
}
