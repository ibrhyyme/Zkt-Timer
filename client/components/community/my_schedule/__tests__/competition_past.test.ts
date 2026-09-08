import {isPastCompetition, localTodayStr} from '../competition-past';

const TODAY = '2026-09-08';

describe('isPastCompetition', () => {
	it('keeps a competition that has not happened yet', () => {
		expect(isPastCompetition({end_date: '2026-09-20'}, TODAY)).toBe(false);
	});

	it('keeps a competition all through its final day', () => {
		// Results are entered on the last evening — dropping it at 00:00 would
		// hide it exactly when people go looking for it.
		expect(isPastCompetition({end_date: '2026-09-08'}, TODAY)).toBe(false);
	});

	it('drops a competition whose last day has passed', () => {
		expect(isPastCompetition({end_date: '2026-08-16'}, TODAY)).toBe(true);
	});

	it('drops one the federation closed out before its printed end date', () => {
		expect(isPastCompetition({end_date: '2026-09-20', status: 'FINISHED'}, TODAY)).toBe(true);
		expect(isPastCompetition({end_date: '2026-09-20', status: 'PUBLISHED'}, TODAY)).toBe(true);
	});

	it('keeps one whose status is still part of the run-up', () => {
		expect(isPastCompetition({end_date: '2026-09-20', status: 'REGISTRATION_OPEN'}, TODAY)).toBe(false);
		expect(isPastCompetition({end_date: '2026-09-08', status: 'ONGOING'}, TODAY)).toBe(false);
	});

	it('reads full ISO dates from the federation, not just YYYY-MM-DD', () => {
		expect(isPastCompetition({end_date: '2026-08-16T00:00:00.000Z'}, TODAY)).toBe(true);
		expect(isPastCompetition({end_date: '2026-09-20T00:00:00.000Z'}, TODAY)).toBe(false);
	});

	it('keeps a competition with no end date rather than guessing', () => {
		expect(isPastCompetition({}, TODAY)).toBe(false);
		expect(isPastCompetition({end_date: null}, TODAY)).toBe(false);
	});
});

describe('localTodayStr', () => {
	it('uses the local calendar day, not UTC', () => {
		// 23:30 local on the 8th is already the 9th in UTC. A competitor's "today"
		// is the one on their own wall, so the local day is what lists compare to.
		const lateEvening = new Date(2026, 8, 8, 23, 30, 0);
		expect(localTodayStr(lateEvening)).toBe('2026-09-08');
	});

	it('zero-pads month and day', () => {
		expect(localTodayStr(new Date(2026, 0, 5))).toBe('2026-01-05');
	});
});
