/**
 * Glicko-2 rating for Online Battle (design ranking-battle.md 4.4).
 *
 * Reference: Mark Glickman, "Example of the Glicko-2 system" (2013). Every match is its
 * own rating period with a single game, the way Lichess runs it. Time without games is
 * handled before the match by growing RD per idle day (inflateRd), capped at MAX_RD.
 *
 * One rule matters for the UI: the "+12 / -9" preview on the match found screen and the
 * delta written at the end of the match must be the same number. Both come from
 * `ratingAfterGame` with the same inputs, so the caller prepares both players once
 * (`prepareForMatch`, at pairing time), keeps those states with the match, and uses them
 * for the preview and for the final update.
 */

import {
	INITIAL_RATING,
	INITIAL_RD,
	INITIAL_VOLATILITY,
	LEADERBOARD_RD_FACTOR,
	MAX_RD,
	PROVISIONAL_JUMP_FLAG,
	PROVISIONAL_JUMP_GAMES,
	PROVISIONAL_RD,
	TAU,
} from './config';
import { BattleRatingDelta, BattleSide, BattleWinner, GlickoRating } from './types';

/** Glicko to Glicko-2 scale factor (400 / ln 10). */
export const GLICKO2_SCALE = 173.7178;
const CONVERGENCE = 0.000001;
const DAY_MS = 24 * 60 * 60 * 1000;

export function initialRating(): GlickoRating {
	return { rating: INITIAL_RATING, rd: INITIAL_RD, volatility: INITIAL_VOLATILITY };
}

function g(phi: number): number {
	return 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));
}

function expectedScore(mu: number, muJ: number, phiJ: number): number {
	return 1 / (1 + Math.exp(-g(phiJ) * (mu - muJ)));
}

export interface GlickoGame {
	opponent: GlickoRating;
	/** 1 win, 0.5 draw, 0 loss. */
	score: number;
}

/**
 * One rating period with any number of games (steps 1-8 of Glickman's paper). With no
 * games only RD grows, by the player's volatility.
 */
export function glicko2Update(player: GlickoRating, games: GlickoGame[], tau: number = TAU): GlickoRating {
	const mu = (player.rating - INITIAL_RATING) / GLICKO2_SCALE;
	const phi = player.rd / GLICKO2_SCALE;
	const sigma = player.volatility;

	if (games.length === 0) {
		const phiStar = Math.sqrt(phi * phi + sigma * sigma);
		return { rating: player.rating, rd: Math.min(MAX_RD, phiStar * GLICKO2_SCALE), volatility: sigma };
	}

	// Steps 3-4: estimated variance and improvement.
	let vInv = 0;
	let deltaSum = 0;
	for (const game of games) {
		const muJ = (game.opponent.rating - INITIAL_RATING) / GLICKO2_SCALE;
		const phiJ = game.opponent.rd / GLICKO2_SCALE;
		const gJ = g(phiJ);
		const e = expectedScore(mu, muJ, phiJ);
		vInv += gJ * gJ * e * (1 - e);
		deltaSum += gJ * (game.score - e);
	}
	const v = 1 / vInv;
	const delta = v * deltaSum;

	// Step 5: new volatility (Illinois algorithm).
	const a = Math.log(sigma * sigma);
	const f = (x: number): number => {
		const ex = Math.exp(x);
		const num = ex * (delta * delta - phi * phi - v - ex);
		const den = 2 * Math.pow(phi * phi + v + ex, 2);
		return num / den - (x - a) / (tau * tau);
	};

	let A = a;
	let B: number;
	if (delta * delta > phi * phi + v) {
		B = Math.log(delta * delta - phi * phi - v);
	} else {
		let k = 1;
		while (f(a - k * tau) < 0) k++;
		B = a - k * tau;
	}
	let fA = f(A);
	let fB = f(B);
	let guard = 0;
	while (Math.abs(B - A) > CONVERGENCE && guard++ < 1000) {
		const C = A + ((A - B) * fA) / (fB - fA);
		const fC = f(C);
		if (fC * fB <= 0) {
			A = B;
			fA = fB;
		} else {
			fA = fA / 2;
		}
		B = C;
		fB = fC;
	}
	const sigmaNew = Math.exp(A / 2);

	// Steps 6-7: new RD and rating.
	const phiStar = Math.sqrt(phi * phi + sigmaNew * sigmaNew);
	const phiNew = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
	const muNew = mu + phiNew * phiNew * deltaSum;

	return {
		rating: muNew * GLICKO2_SCALE + INITIAL_RATING,
		rd: Math.min(MAX_RD, phiNew * GLICKO2_SCALE),
		volatility: sigmaNew,
	};
}

