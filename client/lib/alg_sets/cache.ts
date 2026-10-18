/**
 * Device cache of algorithm sets (trainer-sets 9.3).
 *
 * Studying works offline; managing sets does not. The last opened sets (OFFLINE_CACHED_SETS,
 * own and saved alike) are kept with every row, and the last My Sets list is kept so the tab can
 * show something without a connection.
 *
 * Storage: `localStorage['trainer_alg_sets:<userId>']` = {list, sets: {<set id>: entry}}. Keyed by
 * set id, not by share code: an owner who resets the link changes the code, and a saver keeps
 * access through the set id. The current code is copied in from every My Sets response.
 *
 * Every read and write is guarded: a private window, blocked storage or a full quota must never
 * break the page. On a full quota the oldest sets go first; if even an empty cache does not fit,
 * the app runs without one. LokiJS is not used: sets come from the server and are small, they do
 * not belong in the solve database's sync logic.
 *
 * Pure apart from the storage it is handed (tests pass a fake one).
 */
import {ALG_SET_LIMITS, algSetCaseKey} from '../../../shared/trainer/alg_sets';
import type {AlgSetData, MyAlgSetsData, SavedAlgSetData} from './types';

export const ALG_SET_CACHE_PREFIX = 'trainer_alg_sets:';

export interface StorageLike {
	readonly length: number;
	key(index: number): string | null;
	getItem(key: string): string | null;
	setItem(key: string, value: string): void;
	removeItem(key: string): void;
}

export interface CachedAlgSet {
	set: AlgSetData;
	/** When the server copy was fetched. */
	fetched_at: number;
	/** When the set was last opened (LRU order). */
	opened_at: number;
}

export interface AlgSetCacheData {
	list: MyAlgSetsData | null;
	list_fetched_at: number;
	sets: Record<string, CachedAlgSet>;
}

function emptyCache(): AlgSetCacheData {
	return {list: null, list_fetched_at: 0, sets: {}};
}

/** localStorage, or null where it is missing or throws (SSR, private mode, blocked site data). */
export function defaultStorage(): StorageLike | null {
	try {
		if (typeof window === 'undefined' || !window.localStorage) return null;
		return window.localStorage;
	} catch {
		return null;
	}
}

function cacheKey(userId: string): string {
	return ALG_SET_CACHE_PREFIX + userId;
}

export function readAlgSetCache(userId: string | null | undefined, storage = defaultStorage()): AlgSetCacheData {
	if (!userId || !storage) return emptyCache();
	try {
		const raw = storage.getItem(cacheKey(userId));
		if (!raw) return emptyCache();
		const parsed = JSON.parse(raw);
		if (!parsed || typeof parsed !== 'object') return emptyCache();
		const sets: Record<string, CachedAlgSet> = {};
		if (parsed.sets && typeof parsed.sets === 'object') {
			for (const [id, entry] of Object.entries<any>(parsed.sets)) {
				if (entry && entry.set && Array.isArray(entry.set.items)) sets[id] = entry;
			}
		}
		return {
			list: parsed.list && Array.isArray(parsed.list.own) ? parsed.list : null,
			list_fetched_at: typeof parsed.list_fetched_at === 'number' ? parsed.list_fetched_at : 0,
			sets,
		};
	} catch {
		return emptyCache();
	}
}

/** Sets sorted oldest opened first. */
function byAge(sets: Record<string, CachedAlgSet>): string[] {
	return Object.keys(sets).sort((a, b) => sets[a].opened_at - sets[b].opened_at);
}

/**
 * Writes the cache. On a storage error (full quota) the oldest sets are dropped one by one and
 * the write retried; if nothing fits, the key is removed and false comes back.
 */
export function writeAlgSetCache(
	userId: string | null | undefined,
	data: AlgSetCacheData,
	storage = defaultStorage()
): boolean {
	if (!userId || !storage) return false;
	const key = cacheKey(userId);
	const sets = {...data.sets};
	const order = byAge(sets);
	for (;;) {
		try {
			storage.setItem(key, JSON.stringify({...data, sets}));
			return true;
		} catch {
			const oldest = order.shift();
			if (!oldest) break;
			delete sets[oldest];
		}
	}
	try {
		storage.removeItem(key);
	} catch {
		// nothing else to do: run without a cache
	}
	return false;
}

/** Keeps at most `limit` sets, dropping the least recently opened. */
export function trimToLimit(
	sets: Record<string, CachedAlgSet>,
	limit: number = ALG_SET_LIMITS.OFFLINE_CACHED_SETS
): Record<string, CachedAlgSet> {
	const order = byAge(sets);
	const out = {...sets};
	while (order.length > limit) {
		delete out[order.shift()!];
	}
	return out;
}

export function getCachedSet(userId: string | null | undefined, setId: string, storage = defaultStorage()): CachedAlgSet | null {
	return readAlgSetCache(userId, storage).sets[setId] || null;
}

export function findCachedSetByCode(
	userId: string | null | undefined,
	code: string,
	storage = defaultStorage()
): CachedAlgSet | null {
	const {sets} = readAlgSetCache(userId, storage);
	for (const entry of Object.values(sets)) {
		if (entry.set.code === code) return entry;
	}
	return null;
}

