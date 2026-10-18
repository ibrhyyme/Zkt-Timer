/**
 * Online Battle match manager (design ranking-battle.md 4.1, 4.5-4.8).
 *
 * The server owns every transition. Clients only report what their own cube did
 * (scramble done, solve started, phase reached, solve done) and draw what the server sends.
 *
 * Flow of one match:
 *   found (3 s, preview "+12 / -9")
 *   round n: countdown 3 s -> scramble (90 s, the cube verifies it) -> inspection 15 s per
 *            player from their own scramble_done -> solve (120 s) -> round result 4 s
 *   best of three, drawn rounds replayed, at most 5 rounds -> match result -> rematch 15 s
 *
 * Process model (design 4.8): the MVP runs one Node process. The authoritative state and
 * the phase timers live in this process; every change is mirrored to Redis
 * (`cd:battle:match#<id>`, 30 min TTL) so a restart can void the matches it interrupted
 * and a reconnecting client learns why. Going multi-process needs a per-match Redis lock
 * or routing events to the owner; not done here.
 *
 * Every mutation of one match runs through a per-match promise chain, so a timer and a
 * socket event never interleave on the same state.
 */

import {
	COUNTDOWN_SEC,
	DISCONNECT_GRACE_SEC,
	HISTORY_AVG_RATIO,
	HISTORY_BEST_MARGIN,
	HISTORY_MIN_SOLVES,
	INSPECTION_DNF_SEC,
	MATCH_FOUND_SEC,
	REMATCH_WINDOW_SEC,
	ROUND_RESULT_SEC,
	SCRAMBLE_TIMEOUT_SEC,
	SOLVE_CUTOFF_SEC,
	WALLCLOCK_DNF_MS,
	BATTLE_PUZZLE,
} from '../../shared/battle/config';
import {
	BATTLE_ERROR_KEYS,
	BATTLE_PROGRESS_STEPS,
	BattleCancelReason,
	BattleMatchPhase,
	BattleProgressStep,
	BattleServerEvent,
	CancelledPayload,
	MatchedPayload,
	MatchResultPayload,
	MatchStatePayload,
	OpponentConnectionPayload,
	OpponentStatePayload,
	ProgressPayload,
	RematchPayload,
	RematchStatePayload,
	ResumePayload,
	RoundResultPayload,
	RoundSolveView,
	RoundStartPayload,
	ScrambleDonePayload,
	SolveDonePayload,
	SolveStartPayload,
} from '../../shared/battle/events';
import {
	displayRating,
	isProvisional,
	prepareForMatch,
	previewDeltas,
} from '../../shared/battle/glicko2';
import {forfeitWinner, isPairRated, matchProgress, roundWinner} from '../../shared/battle/rules';
import {
	BattleDnfReason,
	BattleEndReason,
	BattleFlag,
	BattleMatchStatus,
	BattleMove,
	BattlePenalty,
	BattleRatingDelta,
	BattleSide,
	BattleSolveSource,
	BattleWinner,
	GlickoRating,
	RECOVERY_SOURCES,
} from '../../shared/battle/types';
import {ReportedProgress, scrambleFaceletsMatch, verifySolve} from '../../shared/battle/verify';
import {RedisNamespace} from '../services/redis';
import type {PersistMatchInput, PersistMatchResult, StoredBattleRating} from '../models/battle';
import {battleKey, battleKeyPattern, BattleClock, BattleStore, TimerHandle} from './store';
import {
	clearBattleSession,
	getBattleSession,
	getMatchEndedReason,
	markMatchEnded,
	MATCH_SNAPSHOT_TTL_SEC,
	recordAbandon,
	setBattleSession,
	setRecentOpponent,
} from './session';

const DAY_MS = 24 * 60 * 60 * 1000;
/**
 * After scramble_done a solve_done must arrive within inspection DNF + cutoff, plus the
 * wall clock tolerance (check 5) and a little network slack. Later than that: DNF.
 */
export const SOLVE_WINDOW_MS = (INSPECTION_DNF_SEC + SOLVE_CUTOFF_SEC) * 1000 + WALLCLOCK_DNF_MS + 2000;

/**
 * After scramble_done the first solve move (solve_start, or the first progress event) must
 * reach the server within the inspection DNF limit plus network slack, or that player's round
 * is a DNF right there.
 *
 * Without it only SOLVE_WINDOW_MS ended an inspection: a player past 17 s saw DNF on their
 * own screen while the server, and so the opponent, kept them "inspecting" for over two
 * minutes. The slack keeps a start that the cube clock puts just under 17 s from turning into
 * a DNF on a slow link; check 6 still decides +2 and DNF from the cube clock for every solve
 * that does start.
 */
export const INSPECTION_WINDOW_MS = INSPECTION_DNF_SEC * 1000 + 3000;
/** Upper bound for one solve's move log (a 120 s solve at 15 TPS is 1800 moves). */
const MAX_MOVES = 2000;
const MOVE_TOKEN = /^[A-Za-z]{1,3}[0-9]?'?$/;
const SOURCES: readonly BattleSolveSource[] = ['tracker', ...RECOVERY_SOURCES];

// ── Dependencies ─────────────────────────────────────────────────────────────

export interface BattlePlayerProfile {
	username: string;
	/** Profile picture URL, or null. */
	avatar: string | null;
}

export interface BattleLogger {
	info(msg: string, meta?: unknown): void;
	warn(msg: string, meta?: unknown): void;
	error(msg: string, meta?: unknown): void;
}

export interface MatchManagerDeps {
	store: BattleStore;
	clock: BattleClock;
	emitToSocket(socketId: string, event: string, payload: unknown): void;
	generateScramble(): string;
	newId(): string;
	loadProfile(userId: string): Promise<BattlePlayerProfile | null>;
	getStoredRating(userId: string): Promise<StoredBattleRating | null>;
	countPairRatedMatches(userIdA: string, userIdB: string, since: Date): Promise<number>;
	persistMatch(input: PersistMatchInput): Promise<PersistMatchResult>;
	appendBattleFlags(
		matchId: string,
		add: {match?: BattleFlag[]; rounds?: Array<{index: number; side: BattleSide; flags: BattleFlag[]}>}
	): Promise<void>;
	/**
	 * Check 9: the player's last smart cube 3x3 solves on the server (non-DNF, newest
	 * first, at most HISTORY_SAMPLE_SIZE), in ms.
	 */
	loadSolveHistoryMs(userId: string): Promise<number[]>;
	log?: BattleLogger;
}

export interface PairPlayerInput {
	userId: string;
	socketId: string;
	ip: string | null;
}

// ── State ────────────────────────────────────────────────────────────────────

type SidePhase = 'scrambling' | 'inspecting' | 'solving' | 'finished';

export interface SideResult {
	timeMs: number | null;
	penalty: BattlePenalty | null;
	dnfReason: BattleDnfReason | null;
	flags: BattleFlag[];
	moves: BattleMove[] | null;
	inspectionMs: number | null;
}

