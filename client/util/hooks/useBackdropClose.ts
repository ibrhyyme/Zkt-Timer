import type React from 'react';
import {useRef} from 'react';

// Handlers for a modal's backdrop: a click closes the modal only when the press started on the
// backdrop too. The browser sends a click to the nearest element holding both the press and the
// release, so selecting the text of an input and letting go past the modal's edge would land the
// click on the backdrop and close the modal mid-edit.
export function useBackdropClose(onClose: () => void) {
	const pressedOnBackdrop = useRef(false);

	return {
		// Capture phase, so a child that stops the press from bubbling still resets the flag.
		onPointerDownCapture(e: React.PointerEvent) {
			pressedOnBackdrop.current = e.target === e.currentTarget;
		},
		onClick(e: React.MouseEvent) {
			const fromBackdrop = pressedOnBackdrop.current && e.target === e.currentTarget;
			pressedOnBackdrop.current = false;
			if (fromBackdrop) onClose();
		},
	};
}