/** Stores a freshly fetched (or freshly opened) set and makes it the most recent. */
export function putCachedSet(
	userId: string | null | undefined,
	set: AlgSetData,
	now = Date.now(),
	storage = defaultStorage()
): boolean {
	if (!userId || !set || !set.id) return false;
	const data = readAlgSetCache(userId, storage);
	data.sets = trimToLimit({...data.sets, [set.id]: {set, fetched_at: now, opened_at: now}});
	if (!writeAlgSetCache(userId, data, storage)) return false;
	// A full quota may have pushed out the new set itself (it is the most recent, so only when
	// it does not fit alone): true only when it is really there.
	return !!readAlgSetCache(userId, storage).sets[set.id];
}

/** Marks a cached set as just opened (LRU) without replacing it. */
export function touchCachedSet(userId: string | null | undefined, setId: string, now = Date.now(), storage = defaultStorage()) {
	const data = readAlgSetCache(userId, storage);
	const entry = data.sets[setId];
	if (!entry) return;
	data.sets = {...data.sets, [setId]: {...entry, opened_at: now}};
	writeAlgSetCache(userId, data, storage);
}

export function removeCachedSet(userId: string | null | undefined, setId: string, storage = defaultStorage()) {
	const data = readAlgSetCache(userId, storage);
	if (!data.sets[setId]) return;
	const sets = {...data.sets};
	delete sets[setId];
	data.sets = sets;
	writeAlgSetCache(userId, data, storage);
}

/**
 * Stores the My Sets list. The current code of each listed set is copied onto its cached copy
 * (a reset link must not orphan the offline copy), and a saved set that is no longer shared
 * loses its offline copy (the owner withdrew it, 3.4).
 */
export function putCachedList(
	userId: string | null | undefined,
	list: MyAlgSetsData,
	now = Date.now(),
	storage = defaultStorage()
): boolean {
	if (!userId) return false;
	const data = readAlgSetCache(userId, storage);
	const sets = {...data.sets};
	const listed = [...list.own, ...list.saved.map((s) => s.set).filter((s): s is NonNullable<typeof s> => !!s)];
	for (const summary of listed) {
		const entry = sets[summary.id];
		if (entry && entry.set.code !== summary.code) {
			sets[summary.id] = {...entry, set: {...entry.set, code: summary.code}};
		}
	}
	for (const saved of list.saved) {
		if (saved.unavailable) delete sets[saved.set_id];
	}
	return writeAlgSetCache(userId, {list, list_fetched_at: now, sets}, storage);
}

/** Removes one user's cache (logout). */
export function clearAlgSetCache(userId: string | null | undefined, storage = defaultStorage()) {
	if (!userId || !storage) return;
	try {
		storage.removeItem(cacheKey(userId));
	} catch {
		// ignore
	}
}

/** Removes every user's set cache on this device (logout, account deletion). */
export function clearAllAlgSetCaches(storage = defaultStorage()) {
	if (!storage) return;
	try {
		const keys: string[] = [];
		for (let i = 0; i < storage.length; i++) {
			const key = storage.key(i);
			if (key && key.startsWith(ALG_SET_CACHE_PREFIX)) keys.push(key);
		}
		keys.forEach((key) => storage.removeItem(key));
	} catch {
		// ignore
	}
}

/**
 * Saved sets the device knew about that the server no longer lists: the owner deleted the set
 * (or the account). Shown once as "the owner removed this set", then dropped with the new list.
 */
export function removedSavedSets(previous: MyAlgSetsData | null, next: MyAlgSetsData): SavedAlgSetData[] {
	if (!previous) return [];
	const still = new Set(next.saved.map((s) => s.set_id));
	return previous.saved.filter((s) => s.set_id && !still.has(s.set_id));
}

/**
 * Rows whose algorithm changed between the cached copy and the fresh one (same case, other
 * text): the set page marks them "Algorithm changed" once (6.6). Returns item ids of `next`.
 */
export function changedAlgorithmItems(previous: AlgSetData | null | undefined, next: AlgSetData): Set<string> {
	const out = new Set<string>();
	if (!previous) return out;
	const before = new Map<string, string>();
	for (const item of previous.items) before.set(algSetCaseKey(item.category, item.case_name), item.algorithm);
	for (const item of next.items) {
		const old = before.get(algSetCaseKey(item.category, item.case_name));
		if (old !== undefined && old !== item.algorithm) out.add(item.id);
	}
	return out;
}

/**
 * What to do when `algSet(code)` answers NOT_FOUND for a set the device has (9.3), given a fresh
 * My Sets list: the set may have a new code (the owner reset the link), or be gone for us.
 */
export type NotFoundResolution = {action: 'delete'} | {action: 'retry'; code: string};

export function resolveNotFound(setId: string, failedCode: string, list: MyAlgSetsData): NotFoundResolution {
	const own = list.own.find((s) => s.id === setId);
	const saved = list.saved.find((s) => s.set_id === setId);
	const current = own || (saved && !saved.unavailable ? saved.set : null);
	if (current && current.code && current.code !== failedCode) return {action: 'retry', code: current.code};
	return {action: 'delete'};
}
