/**
 * Online Battle duels (owner decision 2026-10-20) as pure functions: invite codes, the status
 * an invite has at a given moment and the head-to-head score of two players.
 *
 * A duel is a normal match (same format, same checks) that is never rated and does not count
 * toward the daily pair limit. It starts from a single use invite: a link (/duel/<code>) or a
 * challenge sent from a profile.
 */

import {BattleChallengeStatus, BattleHeadToHead} from './types';

export const CHALLENGE_CODE_LENGTH = 10;
/** Lowercase letters and digits without the look-alikes 0/o, 1/l/i. */
const CHALLENGE_CODE_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';
const CHALLENGE_CODE_RE = new RegExp(`^[${CHALLENGE_CODE_ALPHABET}]{${CHALLENGE_CODE_LENGTH}}$`);
/** Largest multiple of the alphabet size under 256: bytes at or above it are skipped (no modulo bias). */
const BYTE_LIMIT = 256 - (256 % CHALLENGE_CODE_ALPHABET.length);

/**
 * An invite code from random bytes (the server passes crypto.randomBytes). Needs a few more
 * bytes than the code is long, since a byte that would bias the alphabet is skipped; returns
 * null when the bytes ran out first.
 */
export function challengeCodeFromBytes(bytes: ArrayLike<number>): string | null {
	let code = '';
	for (let i = 0; i < bytes.length && code.length < CHALLENGE_CODE_LENGTH; i++) {
		const v = bytes[i];
		if (v >= BYTE_LIMIT) continue;
		code += CHALLENGE_CODE_ALPHABET[v % CHALLENGE_CODE_ALPHABET.length];
	}
	return code.length === CHALLENGE_CODE_LENGTH ? code : null;
}

export function isChallengeCode(value: unknown): value is string {
	return typeof value === 'string' && CHALLENGE_CODE_RE.test(value);
}

/** In-app path of an invite; push payloads and the share link use it. */
export function challengePath(code: string): string {
	return `/duel/${code}`;
}

/**
 * The status an invite has at `now`: a PENDING row past its expiry is EXPIRED even before
 * the server's timer wrote it (after a restart, say).
 */
export function challengeStatusAt(
	row: {status: string; expires_at: Date | string | number},
	now: number
): BattleChallengeStatus {
	const status = row.status as BattleChallengeStatus;
	if (status === 'PENDING' && new Date(row.expires_at).getTime() <= now) return 'EXPIRED';
	if (status === 'ACCEPTED' || status === 'EXPIRED' || status === 'CANCELLED') return status;
	return 'PENDING';
}

/**
 * Head-to-head from `userId`'s side, from rows of matches between the two (either may be A).
 * A match without a winner (void) is skipped; callers pass finished matches only.
 */
export function headToHeadFrom(
	rows: Array<{player_a_id: string | null; winner: string | null; count?: number}>,
	userId: string
): BattleHeadToHead {
	const out: BattleHeadToHead = {wins: 0, losses: 0, draws: 0};
	for (const row of rows) {
		const n = row.count ?? 1;
		if (row.winner === 'DRAW') out.draws += n;
		else if (row.winner === 'A' || row.winner === 'B') {
			const mySide = row.player_a_id === userId ? 'A' : 'B';
			if (row.winner === mySide) out.wins += n;
			else out.losses += n;
		}
	}
	return out;
}
