/**
 * Pure helpers for the admin Online Battle page (AdminBattleMatches.tsx).
 * Design: .feedback/designs/ranking-battle.md 4.7 (flags), 4.12 (admin queries), 7.2 step 8.
 */

/** Every flag the server writes on a match or a round (shared/battle/types.ts BattleFlag + the void flag). */
export const KNOWN_BATTLE_FLAGS = [
	'replay_gap',
	'missing_cube_ts',
	'time_mismatch',
	'wallclock_short',
	'inspection_mismatch',
	'scramble_pause',
	'inspection_unverified',
	'progress_mismatch',
	'suspicious_speed',
	'beats_own_history',
	'provisional_jump',
	'same_ip',
	'void_rating_kept',
] as const;

export const KNOWN_END_REASONS = ['NORMAL', 'FORFEIT', 'DISCONNECT', 'ABANDON', 'SERVER_RESTART'] as const;

type Translate = (key: string, vars?: Record<string, unknown>) => string;

/** Translated flag label; an unknown code (a newer server) shows as the raw code. */
export function flagLabel(flag: string, t: Translate): string {
	return (KNOWN_BATTLE_FLAGS as readonly string[]).includes(flag) ? t(`admin_online_battle.flags.${flag}`) : flag;
}

export function endReasonLabel(reason: string | null | undefined, t: Translate): string {
	if (!reason) return '';
	return (KNOWN_END_REASONS as readonly string[]).includes(reason)
		? t(`admin_online_battle.end_reason.${reason}`)
		: reason;
}

/** Drops nulls and duplicates from a GraphQL string list, keeping the server's order. */
export function cleanFlags(flags: Array<string | null | undefined> | null | undefined): string[] {
	const out: string[] = [];
	for (const flag of flags || []) {
		if (flag && !out.includes(flag)) out.push(flag);
	}
	return out;
}

/** "+12", "-8", "0"; null when either side of the change is missing. */
export function formatRatingDelta(before: number | null | undefined, after: number | null | undefined): string | null {
	if (before == null || after == null) return null;
	const delta = Math.round(after - before);
	if (delta > 0) return `+${delta}`;
	return String(delta);
}

export interface ParsedMove {
	t: string;
	c: number | null;
	l: number | null;
}

export interface MoveLogSummary {
	moves: ParsedMove[];
	/** Moves without a cube clock stamp (check 3). */
	missingCubeTs: number;
	/** Last minus first stamped move on the cube clock, null with fewer than two stamps. */
	cubeSpanMs: number | null;
}

/**
 * The server sends a round's move log as a JSON string (admins only). Anything that is
 * not an array of moves comes back as null so the page can say "no move log".
 */
export function parseMoveLog(json: string | null | undefined): MoveLogSummary | null {
	if (!json) return null;
	let raw: unknown;
	try {
		raw = JSON.parse(json);
	} catch {
		return null;
	}
	if (!Array.isArray(raw)) return null;
	const moves: ParsedMove[] = [];
	for (const item of raw) {
		if (!item || typeof item !== 'object' || typeof (item as any).t !== 'string') continue;
		const c = (item as any).c;
		const l = (item as any).l;
		moves.push({
			t: (item as any).t,
			c: typeof c === 'number' && Number.isFinite(c) ? c : null,
			l: typeof l === 'number' && Number.isFinite(l) ? l : null,
		});
	}
	const stamped = moves.filter((m) => m.c != null);
	const cubeSpanMs =
		stamped.length >= 2 ? (stamped[stamped.length - 1].c as number) - (stamped[0].c as number) : null;
	return {moves, missingCubeTs: moves.length - stamped.length, cubeSpanMs};
}

export interface VoidOutcomeInput {
	changed?: boolean | null;
	reverted_a?: boolean | null;
	reverted_b?: boolean | null;
}

export interface VoidOutcomeMatch {
	rated?: boolean | null;
	player_a?: {id?: string | null; username?: string | null} | null;
	player_b?: {id?: string | null; username?: string | null} | null;
}

export type VoidMessage =
	| {key: 'admin_online_battle.void_already'}
	| {key: 'admin_online_battle.void_done'}
	| {key: 'admin_online_battle.void_done_reverted'}
	| {key: 'admin_online_battle.void_done_kept'; names: string};

/**
 * Which toast follows "void this match". A rated match reverts a player's rating only
 * when no rated match of theirs came later (server planVoidSide); the others keep it.
 * A deleted account has nothing to revert and is not listed.
 */
export function voidMessage(result: VoidOutcomeInput, match: VoidOutcomeMatch): VoidMessage {
	if (!result.changed) return {key: 'admin_online_battle.void_already'};
	if (!match.rated) return {key: 'admin_online_battle.void_done'};
	const kept: string[] = [];
	if (!result.reverted_a && match.player_a?.id) kept.push(match.player_a.username || match.player_a.id);
	if (!result.reverted_b && match.player_b?.id) kept.push(match.player_b.username || match.player_b.id);
	if (kept.length === 0) return {key: 'admin_online_battle.void_done_reverted'};
	return {key: 'admin_online_battle.void_done_kept', names: kept.join(', ')};
}

/** A match id as typed or pasted: trimmed, and the last path segment if a URL was pasted. */
export function normalizeMatchId(input: string): string {
	const trimmed = (input || '').trim().split(/[?#]/)[0];
	if (!trimmed) return '';
	const parts = trimmed.split('/').filter(Boolean);
	return parts.length ? parts[parts.length - 1] : '';
}
