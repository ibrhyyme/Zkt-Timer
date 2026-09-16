/**
 * "Silinen çözümleri de say": a solve made and then deleted keeps counting toward the
 * daily goal and the activity heatmap when the user opts in. The deletions are tallied
 * per day of the solve and per bucket.
 */

let mockMe: any = null;
jest.mock('../../../store', () => ({ getMe: () => mockMe }));

import dayjs from 'dayjs';
import {
	addDeletedSolvesToTally,
	countDeletedForBucketDay,
	deletedDailyCountsFromTally,
	deletedTallyBucketKey,
	deletedTallyDayKey,
	DELETED_TALLY_RETENTION_DAYS,
	getDeletedCountForBucketToday,
	getDeletedDailyCounts,
	isTalliedDeletion,
	readDeletedSolveTally,
	recordDeletedSolves,
	removeDeletedSolvesFromTally,
	unrecordDeletedSolves,
} from '../deleted-solves';

const NOW = new Date(2026, 8, 15, 14, 0, 0).getTime();
const TODAY = deletedTallyDayKey(NOW);

function daysAgo(days: number, hour = 12): number {
	const d = new Date(NOW);
	d.setDate(d.getDate() - days);
	d.setHours(hour, 0, 0, 0);
	return d.getTime();
}

function solve(overrides: Record<string, any> = {}) {
	return {
		started_at: daysAgo(0),
		cube_type: '333',
		scramble_subset: null,
		from_timer: true,
		bulk: false,
		...overrides,
	};
}

describe('isTalliedDeletion', () => {
	it('takes a timer solve', () => {
		expect(isTalliedDeletion(solve())).toBe(true);
		expect(isTalliedDeletion(solve({dnf: true} as any))).toBe(true);
	});

	it('skips what the goal and the heatmap never counted, and imports', () => {
		expect(isTalliedDeletion(solve({from_timer: false}))).toBe(false);
		expect(isTalliedDeletion(solve({from_timer: undefined}))).toBe(false);
		expect(isTalliedDeletion(solve({bulk: true}))).toBe(false);
	});

	it('skips a solve it cannot place', () => {
		expect(isTalliedDeletion(solve({started_at: null}))).toBe(false);
		expect(isTalliedDeletion(solve({started_at: 0}))).toBe(false);
		expect(isTalliedDeletion(solve({cube_type: ''}))).toBe(false);
		expect(isTalliedDeletion(null)).toBe(false);
	});
});

describe('addDeletedSolvesToTally', () => {
	it('counts each deletion under its own day and bucket', () => {
		const tally = addDeletedSolvesToTally(
			{},
			[solve(), solve(), solve({cube_type: '222'}), solve({cube_type: 'wca', scramble_subset: '333'})],
			NOW
		);

		expect(countDeletedForBucketDay(tally, TODAY, '333', null)).toBe(2);
		expect(countDeletedForBucketDay(tally, TODAY, '222', null)).toBe(1);
		expect(countDeletedForBucketDay(tally, TODAY, 'wca', '333')).toBe(1);
		expect(countDeletedForBucketDay(tally, TODAY, '444', null)).toBe(0);
	});

	it('puts an old solve on its own day, not on the day it was deleted', () => {
		const lastWeek = daysAgo(7);
		const tally = addDeletedSolvesToTally({}, [solve({started_at: lastWeek})], NOW);

		expect(countDeletedForBucketDay(tally, deletedTallyDayKey(lastWeek), '333', null)).toBe(1);
		expect(countDeletedForBucketDay(tally, TODAY, '333', null)).toBe(0);
	});

	it('keeps a null subset apart from an empty-string one, as the solve query does', () => {
		const tally = addDeletedSolvesToTally({}, [solve({cube_type: '777', scramble_subset: ''})], NOW);

		expect(countDeletedForBucketDay(tally, TODAY, '777', '')).toBe(1);
		expect(countDeletedForBucketDay(tally, TODAY, '777', null)).toBe(0);
		expect(deletedTallyBucketKey('777', undefined)).toBe(deletedTallyBucketKey('777', null));
	});

	it('adds to what is already there without changing the input', () => {
		const first = addDeletedSolvesToTally({}, [solve()], NOW);
		const second = addDeletedSolvesToTally(first, [solve()], NOW);

		expect(countDeletedForBucketDay(first, TODAY, '333', null)).toBe(1);
		expect(countDeletedForBucketDay(second, TODAY, '333', null)).toBe(2);
	});

	it('drops days past the retention window, and never records one', () => {
		const expiredDay = deletedTallyDayKey(daysAgo(DELETED_TALLY_RETENTION_DAYS + 5));
		const keptDay = deletedTallyDayKey(daysAgo(DELETED_TALLY_RETENTION_DAYS - 1));
		const start = {
			[expiredDay]: {[deletedTallyBucketKey('333')]: 4},
			[keptDay]: {[deletedTallyBucketKey('333')]: 2},
		};

		const tally = addDeletedSolvesToTally(start, [solve({started_at: daysAgo(DELETED_TALLY_RETENTION_DAYS + 30)})], NOW);

		expect(tally[expiredDay]).toBeUndefined();
		expect(countDeletedForBucketDay(tally, keptDay, '333', null)).toBe(2);
		expect(Object.keys(tally)).toEqual([keptDay]);
	});
});

