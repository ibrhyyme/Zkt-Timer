import {
	colorStringsEqual,
	getAnyColorStringAsRawRgbString,
	getAnyColorStringAsRgb,
	getAnyColorStringAsRgbString,
	hexToRgb,
} from '../theme_util';

describe('hexToRgb', () => {
	it('converts 6-digit hex (with or without #) to a raw "r, g, b" string', () => {
		expect(hexToRgb('#ffffff')).toBe('255, 255, 255');
		expect(hexToRgb('ffffff')).toBe('255, 255, 255');
	});

	it('doubles a bare 3-digit shorthand', () => {
		// Only the no-# form is doubled (hex.length === 3): '#fff' is length 4 and falls
		// through to the 6-digit regex unmatched. Existing behaviour, not something this
		// change touches; documented here so it isn't "fixed" by accident later.
		expect(hexToRgb('fff')).toBe('255, 255, 255');
	});

	it('passes an already-raw value through unchanged', () => {
		expect(hexToRgb('255, 255, 255')).toBe('255, 255, 255');
	});
});

describe('getAnyColorStringAsRgb', () => {
	it('parses raw triplets regardless of whitespace', () => {
		expect(getAnyColorStringAsRgb('255, 255, 255')).toEqual({r: 255, g: 255, b: 255});
		expect(getAnyColorStringAsRgb('255,255,255')).toEqual({r: 255, g: 255, b: 255});
	});

	it('parses hex', () => {
		expect(getAnyColorStringAsRgb('#ff0000')).toEqual({r: 255, g: 0, b: 0});
	});
});

describe('getAnyColorStringAsRawRgbString', () => {
	it('normalises any input format to the same "r, g, b" shape', () => {
		expect(getAnyColorStringAsRawRgbString('#ffffff')).toBe('255, 255, 255');
		expect(getAnyColorStringAsRawRgbString('255, 255, 255')).toBe('255, 255, 255');
		expect(getAnyColorStringAsRawRgbString('255,255,255')).toBe('255, 255, 255');
	});

	it('accepts a react-color-palette Color object', () => {
		expect(getAnyColorStringAsRawRgbString({hex: '#ffffff', rgb: {r: 255, g: 255, b: 255}, hsv: {h: 0, s: 0, v: 100}})).toBe('255, 255, 255');
	});
});

describe('getAnyColorStringAsRgbString', () => {
	it('wraps the raw triplet in rgb(...)', () => {
		expect(getAnyColorStringAsRgbString('#ffffff')).toBe('rgb(255, 255, 255)');
	});
});

// This is the ColorPicker reset-button comparison (client/components/common/color_picker/
// ColorPicker.tsx): a naive string compare between a whitespace-stripped default and a
// palette-derived raw string ("255,255,255" vs "255, 255, 255") never matched, so the
// button never hid itself. colorStringsEqual normalises both sides first.
describe('colorStringsEqual', () => {
	it('treats the same colour as equal across hex/raw formats and whitespace variants', () => {
		expect(colorStringsEqual('255, 255, 255', '255, 255, 255')).toBe(true);
		expect(colorStringsEqual('255,255,255', '255, 255, 255')).toBe(true);
		expect(colorStringsEqual('#ffffff', '255, 255, 255')).toBe(true);
		expect(colorStringsEqual('#ffffff', '255,255,255')).toBe(true);
		expect(colorStringsEqual('ffffff', 'fff')).toBe(true);
	});

	it('treats different colours as different', () => {
		expect(colorStringsEqual('255, 255, 255', '0, 0, 0')).toBe(false);
		expect(colorStringsEqual('#ffffff', '#000000')).toBe(false);
	});

	it('accepts a react-color-palette Color object on either side', () => {
		const white = {hex: '#ffffff', rgb: {r: 255, g: 255, b: 255}, hsv: {h: 0, s: 0, v: 100}};
		expect(colorStringsEqual('255, 255, 255', white)).toBe(true);
		expect(colorStringsEqual('255,255,255', white)).toBe(true);
		expect(colorStringsEqual('0, 0, 0', white)).toBe(false);
	});
});
