/**
 * Opening a set: device cache first, then the server (trainer-sets 6.1, 9.3).
 *
 * - `loadAlgSet(code)`: the network copy, refreshed into the cache. When the server says NOT_FOUND
 *   for a set the device has, the My Sets list decides (resolveNotFound): a new code (the owner
 *   reset the link) is retried once, a set that is gone for us loses its offline copy. A network
 *   error never touches the cache; the cached copy is returned instead when there is one.
 * - `peekCachedAlgSet(code)`: the cached copy for an instant first paint.
 * - `loadSetForStudy(code)`: what a cold `/trainer/algorithms/train?set=<code>` needs.
 *
 * Only the signed-in user's own and saved sets are cached ("the last opened sets, own and saved"):
 * a stranger's link set opened once is not kept on the device.
 */
import {getMe} from '../../components/store';
import {fetchAlgSet, fetchMyAlgSets, isAlgSetNotFound} from './api';
import {
	changedAlgorithmItems,
	findCachedSetByCode,
	getCachedSet,
	putCachedList,
	putCachedSet,
	removeCachedSet,
	resolveNotFound,
	touchCachedSet,
} from './cache';
import type {AlgSetData, StudySet} from './types';

function currentUserId(): string | null {
	try {
		return getMe()?.id || null;
	} catch {
		return null;
	}
}

function isOffline(): boolean {
	return typeof navigator !== 'undefined' && navigator.onLine === false;
}

export function shouldCacheSet(set: AlgSetData): boolean {
	return set.is_owner || set.is_saved;
}

export interface LoadedAlgSet {
	set: AlgSetData;
	/** Served from the device because the network failed (or the device is offline). */
	fromCache: boolean;
	/** Item ids whose algorithm differs from the cached copy (marked "Algorithm changed" once). */
	changed: Set<string>;
}

/** The cached copy of a set by its share code, or null. */
export function peekCachedAlgSet(code: string): AlgSetData | null {
	const userId = currentUserId();
	if (!userId || !code) return null;
	return findCachedSetByCode(userId, code)?.set || null;
}

/** Stores a set the caller changed (owner edits, a save) so the offline copy stays current. */
export function rememberAlgSet(set: AlgSetData) {
	const userId = currentUserId();
	if (!userId || !set?.id) return;
	if (shouldCacheSet(set)) putCachedSet(userId, set);
	else removeCachedSet(userId, set.id);
}

export function forgetAlgSet(setId: string) {
	const userId = currentUserId();
	if (userId && setId) removeCachedSet(userId, setId);
}

/**
 * Loads a set. Resolves with null when it cannot be opened (not found, private, hidden, or
 * offline without a copy). `notFound` tells the two apart for the caller's message.
 */
export async function loadAlgSet(code: string): Promise<{loaded: LoadedAlgSet | null; notFound: boolean}> {
	const userId = currentUserId();
	const cached = userId ? findCachedSetByCode(userId, code) : null;

	if (isOffline()) {
		if (cached && userId) {
			touchCachedSet(userId, cached.set.id);
			return {loaded: {set: cached.set, fromCache: true, changed: new Set()}, notFound: false};
		}
		return {loaded: null, notFound: false};
	}

	try {
		const set = await fetchAlgSet(code);
		const previous = userId ? getCachedSet(userId, set.id)?.set || null : null;
		const changed = changedAlgorithmItems(previous, set);
		if (userId) {
			if (shouldCacheSet(set)) putCachedSet(userId, set);
			else if (previous) removeCachedSet(userId, set.id);
		}
		return {loaded: {set, fromCache: false, changed}, notFound: false};
	} catch (err) {
		if (!isAlgSetNotFound(err)) {
			// Network or server trouble: keep the offline copy, use it if there is one.
			if (cached && userId) {
				touchCachedSet(userId, cached.set.id);
				return {loaded: {set: cached.set, fromCache: true, changed: new Set()}, notFound: false};
			}
			return {loaded: null, notFound: false};
		}

		if (!cached || !userId) return {loaded: null, notFound: true};

		// The device knows this set: did the code change, or is the set gone for us?
		try {
			const list = await fetchMyAlgSets();
			putCachedList(userId, list);
			const resolution = resolveNotFound(cached.set.id, code, list);
			if (resolution.action === 'retry') {
				try {
					const set = await fetchAlgSet(resolution.code);
					const changed = changedAlgorithmItems(cached.set, set);
					putCachedSet(userId, set);
					return {loaded: {set, fromCache: false, changed}, notFound: false};
				} catch (retryErr) {
					if (!isAlgSetNotFound(retryErr)) {
						return {loaded: {set: cached.set, fromCache: true, changed: new Set()}, notFound: false};
					}
				}
			}
			removeCachedSet(userId, cached.set.id);
			return {loaded: null, notFound: true};
		} catch {
			// Could not check: keep the copy, but this code no longer opens it.
			return {loaded: null, notFound: true};
		}
	}
}

export function toStudySet(set: AlgSetData): StudySet {
	return {
		id: set.id,
		code: set.code,
		name: set.name,
		owner_name: set.owner.username,
		is_owner: set.is_owner,
		items: set.items.map((item) => ({
			category: item.category,
			case_name: item.case_name,
			subset: item.subset,
			algorithm: item.algorithm,
			position: item.position,
		})),
	};
}

/** For a cold set study link (useTrainerUrlSync). Null sends the user to the set page. */
export async function loadSetForStudy(code: string): Promise<StudySet | null> {
	if (!code) return null;
	const {loaded} = await loadAlgSet(code);
	if (!loaded || loaded.set.items.length === 0) return null;
	return toStudySet(loaded.set);
}
