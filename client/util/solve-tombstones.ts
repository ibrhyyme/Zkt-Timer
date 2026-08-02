import {getLocalStorage, setLocalStorageObject} from './data/local_storage';

/**
 * Deletion tombstones for solves.
 *
 * A delete is intent, but the sync layer cannot see intent: `backfillLocalDataToServer`
 * only knows "this id exists locally and not on the server" and re-uploads it, which
 * silently resurrects solves deleted on another device. Recording deleted ids lets the
 * backfill (and the delta fetch) tell a real deletion apart from an out-of-sync device.
 *
 * Stored as {id: deletedAtMs} in localStorage. Entries expire after TTL — by then every
 * device has reconciled, and keeping them forever would grow without bound.
 */

const STORAGE_KEY = 'zkt_deleted_solve_ids';
const TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days
const MAX_ENTRIES = 5000;

type TombstoneMap = Record<string, number>;

function readMap(): TombstoneMap {
	if (typeof window === 'undefined') {
		return {};
	}

	try {
		const raw = getLocalStorage(STORAGE_KEY);
		if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
			return {};
		}
		return raw as TombstoneMap;
	} catch (e) {
		return {};
	}
}

function writeMap(map: TombstoneMap) {
	if (typeof window === 'undefined') {
		return;
	}

	try {
		setLocalStorageObject(STORAGE_KEY, map);
	} catch (e) {
		// Quota exceeded — drop the oldest half and retry once. Losing old tombstones
		// is acceptable; failing the write and losing ALL of them is not.
		try {
			const entries = Object.entries(map).sort((a, b) => b[1] - a[1]);
			const trimmed: TombstoneMap = {};
			for (const [id, ts] of entries.slice(0, Math.floor(entries.length / 2))) {
				trimmed[id] = ts;
			}
			setLocalStorageObject(STORAGE_KEY, trimmed);
		} catch (err) {
			// Give up silently — tombstones are a safety net, never a hard dependency.
		}
	}
}

function prune(map: TombstoneMap): TombstoneMap {
	const cutoff = Date.now() - TTL_MS;
	let entries = Object.entries(map).filter(([, ts]) => ts >= cutoff);

	if (entries.length > MAX_ENTRIES) {
		entries = entries.sort((a, b) => b[1] - a[1]).slice(0, MAX_ENTRIES);
	}

	const pruned: TombstoneMap = {};
	for (const [id, ts] of entries) {
		pruned[id] = ts;
	}
	return pruned;
}

export function addSolveTombstones(ids: string[]) {
	if (typeof window === 'undefined' || !ids?.length) {
		return;
	}

	const map = readMap();
	const now = Date.now();
	for (const id of ids) {
		if (id) {
			map[id] = now;
		}
	}

	writeMap(prune(map));
}

export function getSolveTombstones(): Set<string> {
	const map = readMap();
	const cutoff = Date.now() - TTL_MS;
	const set = new Set<string>();

	for (const [id, ts] of Object.entries(map)) {
		if (ts >= cutoff) {
			set.add(id);
		}
	}

	return set;
}

export function clearAllSolveTombstones() {
	if (typeof window === 'undefined') {
		return;
	}

	try {
		localStorage.removeItem(STORAGE_KEY);
	} catch (e) {
		// ignore
	}
}
