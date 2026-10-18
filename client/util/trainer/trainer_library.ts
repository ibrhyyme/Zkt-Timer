/**
 * Where the trainer library comes from.
 *
 * The full library is private: the server holds it outside git and never serves it as a file
 * (server/util/trainer_library.ts). Two pieces reach the client:
 *
 * - Mains (trainerLibrary): every case's main algorithm and setup, for anyone. Everything that
 *   lists or trains cases runs on these. Kept on the device per library version, so a page load
 *   only asks "still this version?".
 * - Alternatives (trainerLibraryAlternatives): one category per request, signed-in users only,
 *   kept on the device per version. Signed out, the alternatives of the public
 *   default-algs.json stand in (already public, so nothing is given away).
 *
 * Offline with nothing kept yet (a fresh native install), the public file is the library.
 */
import {gqlQueryTyped} from '../../components/api';
import {getStore} from '../../components/store';
import {getCachedMe} from '../auth/cached-me';
import {TrainerLibraryAlternativesDocument, TrainerLibraryDocument} from '../../@types/generated/graphql';
import type {AlgorithmSubset} from '../../components/trainer/types';

export type Library = Record<string, AlgorithmSubset[]>;
type AlternativesByName = Map<string, string[]>;

const PUBLIC_LIBRARY_URL = '/public/trainer/default-algs.json';
const IDB_NAME = 'zkt-trainer-library';
const IDB_STORE = 'entries';
const MAINS_KEY = 'mains';
const altsKey = (version: string, category: string) => `alts:${version}:${category}`;

// ---------------------------------------------------------------------------------------
// IndexedDB (the mains run 750 KB, 1LLL's alternatives alone 470 KB: too big for localStorage)
// ---------------------------------------------------------------------------------------

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
	if (dbPromise) return dbPromise;
	dbPromise = new Promise((resolve) => {
		try {
			if (typeof indexedDB === 'undefined') return resolve(null);
			const req = indexedDB.open(IDB_NAME, 1);
			req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
			req.onsuccess = () => resolve(req.result);
			req.onerror = () => resolve(null);
			req.onblocked = () => resolve(null);
		} catch {
			resolve(null);
		}
	});
	return dbPromise;
}

async function idbGet<T>(key: string): Promise<T | null> {
	const db = await openDb();
	if (!db) return null;
	return new Promise((resolve) => {
		try {
			const req = db.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).get(key);
			req.onsuccess = () => resolve((req.result as T) ?? null);
			req.onerror = () => resolve(null);
		} catch {
			resolve(null);
		}
	});
}

async function idbPut(key: string, value: unknown): Promise<void> {
	const db = await openDb();
	if (!db) return;
	await new Promise<void>((resolve) => {
		try {
			const tx = db.transaction(IDB_STORE, 'readwrite');
			tx.objectStore(IDB_STORE).put(value, key);
			tx.oncomplete = () => resolve();
			tx.onerror = () => resolve();
			tx.onabort = () => resolve();
		} catch {
			resolve();
		}
	});
}

/** Drops alternatives of other library versions; the mains entry is overwritten in place. */
async function idbPruneAlternatives(version: string): Promise<void> {
	const db = await openDb();
	if (!db) return;
	await new Promise<void>((resolve) => {
		try {
			const tx = db.transaction(IDB_STORE, 'readwrite');
			const store = tx.objectStore(IDB_STORE);
			const req = store.getAllKeys();
			req.onsuccess = () => {
				for (const key of req.result as string[]) {
					if (typeof key === 'string' && key.startsWith('alts:') && !key.startsWith(`alts:${version}:`)) {
						store.delete(key);
					}
				}
			};
			tx.oncomplete = () => resolve();
			tx.onerror = () => resolve();
			tx.onabort = () => resolve();
		} catch {
			resolve();
		}
	});
}

// ---------------------------------------------------------------------------------------
// Public library (offline fallback, signed-out alternatives)
// ---------------------------------------------------------------------------------------

let publicLibrary: Promise<Library> | null = null;

function fetchPublicLibrary(): Promise<Library> {
	if (!publicLibrary) {
		publicLibrary = fetch(PUBLIC_LIBRARY_URL)
			.then((res) => {
				if (!res.ok) throw new Error(`public library ${res.status}`);
				return res.json();
			})
			.catch((err) => {
				publicLibrary = null;
				throw err;
			});
	}
	return publicLibrary;
}

// ---------------------------------------------------------------------------------------
// Mains
// ---------------------------------------------------------------------------------------

type StoredMains = {version: string; library: Library};

let mains: Promise<Library> | null = null;
let mainsVersion: string | null = null;
// Only the server's library is complete: the public file lacks the newer categories.
let mainsFromServer = false;

type ServerCategory = {
	category: string;
	subsets: {subset: string; algorithms: {name: string; algorithm: string; setup?: string | null; alternativeCount?: number | null}[]}[];
};

