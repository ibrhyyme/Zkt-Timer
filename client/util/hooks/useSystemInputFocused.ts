import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Keyboard } from '@capacitor/keyboard';
import { opensSystemInput } from '../reversed-ui';

/**
 * Whether the focused element is one the OS draws input UI for (soft keyboard, native
 * picker), see opensSystemInput. Listens only while `active`.
 */
export function useSystemInputFocused(active: boolean): boolean {
	const [focused, setFocused] = useState(false);

	useEffect(() => {
		if (!active || typeof document === 'undefined') {
			setFocused(false);
			return;
		}

		let timer: ReturnType<typeof setTimeout> | undefined;
		const sync = () => setFocused(opensSystemInput(document.activeElement as HTMLInputElement | null));
		// Moving from one field to the next fires focusout before the next focusin. Reading the
		// settled element keeps the page from turning back and forth in between.
		const schedule = () => {
			clearTimeout(timer);
			timer = setTimeout(sync, 0);
		};

		sync();
		document.addEventListener('focusin', schedule);
		document.addEventListener('focusout', schedule);
		// A focused field unmounted together with its modal does not reliably fire focusout,
		// but the keyboard always goes down with it.
		const hide = Capacitor.isNativePlatform() ? Keyboard.addListener('keyboardDidHide', schedule) : null;
		hide?.catch(() => {});

		return () => {
			clearTimeout(timer);
			document.removeEventListener('focusin', schedule);
			document.removeEventListener('focusout', schedule);
			hide?.then((h) => h.remove()).catch(() => {});
		};
	}, [active]);

	return active && focused;
}
