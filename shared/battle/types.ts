/**
 * Online Battle shared types (design ranking-battle.md 4.5, 4.7, 4.10).
 *
 * String values match the database columns of battle_match / battle_round, so the server
 * can write them without a mapping table.
 */

/** Side of a match. Player A is the one the server listed first when it paired them. */
export type BattleSide = 'A' | 'B';

/** Round or match outcome. */
export type BattleWinner = 'A' | 'B' | 'DRAW';

/** PLUS_FOUR: a late scramble and a late inspection, each +2. */
export type BattlePenalty = 'PLUS_TWO' | 'PLUS_FOUR' | 'DNF';

/** battle_match.status */
export type BattleMatchStatus = 'FINISHED' | 'VOID';

/** battle_match.end_reason */
export type BattleEndReason = 'NORMAL' | 'FORFEIT' | 'DISCONNECT' | 'ABANDON' | 'SERVER_RESTART';

/** How the device's solve engine decided the solve ended (SolveResult.source). */
export type BattleSolveSource = 'tracker' | 'facelets-grace' | 'facelets-poll' | 'move-order-fix';

/** Sources where the final move packet may be missing from the move log. */
export const RECOVERY_SOURCES: readonly BattleSolveSource[] = ['facelets-grace', 'facelets-poll', 'move-order-fix'];

/**
 * Flags written on a round (a_flags / b_flags) or a match (flags). They never change a
 * result on their own (the DNF cases are decided separately), they surface the match in
 * the admin list.
 */
export type BattleFlag =
	/** Check 2: the move log ends 1-2 moves short of solved on a recovery path. */
	| 'replay_gap'
	/** Check 3: some moves carry no cube timestamp. */
	| 'missing_cube_ts'
	/** Check 4: the client time differs from the server's recomputation by more than 50 ms. */
	| 'time_mismatch'
	/** Check 5: inspection + time exceeds the server's own interval by 1-3 s. */
	| 'wallclock_short'
	/** Check 6: client inspection differs from the cube-clock inspection by more than 300 ms. */
	| 'inspection_mismatch'
	/** Check 6: the last two scramble moves are more than 5 s apart. */
	| 'scramble_pause'
	/** Check 6: no cube timestamp for the end of the scramble, inspection taken from the client. */
	| 'inspection_unverified'
	/** Check 7: reported phase events do not follow the phases rebuilt from the move log. */
	| 'progress_mismatch'
	/** Check 8: very short time, very high TPS or many sub-30 ms move gaps. */
	| 'suspicious_speed'
	/** Check 9 (server): much faster than the player's own smart cube history. */
	| 'beats_own_history'
	/** A provisional account gained more than 300 in one of its first 5 games. */
	| 'provisional_jump'
	/** Both players connected from the same IP. */
	| 'same_ip';

/** Why a solve became DNF. Shown on the result screen with its reason. */
export type BattleDnfReason =
	/** The player's own engine reported DNF (or the client sent DNF). */
	| 'client'
	/** Inspection over 17 s. */
	| 'inspection'
	/** Over the 60 s cutoff (penalties included). */
	| 'cutoff'
	/** Check 2: replaying the move log does not solve the cube. */
	| 'replay_not_solved'
	/** Check 3: cube clock missing or out of order. */
	| 'no_cube_clock'
	/** Check 5: claimed inspection + time is more than 3 s over the server's interval. */
	| 'wallclock'
	/** Scramble not finished within 40 s. */
	| 'scramble_timeout'
	/** Solve not finished in time, or the player was disconnected. */
	| 'timeout'
	| 'disconnect';

/**
 * One move of a solve as it travels in battle:solve_done.
 * t: move in WCA notation, c: cube clock in ms (null when the packet carried none),
 * l: phone clock in ms when the driver stamped it (null otherwise).
 */
export interface BattleMove {
	t: string;
	c: number | null;
	l: number | null;
}

/** A player's final result in one round. */
export interface BattleRoundSolve {
	/** Raw solve time in ms, without the +2. Null when the player has no time (DNF before solving). */
	timeMs: number | null;
	penalty: BattlePenalty | null;
	dnfReason?: BattleDnfReason | null;
}

/** Glicko-2 state of one player, in display units (1500 / 350 / 0.06). */
export interface GlickoRating {
	rating: number;
	rd: number;
	volatility: number;
}

export interface BattleRatingDelta {
	win: number;
	draw: number;
	loss: number;
}
