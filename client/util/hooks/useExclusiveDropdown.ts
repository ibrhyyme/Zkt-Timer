import { useCallback, useEffect, useRef, useState } from 'react';

// Global coordinator so only ONE header dropdown/popover is open at a time.
// Header pickers (cube type, subset, session, timer type, gear, account) each own
// their own Radix open state and don't dismiss one another (Select is modal but
// clicking another trigger doesn't reliably close the first; Popover is non-modal).
// This makes them behave like a mutex: opening one closes any other open one.

type Listener = (openerId: number) => void;

const listeners = new Set<Listener>();
let nextId = 1;

function notifyOpened(openerId: number): void {
	listeners.forEach((listener) => listener(openerId));
}

/**
 * Drop-in replacement for `useState(false)` on a dropdown's open flag. Opening any
 * dropdown that uses this hook auto-closes all others in the group.
 */
export default function useExclusiveDropdown(): [boolean, (next: boolean) => void] {
	const idRef = useRef(0);
	if (idRef.current === 0) {
		idRef.current = nextId++;
	}

	const [open, setOpenState] = useState(false);

	useEffect(() => {
		const listener: Listener = (openerId) => {
			// Another dropdown opened — close this one.
			if (openerId !== idRef.current) {
				setOpenState(false);
			}
		};
		listeners.add(listener);
		return () => {
			listeners.delete(listener);
		};
	}, []);

	const setOpen = useCallback((next: boolean) => {
		setOpenState(next);
		if (next) {
			notifyOpened(idRef.current);
		}
	}, []);

	return [open, setOpen];
}
