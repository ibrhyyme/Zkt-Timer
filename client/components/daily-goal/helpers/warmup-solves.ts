import {gql} from '@apollo/client';
import {emitEvent} from '../../../util/event_handler';
import {getMe} from '../../store';
import {gqlMutate, gqlQuery} from '../../api';
import {canReadSync, canWriteSync} from '../../../lib/sync-gate';
import {WARMUP_SOLVE_RETENTION_DAYS} from '../../../../shared/solve';
import {
	DeletedSolveLike,
	DeletedSolveTally,
	addDeletedSolvesToTally,
	countDeletedForBucketDay,
	deletedDailyCountsFromTally,
	deletedTallyDayKey,
	isTalliedDeletion,
} from './deleted-solves';

/**
 * Warm-up solves behind "Isınma çözümlerini de say" (DailyGoalStorage.count_warmup_solves).
 *
 * Warm-up mode (lib/warmup/store.ts) saves nothing, so the goal and the heatmap never saw
 * those solves. Each one is kept here as a small entry (id, day, bucket; no time, no
 * scramble) and in the server's WarmupSolve table, so a goal finished on the phone reads
 * finished on the computer too. The solve itself stays unsaved: sessions, stats and PBs
 * never read this.
 *
 * - Recorded whether or not the toggle is on, so turning it on is a pure view switch.
 * - Never in this list and the solve DB at once: auto-save skips the record, the Save
 *   button takes it back out, an undone auto-save puts it back (timer/helpers/warmup.ts).
 * - Local first: the goal bar reads the local list synchronously. Uploads and removals
 *   wait in `adds` / `removes` until sent, and stay there (with the time the server
 *   answered) until a fetch that started after that answer has seen the result. A fetch
 *   therefore never resurrects a removed entry or drops one still on its way up.
 * - Sync rules are the solves': every logged-in user writes, READ is Pro when Pro is on
 *   (lib/sync-gate.ts). A Basic user's other devices do not show their timer solves either.
 */

export interface WarmupEntry {
	started_at: number;
	cube_type: string;
	scramble_subset: string | null;
}

export interface WarmupStore {
	entries: Record<string, WarmupEntry>;
	/** Entry ids to upload: 0 until the server confirmed, then the time it did. */
	adds: Record<string, number>;
	/** Ids to delete on the server, same values. */
	removes: Record<string, number>;
}

const STORAGE_KEY = 'daily_goal_warmup_solves';
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_PER_CALL = 500;
const SYNC_DEBOUNCE_MS = 10_000;

function emptyStore(): WarmupStore {
	return {entries: {}, adds: {}, removes: {}};
}

// --- Pure store operations (tested) ---

function isEntry(value: any): value is WarmupEntry {
	return (
		!!value &&
		typeof value.cube_type === 'string' &&
		typeof value.started_at === 'number' &&
		Number.isFinite(value.started_at)
	);
}

/** A copy with entries (and their pending uploads) past the retention window dropped. */
export function pruneWarmupStore(store: WarmupStore, nowMs: number): WarmupStore {
	const cutoff = nowMs - WARMUP_SOLVE_RETENTION_DAYS * DAY_MS;
	const next: WarmupStore = {entries: {}, adds: {}, removes: {...store.removes}};

	for (const [id, entry] of Object.entries(store.entries)) {
		if (!isEntry(entry) || entry.started_at < cutoff) continue;
		next.entries[id] = entry;
		if (id in store.adds) next.adds[id] = store.adds[id];
	}

	return next;
}

export function addWarmupEntry(store: WarmupStore, id: string, entry: WarmupEntry): WarmupStore {
	const removes = {...store.removes};
	delete removes[id];
	return {
		entries: {...store.entries, [id]: entry},
		adds: {...store.adds, [id]: 0},
		removes,
	};
}

export function removeWarmupEntry(store: WarmupStore, id: string): WarmupStore {
	const entries = {...store.entries};
	const adds = {...store.adds};
	delete entries[id];
	delete adds[id];
	return {entries, adds, removes: {...store.removes, [id]: 0}};
}

/**
 * The store after a server listing taken by a request sent at `fetchStartMs`:
 * - the server's entries, minus any this device is removing or has removed;
 * - plus local entries the server does not list yet that are still on their way up
 *   (unsent, or confirmed after the listing was taken);
 * - and the pending marks that this listing settles are cleared.
 * Anything else local that the server does not list is gone from there, and goes here too.
 */
