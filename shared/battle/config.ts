/**
 * Online Battle constants, in one place (design ranking-battle.md section 4.9).
 *
 * The GAN measurement session (design 3.4) may retune these; only this file changes and
 * it ships over OTA. Server and client both read it, so a value never needs to be copied.
 */

/** The only puzzle with a queue in the MVP. */
export const BATTLE_PUZZLE = '333';
export type BattlePuzzle = typeof BATTLE_PUZZLE;
export const BATTLE_PUZZLES: readonly BattlePuzzle[] = [BATTLE_PUZZLE];

// Glicko-2 (design 4.4)
export const INITIAL_RATING = 1500;
export const INITIAL_RD = 350;
export const INITIAL_VOLATILITY = 0.06;
export const TAU = 0.5;
/** Above this RD a rating is provisional ("?" next to it). */
export const PROVISIONAL_RD = 110;
/** Upper bound for RD, also after inactivity inflation. */
export const MAX_RD = 350;
/**
 * How many games a provisional period typically takes. Only for the "Provisional (6/10)"
 * line; the label itself ends when RD drops under PROVISIONAL_RD, not at this count.
 */
export const PROVISIONAL_TYPICAL_GAMES = 10;

// Queue and matcher (design 4.2)
export const QUEUE_WINDOW_BASE = 100;
export const QUEUE_WINDOW_PER_SEC = 10;
/** After this many seconds of waiting there is no rating window: anyone in the queue. */
export const QUEUE_OPEN_AFTER_SEC = 30;
export const QUEUE_SAME_OPPONENT_COOLDOWN_SEC = 120;
/** "Are you still there?" interval while waiting in the queue. */
export const QUEUE_IDLE_CHECK_SEC = 600;
/** After this long in the queue the screen says nobody is searching right now. */
export const QUEUE_QUIET_NOTICE_SEC = 180;

// Match format (design 4.5; owner decision 2026-10-20: first to three, 20 s scramble, 60 s cutoff)
export const ROUNDS_TO_WIN = 3;
/** First to three with draws replayed: up to five decisive rounds plus two draws. */
export const MAX_ROUNDS = 7;
/** Scrambling past this costs +2, on top of an inspection +2. */
export const SCRAMBLE_SEC = 20;
/** Scramble still not done at this point: DNF. */
export const SCRAMBLE_TIMEOUT_SEC = 40;
/**
 * The server times the scramble from goAt to the arrival of scramble_done, which also
 * carries the client's settle delay and the network. The client's own measure is accepted
 * when it lies within this much under the server's; a forged one gains at most this.
 */
export const SCRAMBLE_CLOCK_SLACK_MS = 1000;
export const COUNTDOWN_SEC = 3;
export const INSPECTION_SEC = 15;
export const INSPECTION_DNF_SEC = 17;
export const SOLVE_CUTOFF_SEC = 60;
export const PLUS_TWO_MS = 2000;
export const ROUND_RESULT_SEC = 4;
export const REMATCH_WINDOW_SEC = 15;
/** "Opponent found" screen; leaving inside it cancels the match unrated (design 4.6). */
export const MATCH_FOUND_SEC = 3;

// Disconnects and abandons (design 4.6)
export const DISCONNECT_GRACE_SEC = 20;
export const PAIR_RATED_LIMIT_PER_DAY = 3;
/** Queue cooldown after leaving a match before it started: 1st, 2nd, 3rd+ time that day. */
export const ABANDON_COOLDOWNS_SEC: readonly number[] = [60, 300, 900];

// Verification (design 4.7)
export const TIME_MISMATCH_MS = 50;
export const TIME_CORRECTION_MAX_MS = 1000;
export const WALLCLOCK_TOLERANCE_MS = 1000;
export const WALLCLOCK_DNF_MS = 3000;
export const REPLAY_GAP_MAX_MOVES = 2;
export const MISSING_CUBE_TS_MAX_RATIO = 0.2;
/**
 * A solve is flagged `missing_cube_ts` only above this share of unstamped moves.
 *
 * GAN Gen4 pulls a dropped move back from the cube's history without a cube timestamp, so an
 * honest solve can carry one or two. Measured in the closed test (2026-10-13, real GAN i4 and
 * GAN 12 ui): every flagged honest round had exactly 1 unstamped move out of 83-98, about 1 %.
 * Flagging on the first one put ordinary packet loss on the admin's review list.
 */
export const MISSING_CUBE_TS_FLAG_RATIO = 0.05;
export const INSPECTION_MISMATCH_MS = 300;
export const SCRAMBLE_PAUSE_FLAG_MS = 5000;
export const SUSPICIOUS_MIN_TIME_MS = 5000;
export const SUSPICIOUS_TPS = 15;
export const SUSPICIOUS_FAST_GAP_MS = 30;
export const SUSPICIOUS_FAST_GAP_RATIO = 0.2;
/** Check 9 (own history) runs on the server (B2/B3); its thresholds live here too. */
export const HISTORY_MIN_SOLVES = 20;
export const HISTORY_SAMPLE_SIZE = 100;
export const HISTORY_BEST_MARGIN = 0.15;
export const HISTORY_AVG_RATIO = 0.85;
/**
 * Check 7: a reported phase event may sit this far from the moment the move log completes
 * the phase (live detection runs on uncorrected move times). Not in the design table; added
 * with check 7's implementation.
 */
export const PROGRESS_TOLERANCE_MS = 1000;
export const PROVISIONAL_JUMP_FLAG = 300;
export const PROVISIONAL_JUMP_GAMES = 5;

// Duel (owner decision 2026-10-20): an invite link or a profile challenge, never rated,
// same format as a queue match.
/** An invite lives this long, and is used once. */
export const CHALLENGE_TTL_SEC = 15 * 60;
/** The inviter's socket may drop this long (a reconnect) before the invite dies. */
export const CHALLENGE_HOST_GRACE_SEC = 20;
/** Invites one user may create per hour, links and profile challenges together. */
export const CHALLENGE_CREATE_LIMIT_PER_HOUR = 10;
/** After a profile challenge the same person did not accept, wait this long before the next. */
export const CHALLENGE_TARGET_COOLDOWN_SEC = 10 * 60;
/** Profile challenges to the same person that were not accepted, per 24 h. */
export const CHALLENGE_TARGET_DAILY_LIMIT = 3;
/**
 * Which matches the head-to-head score ("7-4 against Ahmet") counts. 'all': every finished,
 * not voided match of the pair, duels and rated together (owner default). 'challenge': duels only.
 */
export const HEAD_TO_HEAD_SCOPE: 'all' | 'challenge' = 'all';

// Leaderboard (design 4.4, Q3)
/** Leaderboard order is rating - LEADERBOARD_RD_FACTOR * RD. 0 means raw rating. */
export const LEADERBOARD_RD_FACTOR = 2;
export const LEADERBOARD_PAGE_SIZE = 50;

// Time sync (design 4.8)
export const TIME_SYNC_SAMPLES = 5;
