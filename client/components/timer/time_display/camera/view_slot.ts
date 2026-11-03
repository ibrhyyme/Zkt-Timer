import { createContext, useContext } from 'react';

/**
 * Where the Kamera Timer puts its picture: a module-style panel the desktop timer renders in the
 * middle of the screen, left of the digits (owner, 2026-11-03: the box under the digits did not
 * fit, and a full-screen camera background was too much). Null where there is no such panel (a
 * timer in a modal, the mobile layout): the camera then shows in its own box under the digits.
 */
export const CameraViewSlot = createContext<HTMLElement | null>(null);

export function useCameraViewSlot(): HTMLElement | null {
	return useContext(CameraViewSlot);
}
