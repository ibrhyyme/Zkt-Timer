import { isNative } from './platform';

/**
 * What kind of device the app runs on, as far as timer inputs are concerned.
 *
 * Deliberately NOT the viewport: a tablet in landscape gets the desktop layout (>= 1024 px)
 * but still has no keyboard and no usable audio jack, and a desktop browser window can be
 * narrow without becoming a phone. Which timer inputs exist depends on the device, the
 * layout only decides whether they are drawn as a dropdown or a grid.
 */
export interface DeviceProfile {
	/** Running inside the Capacitor app (iOS or Android). */
	native: boolean;
	/** The primary pointer is a finger: phones and tablets, in a browser or in the app. */
	touchFirst: boolean;
}

const SERVER_PROFILE: DeviceProfile = { native: false, touchFirst: false };

/** Pure classifier, fed by the browser globals below and by the tests. */
export function classifyDevice(input: {
	native: boolean;
	coarsePointer: boolean;
	userAgent: string;
	maxTouchPoints: number;
}): DeviceProfile {
	const ua = input.userAgent || '';
	const mobileUa = /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
	// iPadOS Safari reports a desktop Mac user agent; the touch points give it away.
	const iPadAsMac = /Macintosh/.test(ua) && input.maxTouchPoints > 1;
	return {
		native: input.native,
		touchFirst: input.native || input.coarsePointer || mobileUa || iPadAsMac,
	};
}

let cached: DeviceProfile | null = null;

/** Cached once per page load. During SSR it answers "desktop web" without caching. */
export function getDeviceProfile(): DeviceProfile {
	if (cached) return cached;
	if (typeof window === 'undefined' || typeof navigator === 'undefined') return SERVER_PROFILE;

	let coarsePointer = false;
	try {
		coarsePointer = !!window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
	} catch (e) {
		coarsePointer = false;
	}

	cached = classifyDevice({
		native: isNative(),
		coarsePointer,
		userAgent: navigator.userAgent || '',
		maxTouchPoints: navigator.maxTouchPoints || 0,
	});
	return cached;
}
