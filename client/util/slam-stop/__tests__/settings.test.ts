import { sensitivityToThreshold, sensitivityZone, DEFAULT_SENSITIVITY } from '../settings';

describe('sensitivityToThreshold', () => {
	it('maps sensitivity 0 (Low) to the maximum threshold', () => {
		expect(sensitivityToThreshold(0)).toBeCloseTo(2.5);
	});

	it('maps sensitivity 100 (Ultra) to the minimum threshold', () => {
		expect(sensitivityToThreshold(100)).toBeCloseTo(0.35);
	});

	it('is strictly decreasing — higher sensitivity means lower threshold', () => {
		expect(sensitivityToThreshold(75)).toBeLessThan(sensitivityToThreshold(25));
	});

	it('clamps out-of-range input', () => {
		expect(sensitivityToThreshold(-10)).toBeCloseTo(sensitivityToThreshold(0));
		expect(sensitivityToThreshold(150)).toBeCloseTo(sensitivityToThreshold(100));
	});
});

describe('sensitivityZone', () => {
	it('maps zone boundaries correctly', () => {
		expect(sensitivityZone(0)).toBe('low');
		expect(sensitivityZone(24)).toBe('low');
		expect(sensitivityZone(25)).toBe('medium');
		expect(sensitivityZone(49)).toBe('medium');
		expect(sensitivityZone(50)).toBe('high');
		expect(sensitivityZone(74)).toBe('high');
		expect(sensitivityZone(75)).toBe('ultra');
		expect(sensitivityZone(100)).toBe('ultra');
	});

	it('puts the default sensitivity in the medium zone', () => {
		expect(sensitivityZone(DEFAULT_SENSITIVITY)).toBe('medium');
	});
});