describe('removeDeletedSolvesFromTally', () => {
	// An undone deletion (the delete's undo window) must stop counting: the solve itself
	// is back in the solve DB, so leaving it tallied would count it twice.
	it('takes one deletion back out of its own day and bucket', () => {
		const tally = addDeletedSolvesToTally({}, [solve(), solve()], NOW);
		const next = removeDeletedSolvesFromTally(tally, [solve()], NOW);

		expect(countDeletedForBucketDay(next, TODAY, '333', null)).toBe(1);
		// Without changing the tally it was given
		expect(countDeletedForBucketDay(tally, TODAY, '333', null)).toBe(2);
	});

	it('drops the day once its last deletion is undone', () => {
		const tally = addDeletedSolvesToTally({}, [solve()], NOW);
		const next = removeDeletedSolvesFromTally(tally, [solve()], NOW);

		expect(next[TODAY]).toBeUndefined();
		expect(deletedDailyCountsFromTally(next).size).toBe(0);
	});

	it('never goes below zero, whatever it is asked to remove', () => {
		const tally = addDeletedSolvesToTally({}, [solve()], NOW);
		const next = removeDeletedSolvesFromTally(tally, [solve(), solve(), solve({cube_type: '222'})], NOW);

		expect(countDeletedForBucketDay(next, TODAY, '333', null)).toBe(0);
		expect(countDeletedForBucketDay(next, TODAY, '222', null)).toBe(0);
	});

	it('only touches the bucket and day it was given', () => {
		const yesterday = daysAgo(1);
		const tally = addDeletedSolvesToTally(
			{},
			[solve(), solve({cube_type: '222'}), solve({started_at: yesterday})],
			NOW
		);

		const next = removeDeletedSolvesFromTally(tally, [solve()], NOW);

		expect(countDeletedForBucketDay(next, TODAY, '333', null)).toBe(0);
		expect(countDeletedForBucketDay(next, TODAY, '222', null)).toBe(1);
		expect(countDeletedForBucketDay(next, deletedTallyDayKey(yesterday), '333', null)).toBe(1);
	});
});

describe('deletedDailyCountsFromTally', () => {
	const yesterday = daysAgo(1);
	const tally = addDeletedSolvesToTally(
		{},
		[
			solve(),
			solve({cube_type: '222'}),
			solve({started_at: yesterday}),
			solve({cube_type: 'wca', scramble_subset: '333'}),
			solve({cube_type: 'wca', scramble_subset: '444'}),
		],
		NOW
	);

	it('sums every bucket without a cube filter', () => {
		const map = deletedDailyCountsFromTally(tally);
		expect(map.get(TODAY)).toBe(4);
		expect(map.get(deletedTallyDayKey(yesterday))).toBe(1);
	});

	it('narrows to a bucket the way the stats filter matches solves', () => {
		expect(deletedDailyCountsFromTally(tally, '333', null).get(TODAY)).toBe(1);
		expect(deletedDailyCountsFromTally(tally, 'wca', '444').get(TODAY)).toBe(1);
		// A cube type with no subset given matches all of its subsets
		expect(deletedDailyCountsFromTally(tally, 'wca').get(TODAY)).toBe(2);
		expect(deletedDailyCountsFromTally(tally, 'sq1', null).size).toBe(0);
	});

	it('uses the heatmap day keys', () => {
		expect(TODAY).toBe(dayjs(NOW).format('YYYY-M-D'));
	});
});

describe('recording in localStorage', () => {
	let store: Record<string, string>;
	let dateNowSpy: jest.SpyInstance;

	beforeEach(() => {
		store = {};
		(global as any).window = {};
		(global as any).localStorage = {
			getItem: (key: string) => (key in store ? store[key] : null),
			setItem: (key: string, value: string) => {
				store[key] = String(value);
			},
			removeItem: (key: string) => {
				delete store[key];
			},
		};
		dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(NOW);
		mockMe = {id: 'user-1'};
	});

	afterEach(() => {
		dateNowSpy.mockRestore();
		delete (global as any).window;
		delete (global as any).localStorage;
	});

	it('keeps a per-user tally that the goal and the heatmap read back', () => {
		recordDeletedSolves([solve(), solve({started_at: daysAgo(3)})]);

		expect(Object.keys(store)).toEqual(['daily_goal_deleted_solves_user-1']);
		expect(getDeletedCountForBucketToday('333', null)).toBe(1);
		expect(getDeletedDailyCounts().get(deletedTallyDayKey(daysAgo(3)))).toBe(1);

		// Another account on the same device starts from nothing
		mockMe = {id: 'user-2'};
		expect(getDeletedCountForBucketToday('333', null)).toBe(0);
	});

	it('writes nothing when no removed solve qualifies', () => {
		recordDeletedSolves([solve({from_timer: false}), solve({bulk: true})]);
		expect(store).toEqual({});
	});

	it('survives a broken entry', () => {
		store['daily_goal_deleted_solves_user-1'] = '{not json';
		expect(readDeletedSolveTally()).toEqual({});

		recordDeletedSolves([solve()]);
		expect(getDeletedCountForBucketToday('333', null)).toBe(1);
	});

	it('stops counting a deletion the user undid', () => {
		const deleted = solve();
		recordDeletedSolves([deleted, solve({cube_type: '222'})]);
		expect(getDeletedCountForBucketToday('333', null)).toBe(1);

		unrecordDeletedSolves([deleted]);

		expect(getDeletedCountForBucketToday('333', null)).toBe(0);
		expect(getDeletedCountForBucketToday('222', null)).toBe(1);
	});

	it('writes nothing when the undone deletion was never tallied', () => {
		unrecordDeletedSolves([solve({from_timer: false})]);
		expect(store).toEqual({});
	});
});