function toLibrary(categories: ServerCategory[]): Library {
	const out: Library = {};
	for (const c of categories) {
		out[c.category] = c.subsets.map((s) => ({
			subset: s.subset,
			algorithms: s.algorithms.map((a) => {
				const entry: AlgorithmSubset['algorithms'][number] = {name: a.name, algorithm: a.algorithm};
				if (a.setup) entry.setup = a.setup;
				if (a.alternativeCount) entry.alternativeCount = a.alternativeCount;
				return entry;
			}),
		}));
	}
	return out;
}

async function loadMains(): Promise<Library> {
	const stored = await idbGet<StoredMains>(MAINS_KEY);
	try {
		const res = await gqlQueryTyped(TrainerLibraryDocument, {knownVersion: stored?.version ?? null}, {fetchPolicy: 'no-cache'});
		const data = res?.data?.trainerLibrary;
		if (data?.version && stored && !data.categories && data.version === stored.version) {
			mainsVersion = stored.version;
			mainsFromServer = true;
			return stored.library;
		}
		if (data?.version && data.categories) {
			const library = toLibrary(data.categories as ServerCategory[]);
			mainsVersion = data.version;
			mainsFromServer = true;
			idbPut(MAINS_KEY, {version: data.version, library} as StoredMains).then(() => idbPruneAlternatives(data.version));
			return library;
		}
	} catch {
		// offline or the server refused: the copy on the device, else the public file
	}
	if (stored?.library) {
		mainsVersion = stored.version;
		mainsFromServer = true;
		return stored.library;
	}
	return fetchPublicLibrary();
}

/** True once the mains came from the server (now or kept from an earlier visit), not the public file. */
export function isLibraryComplete(): boolean {
	return mainsFromServer;
}

/** Every case's main algorithm and setup. Fetched once per page load. */
export function fetchLibraryMains(): Promise<Library> {
	if (!mains) {
		mains = loadMains().catch((err) => {
			mains = null;
			throw err;
		});
	}
	return mains;
}

// ---------------------------------------------------------------------------------------
// Alternatives
// ---------------------------------------------------------------------------------------

function signedIn(): boolean {
	try {
		return !!(getStore()?.getState()?.account?.me?.id || getCachedMe()?.id);
	} catch {
		return false;
	}
}

const serverAlternatives = new Map<string, Promise<AlternativesByName | null>>();

function publicAlternatives(library: Library, category: string): AlternativesByName {
	const out: AlternativesByName = new Map();
	for (const sub of library[category] || []) {
		for (const entry of sub.algorithms || []) {
			if (entry.alternatives?.length) out.set(entry.name, entry.alternatives);
		}
	}
	return out;
}

async function loadServerAlternatives(category: string): Promise<AlternativesByName | null> {
	await fetchLibraryMains().catch(() => null);
	const version = mainsVersion;
	if (version) {
		const stored = await idbGet<[string, string[]][]>(altsKey(version, category));
		if (stored) return new Map(stored);
	}
	const res = await gqlQueryTyped(TrainerLibraryAlternativesDocument, {category}, {fetchPolicy: 'no-cache'});
	const data = res?.data?.trainerLibraryAlternatives;
	if (!data) return null;
	const pairs: [string, string[]][] = (data.cases || []).map((c) => [c.name, c.alternatives || []]);
	idbPut(altsKey(data.version, category), pairs);
	return new Map(pairs);
}

/** Alternatives per case name for one category (see the module comment for the source). */
export async function fetchCategoryAlternatives(category: string): Promise<AlternativesByName> {
	if (signedIn()) {
		let pending = serverAlternatives.get(category);
		if (!pending) {
			pending = loadServerAlternatives(category).catch(() => null);
			serverAlternatives.set(category, pending);
		}
		const alts = await pending;
		if (alts) return alts;
		// A failed request (offline, rate limited) may succeed later.
		serverAlternatives.delete(category);
	}
	try {
		return publicAlternatives(await fetchPublicLibrary(), category);
	} catch {
		return new Map();
	}
}

/** One category of the library with its alternatives filled in. */
export async function fetchLibraryCategory(category: string): Promise<AlgorithmSubset[]> {
	const [library, alternatives] = await Promise.all([fetchLibraryMains(), fetchCategoryAlternatives(category)]);
	return (library[category] || []).map((sub) => ({
		subset: sub.subset,
		algorithms: sub.algorithms.map((entry) => {
			const alts = alternatives.get(entry.name);
			return alts?.length ? {...entry, alternatives: alts} : entry;
		}),
	}));
}

/** Test hook: forget everything fetched in this session. */
export function resetTrainerLibraryForTests(): void {
	mains = null;
	mainsVersion = null;
	mainsFromServer = false;
	publicLibrary = null;
	serverAlternatives.clear();
	dbPromise = null;
}
