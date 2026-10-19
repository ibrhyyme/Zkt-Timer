/**
 * Online Battle rules as pure functions (design ranking-battle.md 4.2, 4.5, 4.6).
 *
 * The server's match manager decides with these; the client uses the same functions to
 * label what it shows, so a rule lives in exactly one place.
 */

import {
	ABANDON_COOLDOWNS_SEC,
	INSPECTION_DNF_SEC,
	INSPECTION_SEC,
	MAX_ROUNDS,
	PAIR_RATED_LIMIT_PER_DAY,
	PLUS_TWO_MS,
	QUEUE_OPEN_AFTER_SEC,
	QUEUE_WINDOW_BASE,
	QUEUE_WINDOW_PER_SEC,
	ROUNDS_TO_WIN,
	SCRAMBLE_CLOCK_SLACK_MS,
	SCRAMBLE_SEC,
	SOLVE_CUTOFF_SEC,
} from './config';
import { BattlePenalty, BattleRoundSolve, BattleWinner } from './types';

// ── Solve level ─────────────────────────────────────────────────────────────

/** WCA inspection: up to 15 s fine, 15-17 s +2, over 17 s DNF. */
export function inspectionPenalty(inspectionMs: number): BattlePenalty | null {
	if (inspectionMs > INSPECTION_DNF_SEC * 1000) return 'DNF';
	if (inspectionMs > INSPECTION_SEC * 1000) return 'PLUS_TWO';
	return null;
}

/** Scramble: up to 20 s fine, longer +2. The DNF at the hard deadline is the server's timer. */
export function scramblePenalty(scrambleMs: number): BattlePenalty | null {
	return scrambleMs > SCRAMBLE_SEC * 1000 ? 'PLUS_TWO' : null;
}

/**
 * Scramble time that counts: the client's own measure (goAt to scramble complete), unless
 * it claims more than the slack under the server's goAt-to-arrival interval. Without a
 * client measure, the server's interval minus the slack.
 */
export function acceptedScrambleMs(serverMs: number, clientMs: number | null | undefined): number {
	const floor = Math.max(0, serverMs - SCRAMBLE_CLOCK_SLACK_MS);
	if (clientMs == null || !Number.isFinite(clientMs)) return floor;
	return Math.min(serverMs, Math.max(floor, clientMs));
}

/** Milliseconds a penalty adds to the time; 0 for none and for DNF. */
export function penaltyMs(penalty: BattlePenalty | null | undefined): number {
	if (penalty === 'PLUS_TWO') return PLUS_TWO_MS;
	if (penalty === 'PLUS_FOUR') return 2 * PLUS_TWO_MS;
	return 0;
}

/** How many +2s a penalty holds; a battle time shows one "+" for each. */
export function plusTwoCount(penalty: BattlePenalty | null | undefined): number {
	return penaltyMs(penalty) / PLUS_TWO_MS;
}

/** The heavier of two calls on the same thing, e.g. the device's and the cube clock's inspection. */
export function worsePenalty(a: BattlePenalty | null | undefined, b: BattlePenalty | null | undefined): BattlePenalty | null {
	if (a === 'DNF' || b === 'DNF') return 'DNF';
	const ms = Math.max(penaltyMs(a), penaltyMs(b));
	return ms > PLUS_TWO_MS ? 'PLUS_FOUR' : ms > 0 ? 'PLUS_TWO' : null;
}

/** Penalties from separate causes (scramble, inspection) stack: +2 and +2 is +4, DNF wins. */
export function addPenalties(a: BattlePenalty | null | undefined, b: BattlePenalty | null | undefined): BattlePenalty | null {
	if (a === 'DNF' || b === 'DNF') return 'DNF';
	const ms = penaltyMs(a) + penaltyMs(b);
	return ms > PLUS_TWO_MS ? 'PLUS_FOUR' : ms > 0 ? 'PLUS_TWO' : null;
}

/** Time compared between players: raw plus the penalty, null for DNF or no time. */
export function effectiveTimeMs(solve: BattleRoundSolve | null | undefined): number | null {
	if (!solve || solve.penalty === 'DNF' || solve.timeMs == null) return null;
	return solve.timeMs + penaltyMs(solve.penalty);
}

/** Over the 60 s cutoff (penalties count). */
export function isOverCutoff(timeMs: number, penalty: BattlePenalty | null): boolean {
	return timeMs + penaltyMs(penalty) > SOLVE_CUTOFF_SEC * 1000;
}

