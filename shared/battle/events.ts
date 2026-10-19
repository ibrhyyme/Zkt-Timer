/**
 * Online Battle Socket.IO contract (design ranking-battle.md 4.11).
 *
 * Event names and payloads, shared by the server listeners (server/battle/events.ts) and
 * the client hooks (client/components/battle/online/useBattleSocket.ts). Same pattern as
 * shared/friendly_room/events.ts. Every name carries the `battle:` prefix.
 *
 * Payloads are picked by hand on the server: never send a Prisma row through a socket
 * (BigInt is silently dropped by the Redis adapter's msgpack and a raw row can leak
 * private columns).
 *
 * Times named `...At` / `goAt` / `deadline` are server clock (ms since epoch). The client
 * converts them with the offset it measured through TIME_SYNC.
 */

import { BattlePuzzle } from './config';
import {
	BattleDnfReason,
	BattleEndReason,
	BattleMove,
	BattlePenalty,
	BattleRatingDelta,
	BattleSide,
	BattleSolveSource,
	BattleWinner,
} from './types';

export enum BattleClientEvent {
	QUEUE_JOIN = 'battle:queue_join',
	QUEUE_LEAVE = 'battle:queue_leave',
	/** Answer to the "Are you still there?" prompt (queue_state.askStillHere). */
	QUEUE_STILL_HERE = 'battle:queue_still_here',
	/** Ack: { searchingCount }. Polled every 10 s by the landing card while it is visible. */
	SEARCHING_COUNT = 'battle:searching_count',
	/** Ack: TimeSyncAck. Sent 5 times at match start; the shortest round trip wins. */
	TIME_SYNC = 'battle:time_sync',
	/** After a reconnect. The server answers with MATCH_STATE (or CANCELLED). */
	RESUME = 'battle:resume',
	SCRAMBLE_DONE = 'battle:scramble_done',
	/** Only so the opponent sees "solving". No check depends on it. */
	SOLVE_START = 'battle:solve_start',
	PROGRESS = 'battle:progress',
	SOLVE_DONE = 'battle:solve_done',
	GIVE_UP = 'battle:give_up',
	REMATCH = 'battle:rematch',
	REPORT = 'battle:report',
}

export enum BattleServerEvent {
	QUEUE_STATE = 'battle:queue_state',
	MATCHED = 'battle:matched',
	ROUND_START = 'battle:round_start',
	OPPONENT_STATE = 'battle:opponent_state',
	ROUND_RESULT = 'battle:round_result',
	MATCH_RESULT = 'battle:match_result',
	REMATCH_STATE = 'battle:rematch_state',
	OPPONENT_CONNECTION = 'battle:opponent_connection',
	/** Full snapshot of a running match, the answer to RESUME. */
	MATCH_STATE = 'battle:match_state',
	CANCELLED = 'battle:cancelled',
	ERROR = 'battle:error',
}

/** Socket.IO room of one match: both players' sockets join it. */
export const BATTLE_SOCKET_ROOM_PREFIX = 'battle:';

export function getBattleSocketRoom(matchId: string): string {
	return `${BATTLE_SOCKET_ROOM_PREFIX}${matchId}`;
}

// ── Client -> server payloads ────────────────────────────────────────────────

export interface BattleCubeInfo {
	/** Driver brand as the connection manager reports it (gan, qiyi, moyu32...). */
	brand: string;
	/** The cube stamps moves with its own clock. Required to queue (design 4.3, Q2). */
	hasClock: boolean;
}

export interface QueueJoinPayload {
	puzzle: BattlePuzzle;
	cube: BattleCubeInfo;
}

export interface SearchingCountAck {
	searchingCount: number;
}

export interface TimeSyncAck {
	serverNow: number;
}

export interface ResumePayload {
	/** Omitted when the client does not know it (app restarted); the server looks it up. */
	matchId?: string;
}

export interface ScrambleDonePayload {
	matchId: string;
	round: number;
	/** The cube's own facelets report when the scramble completed (check 1). */
	facelets: string;
	/**
	 * Cube clock of the second to last and the last scramble move (check 6). Null entries
	 * when the cube did not stamp them.
	 */
	lastScrambleCubeTs: [number | null, number | null];
	/**
	 * goAt to scramble complete on the device's synced clock. The server keeps it only within
	 * SCRAMBLE_CLOCK_SLACK_MS of its own interval (`acceptedScrambleMs`). Older clients omit it.
	 */
	scrambleMs?: number;
}

export interface SolveStartPayload {
	matchId: string;
	round: number;
	/** Inspection as the device's engine measured it (TIMER_START.inspectionMs). */
	inspectionMs: number;
}

/** CFOP step names of the progress bar (shared/util/solve/methods, cfop). */
export type BattleProgressStep = 'cross' | 'f2l_1' | 'f2l_2' | 'f2l_3' | 'f2l_4' | 'oll' | 'pll';

export const BATTLE_PROGRESS_STEPS: readonly BattleProgressStep[] = [
	'cross',
	'f2l_1',
	'f2l_2',
	'f2l_3',
	'f2l_4',
	'oll',
	'pll',
];

export interface ProgressPayload {
	matchId: string;
	round: number;
	step: BattleProgressStep;
	/** Ms since the first solve move, on the corrected move clock. */
	atMs: number;
}

export interface SolveDonePayload {
	matchId: string;
	round: number;
	/** SolveResult.timeMs of the device's engine. */
	timeMs: number;
	/** The device's own penalty call (its inspection count). The server decides the final one. */
	penalty: BattlePenalty | null;
	source: BattleSolveSource;
	timeCorrectionMs: number;
	/** Solution moves only, scramble excluded. */
	moves: BattleMove[];
}

