import {
	ALG_SET_CACHE_PREFIX,
	changedAlgorithmItems,
	clearAllAlgSetCaches,
	findCachedSetByCode,
	getCachedSet,
	putCachedList,
	putCachedSet,
	readAlgSetCache,
	removedSavedSets,
	resolveNotFound,
	touchCachedSet,
	trimToLimit,
	writeAlgSetCache,
	type StorageLike,
} from '../cache';
import type {AlgSetData, AlgSetItemData, AlgSetSummaryData, MyAlgSetsData} from '../types';

class MemoryStorage implements StorageLike {
	map = new Map<string, string>();
	/** Max total characters; a write beyond it throws like a full quota. */
	constructor(private quota = Infinity) {}
	get length() {
		return this.map.size;
	}
	key(i: number) {
		return Array.from(this.map.keys())[i] ?? null;
	}
	getItem(key: string) {
		return this.map.has(key) ? this.map.get(key)! : null;
	}
	setItem(key: string, value: string) {
		let total = value.length;
		this.map.forEach((v, k) => {
			if (k !== key) total += v.length;
		});
		if (total > this.quota) throw new Error('QuotaExceededError');
		this.map.set(key, value);
	}
	removeItem(key: string) {
		this.map.delete(key);
	}
}

function item(category: string, caseName: string, algorithm: string, position = 0): AlgSetItemData {
	return {
		id: `${category}-${caseName}`,
		category,
		case_name: caseName,
		subset: '',
		puzzle: '333',
		algorithm,
		position,
	};
}

function summary(id: string, code = `code_${id}`): AlgSetSummaryData {
	return {
		id,
		code,
		name: `Set ${id}`,
		description: null,
		visibility: 'link',
		item_count: 1,
		save_count: 0,
		categories: ['PLL'],
		puzzles: ['333'],
		preview: [],
		owner: {id: 'u1', username: 'owner', verified: false, avatar_path: null},
		published_at: null,
		updated_at: '2026-10-01T00:00:00.000Z',
		created_at: '2026-10-01T00:00:00.000Z',
		hidden: false,
	};
}

function set(id: string, items: AlgSetItemData[] = [item('PLL', 'Aa perm', "x R' U R' D2 R U' R' D2 R2 x'")], code?: string): AlgSetData {
	return {...summary(id, code), items, is_owner: true, is_saved: false};
}

const USER = 'user-1';