export function mergeServerWarmupEntries(
	store: WarmupStore,
	server: Array<{id: string} & WarmupEntry>,
	fetchStartMs: number
): WarmupStore {
	const serverIds = new Set<string>();
	const next: WarmupStore = {entries: {}, adds: {}, removes: {}};

	for (const row of server) {
		if (!row?.id || !isEntry(row)) continue;
		serverIds.add(row.id);
		if (row.id in store.removes) continue;
		next.entries[row.id] = {
			started_at: row.started_at,
			cube_type: row.cube_type,
			scramble_subset: row.scramble_subset ?? null,
		};
	}

	for (const [id, ackedAt] of Object.entries(store.adds)) {
		const settled = ackedAt > 0 && ackedAt < fetchStartMs;
		if (settled) continue;
		next.adds[id] = ackedAt;
		if (!serverIds.has(id) && store.entries[id]) {
			next.entries[id] = store.entries[id];
		}
	}

	for (const [id, ackedAt] of Object.entries(store.removes)) {
		const settled = ackedAt > 0 && ackedAt < fetchStartMs;
		if (!settled) next.removes[id] = ackedAt;
	}

	return next;
}

export function warmupStoreToTally(store: WarmupStore, nowMs: number): DeletedSolveTally {
	const solves = Object.values(store.entries).map((e) => ({...e, from_timer: true}));
	return addDeletedSolvesToTally({}, solves, nowMs);
}

// --- localStorage, with an in-memory copy (the goal bar reads on every render) ---

let cache: {key: string; store: WarmupStore; tally: DeletedSolveTally | null} | null = null;

function storageKeyFor(userId: string | null | undefined): string {
	return `${STORAGE_KEY}_${userId || '_anon'}`;
}

function currentKey(): string {
	return storageKeyFor(getMe()?.id);
}

function readStore(key: string): WarmupStore {
	if (cache?.key === key) return cache.store;

	let store = emptyStore();
	if (typeof window !== 'undefined') {
		try {
			const parsed = JSON.parse(localStorage.getItem(key) || 'null');
			if (parsed && typeof parsed === 'object' && parsed.entries && typeof parsed.entries === 'object') {
				store = {
					entries: parsed.entries,
					adds: parsed.adds && typeof parsed.adds === 'object' ? parsed.adds : {},
					removes: parsed.removes && typeof parsed.removes === 'object' ? parsed.removes : {},
				};
			}
		} catch {
			// Unreadable: start over. The server copy comes back with the next fetch.
		}
	}

	cache = {key, store, tally: null};
	return store;
}

function writeStore(key: string, store: WarmupStore): void {
	const pruned = pruneWarmupStore(store, Date.now());
	cache = {key, store: pruned, tally: null};
	try {
		localStorage.setItem(key, JSON.stringify(pruned));
	} catch {
		// Quota or private mode: the in-memory copy still serves this page session.
	}
	// The solve DB does not change for a warm-up solve, so the goal bar would not recount.
	emitEvent('dailyGoalUpdatedEvent');
}

function currentTally(): DeletedSolveTally {
	const key = currentKey();
	readStore(key);
	if (!cache.tally) cache.tally = warmupStoreToTally(cache.store, Date.now());
	return cache.tally;
}

// --- Server sync ---

const ADD_MUTATION = gql`
	mutation AddWarmupSolves($solves: [WarmupSolveInput!]!) {
		addWarmupSolves(solves: $solves)
	}
`;

const REMOVE_MUTATION = gql`
	mutation RemoveWarmupSolves($ids: [String!]!) {
		removeWarmupSolves(ids: $ids)
	}
`;

const ENTRIES_QUERY = gql`
	query MyWarmupSolveEntries($sinceDays: Int!) {
		myWarmupSolveEntries(sinceDays: $sinceDays) {
			id
			cube_type
			scramble_subset
			started_at
		}
	}
`;

// One request at a time, in order: a removal must never overtake the upload of the same id.
let chain: Promise<void> = Promise.resolve();

function enqueue(task: () => Promise<void>): Promise<void> {
	chain = chain.then(task, task);
	return chain;
}

