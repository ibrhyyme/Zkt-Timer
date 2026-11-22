/**
 * Warm-up solve list: local first, synced to the server. The goal reads the local list, so
 * what matters is that a server listing never brings back an entry this device removed and
 * never drops one still on its way up, while it does take in other devices' entries.
 */

jest.mock('@apollo/client', () => ({gql: (s: TemplateStringsArray) => s.join('')}));
jest.mock('../../../store', () => ({getMe: () => null}));
jest.mock('../../../api', () => ({gqlMutate: jest.fn(), gqlQuery: jest.fn()}));
jest.mock('../../../../lib/sync-gate', () => ({canReadSync: () => false, canWriteSync: () => false}));
jest.mock('../../../../util/event_handler', () => ({emitEvent: jest.fn()}));

import {
	WarmupStore,
	addWarmupEntry,
	mergeServerWarmupEntries,
	pruneWarmupStore,
	removeWarmupEntry,
	warmupStoreToTally,
} from '../warmup-solves';
import {countDeletedForBucketDay, deletedTallyDayKey} from '../deleted-solves';

const NOW = new Date(2026, 10, 23, 12, 0, 0).getTime();
const entry = (started_at = NOW - 60_000) => ({started_at, cube_type: '333', scramble_subset: null});
const empty = (): WarmupStore => ({entries: {}, adds: {}, removes: {}});

describe('local changes', () => {
	it('records an entry as an upload to send', () => {
		const s = addWarmupEntry(empty(), 'a', entry());
		expect(s.entries.a).toBeDefined();
		expect(s.adds).toEqual({a: 0});
	});

	it('removing drops the entry and its upload and queues the server removal', () => {
		const s = removeWarmupEntry(addWarmupEntry(empty(), 'a', entry()), 'a');
		expect(s.entries).toEqual({});
		expect(s.adds).toEqual({});
		expect(s.removes).toEqual({a: 0});
	});

	it('recording again (undone auto-save) cancels a queued removal', () => {
		const s = addWarmupEntry(removeWarmupEntry(addWarmupEntry(empty(), 'a', entry()), 'a'), 'a', entry());
		expect(s.removes).toEqual({});
		expect(s.adds).toEqual({a: 0});
	});

	it('prunes entries past the retention window', () => {
		const old = NOW - 400 * 24 * 60 * 60 * 1000;
		const s = pruneWarmupStore(addWarmupEntry(addWarmupEntry(empty(), 'old', entry(old)), 'new', entry()), NOW);
		expect(Object.keys(s.entries)).toEqual(['new']);
		expect(Object.keys(s.adds)).toEqual(['new']);
	});
});

describe('mergeServerWarmupEntries', () => {
	const fetchStart = NOW;

	it("takes in another device's entries", () => {
		const s = mergeServerWarmupEntries(empty(), [{id: 'phone', ...entry()}], fetchStart);
		expect(s.entries.phone).toBeDefined();
	});

	it('keeps an entry not uploaded yet', () => {
		const s = mergeServerWarmupEntries(addWarmupEntry(empty(), 'a', entry()), [], fetchStart);
		expect(s.entries.a).toBeDefined();
		expect(s.adds).toEqual({a: 0});
	});

	it('keeps an entry confirmed after the listing was taken', () => {
		const local = {...addWarmupEntry(empty(), 'a', entry()), adds: {a: fetchStart + 5}};
		const s = mergeServerWarmupEntries(local, [], fetchStart);
		expect(s.entries.a).toBeDefined();
		expect(s.adds).toEqual({a: fetchStart + 5});
	});

	it('settles an upload the listing confirms', () => {
		const local = {...addWarmupEntry(empty(), 'a', entry()), adds: {a: fetchStart - 5}};
		const s = mergeServerWarmupEntries(local, [{id: 'a', ...entry()}], fetchStart);
		expect(s.entries.a).toBeDefined();
		expect(s.adds).toEqual({});
	});

	it('never brings back an entry being removed, even from a listing taken before', () => {
		const pending = removeWarmupEntry(addWarmupEntry(empty(), 'a', entry()), 'a');
		expect(mergeServerWarmupEntries(pending, [{id: 'a', ...entry()}], fetchStart).entries).toEqual({});

		const ackedAfter = {...pending, removes: {a: fetchStart + 5}};
		const s = mergeServerWarmupEntries(ackedAfter, [{id: 'a', ...entry()}], fetchStart);
		expect(s.entries).toEqual({});
		expect(s.removes).toEqual({a: fetchStart + 5});
	});

	it('settles a removal confirmed before the listing', () => {
		const local = {...empty(), removes: {a: fetchStart - 5}};
		expect(mergeServerWarmupEntries(local, [], fetchStart).removes).toEqual({});
	});

	it('drops a settled local entry the server no longer lists', () => {
		const local = {entries: {gone: entry()}, adds: {}, removes: {}};
		expect(mergeServerWarmupEntries(local, [], fetchStart).entries).toEqual({});
	});
});

describe('warmupStoreToTally', () => {
	it('counts entries per day and bucket like the goal query', () => {
		let s = addWarmupEntry(empty(), 'a', entry());
		s = addWarmupEntry(s, 'b', entry());
		s = addWarmupEntry(s, 'c', {started_at: NOW - 60_000, cube_type: '222', scramble_subset: null});
		const tally = warmupStoreToTally(s, NOW);
		expect(countDeletedForBucketDay(tally, deletedTallyDayKey(NOW), '333', null)).toBe(2);
		expect(countDeletedForBucketDay(tally, deletedTallyDayKey(NOW), '222', null)).toBe(1);
	});
});
