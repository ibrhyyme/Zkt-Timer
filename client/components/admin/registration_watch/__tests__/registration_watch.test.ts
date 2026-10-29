import {formatWatchDay, formatWatchMoment, missingRegistrantIds} from '../registration_watch';

describe('formatWatchMoment', () => {
	it('shows Turkey time whatever the zone of the machine', () => {
		// 16:10 UTC is 19:10 in Istanbul.
		expect(formatWatchMoment('2026-10-27T16:10:35.542Z', 'tr')).toContain('19:10');
	});

	it('is null for a missing or broken value', () => {
		expect(formatWatchMoment(null, 'tr')).toBeNull();
		expect(formatWatchMoment('not a date', 'tr')).toBeNull();
	});
});

describe('formatWatchDay', () => {
	it('keeps the calendar day', () => {
		expect(formatWatchDay('2026-10-31', 'en')).toContain('31');
	});

	it('passes an unexpected value through', () => {
		expect(formatWatchDay('soon', 'tr')).toBe('soon');
	});
});

describe('missingRegistrantIds', () => {
	it('lists the gaps up to the highest accepted number', () => {
		expect(missingRegistrantIds([1, 2, 4, 7, null])).toEqual([3, 5, 6]);
	});

	it('is empty for an empty list', () => {
		expect(missingRegistrantIds([])).toEqual([]);
	});
});