export interface MatchIdPayload {
	matchId: string;
}

export interface RematchPayload {
	matchId: string;
	accept: boolean;
}

export interface ReportPayload {
	matchId: string;
	reason: string;
}

// ── Server -> client payloads ────────────────────────────────────────────────

export interface QueueStatePayload {
	searching: boolean;
	waitedSec: number;
	searchingCount: number;
	/** Set every QUEUE_IDLE_CHECK_SEC; answer with QUEUE_STILL_HERE or leave the queue. */
	askStillHere?: boolean;
	/** Server clock deadline for the still-here answer. */
	stillHereDeadline?: number;
}

export interface BattlePlayerInfo {
	id: string;
	username: string;
	/** Profile picture URL, or null. */
	avatar: string | null;
	/** Rounded rating. */
	rating: number;
	provisional: boolean;
}

export interface MatchedPayload {
	matchId: string;
	/** False for rematches past the daily pair limit. */
	rated: boolean;
	isRematch: boolean;
	/** Which side this player is in round results. */
	side: BattleSide;
	you: { rating: number; provisional: boolean; games: number };
	opponent: BattlePlayerInfo;
	/** Signed deltas from glicko2.previewDeltas. Absent on unrated matches. */
	preview: BattleRatingDelta | null;
	/** Server clock: when the first round's countdown starts. */
	startsAt: number;
}

export interface RoundStartPayload {
	matchId: string;
	round: number;
	scramble: string;
	/** Server clock: the scramble opens on both screens at this moment (after 3-2-1). */
	goAt: number;
	/** Server clock: scrambling not done by then loses the round. */
	scrambleDeadline: number;
}

export type BattleOpponentPhase = 'scrambling' | 'inspecting' | 'solving' | 'finished';

export interface OpponentStatePayload {
	matchId: string;
	round: number;
	phase: BattleOpponentPhase;
	step?: BattleProgressStep;
	/** Server clock of the opponent's solve_start, for the live running time. */
	solvingSince?: number;
	/** Only once finished. */
	timeMs?: number | null;
	penalty?: BattlePenalty | null;
}

export interface RoundSolveView {
	timeMs: number | null;
	penalty: BattlePenalty | null;
	dnfReason?: BattleDnfReason | null;
}

export interface RoundResultPayload {
	matchId: string;
	round: number;
	a: RoundSolveView;
	b: RoundSolveView;
	winner: BattleWinner;
	score: { a: number; b: number };
}

export interface MatchResultPayload {
	matchId: string;
	winner: BattleWinner;
	endReason: BattleEndReason;
	rated: boolean;
	/** Rounded, from this player's view. Null on unrated or void matches. */
	ratingBefore: number | null;
	ratingAfter: number | null;
	delta: number | null;
	provisional: boolean;
	/** Games played including this one, for "Provisional (6/10)". */
	games: number;
	rounds: RoundResultPayload[];
}

export interface RematchStatePayload {
	matchId: string;
	you: boolean;
	/** True when the opponent pressed rematch, 'left' when they left or picked a new opponent. */
	opponent: boolean | 'left';
	/** Server clock. */
	deadline: number;
	/** False once the pair reached the daily rated limit: "Rematch (unrated)". */
	rated: boolean;
}

export interface OpponentConnectionPayload {
	matchId: string;
	connected: boolean;
	/** Server clock: the opponent loses the round if not back by then. */
	graceUntil?: number;
}

export type BattleMatchPhase = 'found' | 'countdown' | 'scrambling' | 'inspecting' | 'solving' | 'round_result' | 'finished';

export interface MatchStatePayload {
	matchId: string;
	matched: MatchedPayload;
	round: number;
	phase: BattleMatchPhase;
	current: RoundStartPayload | null;
	score: { a: number; b: number };
	rounds: RoundResultPayload[];
	opponent: OpponentStatePayload | null;
	opponentConnected: boolean;
}

export type BattleCancelReason =
	/** Someone left inside the match found screen; nobody's rating changes. */
	| 'left_before_start'
	/** The server restarted (deploy); the match is void. */
	| 'server_restart'
	/** Both players disconnected; the match is void. */
	| 'both_disconnected'
	/** RESUME for a match that no longer exists. */
	| 'not_found';

export interface CancelledPayload {
	matchId?: string;
	reason: BattleCancelReason;
}

export interface BattleErrorPayload {
	/** Translation key (online_battle.errors.*), same pattern as GraphQL errors. */
	i18nKey: string;
	params?: Record<string, string | number>;
}

/** i18n keys the server sends in battle:error. The client translates them. */
export const BATTLE_ERROR_KEYS = {
	notLoggedIn: 'online_battle.errors.not_logged_in',
	emailNotVerified: 'online_battle.errors.email_not_verified',
	banned: 'online_battle.errors.banned',
	disabled: 'online_battle.errors.disabled',
	alreadyInMatch: 'online_battle.errors.already_in_match',
	inFriendlyRoom: 'online_battle.errors.in_friendly_room',
	cubeNotSupported: 'online_battle.errors.cube_not_supported',
	puzzleNotSupported: 'online_battle.errors.puzzle_not_supported',
	/** params: { seconds } */
	queueCooldown: 'online_battle.errors.queue_cooldown',
	rateLimited: 'online_battle.errors.rate_limited',
	scrambleMismatch: 'online_battle.errors.scramble_mismatch',
	matchNotFound: 'online_battle.errors.match_not_found',
	generic: 'online_battle.errors.generic',
} as const;
