import { RefObject, useEffect, useRef } from 'react';

// The strip at the top of a sheet that takes a drag: the grabber and the title. Below it a
// finger is scrolling the content.
const HANDLE_HEIGHT = 72;
// Past this far, or flicked faster than this (px/ms), the sheet goes.
const DISMISS_DISTANCE = 120;
const DISMISS_SPEED = 0.6;
const SLIDE_OUT_MS = 220;

/**
 * Pull a bottom sheet down by its top strip to close it, as on a native sheet. A short pull
 * springs back. Styles are written straight to the element: this runs on every touch move, and
 * the sheet's CSS transition is what carries the release.
 */
export function useSheetDrag(ref: RefObject<HTMLElement>, onDismiss: () => void, enabled: boolean): void {
	const dismissRef = useRef(onDismiss);
	dismissRef.current = onDismiss;

	useEffect(() => {
		const sheet = ref.current;
		if (!enabled || !sheet) return undefined;

		let dragging = false;
		let startY = 0;
		let startTime = 0;
		let offset = 0;
		let closeTimer: ReturnType<typeof setTimeout> | null = null;

		function onStart(e: TouchEvent) {
			if (e.touches.length !== 1) return;
			const target = e.target as Element;
			if (target.closest('button, a, input, textarea, select, [role="button"]')) return;
			const touch = e.touches[0];
			if (touch.clientY - sheet.getBoundingClientRect().top > HANDLE_HEIGHT) return;
			dragging = true;
			startY = touch.clientY;
			startTime = e.timeStamp;
			offset = 0;
		}

		function onMove(e: TouchEvent) {
			if (!dragging) return;
			offset = Math.max(0, e.touches[0].clientY - startY);
			if (offset === 0) return;
			// Not passive for this: the browser must not turn the same pull into a scroll.
			e.preventDefault();
			sheet.style.transition = 'none';
			sheet.style.transform = `translateY(${offset}px)`;
		}

		function onEnd(e: TouchEvent) {
			if (!dragging) return;
			dragging = false;
			const speed = offset / Math.max(1, e.timeStamp - startTime);
			sheet.style.transition = '';
			if (offset > DISMISS_DISTANCE || (offset > 24 && speed > DISMISS_SPEED)) {
				sheet.style.transition = `transform ${SLIDE_OUT_MS}ms ease-out`;
				sheet.style.transform = 'translateY(100%)';
				closeTimer = setTimeout(() => dismissRef.current(), SLIDE_OUT_MS);
			} else {
				sheet.style.transform = '';
			}
		}

		sheet.addEventListener('touchstart', onStart, { passive: true });
		sheet.addEventListener('touchmove', onMove, { passive: false });
		sheet.addEventListener('touchend', onEnd);
		sheet.addEventListener('touchcancel', onEnd);
		return () => {
			if (closeTimer) clearTimeout(closeTimer);
			sheet.removeEventListener('touchstart', onStart);
			sheet.removeEventListener('touchmove', onMove);
			sheet.removeEventListener('touchend', onEnd);
			sheet.removeEventListener('touchcancel', onEnd);
		};
	}, [ref, enabled]);
}
