import {UserAccount} from '../../../server/schemas/UserAccount.schema';

// Local snapshot of the sanitized `me` object so an offline cold start can
// restore the session instead of degrading to anonymous or bouncing to /login.
// The server remains the authority: the snapshot is refreshed on every
// successful SSR boot / getMe() and cleared on logout or a real auth rejection.
const CACHED_ME_KEY = 'zkt_cached_me';

interface CachedMe {
	me: UserAccount;
	saved_at: number;
}

export function saveCachedMe(me: UserAccount) {
	if (!me?.id) {
		return;
	}

	try {
		const payload: CachedMe = {me, saved_at: Date.now()};
		localStorage.setItem(CACHED_ME_KEY, JSON.stringify(payload));
	} catch (e) {
		// Storage unavailable/full: offline identity restore just won't be possible
	}
}

export function getCachedMe(): UserAccount | null {
	try {
		const raw = localStorage.getItem(CACHED_ME_KEY);
		if (!raw) {
			return null;
		}

		const parsed = JSON.parse(raw) as CachedMe;
		return parsed?.me?.id ? parsed.me : null;
	} catch (e) {
		return null;
	}
}

export function clearCachedMe() {
	try {
		localStorage.removeItem(CACHED_ME_KEY);
	} catch (e) {
		// Ignore: nothing to clear or storage unavailable
	}
}
