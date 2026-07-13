import {getMe} from '../../store';

// Free, ephemeral competition event filter. Persisted per-user in localStorage
// only (no server sync) — mirrors the daily-goal localStorage-first pattern but
// stays purely client-side since this is discovery UX, not user data.
const STORAGE_KEY = 'wca_comp_event_filter';

function getStorageKey(): string {
	const me = getMe();
	const userId = me?.id || '_anon';
	return `${STORAGE_KEY}_${userId}`;
}

export function getEventFilter(): string[] {
	if (typeof window === 'undefined') return [];
	try {
		const raw = localStorage.getItem(getStorageKey());
		if (!raw) return [];
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed.filter((e): e is string => typeof e === 'string') : [];
	} catch {
		return [];
	}
}

export function setEventFilter(events: string[]): void {
	if (typeof window === 'undefined') return;
	try {
		localStorage.setItem(getStorageKey(), JSON.stringify(events));
	} catch {
		// storage full / disabled — filter simply won't persist, non-fatal
	}
}