interface SideRound {
	phase: SidePhase;
	scrambleDoneAt: number | null;
	lastScrambleCubeTs: [number | null, number | null] | null;
	solveStartAt: number | null;
	clientInspectionMs: number | null;
	progress: ReportedProgress[];
	result: SideResult | null;
}

interface RoundRuntime {
	round: number;
	scramble: string;
	goAt: number;
	scrambleDeadline: number;
	a: SideRound;
	b: SideRound;
	resolved: boolean;
}

export interface ResolvedRound {
	round: number;
	scramble: string;
	winner: BattleWinner;
	a: SideResult;
	b: SideResult;
}

export interface MatchPlayer {
	userId: string;
	socketId: string;
	ip: string | null;
	username: string;
	avatar: string | null;
	/** prepareForMatch at pairing time; the preview and the final update both read it. */
	prepared: GlickoRating;
	/** Rated games before this match. */
	games: number;
	preview: BattleRatingDelta | null;
	connected: boolean;
	graceUntil: number | null;
	/** The 20 s grace ran out and the player has not come back. */
	absent: boolean;
	/** Round the player lost (or had finished) when the grace ran out. */
	absentLostRound: number | null;
	/** The grace ran out between rounds: the next round is lost. */
	owesRound: boolean;
	/** Rematch answer: true pressed, 'left' declined, left or disconnected. */
	rematch: boolean | 'left';
}

export interface MatchState {
	id: string;
	puzzle: string;
	rated: boolean;
	isRematch: boolean;
	startedAt: number;
	startsAt: number;
	/** The first scramble was shown: leaving now is a rated loss, no longer a cancel. */
	started: boolean;
	a: MatchPlayer;
	b: MatchPlayer;
	current: RoundRuntime | null;
	rounds: ResolvedRound[];
	flags: BattleFlag[];
	/** The match is decided, the last round result is still on screen. */
	decided: {winner: BattleWinner} | null;
	ended: {status: BattleMatchStatus; endReason: BattleEndReason; winner: BattleWinner | null} | null;
	/** MATCH_RESULT per side, kept for a client that reconnects on the result screen. */
	results: {A: MatchResultPayload; B: MatchResultPayload} | null;
	rematchDeadline: number | null;
	rematchRated: boolean;
}

export function matchKey(matchId: string): string {
	return battleKey(RedisNamespace.BATTLE_MATCH, matchId);
}

function newSideRound(): SideRound {
	return {
		phase: 'scrambling',
		scrambleDoneAt: null,
		lastScrambleCubeTs: null,
		solveStartAt: null,
		clientInspectionMs: null,
		progress: [],
		result: null,
	};
}

