import { classifyDevice } from '../device-profile';

const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36';
const MAC_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
const ANDROID_UA = 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36';

describe('classifyDevice', () => {
	it('treats a desktop browser with a mouse as desktop web', () => {
		expect(classifyDevice({ native: false, coarsePointer: false, userAgent: DESKTOP_UA, maxTouchPoints: 0 })).toEqual({
			native: false,
			touchFirst: false,
		});
	});

	it('keeps a touchscreen laptop with a fine pointer on the desktop side', () => {
		expect(classifyDevice({ native: false, coarsePointer: false, userAgent: DESKTOP_UA, maxTouchPoints: 10 }).touchFirst).toBe(false);
	});

	it('treats phones and tablets as touch first, in the browser and in the app', () => {
		expect(classifyDevice({ native: false, coarsePointer: true, userAgent: ANDROID_UA, maxTouchPoints: 5 }).touchFirst).toBe(true);
		expect(classifyDevice({ native: true, coarsePointer: false, userAgent: '', maxTouchPoints: 0 })).toEqual({
			native: true,
			touchFirst: true,
		});
	});

	it('sees an iPad that reports a Mac user agent', () => {
		expect(classifyDevice({ native: false, coarsePointer: false, userAgent: MAC_UA, maxTouchPoints: 5 }).touchFirst).toBe(true);
		expect(classifyDevice({ native: false, coarsePointer: false, userAgent: MAC_UA, maxTouchPoints: 0 }).touchFirst).toBe(false);
	});
});