/** RD after `days` without games: phi' = sqrt(phi^2 + sigma^2 * days), capped at MAX_RD. */
export function inflateRd(rd: number, volatility: number, days: number): number {
	if (!(days > 0)) return Math.min(MAX_RD, rd);
	const phi = rd / GLICKO2_SCALE;
	const phiNew = Math.sqrt(phi * phi + volatility * volatility * days);
	return Math.min(MAX_RD, phiNew * GLICKO2_SCALE);
}

/**
 * The state a player enters a match with: the stored rating with RD grown for the idle
 * time since their last match. A player without a stored rating starts at 1500 / 350.
 * Call once per match, at pairing time, and keep the result with the match.
 */
export function prepareForMatch(
	stored: GlickoRating | null | undefined,
	lastMatchAt: Date | number | null | undefined,
	now: Date | number
): GlickoRating {
	if (!stored) return initialRating();
	const nowMs = typeof now === 'number' ? now : now.getTime();
	const lastMs =
		lastMatchAt == null ? null : typeof lastMatchAt === 'number' ? lastMatchAt : lastMatchAt.getTime();
	const days = lastMs == null ? 0 : Math.max(0, (nowMs - lastMs) / DAY_MS);
	return {
		rating: stored.rating,
		rd: inflateRd(stored.rd, stored.volatility, days),
		volatility: stored.volatility,
	};
}

/** Rating after one game against `opponent`. Both states as returned by prepareForMatch. */
export function ratingAfterGame(player: GlickoRating, opponent: GlickoRating, score: number): GlickoRating {
	return glicko2Update(player, [{ opponent, score }]);
}

/** The number shown to players: the rounded rating. */
export function displayRating(rating: number): number {
	return Math.round(rating);
}

/** Delta as shown to players: difference of the two rounded ratings, so "1532 -> 1547 +15" adds up. */
export function displayDelta(before: number, after: number): number {
	return displayRating(after) - displayRating(before);
}

/**
 * Signed rating change for each outcome, for the match found screen. The copy
 * ("Win +{{win}}, lose -{{loss}}") takes `win` and the absolute value of `loss`.
 */
export function previewDeltas(player: GlickoRating, opponent: GlickoRating): BattleRatingDelta {
	return {
		win: displayDelta(player.rating, ratingAfterGame(player, opponent, 1).rating),
		draw: displayDelta(player.rating, ratingAfterGame(player, opponent, 0.5).rating),
		loss: displayDelta(player.rating, ratingAfterGame(player, opponent, 0).rating),
	};
}

export function isProvisional(rd: number): boolean {
	return rd > PROVISIONAL_RD;
}

/** Leaderboard sort key: rating - 2 * RD (design 4.4, Q3). */
export function conservativeRating(rating: number, rd: number): number {
	return rating - LEADERBOARD_RD_FACTOR * rd;
}

/**
 * A new account gaining more than 300 in one of its first 5 games is flagged
 * (`provisional_jump`, design 4.7). `gamesBefore` is the game count before this match.
 */
export function isProvisionalJump(gamesBefore: number, ratingBefore: number, ratingAfter: number): boolean {
	return gamesBefore < PROVISIONAL_JUMP_GAMES && ratingAfter - ratingBefore > PROVISIONAL_JUMP_FLAG;
}

/** Glicko score of a match result from one side's view. */
export function scoreFor(winner: BattleWinner, side: BattleSide): number {
	if (winner === 'DRAW') return 0.5;
	return winner === side ? 1 : 0;
}

export interface MatchRatingUpdate {
	a: GlickoRating;
	b: GlickoRating;
}

/**
 * Both players' new ratings after a rated match. Inputs are the prepared states the match
 * was created with; both updates read the opponent's pre-match state, never the updated one.
 */
export function rateMatch(a: GlickoRating, b: GlickoRating, winner: BattleWinner): MatchRatingUpdate {
	return {
		a: ratingAfterGame(a, b, scoreFor(winner, 'A')),
		b: ratingAfterGame(b, a, scoreFor(winner, 'B')),
	};
}
