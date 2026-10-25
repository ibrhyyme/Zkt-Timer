/**
 * Time distribution labels double as the chart's band keys: two buckets with the same
 * label are drawn on the same spot. Buckets narrower than a second above 10 s all printed
 * whole seconds ("15-15" twice).
 */
jest.mock('../../../settings/query', () => ({getSetting: () => 2}));
jest.mock('../../query', () => ({fetchSolves: () => []}));

import {bucketEdgeLabel} from '../time_distro';

function labels(min: number, bucketSize: number, buckets: number): string[] {
	const out: string[] = [];
	for (let i = 0; i < buckets; i++) {
		const low = min + i * bucketSize;
		out.push(`${bucketEdgeLabel(low, bucketSize)}-${bucketEdgeLabel(low + bucketSize, bucketSize)}`);
	}
	return out;
}

describe('bucketEdgeLabel', () => {
	it('keeps whole seconds for buckets a second or wider', () => {
		expect(labels(12, 2, 4)).toEqual(['12-14', '14-16', '16-18', '18-20']);
	});

	it('gives every narrow bucket above 10 s its own label', () => {
		// 15 to 16 s in 7 buckets: 0.14 s each.
		const narrow = labels(15, 0.14, 7);
		expect(new Set(narrow).size).toBe(narrow.length);
	});

	it('gives every bucket its own label at the narrowest width the bucketing produces', () => {
		const narrowest = labels(15, 0.1, 10);
		expect(new Set(narrowest).size).toBe(narrowest.length);
	});

	it('keeps one decimal under 10 s, as before', () => {
		expect(bucketEdgeLabel(8.6, 1)).toBe('8.6');
		expect(bucketEdgeLabel(8, 1)).toBe('8');
	});
});
