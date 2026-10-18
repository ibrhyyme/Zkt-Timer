import {getStore} from '../store';
import {getCachedMe} from '../../util/auth/cached-me';

/**
 * Last-seen competition data, kept on the device.
 *
 * A competitor opens the app on competition day and taps "My competitions": the
 * list, the competition, its groups and its results must be on screen at once,
 * not after the network answers. Every competition screen renders the copy kept
 * here and replaces it quietly when the fresh one lands (stale-while-revalidate).
 * How old a copy may be before it is refreshed is each caller's decision; this
 * module only keeps and returns copies with the time they were written.
 *
 * Three tiers:
 * - memory: everything read or written in this session.
 * - localStorage ('local'): small lists, readable synchronously, so the very
 *   first frame of the list already has them.
 * - IndexedDB ('idb'): large payloads. A competition detail runs 300 to 600 KB,
 *   a handful of them would fill localStorage. Read asynchronously (a few ms).
 *
 * Data that depends on the viewer (their registrations, a detail carrying their
 * own registration) goes under `userScoped()` keys; everything is dropped on
 * logout (clearAccountCaches).
 */

export interface CacheEntry<T> {
	data: T;
	ts: number;
}

export type CacheTier = 'local' | 'idb';

const LS_PREFIX = 'zkt_comp_cache_v1:';
const IDB_NAME = 'zkt-competition-cache';
const IDB_STORE = 'entries';
const IDB_MAX_ENTRIES = 60;
const MEMORY_MAX_ENTRIES = 60;

const memory = new Map<string, CacheEntry<any>>();

// On the web the first render hydrates server markup that was drawn without any
// of this data; reading it synchronously in that render would not match the
// markup. The native app has no server markup, so it may read at once. The
// flag is computed when this module loads, which is before the app hydrates.
const serverMarkupAtBoot =
	typeof document !== 'undefined' && !!document.getElementById('app')?.firstElementChild;
let hydrated = false;

/** Call from an effect: hydration is over once any effect runs. */
export function markHydrated(): void {
	hydrated = true;
}

function canReadPersistedSync(): boolean {
	return typeof window !== 'undefined' && (!serverMarkupAtBoot || hydrated);
}

function remember<T>(key: string, entry: CacheEntry<T>): void {
	memory.delete(key);
	memory.set(key, entry);
	while (memory.size > MEMORY_MAX_ENTRIES) {
		const oldest = memory.keys().next().value;
		if (oldest === undefined) break;
		memory.delete(oldest);
	}
}

// On a native cold start the account arrives from the network a moment after the
// first render; the copy saved on the device names the same account at once.
function currentUserId(): string {
	try {
		return getStore()?.getState()?.account?.me?.id || getCachedMe()?.id || 'anon';
	} catch {
		return 'anon';
	}
}

/** Key for data that belongs to the signed-in viewer. */
export function userScoped(key: string): string {
	return `u:${currentUserId()}:${key}`;
}

function readLocal<T>(key: string): CacheEntry<T> | null {
	try {
		const raw = localStorage.getItem(LS_PREFIX + key);
		if (!raw) return null;
		const entry = JSON.parse(raw);
		return entry && typeof entry.ts === 'number' ? entry : null;
	} catch {
		return null;
	}
}

/**
 * The copy available right now without waiting: memory, then localStorage.
 * IndexedDB copies need `loadCached`.
 */
export function peekCached<T>(key: string): CacheEntry<T> | null {
	const hit = memory.get(key);
	if (hit) return hit;
	if (!canReadPersistedSync()) return null;
	const local = readLocal<T>(key);
	if (local) remember(key, local);
	return local;
}

/** Any copy on the device, IndexedDB included. Call from an effect. */
export async function loadCached<T>(key: string): Promise<CacheEntry<T> | null> {
	const hit = memory.get(key);
	if (hit) return hit;
	if (typeof window === 'undefined') return null;
	const local = readLocal<T>(key);
	if (local) {
		remember(key, local);
		return local;
	}
	const stored = await idbGet<T>(key);
	if (stored) remember(key, stored);
	return stored;
}

/** The data of `peekCached` when it is no older than `maxAge`, else null. */
export function peekShown<T>(key: string, maxAge: number): T | null {
	const entry = peekCached<T>(key);
	return entry && !isOlderThan(entry, maxAge) ? entry.data : null;
}

/**
 * Memory, then the device, for a page deciding what to draw first. A copy older
 * than `maxAge` does not count. A slow device read is not waited out: after
 * `timeoutMs` the page goes on as if nothing was kept.
 */