// ── Round level ─────────────────────────────────────────────────────────────

/**
 * Lower effective time wins. A DNF loses to any time. Two DNFs, or the same time to the
 * centisecond (WCA truncation), is a draw: the round does not count and is replayed with a
 * new scramble.
 */
export function roundWinner(a: BattleRoundSolve | null | undefined, b: BattleRoundSolve | null | undefined): BattleWinner {
	const ta = effectiveTimeMs(a);
	const tb = effectiveTimeMs(b);
	if (ta == null && tb == null) return 'DRAW';
	if (ta == null) return 'B';
	if (tb == null) return 'A';
	const ca = Math.floor(ta / 10);
	const cb = Math.floor(tb / 10);
	if (ca === cb) return 'DRAW';
	return ca < cb ? 'A' : 'B';
}

// ── Match level ─────────────────────────────────────────────────────────────

export interface MatchProgress {
	score: { a: number; b: number };
	/** Rounds played, draws included. */
	roundsPlayed: number;
	finished: boolean;
	/** Set once finished. */
	winner: BattleWinner | null;
}

/**
 * Best of five: the first to three round wins takes the match. Drawn rounds are replayed,
 * at most seven rounds in total; if seven rounds pass and nobody reached three wins the
 * match is a draw (design 4.5, rated as 0.5), whatever the score.
 */
export function matchProgress(roundWinners: BattleWinner[]): MatchProgress {
	let a = 0;
	let b = 0;
	let played = 0;
	for (const w of roundWinners) {
		played++;
		if (w === 'A') a++;
		else if (w === 'B') b++;
		if (a >= ROUNDS_TO_WIN || b >= ROUNDS_TO_WIN || played >= MAX_ROUNDS) break;
	}
	const score = { a, b };
	if (a >= ROUNDS_TO_WIN) return { score, roundsPlayed: played, finished: true, winner: 'A' };
	if (b >= ROUNDS_TO_WIN) return { score, roundsPlayed: played, finished: true, winner: 'B' };
	if (played >= MAX_ROUNDS) return { score, roundsPlayed: played, finished: true, winner: 'DRAW' };
	return { score, roundsPlayed: played, finished: false, winner: null };
}

/** Winner when one side gives up, leaves or is forfeited: always the other side. */
export function forfeitWinner(loser: 'A' | 'B'): BattleWinner {
	return loser === 'A' ? 'B' : 'A';
}

// ── Pair limit, abandons ─────────────────────────────────────────────────────

/** Stable key for a pair of players, independent of who is A. */
export function pairKey(userIdA: string, userIdB: string): string {
	return userIdA < userIdB ? `${userIdA}:${userIdB}` : `${userIdB}:${userIdA}`;
}

/**
 * Whether the next match between two players is rated: at most 3 rated matches per pair
 * in 24 hours, queue and rematch together (design 4.5, Q1).
 */
export function isPairRated(ratedMatchesLast24h: number): boolean {
	return ratedMatchesLast24h < PAIR_RATED_LIMIT_PER_DAY;
}

/**
 * Queue cooldown after leaving before the first round started. `abandonsToday` counts
 * this one too: 1 -> 60 s, 2 -> 300 s, 3 or more -> 900 s.
 */
export function abandonCooldownSec(abandonsToday: number): number {
	if (abandonsToday <= 0) return 0;
	const i = Math.min(abandonsToday, ABANDON_COOLDOWNS_SEC.length) - 1;
	return ABANDON_COOLDOWNS_SEC[i];
}

// ── Queue window (design 4.2) ───────────────────────────────────────────────

/**
 * Rating window after waiting `waitedSec`: 100 + 10 per second. Null means no window
 * at all: after 30 s anyone in the queue is a valid opponent.
 */
export function queueWindow(waitedSec: number): number | null {
	if (waitedSec >= QUEUE_OPEN_AFTER_SEC) return null;
	return QUEUE_WINDOW_BASE + QUEUE_WINDOW_PER_SEC * Math.max(0, waitedSec);
}

/**
 * Whether two queued players may be paired. The larger of the two windows applies, so a
 * newcomer's narrow window never turns away someone who has waited 25 s.
 */
export function withinQueueWindow(
	ratingA: number,
	waitedSecA: number,
	ratingB: number,
	waitedSecB: number
): boolean {
	const wa = queueWindow(waitedSecA);
	const wb = queueWindow(waitedSecB);
	if (wa == null || wb == null) return true;
	return Math.abs(ratingA - ratingB) <= Math.max(wa, wb);
}
