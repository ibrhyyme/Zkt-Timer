import {normalizeWcaEventBucket, toStoredSubset} from '../solve';

// The subset pickers name a puzzle's default subset '' while the timer stores it as null.
// LokiJS compares with ===, so every write and every filter has to agree on one value.
describe('toStoredSubset', () => {
	it('stores the picker default as null', () => {
		expect(toStoredSubset('')).toBeNull();
		expect(toStoredSubset(null)).toBeNull();
		expect(toStoredSubset(undefined)).toBeNull();
	});

	it('keeps a real subset id', () => {
		expect(toStoredSubset('fto')).toBe('fto');
		expect(toStoredSubset('333')).toBe('333');
	});
});

describe('normalizeWcaEventBucket', () => {
	it('stores a non-WCA default subset as null', () => {
		expect(normalizeWcaEventBucket('fto', '')).toEqual({cube_type: 'fto', scramble_subset: null});
		expect(normalizeWcaEventBucket('444yau', '')).toEqual({cube_type: '444yau', scramble_subset: null});
	});

	it('still collapses a standalone WCA event onto the wca bucket', () => {
		expect(normalizeWcaEventBucket('777', '')).toEqual({cube_type: 'wca', scramble_subset: '777'});
		expect(normalizeWcaEventBucket('333', null)).toEqual({cube_type: 'wca', scramble_subset: '333'});
	});

	it('leaves canonical buckets and real variants unchanged', () => {
		expect(normalizeWcaEventBucket('wca', '333')).toEqual({cube_type: 'wca', scramble_subset: '333'});
		expect(normalizeWcaEventBucket('333', '333oh')).toEqual({cube_type: '333', scramble_subset: '333oh'});
		expect(normalizeWcaEventBucket('333cfop', 'f2l')).toEqual({cube_type: '333cfop', scramble_subset: 'f2l'});
	});
});