export async function readDeviceCopy<T>(key: string, maxAge: number, timeoutMs = 300): Promise<CacheEntry<T> | null> {
	const fresh = (entry: CacheEntry<T> | null) => (entry && !isOlderThan(entry, maxAge) ? entry : null);
	const hit = fresh(peekCached<T>(key));
	if (hit) return hit;
	const stored = await Promise.race([
		loadCached<T>(key),
		new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
	]);
	return fresh(stored);
}

/** Keep a fresh copy. Returns the entry so callers can read its time. */
export function storeCached<T>(key: string, data: T, tier: CacheTier): CacheEntry<T> {
	const entry: CacheEntry<T> = {data, ts: Date.now()};
	remember(key, entry);
	if (typeof window === 'undefined') return entry;
	if (tier === 'local') {
		try {
			localStorage.setItem(LS_PREFIX + key, JSON.stringify(entry));
		} catch {
			// Full or blocked storage: the memory copy still serves this session.
		}
	} else {
		idbPut(key, entry).catch(() => {});
	}
	return entry;
}

export function isOlderThan(entry: CacheEntry<unknown> | null | undefined, ms: number): boolean {
	return !entry || Date.now() - entry.ts > ms;
}

/** Everything this module kept, on every tier. Part of logout. */
export async function clearCompetitionCaches(): Promise<void> {
	memory.clear();
	if (typeof window === 'undefined') return;
	try {
		for (let i = localStorage.length - 1; i >= 0; i--) {
			const k = localStorage.key(i);
			if (k && k.startsWith(LS_PREFIX)) localStorage.removeItem(k);
		}
	} catch {
		// ignore
	}
	try {
		const db = await openDb();
		if (!db) return;
		await requestDone(db.transaction(IDB_STORE, 'readwrite').objectStore(IDB_STORE).clear());
	} catch {
		// ignore
	}
}

// --- IndexedDB -----------------------------------------------------------------

let dbPromise: Promise<IDBDatabase | null> | null = null;
let writesSincePrune = 0;

function openDb(): Promise<IDBDatabase | null> {
	if (dbPromise) return dbPromise;
	dbPromise = new Promise((resolve) => {
		try {
			if (typeof indexedDB === 'undefined') {
				resolve(null);
				return;
			}
			const request = indexedDB.open(IDB_NAME, 1);
			request.onupgradeneeded = () => {
				const db = request.result;
				if (!db.objectStoreNames.contains(IDB_STORE)) {
					const store = db.createObjectStore(IDB_STORE, {keyPath: 'key'});
					store.createIndex('ts', 'ts');
				}
			};
			request.onsuccess = () => resolve(request.result);
			// Private mode and blocked storage: the app runs on memory alone.
			request.onerror = () => resolve(null);
			request.onblocked = () => resolve(null);
		} catch {
			resolve(null);
		}
	});
	return dbPromise;
}

function requestDone<T = unknown>(request: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

async function idbGet<T>(key: string): Promise<CacheEntry<T> | null> {
	try {
		const db = await openDb();
		if (!db) return null;
		const row: any = await requestDone(db.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).get(key));
		return row && typeof row.ts === 'number' ? {data: row.data, ts: row.ts} : null;
	} catch {
		return null;
	}
}

async function idbPut<T>(key: string, entry: CacheEntry<T>): Promise<void> {
	const db = await openDb();
	if (!db) return;
	await requestDone(db.transaction(IDB_STORE, 'readwrite').objectStore(IDB_STORE).put({key, ...entry}));
	writesSincePrune += 1;
	if (writesSincePrune >= 10) {
		writesSincePrune = 0;
		await pruneIdb(db).catch(() => {});
	}
}

/** Keep the newest IDB_MAX_ENTRIES copies; older competitions fall off. */
async function pruneIdb(db: IDBDatabase): Promise<void> {
	const store = db.transaction(IDB_STORE, 'readwrite').objectStore(IDB_STORE);
	const total = await requestDone(store.count());
	let excess = total - IDB_MAX_ENTRIES;
	if (excess <= 0) return;
	await new Promise<void>((resolve) => {
		const cursorRequest = store.index('ts').openCursor();
		cursorRequest.onsuccess = () => {
			const cursor = cursorRequest.result;
			if (!cursor || excess <= 0) {
				resolve();
				return;
			}
			cursor.delete();
			excess -= 1;
			cursor.continue();
		};
		cursorRequest.onerror = () => resolve();
	});
}
