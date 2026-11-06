import { RefObject, useEffect, useRef } from 'react';
import { isUiReversed } from '../reversed-ui';

// The strip at the top of a sheet that takes a drag: the grabber and the title. Below it a
// finger is scrolling the content.
const HANDLE_HEIGHT = 72;
// The grabber's own row: one tap here closes the sheet.
const TAP_HEIGHT = 32;
// A press that moved further than this was a pull, not a tap, and a click this soon after it
// belongs to the pull.
const TAP_SLOP = 8;
const PULL_CLICK_MS = 400;
// Takes a press anywhere on the sheet, even as a button or when the content is scrolled.
const HANDLE_SELECTOR = '[data-sheet-handle]';
const INTERACTIVE_SELECTOR = 'button, a, input, textarea, select, [role="button"]';
// Past this far, or flicked faster than this (px/ms), the sheet goes.
const DISMISS_DISTANCE = 120;
const DISMISS_SPEED = 0.6;
const SLIDE_OUT_MS = 220;

/**
 * How far below the sheet's top a point is, in the reader's frame. Reversed use draws the modal
 * turned 180°: its top is the physical bottom edge, and a pull toward the reader runs upward.
 */
function depthInSheet(sheet: HTMLElement, clientY: number): number {
	const rect = sheet.getBoundingClientRect();
	return isUiReversed() ? rect.bottom - clientY : clientY - rect.top;
}

/** Scrolled content owns the top of the sheet: a pull there scrolls it back, a tap reads it. */
function isScrolledBetween(target: Element, sheet: HTMLElement): boolean {
	for (let el: Element | null = target; el; el = el.parentElement) {
		if (el.scrollTop > 0) return true;
		if (el === sheet) break;
	}
	return false;
}

/**
 * Close a bottom sheet from its top, as on a native sheet: pull the top strip down, or tap the
 * grabber's row. A short pull springs back. Styles are written straight to the element: this
 * runs on every touch move, and the sheet's CSS transition is what carries the release.
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
		let lastPullAt = -Infinity;
		let closing = false;
		let closeTimer: ReturnType<typeof setTimeout> | null = null;

		function slideOut() {
			closing = true;
			// Dismissing closes the newest modal, so a row tapped on the way down must not open
			// one: it would be closed in this sheet's place, leaving this one off screen.
			sheet.style.pointerEvents = 'none';
			sheet.style.transition = `transform ${SLIDE_OUT_MS}ms ease-out`;
			sheet.style.transform = 'translateY(100%)';
			closeTimer = setTimeout(() => dismissRef.current(), SLIDE_OUT_MS);
		}

		function onStart(e: TouchEvent) {
			if (closing || e.touches.length !== 1) return;
			const target = e.target as Element;
			const touch = e.touches[0];
			if (!target.closest(HANDLE_SELECTOR)) {
				if (target.closest(INTERACTIVE_SELECTOR) || isScrolledBetween(target, sheet)) return;
				if (depthInSheet(sheet, touch.clientY) > HANDLE_HEIGHT) return;
			}
			dragging = true;
			startY = touch.clientY;
			startTime = e.timeStamp;
			offset = 0;
		}

		function onMove(e: TouchEvent) {
			if (!dragging) return;
			const moved = e.touches[0].clientY - startY;
			offset = Math.max(0, isUiReversed() ? -moved : moved);
			if (offset === 0) return;
			// Not passive for this: the browser must not turn the same pull into a scroll.
			e.preventDefault();
			sheet.style.transition = 'none';
			sheet.style.transform = `translateY(${offset}px)`;
		}

		function onEnd(e: TouchEvent) {
			if (!dragging) return;
			dragging = false;
			if (offset > TAP_SLOP) lastPullAt = e.timeStamp;
			const speed = offset / Math.max(1, e.timeStamp - startTime);
			sheet.style.transition = '';
			if (offset > DISMISS_DISTANCE || (offset > 24 && speed > DISMISS_SPEED)) {
				slideOut();
			} else {
				sheet.style.transform = '';
			}
		}

		// A click, not touchend: the browser has already told a tap from a scroll, and it covers
		// a mouse and a keyboard press on the handle as well.
		function onClick(e: MouseEvent) {
			if (closing || e.timeStamp - lastPullAt < PULL_CLICK_MS) return;
			const target = e.target as Element;
			if (!target.closest(HANDLE_SELECTOR)) {
				if (target.closest(INTERACTIVE_SELECTOR) || isScrolledBetween(target, sheet)) return;
				// Above the sheet is no finger: a click from code reports position 0.
				const y = depthInSheet(sheet, e.clientY);
				if (y < 0 || y > TAP_HEIGHT) return;
			}
			slideOut();
		}

		sheet.addEventListener('touchstart', onStart, { passive: true });
		sheet.addEventListener('touchmove', onMove, { passive: false });
		sheet.addEventListener('touchend', onEnd);
		sheet.addEventListener('touchcancel', onEnd);
		sheet.addEventListener('click', onClick);
		return () => {
			if (closeTimer) clearTimeout(closeTimer);
			sheet.removeEventListener('touchstart', onStart);
			sheet.removeEventListener('touchmove', onMove);
			sheet.removeEventListener('touchend', onEnd);
			sheet.removeEventListener('touchcancel', onEnd);
			sheet.removeEventListener('click', onClick);
		};
	}, [ref, enabled]);
}
