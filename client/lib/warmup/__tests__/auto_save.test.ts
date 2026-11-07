import {
	getWarmupThreshold,
	meetsWarmupThreshold,
	warmupAutoSaveReason,
	warmupBucketKey,
	withWarmupThreshold,
} from '../auto_save';

describe('warmupBucketKey', () => {
	it('puts a bare WCA event and its wca bucket under one key', () => {
		expect(warmupBucketKey('333', null)).toBe('wca::333');
		expect(warmupBucketKey('wca', '333')).toBe('wca::333');
	});

	it('keeps other puzzles and subsets apart', () => {
		expect(warmupBucketKey('wca', '222')).toBe('wca::222');
		expect(warmupBucketKey('custom-1', null)).toBe('custom-1::');
	});
});

describe('thresholds per bucket', () => {
	it('sets, reads and removes one bucket without touching the others', () => {
		const start = { 'wca::222': 4 };
		const set = withWarmupThreshold(start, 'wca', '333', 12.99);

		expect(start).toEqual({ 'wca::222': 4 });
		expect(getWarmupThreshold(set, '333', null)).toBe(12.99);
		expect(getWarmupThreshold(set, 'wca', '222')).toBe(4);

		const removed = withWarmupThreshold(set, 'wca', '333', null);
		expect(getWarmupThreshold(removed, 'wca', '333')).toBeNull();
		expect(removed).toEqual({ 'wca::222': 4 });
	});

	it('reads nothing from an empty or broken map', () => {
		expect(getWarmupThreshold(undefined, 'wca', '333')).toBeNull();
		expect(getWarmupThreshold({ 'wca::333': 0 }, 'wca', '333')).toBeNull();
	});
});

describe('meetsWarmupThreshold', () => {
	it('includes the threshold itself, in hundredths', () => {
		expect(meetsWarmupThreshold(12.99, 12.99)).toBe(true);
		expect(meetsWarmupThreshold(10.99 + 2, 12.99)).toBe(true);
		expect(meetsWarmupThreshold(13, 12.99)).toBe(false);
	});
});

describe('warmupAutoSaveReason', () => {
	const solve = (time: number, dnf = false) => ({ time, dnf, cube_type: 'wca', scramble_subset: '333' });
	const thresholds = { 'wca::333': 12.99 };
	const yes = () => true;
	const no = () => false;

	it('saves nothing when off', () => {
		expect(warmupAutoSaveReason(solve(5), 'off', thresholds, yes)).toBeNull();
		expect(warmupAutoSaveReason(solve(5), undefined, thresholds, yes)).toBeNull();
	});

	it('pb mode saves a PB only, whatever the threshold', () => {
		expect(warmupAutoSaveReason(solve(9), 'pb', thresholds, yes)).toBe('pb');
		expect(warmupAutoSaveReason(solve(9), 'pb', thresholds, no)).toBeNull();
	});

	it('threshold mode saves under the time, and a PB over it', () => {
		expect(warmupAutoSaveReason(solve(12.5), 'threshold', thresholds, no)).toBe('threshold');
		expect(warmupAutoSaveReason(solve(13.5), 'threshold', thresholds, no)).toBeNull();
		expect(warmupAutoSaveReason(solve(13.5), 'threshold', thresholds, yes)).toBe('pb');
	});

	it('threshold mode with no time for the bucket saves PBs only', () => {
		expect(warmupAutoSaveReason(solve(5), 'threshold', {}, no)).toBeNull();
		expect(warmupAutoSaveReason(solve(5), 'threshold', {}, yes)).toBe('pb');
	});

	it('never saves a DNF and never asks for the PB of one', () => {
		const beatsPb = jest.fn(() => true);
		expect(warmupAutoSaveReason(solve(-1, true), 'threshold', thresholds, beatsPb)).toBeNull();
		expect(beatsPb).not.toHaveBeenCalled();
	});
});