function finiteOrNull(v: unknown): number | null {
	return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

/** Moves exactly as verify expects them; anything else in the payload is dropped. */
export function sanitizeMoves(raw: unknown): BattleMove[] {
	if (!Array.isArray(raw)) return [];
	const out: BattleMove[] = [];
	for (const m of raw.slice(0, MAX_MOVES)) {
		if (!m || typeof m !== 'object') continue;
		const t = (m as any).t;
		if (typeof t !== 'string' || !MOVE_TOKEN.test(t)) continue;
		out.push({t, c: finiteOrNull((m as any).c), l: finiteOrNull((m as any).l)});
	}
	return out;
}

function sanitizeTsPair(raw: unknown): [number | null, number | null] | null {
	if (!Array.isArray(raw)) return null;
	return [finiteOrNull(raw[0]), finiteOrNull(raw[1])];
}

function solveView(r: SideResult | null): RoundSolveView {
	if (!r) return {timeMs: null, penalty: null, dnfReason: null};
	return {timeMs: r.timeMs, penalty: r.penalty, dnfReason: r.dnfReason};
}

// ── Check 9 (own history) ────────────────────────────────────────────────────

/** Mean without the best and worst 5 % (ao100 style). */
export function trimmedMean(times: number[]): number | null {
	if (!times.length) return null;
	const sorted = [...times].sort((x, y) => x - y);
	const cut = Math.ceil(sorted.length * 0.05);
	const core = sorted.length > 2 * cut ? sorted.slice(cut, sorted.length - cut) : sorted;
	return core.reduce((s, t) => s + t, 0) / core.length;
}

export interface HistoryCheckResult {
	/** Rounds whose solve beat the player's best by more than the margin. */
	rounds: number[];
	/** The battle average is under 85 % of the player's own average. */
	match: boolean;
}

/**
 * Check 9 (design 4.7): a battle solve more than 15 % faster than the player's best of
 * their last 100 smart cube solves, or a battle average under 85 % of their own average.
 * Needs at least 20 solves of history; flags only, results stand.
 */
export function historyCheck(historyMs: number[], battle: Array<{round: number; timeMs: number}>): HistoryCheckResult {
	const history = historyMs.filter((t) => Number.isFinite(t) && t > 0);
	if (history.length < HISTORY_MIN_SOLVES || !battle.length) return {rounds: [], match: false};
	const best = Math.min(...history);
	const avg = trimmedMean(history) as number;
	const rounds = battle.filter((b) => b.timeMs < best * (1 - HISTORY_BEST_MARGIN)).map((b) => b.round);
	const battleAvg = battle.reduce((s, b) => s + b.timeMs, 0) / battle.length;
	return {rounds, match: battleAvg < avg * HISTORY_AVG_RATIO};
}

// ── Manager ──────────────────────────────────────────────────────────────────

export class BattleMatchManager {
	private matches = new Map<string, MatchState>();
	/** userId -> matchId of the match the user is in (running, or in its rematch window). */
	private userMatch = new Map<string, string>();
	private timers = new Map<string, Map<string, TimerHandle>>();
	private chains = new Map<string, Promise<void>>();
	private background = new Set<Promise<void>>();

	constructor(private deps: MatchManagerDeps) {}

	// ── Lookups ──

	getMatch(matchId: string): MatchState | undefined {
		return this.matches.get(matchId);
	}

	matchIdFor(userId: string): string | null {
		return this.userMatch.get(userId) ?? null;
	}

	matchStatusFor(userId: string): 'live' | 'finished' | null {
		const match = this.matchForUser(userId);
		if (!match) return null;
		if (!match.ended) return 'live';
		const p = this.player(match, userId);
		return p && p.rematch !== 'left' ? 'finished' : null;
	}

	/** Waits for queued mutations and background work (check 9). For tests and shutdown. */
	async idle(): Promise<void> {
		for (let i = 0; i < 10; i++) {
			const pending = [...this.chains.values(), ...this.background];
			if (!pending.length) return;
			await Promise.all(pending.map((p) => p.catch((): void => undefined)));
		}
	}

	/** Clears every timer (tests, shutdown). */
	stop(): void {
		for (const id of Array.from(this.timers.keys())) this.clearTimers(id);
	}

	private matchForUser(userId: string): MatchState | undefined {
		const id = this.userMatch.get(userId);
		return id ? this.matches.get(id) : undefined;
	}

	private sideOf(match: MatchState, userId: string): BattleSide | null {
		if (match.a.userId === userId) return 'A';
		if (match.b.userId === userId) return 'B';
		return null;
	}

	private player(match: MatchState, userId: string): MatchPlayer | null {
		const side = this.sideOf(match, userId);
		return side ? this.bySide(match, side) : null;
	}

	private bySide(match: MatchState, side: BattleSide): MatchPlayer {
		return side === 'A' ? match.a : match.b;
	}

	private other(side: BattleSide): BattleSide {
		return side === 'A' ? 'B' : 'A';
	}

	private roundSide(round: RoundRuntime, side: BattleSide): SideRound {
		return side === 'A' ? round.a : round.b;
	}

	private now(): number {
		return this.deps.clock.now();
	}

	private send(p: MatchPlayer, event: BattleServerEvent, payload: unknown): void {
		if (p.socketId) this.deps.emitToSocket(p.socketId, event, payload);
	}

	// ── Serialisation, timers, snapshot ──

	private run(matchId: string, fn: () => Promise<void> | void): Promise<void> {
		const prev = this.chains.get(matchId) || Promise.resolve();
		const next = prev
			.then(() => fn())
			.catch((e) => {
				this.deps.log?.error('[battle] match step failed', {matchId, error: (e as Error)?.message});
			});
		this.chains.set(matchId, next);
		void next.then(() => {
			if (this.chains.get(matchId) === next) this.chains.delete(matchId);
		});
		return next;
	}

	private track(p: Promise<void>): void {
		this.background.add(p);
		void p.finally(() => this.background.delete(p));
	}

	private schedule(match: MatchState, name: string, at: number, fn: (m: MatchState) => Promise<void> | void): void {
		const id = match.id;
		let map = this.timers.get(id);
		if (!map) {
			map = new Map();
			this.timers.set(id, map);
		}
		const existing = map.get(name);
		if (existing) this.deps.clock.clearTimeout(existing);
		const handle = this.deps.clock.setTimeout(() => {
			this.timers.get(id)?.delete(name);
			void this.run(id, async () => {
				const m = this.matches.get(id);
				if (m) await fn(m);
			});
		}, Math.max(0, at - this.now()));
		map.set(name, handle);
	}

	private clearTimer(matchId: string, name: string): void {
		const map = this.timers.get(matchId);
		const h = map?.get(name);
		if (h) {
			this.deps.clock.clearTimeout(h);
			map?.delete(name);
		}
	}

	private clearTimers(matchId: string): void {
		const map = this.timers.get(matchId);
		if (map) for (const h of map.values()) this.deps.clock.clearTimeout(h);
		this.timers.delete(matchId);
	}

	private async save(match: MatchState): Promise<void> {
		try {
			await this.deps.store.set(matchKey(match.id), JSON.stringify(match), MATCH_SNAPSHOT_TTL_SEC);
		} catch (e) {
			this.deps.log?.warn('[battle] match snapshot write failed', {matchId: match.id, error: (e as Error)?.message});
		}
	}

	// ── Payload builders ──

	private matchedPayload(match: MatchState, side: BattleSide): MatchedPayload {
		const me = this.bySide(match, side);
		const op = this.bySide(match, this.other(side));
		return {
			matchId: match.id,
			rated: match.rated,
			isRematch: match.isRematch,
			side,
			you: {rating: displayRating(me.prepared.rating), provisional: isProvisional(me.prepared.rd), games: me.games},
			opponent: {
				id: op.userId,
				username: op.username,
				avatar: op.avatar,
				rating: displayRating(op.prepared.rating),
				provisional: isProvisional(op.prepared.rd),
			},
			preview: match.rated ? me.preview : null,
			startsAt: match.startsAt,
		};
	}

	private roundStartPayload(match: MatchState, r: RoundRuntime): RoundStartPayload {
		return {matchId: match.id, round: r.round, scramble: r.scramble, goAt: r.goAt, scrambleDeadline: r.scrambleDeadline};
	}

	private opponentView(match: MatchState, r: RoundRuntime, side: BattleSide): OpponentStatePayload {
		const s = this.roundSide(r, side);
		const view: OpponentStatePayload = {matchId: match.id, round: r.round, phase: s.phase};
		const last = s.progress[s.progress.length - 1];
		if (last) view.step = last.step as BattleProgressStep;
		if (s.solveStartAt != null) view.solvingSince = s.solveStartAt;
		if (s.phase === 'finished' && s.result) {
			view.timeMs = s.result.timeMs;
			view.penalty = s.result.penalty;
		}
		return view;
	}

	/** Sends `side`'s round state to the other player. */
	private sendOpponentState(match: MatchState, r: RoundRuntime, side: BattleSide): void {
		this.send(this.bySide(match, this.other(side)), BattleServerEvent.OPPONENT_STATE, this.opponentView(match, r, side));
	}

	private roundResults(match: MatchState): RoundResultPayload[] {
		let a = 0;
		let b = 0;
		return match.rounds.map((r) => {
			if (r.winner === 'A') a++;
			else if (r.winner === 'B') b++;
			return {
				matchId: match.id,
				round: r.round,
				a: solveView(r.a),
				b: solveView(r.b),
				winner: r.winner,
				score: {a, b},
			};
		});
	}

	private score(match: MatchState): {a: number; b: number} {
		return matchProgress(match.rounds.map((r) => r.winner)).score;
	}

	private matchStatePayload(match: MatchState, side: BattleSide): MatchStatePayload {
		const r = match.current;
		let phase: BattleMatchPhase;
		if (!r) phase = 'found';
		else if (r.resolved) phase = 'round_result';
		else if (this.now() < r.goAt) phase = 'countdown';
		else {
			const mine = this.roundSide(r, side).phase;
			// "Done, waiting for the opponent" is still the solving stage of the round.
			phase = mine === 'finished' ? 'solving' : mine;
		}
		return {
			matchId: match.id,
			matched: this.matchedPayload(match, side),
			round: r ? r.round : 0,
			phase,
			current: r ? this.roundStartPayload(match, r) : null,
			score: this.score(match),
			rounds: this.roundResults(match),
			opponent: r ? this.opponentView(match, r, this.other(side)) : null,
			opponentConnected: this.bySide(match, this.other(side)).connected,
		};
	}

	private rematchStatePayload(match: MatchState, side: BattleSide): RematchStatePayload {
		const me = this.bySide(match, side);
		const op = this.bySide(match, this.other(side));
		return {
			matchId: match.id,
			you: me.rematch === true,
			opponent: op.rematch,
			deadline: match.rematchDeadline ?? this.now(),
			rated: match.rematchRated,
		};
	}

	// ── Creating a match ──

	/**
	 * Pairs two players (from the queue, or a rematch). Reads both stored ratings once and
	 * prepares them for this match (idle RD growth up to now); the preview and the final
	 * update both use these prepared states.
	 */
	async createMatch(pa: PairPlayerInput, pb: PairPlayerInput, opts: {isRematch?: boolean} = {}): Promise<MatchState> {
		if (pa.userId === pb.userId) throw new Error('battle: a player cannot be paired with themselves');
		for (const p of [pa, pb]) {
			const existing = this.matchForUser(p.userId);
			if (existing && !existing.ended) throw new Error('battle: player already in a running match');
			if (existing) await this.leaveFinished(p.userId);
		}

		const now = this.now();
		const [storedA, storedB, profA, profB, pairCount] = await Promise.all([
			this.deps.getStoredRating(pa.userId),
			this.deps.getStoredRating(pb.userId),
			this.deps.loadProfile(pa.userId),
			this.deps.loadProfile(pb.userId),
			this.deps.countPairRatedMatches(pa.userId, pb.userId, new Date(now - DAY_MS)),
		]);

		const prep = (s: StoredBattleRating | null) =>
			prepareForMatch(s ? {rating: s.rating, rd: s.rd, volatility: s.volatility} : null, s?.last_match_at ?? null, now);
		const preparedA = prep(storedA);
		const preparedB = prep(storedB);
		const rated = isPairRated(pairCount);

		const mkPlayer = (
			input: PairPlayerInput,
			prof: BattlePlayerProfile | null,
			prepared: GlickoRating,
			opponent: GlickoRating,
			stored: StoredBattleRating | null
		): MatchPlayer => ({
			userId: input.userId,
			socketId: input.socketId,
			ip: input.ip,
			username: prof?.username || '',
			avatar: prof?.avatar ?? null,
			prepared,
			games: stored?.games ?? 0,
			preview: rated ? previewDeltas(prepared, opponent) : null,
			connected: true,
			graceUntil: null,
			absent: false,
			absentLostRound: null,
			owesRound: false,
			rematch: false,
		});

		const match: MatchState = {
			id: this.deps.newId(),
			puzzle: BATTLE_PUZZLE,
			rated,
			isRematch: !!opts.isRematch,
			startedAt: now,
			startsAt: now + MATCH_FOUND_SEC * 1000,
			started: false,
			a: mkPlayer(pa, profA, preparedA, preparedB, storedA),
			b: mkPlayer(pb, profB, preparedB, preparedA, storedB),
			current: null,
			rounds: [],
			flags: pa.ip && pb.ip && pa.ip === pb.ip ? ['same_ip'] : [],
			decided: null,
			ended: null,
			results: null,
			rematchDeadline: null,
			rematchRated: false,
		};

		this.matches.set(match.id, match);
		this.userMatch.set(pa.userId, match.id);
		this.userMatch.set(pb.userId, match.id);

		try {
			await Promise.all([
				setBattleSession(this.deps.store, pa.userId, {kind: 'match', socketId: pa.socketId, matchId: match.id, since: now}),
				setBattleSession(this.deps.store, pb.userId, {kind: 'match', socketId: pb.socketId, matchId: match.id, since: now}),
			]);
		} catch (e) {
			// No timer runs for this match yet. Left in memory it would hold both players as
			// "already in a match" until the next restart.
			this.matches.delete(match.id);
			if (this.userMatch.get(pa.userId) === match.id) this.userMatch.delete(pa.userId);
			if (this.userMatch.get(pb.userId) === match.id) this.userMatch.delete(pb.userId);
			throw e;
		}

		this.send(match.a, BattleServerEvent.MATCHED, this.matchedPayload(match, 'A'));
		this.send(match.b, BattleServerEvent.MATCHED, this.matchedPayload(match, 'B'));

		this.schedule(match, 'start', match.startsAt, (m) => this.startRound(m));
		await this.save(match);
		return match;
	}

	// ── Rounds ──

	private async startRound(match: MatchState): Promise<void> {
		if (match.ended || match.decided) return;
		const now = this.now();
		const goAt = now + COUNTDOWN_SEC * 1000;
		const r: RoundRuntime = {
			round: match.rounds.length + 1,
			scramble: this.deps.generateScramble(),
			goAt,
			scrambleDeadline: goAt + SCRAMBLE_TIMEOUT_SEC * 1000,
			a: newSideRound(),
			b: newSideRound(),
			resolved: false,
		};
		match.current = r;

		const payload = this.roundStartPayload(match, r);
		this.send(match.a, BattleServerEvent.ROUND_START, payload);
		this.send(match.b, BattleServerEvent.ROUND_START, payload);

		// A player whose grace ran out between rounds loses this one (design 4.6).
		for (const side of ['A', 'B'] as BattleSide[]) {
			const p = this.bySide(match, side);
			if (!p.owesRound) continue;
			p.owesRound = false;
			p.absentLostRound = r.round;
			this.finishSide(match, r, side, {
				timeMs: null,
				penalty: 'DNF',
				dnfReason: 'disconnect',
				flags: [],
				moves: null,
				inspectionMs: null,
			});
		}

		this.schedule(match, 'go', goAt, (m) => this.onGoAt(m, r.round));
		this.schedule(match, 'scramble_deadline', r.scrambleDeadline, (m) => this.onScrambleDeadline(m, r.round));
		await this.maybeResolveRound(match);
		await this.save(match);
	}

	private async onGoAt(match: MatchState, round: number): Promise<void> {
		if (match.ended || match.started || match.current?.round !== round) return;
		// The first scramble opens now. Whoever is gone at this moment left before the
		// start: the match is cancelled unrated and the leaver gets a queue cooldown.
		const gone = (['A', 'B'] as BattleSide[]).filter((s) => !this.bySide(match, s).connected);
		if (gone.length === 2) return this.cancel(match, [], 'both_disconnected');
		if (gone.length === 1) return this.cancel(match, gone, 'left_before_start');
		match.started = true;
		await this.save(match);
	}

	private async onScrambleDeadline(match: MatchState, round: number): Promise<void> {
		const r = match.current;
		if (match.ended || match.decided || !r || r.round !== round || r.resolved) return;
		const forfeits: BattleSide[] = [];
		for (const side of ['A', 'B'] as BattleSide[]) {
			const s = this.roundSide(r, side);
			if (s.phase !== 'scrambling') continue;
			const p = this.bySide(match, side);
			// Still away one round after losing a round to the disconnect: forfeit (design 4.6).
			if (!p.connected && p.absent && p.absentLostRound != null && round > p.absentLostRound) {
				forfeits.push(side);
				continue;
			}
			this.finishSide(match, r, side, {
				timeMs: null,
				penalty: 'DNF',
				dnfReason: 'scramble_timeout',
				flags: [],
				moves: null,
				inspectionMs: null,
			});
		}
		if (forfeits.length === 2) return this.finishMatch(match, 'VOID', 'DISCONNECT', null);
		if (forfeits.length === 1) return this.finishMatch(match, 'FINISHED', 'DISCONNECT', forfeitWinner(forfeits[0]));
		await this.maybeResolveRound(match);
		await this.save(match);
	}

	private async onSolveWindowEnd(match: MatchState, round: number, side: BattleSide): Promise<void> {
		const r = match.current;
		if (match.ended || !r || r.round !== round || r.resolved) return;
		const s = this.roundSide(r, side);
		if (s.phase === 'finished') return;
		this.finishSide(match, r, side, {
			timeMs: null,
			penalty: 'DNF',
			dnfReason: 'timeout',
			flags: [],
			moves: null,
			inspectionMs: null,
		});
		await this.maybeResolveRound(match);
		await this.save(match);
	}

	/** Inspection ran out without a first solve move: DNF now, so the opponent sees it too. */
	private async onInspectionWindowEnd(match: MatchState, round: number, side: BattleSide): Promise<void> {
		const r = match.current;
		if (match.ended || !r || r.round !== round || r.resolved) return;
		const s = this.roundSide(r, side);
		if (s.phase !== 'inspecting') return;
		this.finishSide(match, r, side, {
			timeMs: null,
			penalty: 'DNF',
			dnfReason: 'inspection',
			flags: [],
			moves: null,
			inspectionMs: null,
		});
		await this.maybeResolveRound(match);
		await this.save(match);
	}

	private finishSide(match: MatchState, r: RoundRuntime, side: BattleSide, result: SideResult): void {
		const s = this.roundSide(r, side);
		s.result = result;
		s.phase = 'finished';
		this.clearTimer(match.id, `solve_${side}`);
		this.clearTimer(match.id, `insp_${side}`);
		this.sendOpponentState(match, r, side);
	}

	private async maybeResolveRound(match: MatchState): Promise<void> {
		const r = match.current;
		if (!r || r.resolved || r.a.phase !== 'finished' || r.b.phase !== 'finished') return;
		r.resolved = true;
		this.clearTimer(match.id, 'go');
		this.clearTimer(match.id, 'scramble_deadline');

		const a = r.a.result as SideResult;
		const b = r.b.result as SideResult;
		const winner = roundWinner(a, b);
		match.rounds.push({round: r.round, scramble: r.scramble, winner, a, b});
		const progress = matchProgress(match.rounds.map((x) => x.winner));

		const payload: RoundResultPayload = {
			matchId: match.id,
			round: r.round,
			a: solveView(a),
			b: solveView(b),
			winner,
			score: progress.score,
		};
		this.send(match.a, BattleServerEvent.ROUND_RESULT, payload);
		this.send(match.b, BattleServerEvent.ROUND_RESULT, payload);

		const next = this.now() + ROUND_RESULT_SEC * 1000;
		if (progress.finished) {
			const w = progress.winner as BattleWinner;
			match.decided = {winner: w};
			this.schedule(match, 'finish', next, (m) => this.finishMatch(m, 'FINISHED', 'NORMAL', w));
		} else {
			this.schedule(match, 'next_round', next, (m) => this.startRound(m));
		}
	}

	// ── Client events ──

	/** The match, side and round an in-round event refers to, or null to ignore it. */
	private roundContext(
		userId: string,
		socketId: string,
		matchId: unknown,
		round: unknown
	): {match: MatchState; side: BattleSide; r: RoundRuntime; s: SideRound} | null {
		if (typeof matchId !== 'string') return null;
		const match = this.matches.get(matchId);
		if (!match || match.ended || match.decided) return null;
		const side = this.sideOf(match, userId);
		if (!side) return null;
		// Only the bound socket plays; another tab takes over through RESUME.
		if (this.bySide(match, side).socketId !== socketId) return null;
		const r = match.current;
		if (!r || r.resolved || r.round !== round) return null;
		return {match, side, r, s: this.roundSide(r, side)};
	}

	handleScrambleDone(userId: string, socketId: string, p: Partial<ScrambleDonePayload>): Promise<void> {
		return this.runFor(p?.matchId, async () => {
			const ctx = this.roundContext(userId, socketId, p?.matchId, p?.round);
			if (!ctx || ctx.s.phase !== 'scrambling') return;
			const {match, side, r, s} = ctx;
			// Check 1: the cube is in the scrambled state, or the round does not start.
			if (typeof p.facelets !== 'string' || !scrambleFaceletsMatch(r.scramble, p.facelets)) {
				this.send(this.bySide(match, side), BattleServerEvent.ERROR, {i18nKey: BATTLE_ERROR_KEYS.scrambleMismatch});
				return;
			}
			const now = this.now();
			s.phase = 'inspecting';
			s.scrambleDoneAt = now;
			s.lastScrambleCubeTs = sanitizeTsPair(p.lastScrambleCubeTs);
			this.schedule(match, `solve_${side}`, now + SOLVE_WINDOW_MS, (m) => this.onSolveWindowEnd(m, r.round, side));
			this.schedule(match, `insp_${side}`, now + INSPECTION_WINDOW_MS, (m) => this.onInspectionWindowEnd(m, r.round, side));
			this.sendOpponentState(match, r, side);
			await this.save(match);
		});
	}

	handleSolveStart(userId: string, socketId: string, p: Partial<SolveStartPayload>): Promise<void> {
		return this.runFor(p?.matchId, async () => {
			const ctx = this.roundContext(userId, socketId, p?.matchId, p?.round);
			if (!ctx || ctx.s.phase !== 'inspecting') return;
			const {match, side, r, s} = ctx;
			s.phase = 'solving';
			s.solveStartAt = this.now();
			this.clearTimer(match.id, `insp_${side}`);
			const insp = finiteOrNull(p.inspectionMs);
			s.clientInspectionMs = insp == null ? null : Math.max(0, Math.min(insp, 10 * 60 * 1000));
			this.sendOpponentState(match, r, side);
			await this.save(match);
		});
	}

	handleProgress(userId: string, socketId: string, p: Partial<ProgressPayload>): Promise<void> {
		return this.runFor(p?.matchId, async () => {
			const ctx = this.roundContext(userId, socketId, p?.matchId, p?.round);
			if (!ctx || (ctx.s.phase !== 'inspecting' && ctx.s.phase !== 'solving')) return;
			const {match, side, r, s} = ctx;
			const step = p.step as BattleProgressStep;
			const atMs = finiteOrNull(p.atMs);
			if (!BATTLE_PROGRESS_STEPS.includes(step) || atMs == null || atMs < 0) return;
			if (s.progress.some((x) => x.step === step)) return;
			if (s.phase === 'inspecting') {
				// solve_start got lost; the first phase event proves the solve is running.
				s.phase = 'solving';
				s.solveStartAt = this.now();
				this.clearTimer(match.id, `insp_${side}`);
			}
			s.progress.push({step, atMs});
			this.sendOpponentState(match, r, side);
		});
	}

	handleSolveDone(userId: string, socketId: string, p: Partial<SolveDonePayload>): Promise<void> {
		return this.runFor(p?.matchId, async () => {
			const ctx = this.roundContext(userId, socketId, p?.matchId, p?.round);
			if (!ctx || (ctx.s.phase !== 'inspecting' && ctx.s.phase !== 'solving')) return;
			const {match, side, r, s} = ctx;
			const moves = sanitizeMoves(p.moves);
			const clientPenalty: BattlePenalty | null = p.penalty === 'DNF' || p.penalty === 'PLUS_TWO' ? p.penalty : null;
			const source: BattleSolveSource = SOURCES.includes(p.source as BattleSolveSource)
				? (p.source as BattleSolveSource)
				: 'tracker';

			let result: SideResult;
			try {
				const v = verifySolve({
					scramble: r.scramble,
					moves,
					clientTimeMs: finiteOrNull(p.timeMs) ?? 0,
					clientPenalty,
					source,
					timeCorrectionMs: finiteOrNull(p.timeCorrectionMs) ?? 0,
					lastScrambleCubeTs: s.lastScrambleCubeTs,
					clientInspectionMs: s.clientInspectionMs,
					progress: s.progress,
					scrambleDoneServerAt: s.scrambleDoneAt,
					solveDoneServerAt: this.now(),
				});
				result = {
					timeMs: Math.round(v.timeMs),
					penalty: v.penalty,
					dnfReason: v.dnfReason,
					flags: v.flags,
					moves,
					inspectionMs: Math.round(v.inspectionMs),
				};
			} catch (e) {
				this.deps.log?.warn('[battle] solve verification threw', {matchId: match.id, error: (e as Error)?.message});
				result = {timeMs: null, penalty: 'DNF', dnfReason: 'replay_not_solved', flags: [], moves, inspectionMs: null};
			}

			this.finishSide(match, r, side, result);
			await this.maybeResolveRound(match);
			await this.save(match);
		});
	}

	handleGiveUp(userId: string, socketId: string, p: {matchId?: unknown} | null | undefined): Promise<void> {
		return this.runFor(p?.matchId, async () => {
			const match = this.matches.get(p?.matchId as string);
			if (!match || match.ended || match.decided) return;
			const side = this.sideOf(match, userId);
			if (!side || this.bySide(match, side).socketId !== socketId) return;
			// Before the first scramble showed: a cancel with a cooldown (design 4.6).
			if (!match.started) return this.cancel(match, [side], 'left_before_start');
			await this.finishMatch(match, 'FINISHED', 'FORFEIT', forfeitWinner(side));
		});
	}

	handleRematch(userId: string, socketId: string, p: Partial<RematchPayload>): Promise<void> {
		return this.runFor(p?.matchId, async () => {
			const match = this.matches.get(p?.matchId as string);
			if (!match || !match.ended || match.rematchDeadline == null || this.now() > match.rematchDeadline) return;
			const side = this.sideOf(match, userId);
			if (!side) return;
			const me = this.bySide(match, side);
			if (me.socketId !== socketId || me.rematch === 'left') return;

			if (p.accept === true) {
				me.rematch = true;
			} else {
				await this.markLeft(match, side);
			}
			this.sendRematchState(match);

			if (match.a.rematch === true && match.b.rematch === true) {
				const a: PairPlayerInput = {userId: match.a.userId, socketId: match.a.socketId, ip: match.a.ip};
				const b: PairPlayerInput = {userId: match.b.userId, socketId: match.b.socketId, ip: match.b.ip};
				await this.close(match);
				try {
					await this.createMatch(a, b, {isRematch: true});
				} catch (e) {
					// Both pressed rematch and got nothing: tell them so the screen can move on.
					this.deps.log?.error('[battle] rematch could not start', {matchId: match.id, error: (e as Error)?.message});
					this.deps.emitToSocket(a.socketId, BattleServerEvent.ERROR, {i18nKey: BATTLE_ERROR_KEYS.generic});
					this.deps.emitToSocket(b.socketId, BattleServerEvent.ERROR, {i18nKey: BATTLE_ERROR_KEYS.generic});
				}
				return;
			}
			if (match.a.rematch === 'left' && match.b.rematch === 'left') await this.close(match);
			else await this.save(match);
		});
	}

	/** The user leaves a finished match's rematch window (queue join, "New opponent"). */
	async leaveFinished(userId: string): Promise<void> {
		const match = this.matchForUser(userId);
		if (!match || !match.ended) return;
		await this.run(match.id, async () => {
			const side = this.sideOf(match, userId);
			if (!side || !this.matches.has(match.id)) return;
			if (this.bySide(match, side).rematch === 'left') return;
			await this.markLeft(match, side);
			this.sendRematchState(match);
			if (match.a.rematch === 'left' && match.b.rematch === 'left') await this.close(match);
		});
	}

	handleResume(userId: string, socketId: string, p: Partial<ResumePayload> | null | undefined): Promise<void> {
		const requested = typeof p?.matchId === 'string' && p.matchId ? p.matchId : null;
		const known = requested || this.userMatch.get(userId) || null;
		const work = async (matchId: string | null) => {
			if (!matchId) {
				const session = await getBattleSession(this.deps.store, userId);
				matchId = session?.kind === 'match' ? session.matchId || null : null;
			}
			const match = matchId ? this.matches.get(matchId) : undefined;
			const side = match ? this.sideOf(match, userId) : null;
			if (!matchId || !match || !side) {
				const reason: BattleCancelReason = (matchId && (await getMatchEndedReason(this.deps.store, matchId))) || 'not_found';
				const payload: CancelledPayload = matchId ? {matchId, reason} : {reason};
				this.deps.emitToSocket(socketId, BattleServerEvent.CANCELLED, payload);
				if (matchId) await clearBattleSession(this.deps.store, userId, {matchId});
				return;
			}

			const me = this.bySide(match, side);
			me.socketId = socketId;

			if (match.ended) {
				if (match.results && me.rematch !== 'left') {
					this.deps.emitToSocket(socketId, BattleServerEvent.MATCH_RESULT, match.results[side]);
					if (match.rematchDeadline != null && this.now() <= match.rematchDeadline) {
						this.deps.emitToSocket(socketId, BattleServerEvent.REMATCH_STATE, this.rematchStatePayload(match, side));
					}
				}
				return;
			}

			await setBattleSession(this.deps.store, userId, {kind: 'match', socketId, matchId: match.id, since: match.startedAt});
			if (!me.connected) {
				me.connected = true;
				me.graceUntil = null;
				me.absent = false;
				me.absentLostRound = null;
				this.clearTimer(match.id, `grace_${side}`);
				const payload: OpponentConnectionPayload = {matchId: match.id, connected: true};
				this.send(this.bySide(match, this.other(side)), BattleServerEvent.OPPONENT_CONNECTION, payload);
			}
			this.deps.emitToSocket(socketId, BattleServerEvent.MATCH_STATE, this.matchStatePayload(match, side));
			await this.save(match);
		};
		if (known && this.matches.has(known)) return this.run(known, () => work(known));
		return work(known).catch((e) => {
			this.deps.log?.error('[battle] resume failed', {error: (e as Error)?.message});
		});
	}

	/** A socket went away. Only the socket bound to the match counts. */
	handleDisconnect(userId: string, socketId: string): Promise<void> {
		const match = this.matchForUser(userId);
		if (!match) return Promise.resolve();
		return this.run(match.id, async () => {
			if (!this.matches.has(match.id)) return;
			const side = this.sideOf(match, userId);
			if (!side) return;
			const me = this.bySide(match, side);
			if (me.socketId !== socketId) return;

			if (match.ended) {
				if (match.rematchDeadline != null && me.rematch !== 'left') {
					await this.markLeft(match, side);
					this.sendRematchState(match);
					if (match.a.rematch === 'left' && match.b.rematch === 'left') await this.close(match);
				}
				return;
			}
			if (!me.connected) return;

			me.connected = false;
			me.graceUntil = this.now() + DISCONNECT_GRACE_SEC * 1000;
			const payload: OpponentConnectionPayload = {matchId: match.id, connected: false, graceUntil: me.graceUntil};
			this.send(this.bySide(match, this.other(side)), BattleServerEvent.OPPONENT_CONNECTION, payload);
			this.schedule(match, `grace_${side}`, me.graceUntil, (m) => this.onGraceExpired(m, side));
			await this.save(match);
		});
	}

	private async onGraceExpired(match: MatchState, side: BattleSide): Promise<void> {
		const me = this.bySide(match, side);
		if (match.ended || me.connected) return;
		const op = this.bySide(match, this.other(side));

		if (!match.started) {
			return this.cancel(match, op.connected ? [side] : [], op.connected ? 'left_before_start' : 'both_disconnected');
		}
		// Already decided: the result stands, the finish timer writes it.
		if (match.decided) return;
		if (!op.connected) {
			// Both gone: nobody wins, nothing is rated (design 4.6).
			return this.finishMatch(match, 'VOID', 'DISCONNECT', null);
		}

		me.absent = true;
		const r = match.current;
		if (r && !r.resolved) {
			const s = this.roundSide(r, side);
			me.absentLostRound = r.round;
			if (s.phase !== 'finished') {
				this.finishSide(match, r, side, {
					timeMs: null,
					penalty: 'DNF',
					dnfReason: 'disconnect',
					flags: [],
					moves: null,
					inspectionMs: null,
				});
				await this.maybeResolveRound(match);
			}
		} else {
			me.owesRound = true;
		}
		await this.save(match);
	}

	// ── Ending ──

	private runFor(matchId: unknown, fn: () => Promise<void>): Promise<void> {
		if (typeof matchId !== 'string' || !this.matches.has(matchId)) return Promise.resolve();
		return this.run(matchId, fn);
	}

	private async markLeft(match: MatchState, side: BattleSide): Promise<void> {
		const p = this.bySide(match, side);
		p.rematch = 'left';
		if (this.userMatch.get(p.userId) === match.id) this.userMatch.delete(p.userId);
		await clearBattleSession(this.deps.store, p.userId, {matchId: match.id});
	}

	private sendRematchState(match: MatchState): void {
		this.send(match.a, BattleServerEvent.REMATCH_STATE, this.rematchStatePayload(match, 'A'));
		this.send(match.b, BattleServerEvent.REMATCH_STATE, this.rematchStatePayload(match, 'B'));
	}

	/**
	 * Ends a match before its first scramble was shown: unrated, not written (there is
	 * nothing to keep), the leavers get a queue cooldown.
	 */
	private async cancel(match: MatchState, leavers: BattleSide[], reason: BattleCancelReason): Promise<void> {
		if (match.ended) return;
		match.ended = {status: 'VOID', endReason: 'ABANDON', winner: null};
		this.clearTimers(match.id);
		for (const side of leavers) {
			try {
				await recordAbandon(this.deps.store, this.bySide(match, side).userId);
			} catch (e) {
				// The cooldown is lost, the cancel itself must still reach both players.
				this.deps.log?.warn('[battle] abandon cooldown write failed', {matchId: match.id, error: (e as Error)?.message});
			}
		}
		const payload: CancelledPayload = {matchId: match.id, reason};
		this.send(match.a, BattleServerEvent.CANCELLED, payload);
		this.send(match.b, BattleServerEvent.CANCELLED, payload);
		await markMatchEnded(this.deps.store, match.id, reason).catch((e) => {
			this.deps.log?.warn('[battle] tombstone write failed', {matchId: match.id, error: (e as Error)?.message});
		});
		await this.close(match);
	}

	private toPersistInput(match: MatchState, status: BattleMatchStatus, endReason: BattleEndReason, winner: BattleWinner | null): PersistMatchInput {
		return {
			id: match.id,
			puzzle: match.puzzle,
			status,
			endReason,
			rated: match.rated && status === 'FINISHED',
			isRematch: match.isRematch,
			a: {userId: match.a.userId, prepared: match.a.prepared},
			b: {userId: match.b.userId, prepared: match.b.prepared},
			winner,
			rounds: match.rounds.map((r) => ({
				index: r.round,
				scramble: r.scramble,
				winner: r.winner,
				a: {timeMs: r.a.timeMs, penalty: r.a.penalty, moves: r.a.moves, flags: r.a.flags},
				b: {timeMs: r.b.timeMs, penalty: r.b.penalty, moves: r.b.moves, flags: r.b.flags},
			})),
			flags: match.flags,
			startedAt: new Date(match.startedAt),
			endedAt: new Date(this.now()),
		};
	}

	/**
	 * Writes the match, tells both players and opens the rematch window. A VOID match
	 * (both disconnected) is written unrated and the players get a cancel.
	 */
	private async finishMatch(
		match: MatchState,
		status: BattleMatchStatus,
		endReason: BattleEndReason,
		winner: BattleWinner | null
	): Promise<void> {
		if (match.ended) return;
		match.ended = {status, endReason, winner};
		match.decided = null;
		this.clearTimers(match.id);

		let persisted: PersistMatchResult | null = null;
		try {
			persisted = await this.deps.persistMatch(this.toPersistInput(match, status, endReason, winner));
		} catch (e) {
			this.deps.log?.error('[battle] match could not be written', {matchId: match.id, error: (e as Error)?.message});
		}

		const now = this.now();
		// Redis bookkeeping must not keep the result from the players: a failed write here
		// would leave both screens on the last round with the match already written.
		try {
			await Promise.all([
				setRecentOpponent(this.deps.store, match.a.userId, match.b.userId, now),
				setRecentOpponent(this.deps.store, match.b.userId, match.a.userId, now),
			]);
		} catch (e) {
			this.deps.log?.warn('[battle] recent opponent write failed', {matchId: match.id, error: (e as Error)?.message});
		}

		if (status === 'VOID') {
			const reason: BattleCancelReason = endReason === 'SERVER_RESTART' ? 'server_restart' : 'both_disconnected';
			const payload: CancelledPayload = {matchId: match.id, reason};
			this.send(match.a, BattleServerEvent.CANCELLED, payload);
			this.send(match.b, BattleServerEvent.CANCELLED, payload);
			await markMatchEnded(this.deps.store, match.id, reason).catch((e) => {
				this.deps.log?.warn('[battle] tombstone write failed', {matchId: match.id, error: (e as Error)?.message});
			});
			await this.close(match);
			return;
		}

		const rounds = this.roundResults(match);
		const resultFor = (side: BattleSide): MatchResultPayload => {
			const p = this.bySide(match, side);
			const res = persisted ? (side === 'A' ? persisted.a : persisted.b) : null;
			const rated = !!persisted?.rated;
			return {
				matchId: match.id,
				winner: winner || 'DRAW',
				endReason,
				rated,
				ratingBefore: rated && res ? res.ratingBefore : null,
				ratingAfter: rated && res ? res.ratingAfter : null,
				delta: rated && res ? res.delta : null,
				provisional: res ? res.provisional : isProvisional(p.prepared.rd),
				games: res ? res.games : p.games,
				rounds,
			};
		};
		match.results = {A: resultFor('A'), B: resultFor('B')};
		this.send(match.a, BattleServerEvent.MATCH_RESULT, match.results.A);
		this.send(match.b, BattleServerEvent.MATCH_RESULT, match.results.B);

		// Rematch window (design 4.5): rated while the pair is under its daily limit.
		let pairCount = 0;
		try {
			pairCount = await this.deps.countPairRatedMatches(match.a.userId, match.b.userId, new Date(now - DAY_MS));
		} catch (e) {
			this.deps.log?.warn('[battle] pair count failed', {error: (e as Error)?.message});
		}
		match.rematchRated = isPairRated(pairCount);
		match.rematchDeadline = now + REMATCH_WINDOW_SEC * 1000;
		for (const side of ['A', 'B'] as BattleSide[]) {
			const p = this.bySide(match, side);
			if (!p.connected || p.absent) await this.markLeft(match, side);
		}
		this.sendRematchState(match);
		if (match.a.rematch === 'left' && match.b.rematch === 'left') {
			await this.close(match);
		} else {
			this.schedule(match, 'rematch', match.rematchDeadline, (m) => this.close(m));
			await this.save(match);
		}

		if (persisted) this.track(this.runHistoryCheck(match, persisted.matchId));
	}

	/** Drops the match from memory and Redis; sessions that still point at it go too. */
	private async close(match: MatchState): Promise<void> {
		this.clearTimers(match.id);
		this.matches.delete(match.id);
		for (const p of [match.a, match.b]) {
			if (this.userMatch.get(p.userId) === match.id) this.userMatch.delete(p.userId);
			await clearBattleSession(this.deps.store, p.userId, {matchId: match.id});
		}
		await this.deps.store.del(matchKey(match.id));
	}

	/** Check 9, once per player after the match; the result never waits for it. */
	private async runHistoryCheck(match: MatchState, matchId: string): Promise<void> {
		const add: {match: BattleFlag[]; rounds: Array<{index: number; side: BattleSide; flags: BattleFlag[]}>} = {
			match: [],
			rounds: [],
		};
		for (const side of ['A', 'B'] as BattleSide[]) {
			const p = this.bySide(match, side);
			const solves = match.rounds
				.map((r) => ({round: r.round, res: side === 'A' ? r.a : r.b}))
				.filter((x) => x.res.penalty !== 'DNF' && x.res.timeMs != null)
				.map((x) => ({round: x.round, timeMs: x.res.timeMs as number}));
			if (!solves.length) continue;
			let history: number[] = [];
			try {
				history = await this.deps.loadSolveHistoryMs(p.userId);
			} catch (e) {
				this.deps.log?.warn('[battle] history check read failed', {matchId, error: (e as Error)?.message});
				continue;
			}
			const res = historyCheck(history, solves);
			for (const round of res.rounds) add.rounds.push({index: round, side, flags: ['beats_own_history']});
			if (res.match && !add.match.length) add.match.push('beats_own_history');
		}
		if (!add.match.length && !add.rounds.length) return;
		try {
			await this.deps.appendBattleFlags(matchId, add);
		} catch (e) {
			this.deps.log?.warn('[battle] history flags write failed', {matchId, error: (e as Error)?.message});
		}
	}
}

// ── Startup ──────────────────────────────────────────────────────────────────

/**
 * After a restart (deploy) the matches of the previous process have no timers and no
 * sockets. Each one is written VOID (SERVER_RESTART, unrated) with the rounds it had,
 * a tombstone tells a reconnecting client why, and the snapshot is deleted (design 4.6).
 * Runs before the matcher starts. Assumes one process (design 4.8).
 */
export async function voidInterruptedMatches(
	store: BattleStore,
	persistMatch: (input: PersistMatchInput) => Promise<PersistMatchResult>,
	now: number,
	log?: BattleLogger
): Promise<number> {
	const keys = await store.scanKeys(battleKeyPattern(RedisNamespace.BATTLE_MATCH));
	let voided = 0;
	for (const key of keys) {
		const raw = await store.get(key);
		await store.del(key);
		if (!raw) continue;
		let match: MatchState;
		try {
			match = JSON.parse(raw);
		} catch {
			continue;
		}
		if (!match?.id || !match.a?.userId || !match.b?.userId || match.ended) continue;
		try {
			await persistMatch({
				id: match.id,
				puzzle: match.puzzle || BATTLE_PUZZLE,
				status: 'VOID',
				endReason: 'SERVER_RESTART',
				rated: false,
				isRematch: !!match.isRematch,
				a: {userId: match.a.userId, prepared: match.a.prepared},
				b: {userId: match.b.userId, prepared: match.b.prepared},
				winner: null,
				rounds: (match.rounds || []).map((r) => ({
					index: r.round,
					scramble: r.scramble,
					winner: r.winner,
					a: {timeMs: r.a.timeMs, penalty: r.a.penalty, moves: r.a.moves, flags: r.a.flags},
					b: {timeMs: r.b.timeMs, penalty: r.b.penalty, moves: r.b.moves, flags: r.b.flags},
				})),
				flags: match.flags || [],
				startedAt: new Date(match.startedAt || now),
				endedAt: new Date(now),
			});
		} catch (e) {
			log?.warn('[battle] could not write an interrupted match', {matchId: match.id, error: (e as Error)?.message});
		}
		await markMatchEnded(store, match.id, 'server_restart');
		voided++;
	}
	return voided;
}
