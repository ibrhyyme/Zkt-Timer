import type {BattleLaunch} from '../battle/battle_landing_modes';

/**
 * Pure decisions for the Leaderboard page (/ranks, ranking-battle 5.6). Kept out of the
 * component so they can be tested without a DOM.
 */

/** Same cap the server applies to the search term (Battle.resolver.ts). */
export const SEARCH_MAX_LENGTH = 50;
export const SEARCH_DEBOUNCE_MS = 300;

export type RankingsView = 'empty' | 'board';

/**
 * Until Online Battle is open to this viewer the page keeps R1's empty state. Admins and
 * the flag's access list see the real board so they can try it before launch; the server
 * returns empty lists to everyone else anyway. Unknown (null) stays on the empty state.
 */
export function pickRankingsView(launch: BattleLaunch | null): RankingsView {
	return launch?.open ? 'board' : 'empty';
}

/** Whole percent of matches won, or null when there is nothing to divide. */
export function winRatePercent(wins: number | null | undefined, games: number | null | undefined): number | null {
	if (!games || games <= 0) return null;
	const w = Math.max(0, Math.min(wins || 0, games));
	return Math.round((w * 100) / games);
}

export function normalizeSearch(term: string | null | undefined): string {
	return (term || '').trim().slice(0, SEARCH_MAX_LENGTH);
}

interface RowWithUser {
	user_id?: string | null;
}

/**
 * Appends the next page. The list can shift between two loads (a match ends and the
 * cached page is rebuilt), so a player already shown is not shown twice.
 */
export function appendLeaderboardRows<T extends RowWithUser>(prev: T[], next: T[]): T[] {
	const seen = new Set(prev.map((r) => r.user_id));
	const out = prev.slice();
	for (const row of next) {
		if (!row || seen.has(row.user_id)) continue;
		seen.add(row.user_id);
		out.push(row);
	}
	return out;
}

/** True while the server says more rows exist than the pages loaded so far. */
export function hasMoreRows(pagesLoaded: number, pageSize: number, total: number): boolean {
	if (!pageSize || pageSize <= 0) return false;
	return pagesLoaded * pageSize < total;
}
