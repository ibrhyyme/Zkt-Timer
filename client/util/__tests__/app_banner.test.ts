import {APP_BANNER_SNOOZE_MS, parseDismissedAt, shouldOfferAndroidApp} from '../app-banner';

const ANDROID_CHROME = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';
const IPHONE_SAFARI = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const DESKTOP_CHROME = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

const base = {userAgent: ANDROID_CHROME, native: false, standalone: false, dismissedAt: null, now: 1_800_000_000_000};

describe('shouldOfferAndroidApp', () => {
	it('offers the app to an Android browser visitor', () => {
		expect(shouldOfferAndroidApp(base)).toBe(true);
	});

	it('never shows inside the native app or an installed PWA', () => {
		expect(shouldOfferAndroidApp({...base, native: true})).toBe(false);
		expect(shouldOfferAndroidApp({...base, standalone: true})).toBe(false);
	});

	it('leaves iOS (Apple banner) and desktop alone', () => {
		expect(shouldOfferAndroidApp({...base, userAgent: IPHONE_SAFARI})).toBe(false);
		expect(shouldOfferAndroidApp({...base, userAgent: DESKTOP_CHROME})).toBe(false);
	});

	it('stays away for 30 days after a dismissal, then returns', () => {
		expect(shouldOfferAndroidApp({...base, dismissedAt: base.now - 1000})).toBe(false);
		expect(shouldOfferAndroidApp({...base, dismissedAt: base.now - APP_BANNER_SNOOZE_MS - 1})).toBe(true);
	});
});

describe('parseDismissedAt', () => {
	it('reads a stored timestamp and ignores junk', () => {
		expect(parseDismissedAt('1800000000000')).toBe(1_800_000_000_000);
		expect(parseDismissedAt('')).toBeNull();
		expect(parseDismissedAt(null)).toBeNull();
		expect(parseDismissedAt('abc')).toBeNull();
	});
});