/** Marks the ids the server just confirmed, unless they changed meanwhile. */
function markAcked(key: string, field: 'adds' | 'removes', ids: string[]): void {
	const store = readStore(key);
	const now = Date.now();
	const marks = {...store[field]};
	for (const id of ids) {
		if (marks[id] === 0) marks[id] = now;
	}
	writeStore(key, {...store, [field]: marks});
}

async function flushOnce(): Promise<void> {
	const me = getMe();
	if (!me || !canWriteSync()) return;
	const key = storageKeyFor(me.id);

	const store = readStore(key);
	const addIds = Object.keys(store.adds)
		.filter((id) => store.adds[id] === 0 && store.entries[id])
		.slice(0, MAX_PER_CALL);
	if (addIds.length) {
		const solves = addIds.map((id) => {
			const e = store.entries[id];
			return {id, cube_type: e.cube_type, scramble_subset: e.scramble_subset, started_at: e.started_at};
		});
		try {
			await gqlMutate(ADD_MUTATION, {solves});
			markAcked(key, 'adds', addIds);
		} catch {
			return; // Offline or refused: stays pending for the next flush.
		}
	}

	const removeIds = Object.keys(readStore(key).removes)
		.filter((id) => readStore(key).removes[id] === 0)
		.slice(0, MAX_PER_CALL);
	if (removeIds.length) {
		try {
			await gqlMutate(REMOVE_MUTATION, {ids: removeIds});
			markAcked(key, 'removes', removeIds);
		} catch {
			// Stays pending.
		}
	}
}

function flushWarmupSolves(): Promise<void> {
	return enqueue(flushOnce);
}

let lastSyncAt = 0;

/**
 * Sends what is pending, then (when `read` and the user may read synced data) takes the
 * server's list. Called at boot, on returning to the tab and when the toggle is turned on.
 */
export function syncWarmupSolves(read: boolean, force = false): Promise<void> {
	const now = Date.now();
	if (!force && now - lastSyncAt < SYNC_DEBOUNCE_MS) return chain;
	lastSyncAt = now;

	flushWarmupSolves();
	if (!read) return chain;

	return enqueue(async () => {
		const me = getMe();
		if (!me || !canReadSync()) return;
		const key = storageKeyFor(me.id);

		const fetchStart = Date.now();
		try {
			const res = await gqlQuery<{myWarmupSolveEntries: Array<{id: string} & WarmupEntry>}>(ENTRIES_QUERY, {
				sinceDays: WARMUP_SOLVE_RETENTION_DAYS,
			});
			if (getMe()?.id !== me.id) return;
			writeStore(key, mergeServerWarmupEntries(readStore(key), res.data.myWarmupSolveEntries || [], fetchStart));
		} catch {
			// Offline: the local list keeps serving.
		}
	});
}

// --- Public API ---

export function recordWarmupSolve(solve: DeletedSolveLike & {id?: string | null}): void {
	if (typeof window === 'undefined' || !solve?.id || !isTalliedDeletion(solve)) return;
	const key = currentKey();
	writeStore(
		key,
		addWarmupEntry(readStore(key), solve.id, {
			started_at: solve.started_at,
			cube_type: solve.cube_type,
			scramble_subset: solve.scramble_subset || null,
		})
	);
	void flushWarmupSolves();
}

export function unrecordWarmupSolve(solve: {id?: string | null}): void {
	if (typeof window === 'undefined' || !solve?.id) return;
	const key = currentKey();
	const store = readStore(key);
	if (!store.entries[solve.id] && !(solve.id in store.adds)) return;
	writeStore(key, removeWarmupEntry(store, solve.id));
	void flushWarmupSolves();
}

/** Today's warm-up solves of a goal bucket. */
export function getWarmupCountForBucketToday(cubeType: string, scrambleSubset?: string | null): number {
	return countDeletedForBucketDay(currentTally(), deletedTallyDayKey(Date.now()), cubeType, scrambleSubset);
}

/** Per-day warm-up solve counts, filtered as deletedDailyCountsFromTally filters. */
export function getWarmupDailyCounts(cubeType?: string | null, scrambleSubset?: string | null): Map<string, number> {
	return deletedDailyCountsFromTally(currentTally(), cubeType, scrambleSubset);
}
