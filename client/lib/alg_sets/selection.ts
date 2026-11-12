/**
 * The rows picked on a set page for the next study (`category::case_name` keys), kept per set id
 * in sessionStorage.
 *
 * Why session and not the server or localStorage: a pick is "what I study today". It has to
 * survive a reload of the study screen (the cold `?set=` open reads it, otherwise a reload would
 * quietly widen the study to the whole set) and the way back to the set page, but tomorrow's
 * visit starts clean. Keyed by set id, not code, so a reset link keeps the pick.
 *
 * Storage can be missing or throw (private window, blocked site data, SSR): every access is
 * guarded and an unreadable pick simply means "the whole set".
 */
const PREFIX = 'trainer_set_pick:';

function storage(): Storage | null {
	try {
		return typeof window !== 'undefined' ? window.sessionStorage : null;
	} catch {
		return null;
	}
}

export function readSetSelection(setId: string | null | undefined): string[] {
	if (!setId) return [];
	try {
		const raw = storage()?.getItem(PREFIX + setId);
		if (!raw) return [];
		const parsed: unknown = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed.filter((key): key is string => typeof key === 'string') : [];
	} catch {
		return [];
	}
}

export function writeSetSelection(setId: string | null | undefined, keys: string[]): void {
	if (!setId) return;
	try {
		const store = storage();
		if (!store) return;
		if (keys.length === 0) store.removeItem(PREFIX + setId);
		else store.setItem(PREFIX + setId, JSON.stringify(keys));
	} catch {
		// Quota or blocked storage: the pick lives only in the page state this time.
	}
}