describe('alg set device cache', () => {
	it('reads an empty cache without storage, without a user, and from broken JSON', () => {
		expect(readAlgSetCache(USER, null)).toEqual({list: null, list_fetched_at: 0, sets: {}});
		const storage = new MemoryStorage();
		expect(readAlgSetCache(null, storage).sets).toEqual({});
		storage.setItem(ALG_SET_CACHE_PREFIX + USER, '{not json');
		expect(readAlgSetCache(USER, storage).sets).toEqual({});
	});

	it('stores a set by id and finds it by its code', () => {
		const storage = new MemoryStorage();
		expect(putCachedSet(USER, set('a'), 1, storage)).toBe(true);
		expect(getCachedSet(USER, 'a', storage)?.set.name).toBe('Set a');
		expect(findCachedSetByCode(USER, 'code_a', storage)?.set.id).toBe('a');
		expect(findCachedSetByCode(USER, 'nope', storage)).toBeNull();
		// Per user: another account on the device does not see it.
		expect(getCachedSet('user-2', 'a', storage)).toBeNull();
	});

	it('keeps at most the limit, dropping the least recently opened (LRU)', () => {
		const storage = new MemoryStorage();
		for (let i = 0; i < 21; i++) putCachedSet(USER, set(`s${i}`), 100 + i, storage);
		let ids = Object.keys(readAlgSetCache(USER, storage).sets);
		expect(ids).toHaveLength(20);
		expect(ids).not.toContain('s0');

		// Opening s1 makes it recent; the next new set pushes out s2 instead.
		touchCachedSet(USER, 's1', 500, storage);
		putCachedSet(USER, set('new'), 600, storage);
		ids = Object.keys(readAlgSetCache(USER, storage).sets);
		expect(ids).toContain('s1');
		expect(ids).not.toContain('s2');
		expect(ids).toHaveLength(20);
	});

	it('trimToLimit is pure', () => {
		const sets = {
			a: {set: set('a'), fetched_at: 1, opened_at: 3},
			b: {set: set('b'), fetched_at: 1, opened_at: 1},
			c: {set: set('c'), fetched_at: 1, opened_at: 2},
		};
		expect(Object.keys(trimToLimit(sets, 2)).sort()).toEqual(['a', 'c']);
		expect(Object.keys(sets)).toHaveLength(3);
	});

	it('on a full quota drops the oldest sets until the write fits', () => {
		const big = Array.from({length: 40}, (_, i) => item('ZBLL', `ZBLL ${i}`, "R U R' U R U2 R' ".repeat(3), i));
		const probe = new MemoryStorage();
		writeAlgSetCache(USER, {list: null, list_fetched_at: 0, sets: {x: {set: set('x', big), fetched_at: 0, opened_at: 0}}}, probe);
		const oneSet = probe.getItem(ALG_SET_CACHE_PREFIX + USER)!.length;

		// Room for about two big sets.
		const storage = new MemoryStorage(Math.floor(oneSet * 2.5));
		putCachedSet(USER, set('a', big), 1, storage);
		putCachedSet(USER, set('b', big), 2, storage);
		expect(putCachedSet(USER, set('c', big), 3, storage)).toBe(true);
		const ids = Object.keys(readAlgSetCache(USER, storage).sets).sort();
		expect(ids).toContain('c');
		expect(ids).not.toContain('a');
	});

	it('runs without a cache when not even one set fits', () => {
		const storage = new MemoryStorage(50);
		expect(putCachedSet(USER, set('a'), 1, storage)).toBe(false);
		expect(getCachedSet(USER, 'a', storage)).toBeNull();
	});

	it('never throws when storage itself throws', () => {
		const broken: StorageLike = {
			length: 0,
			key: () => null,
			getItem: () => {
				throw new Error('SecurityError');
			},
			setItem: () => {
				throw new Error('SecurityError');
			},
			removeItem: () => {
				throw new Error('SecurityError');
			},
		};
		expect(() => putCachedSet(USER, set('a'), 1, broken)).not.toThrow();
		expect(readAlgSetCache(USER, broken).sets).toEqual({});
		expect(() => clearAllAlgSetCaches(broken)).not.toThrow();
	});

	it('copies a new share code from the list and drops saved sets that are no longer shared', () => {
		const storage = new MemoryStorage();
		putCachedSet(USER, set('own', undefined, 'oldcode'), 1, storage);
		putCachedSet(USER, {...set('saved'), is_owner: false, is_saved: true}, 2, storage);
		const list: MyAlgSetsData = {
			own: [summary('own', 'newcode')],
			saved: [{set_id: 'saved', saved_at: null, unavailable: true, set: null}],
		};
		putCachedList(USER, list, 3, storage);
		const cache = readAlgSetCache(USER, storage);
		expect(cache.sets.own.set.code).toBe('newcode');
		expect(cache.sets.saved).toBeUndefined();
		expect(cache.list?.own[0].code).toBe('newcode');
	});

	it('resolves NOT_FOUND: retry with a new code, otherwise delete', () => {
		const list: MyAlgSetsData = {
			own: [summary('own', 'newcode')],
			saved: [
				{set_id: 'gone', saved_at: null, unavailable: true, set: null},
				{set_id: 'ok', saved_at: null, unavailable: false, set: summary('ok', 'same')},
			],
		};
		expect(resolveNotFound('own', 'oldcode', list)).toEqual({action: 'retry', code: 'newcode'});
		expect(resolveNotFound('gone', 'x', list)).toEqual({action: 'delete'});
		// Same code still NOT_FOUND: nothing to retry.
		expect(resolveNotFound('ok', 'same', list)).toEqual({action: 'delete'});
		expect(resolveNotFound('unknown', 'x', list)).toEqual({action: 'delete'});
	});

	it('marks rows whose algorithm changed, by case not by item id', () => {
		const before = set('a', [item('PLL', 'Aa perm', 'A'), item('OLL', 'OLL 1', 'B')]);
		const after = set('a', [
			{...item('PLL', 'Aa perm', 'A2'), id: 'new-id'},
			item('OLL', 'OLL 1', 'B'),
			item('PLL', 'T perm', 'C'),
		]);
		expect(Array.from(changedAlgorithmItems(before, after))).toEqual(['new-id']);
		expect(changedAlgorithmItems(null, after).size).toBe(0);
	});

	it('lists saved sets the server dropped (owner deleted them)', () => {
		const prev: MyAlgSetsData = {
			own: [],
			saved: [
				{set_id: 'a', saved_at: null, unavailable: false, set: summary('a')},
				{set_id: 'b', saved_at: null, unavailable: false, set: summary('b')},
			],
		};
		const next: MyAlgSetsData = {own: [], saved: [{set_id: 'a', saved_at: null, unavailable: false, set: summary('a')}]};
		expect(removedSavedSets(prev, next).map((s) => s.set_id)).toEqual(['b']);
		expect(removedSavedSets(null, next)).toEqual([]);
	});

	it('clears every user cache on logout and leaves other keys alone', () => {
		const storage = new MemoryStorage();
		putCachedSet('u1', set('a'), 1, storage);
		putCachedSet('u2', set('b'), 1, storage);
		storage.setItem('trainer_savedAlgorithms', '{}');
		clearAllAlgSetCaches(storage);
		expect(storage.getItem(ALG_SET_CACHE_PREFIX + 'u1')).toBeNull();
		expect(storage.getItem(ALG_SET_CACHE_PREFIX + 'u2')).toBeNull();
		expect(storage.getItem('trainer_savedAlgorithms')).toBe('{}');
	});
});
