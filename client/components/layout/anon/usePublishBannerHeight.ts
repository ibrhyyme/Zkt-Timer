import {RefObject, useEffect} from 'react';

// Publish the strip's height so the pages that size themselves against the viewport
// can subtract it. The timer is a full-height layout (`100vh - nav`), and without
// this the strip pushed the whole page down by its own height and the module bar at
// the bottom fell off the screen. Measured rather than hard-coded: the text wraps to
// two lines on a narrow window. Shared by the signed-out strip and the Android app
// strip, which take turns in the same slot.
export function usePublishBannerHeight(ref: RefObject<HTMLElement>, visible: boolean) {
	useEffect(() => {
		const element = visible ? ref.current : null;
		const root = typeof document === 'undefined' ? null : document.documentElement;
		if (!root) return undefined;

		if (!element) {
			root.style.removeProperty('--anon-banner-h');
			return undefined;
		}

		// Margins included: the strip pushes the page down by its box AND the gap under
		// it, and a measurement that stops at the border leaves that gap unaccounted for.
		const publish = () => {
			const style = getComputedStyle(element);
			const margins = (parseFloat(style.marginTop) || 0) + (parseFloat(style.marginBottom) || 0);
			root.style.setProperty('--anon-banner-h', `${Math.round(element.getBoundingClientRect().height + margins)}px`);
		};
		publish();

		const observer = new ResizeObserver(publish);
		observer.observe(element);

		return () => {
			observer.disconnect();
			root.style.removeProperty('--anon-banner-h');
		};
	}, [visible]);
}
