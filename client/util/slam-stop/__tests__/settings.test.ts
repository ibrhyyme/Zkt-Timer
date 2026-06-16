import { sensitivityToThreshold, sensitivityZone, DEFAULT_SENSITIVITY } from '../settings';

// Threshold in m/s² — FiveTimer formula (100 - sensitivity + 0.01) / 20
describe('sensitivityToThreshold', () => {
	it('maps sensitivity 0 (Low) to the maximum threshold (~5 m/s²)', () => {
		expect(sensitivityToThreshold(0)).toBeCloseTo(5.0005);
	});

	it('maps sensitivity 100 (Ultra) to the minimum threshold (~0)', () => {
		expect(sensitivityToThreshold(100)).toBeCloseTo(0.0005);
	});

	it('matches the FiveTimer default (75 → 1.25 m/s²)', () => {
		expect(sensitivityToThreshold(75)).toBeCloseTo(1.2505);
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

	it('puts the default sensitivity (FiveTimer reference) in the ultra zone', () => {
		expect(sensitivityZone(DEFAULT_SENSITIVITY)).toBe('ultra');
	});
});
