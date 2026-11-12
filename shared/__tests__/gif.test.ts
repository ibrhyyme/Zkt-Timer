import {GIF_PROVIDER_KLIPY, isValidGifRef} from '../gif';

describe('isValidGifRef', () => {
	it('accepts a KLIPY slug', () => {
		expect(isValidGifRef(GIF_PROVIDER_KLIPY, 'hello-hi-662')).toBe(true);
		expect(isValidGifRef('klipy', 'Cube_Win-3')).toBe(true);
	});

	it('refuses unknown providers and non-strings', () => {
		expect(isValidGifRef('giphy', 'hello-hi-662')).toBe(false);
		expect(isValidGifRef(undefined, 'hello-hi-662')).toBe(false);
		expect(isValidGifRef('klipy', 8041071659142944)).toBe(false);
		expect(isValidGifRef('klipy', null)).toBe(false);
	});

	// Whatever passes ends up in a request URL on every reader's device.
	it('refuses anything that is not a plain slug', () => {
		for (const bad of [
			'',
			'-leading-dash',
			'has space',
			'a,b',
			'../items',
			'slug?x=1',
			'slug&q=1',
			'https://static.klipy.com/x.gif',
			'a'.repeat(161),
		]) {
			expect(isValidGifRef('klipy', bad)).toBe(false);
		}
	});
});
