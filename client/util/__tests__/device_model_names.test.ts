import { deviceModelDisplayName } from '../device-model-names';

describe('deviceModelDisplayName', () => {
	it('names known iPhones from the stored "Apple <machine id>" key', () => {
		expect(deviceModelDisplayName('Apple iPhone16,1')).toBe('iPhone 15 Pro');
		expect(deviceModelDisplayName('Apple iPhone17,3')).toBe('iPhone 16');
		expect(deviceModelDisplayName('iPhone14,6')).toBe('iPhone SE (3rd gen)');
	});

	it('keeps unknown identifiers and Android models exactly as stored', () => {
		expect(deviceModelDisplayName('Apple iPhone99,9')).toBe('Apple iPhone99,9');
		expect(deviceModelDisplayName('samsung SM-F956B')).toBe('samsung SM-F956B');
		expect(deviceModelDisplayName('unknown')).toBe('unknown');
	});

	it('reads the iOS screen fallback key', () => {
		expect(deviceModelDisplayName('Apple screen-393x852@3')).toBe('iPhone (393 x 852)');
	});

	it('returns an empty string for an empty key', () => {
		expect(deviceModelDisplayName('')).toBe('');
		expect(deviceModelDisplayName(null)).toBe('');
		expect(deviceModelDisplayName(undefined)).toBe('');
	});
});
