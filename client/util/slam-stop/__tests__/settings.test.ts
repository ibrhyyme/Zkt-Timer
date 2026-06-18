import { sensitivityToThreshold, sensitivityZone, DEFAULT_SENSITIVITY } from '../settings';

// Threshold in m/s² — quadratic curve MAX_THRESHOLD * ((100-s)/100)²
describe('sensitivityToThreshold', () => {
	it('maps sensitivity 0 (Low) to the maximum threshold (4 m/s²)', () => {
		expect(sensitivityToThreshold(0)).toBeCloseTo(4);
	});

	it('maps sensitivity 100 (Ultra) to ~0', () => {
		expect(sensitivityToThreshold(100)).toBeCloseTo(0);
	});

	it('drops the whole Ultra zone below the 0.3 deadband (s=75 → 0.25)', () => {
		expect(sensitivityToThreshold(75)).toBeCloseTo(0.25);
		expect(sensitivityToThreshold(75)).toBeLessThan(0.3);
	});

	it('keeps the mid range meaningful (s=50 → 1.0)', () => {
		expect(sensitivityToThreshold(50)).toBeCloseTo(1);
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
