/**
 * Online Battle duel invites (owner decision 2026-10-20).
 *
 * A player opens an invite with their cube connected and waits on it: a link anyone signed
 * in may accept (/duel/<code>), or a challenge sent from a profile that only its addressee
 * may accept (they get an in-app and a push notification). Whoever accepts goes through the
 * same entry checks as the queue (checkBattleEntry); the server then starts the duel through
 * the match manager in mode 'challenge': same format, never rated, outside the pair limit.
 *
 * An invite is used once and lives CHALLENGE_TTL_SEC. It dies when the inviter cancels,
 * leaves the page, or their socket stays away longer than CHALLENGE_HOST_GRACE_SEC (a
 * reconnect takes it back with CHALLENGE_RESUME). The row in battle_challenge is the record
 * and the single use claim (PENDING -> ACCEPTED in one conditional update); who is waiting
 * on which socket lives in this process, like the matches (design 4.8, one process). After a
 * restart every PENDING row is cancelled: its inviter's socket belonged to the old process.
 *
 * Abuse limits: CHALLENGE_CREATE_LIMIT_PER_HOUR invites per user, and a profile challenge
 * the addressee did not accept blocks the next one to the same person for
 * CHALLENGE_TARGET_COOLDOWN_SEC, at most CHALLENGE_TARGET_DAILY_LIMIT a day.
 */

import {
	CHALLENGE_CREATE_LIMIT_PER_HOUR,
	CHALLENGE_HOST_GRACE_SEC,
	CHALLENGE_TARGET_COOLDOWN_SEC,
	CHALLENGE_TARGET_DAILY_LIMIT,
	CHALLENGE_TTL_SEC,
} from '../../shared/battle/config';
import {challengeStatusAt, isChallengeCode} from '../../shared/battle/challenge';
import {
	BATTLE_ERROR_KEYS,
	BattleServerEvent,
	ChallengeAcceptPayload,
	ChallengeCodePayload,
	ChallengeCreatePayload,
	ChallengeStatePayload,
} from '../../shared/battle/events';
import {BattleChallengeStatus} from '../../shared/battle/types';
import {BattleClock, BattleStore, TimerHandle} from './store';
import {clearBattleSession, setBattleSession} from './session';
import {BattleEntryDeps, checkBattleEntry, getQueueEntry} from './queue';
import type {BattleLogger, CreateMatchOptions, PairPlayerInput} from './match_manager';

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const USERNAME_MAX = 64;

// ── Dependencies ─────────────────────────────────────────────────────────────

export interface ChallengeRow {
	id: string;
	code: string;
	from_user_id: string;
	to_user_id: string | null;
	status: string;
	expires_at: Date;
	created_at: Date;
}

export interface ChallengeTarget {
	id: string;
	username: string;
	admin: boolean;
	banned: boolean;
}

/** battle_challenge reads and writes (server/models/battle_challenge.ts; a memory one in tests). */
export interface ChallengeRepo {
	create(data: {code: string; fromUserId: string; toUserId: string | null; expiresAt: Date}): Promise<ChallengeRow>;
	findByCode(code: string): Promise<ChallengeRow | null>;
	/** PENDING and unexpired at `now` -> ACCEPTED by `userId`. True only for the call that won. */
	claim(id: string, userId: string, now: Date): Promise<boolean>;
	/** ACCEPTED -> PENDING, when the match could not be started after the claim. */
	release(id: string): Promise<void>;
	setMatch(id: string, matchId: string): Promise<void>;
	/** PENDING -> EXPIRED / CANCELLED. */
	close(id: string, status: 'EXPIRED' | 'CANCELLED'): Promise<void>;
	/** Startup: every PENDING row's inviter belonged to the previous process. */
	cancelAllPending(): Promise<number>;
	/** created_at of the user's invites since `since`, oldest first. */
	createdSince(fromUserId: string, since: Date): Promise<Date[]>;
	/** created_at of profile challenges from -> to since `since` that were not accepted, newest first. */
	unansweredToTarget(fromUserId: string, toUserId: string, since: Date): Promise<Date[]>;
	findUserByUsername(username: string): Promise<ChallengeTarget | null>;
	/** Either of the two blocked the other (direct messages' block list). */
	isBlockedEither(userIdA: string, userIdB: string): Promise<boolean>;
}

export interface ChallengeManagerDeps {
	store: BattleStore;
	clock: BattleClock;
	emitToSocket(socketId: string, event: string, payload: unknown): void;
	newCode(): string;
	repo: ChallengeRepo;
	/** The queue's entry checks, applied to both the inviter and whoever accepts. */
	entry: BattleEntryDeps;
	createMatch(a: PairPlayerInput, b: PairPlayerInput, opts: CreateMatchOptions): Promise<{id: string}>;
	/** In-app + push to a profile challenge's addressee; checks their opt-out itself. */
	notifyTarget?(input: {code: string; fromUserId: string; toUserId: string}): Promise<void>;
	log?: BattleLogger;
}

// ── State ────────────────────────────────────────────────────────────────────

export interface HostedChallenge {
	id: string;
	code: string;
	userId: string;
	/** Null while the inviter's socket is away (grace running). */
	socketId: string | null;
	ip: string | null;
	to: {id: string; username: string} | null;
	expiresAt: number;
	createdAt: number;
}

function minutesUntil(ms: number): number {
	return Math.max(1, Math.ceil(ms / 60000));
}

// ── Manager ──────────────────────────────────────────────────────────────────

export class BattleChallengeManager {
	private byCode = new Map<string, HostedChallenge>();
	/** userId -> code of the invite the user waits on. */
	private byUser = new Map<string, string>();
	private timers = new Map<string, Map<string, TimerHandle>>();
	private chains = new Map<string, Promise<void>>();
	private background = new Set<Promise<void>>();

	constructor(private deps: ChallengeManagerDeps) {}

	// ── Lookups ──

	/** The invite the user has open (the queue refuses while there is one). */
	hostedCode(userId: string): string | null {
		return this.byUser.get(userId) ?? null;
	}

	getHosted(code: string): HostedChallenge | undefined {
		return this.byCode.get(code);
	}

	async idle(): Promise<void> {
		for (let i = 0; i < 10; i++) {
			const pending = [...this.chains.values(), ...this.background];
			if (!pending.length) return;
			await Promise.all(pending.map((p) => p.catch((): void => undefined)));
		}
	}

	stop(): void {
		for (const code of Array.from(this.timers.keys())) this.clearTimers(code);
	}

	// ── Plumbing ──

	private now(): number {
		return this.deps.clock.now();
	}

	/** Every change of one invite runs in order: accept, cancel, expiry and reconnect never interleave. */
	private run(key: string, fn: () => Promise<void> | void): Promise<void> {
		const prev = this.chains.get(key) || Promise.resolve();
		const next = prev
			.then(() => fn())
			.catch((e) => {
				this.deps.log?.error('[battle] challenge step failed', {key, error: (e as Error)?.message});
			});
		this.chains.set(key, next);
		void next.then(() => {
			if (this.chains.get(key) === next) this.chains.delete(key);
		});
		return next;
	}

	private track(p: Promise<void>): void {
		this.background.add(p);
		void p.finally(() => this.background.delete(p));
	}

	private schedule(code: string, name: string, at: number, fn: () => Promise<void> | void): void {
		let map = this.timers.get(code);
		if (!map) {
			map = new Map();
			this.timers.set(code, map);
		}
		const existing = map.get(name);
		if (existing) this.deps.clock.clearTimeout(existing);
		const handle = this.deps.clock.setTimeout(() => {
			this.timers.get(code)?.delete(name);
			void this.run(`code:${code}`, fn);
		}, Math.max(0, at - this.now()));
		map.set(name, handle);
	}

	private clearTimer(code: string, name: string): void {
		const map = this.timers.get(code);
		const h = map?.get(name);
		if (h) {
			this.deps.clock.clearTimeout(h);
			map?.delete(name);
		}
	}

	private clearTimers(code: string): void {
		const map = this.timers.get(code);
		if (map) for (const h of map.values()) this.deps.clock.clearTimeout(h);
		this.timers.delete(code);
	}

	private error(socketId: string, i18nKey: string, params?: Record<string, string | number>): void {
		this.deps.emitToSocket(socketId, BattleServerEvent.ERROR, params ? {i18nKey, params} : {i18nKey});
	}

	private statePayload(host: HostedChallenge, status: BattleChallengeStatus): ChallengeStatePayload {
		return {code: host.code, status, expiresAt: host.expiresAt, to: host.to};
	}

	private register(host: HostedChallenge): void {
		this.byCode.set(host.code, host);
		this.byUser.set(host.userId, host.code);
		this.schedule(host.code, 'expire', host.expiresAt, () => this.onExpire(host.code));
	}

	/** Drops an invite from memory: timers, maps. The DB row and the session are the caller's. */
	private forget(host: HostedChallenge): void {
		this.clearTimers(host.code);
		if (this.byCode.get(host.code) === host) this.byCode.delete(host.code);
		if (this.byUser.get(host.userId) === host.code) this.byUser.delete(host.userId);
	}

	/** Ends a waiting invite: the row, the session and the inviter's screen. */
	private async close(host: HostedChallenge, status: 'EXPIRED' | 'CANCELLED', notify: boolean = true): Promise<void> {
		this.forget(host);
		try {
			await this.deps.repo.close(host.id, status);
		} catch (e) {
			this.deps.log?.warn('[battle] challenge close write failed', {code: host.code, error: (e as Error)?.message});
		}
		await clearBattleSession(this.deps.store, host.userId, {kind: 'challenge', code: host.code}).catch((): void => undefined);
		if (notify && host.socketId) {
			this.deps.emitToSocket(host.socketId, BattleServerEvent.CHALLENGE_STATE, this.statePayload(host, status));
		}
	}

	/** Ends the invite a user waits on, if any (a new invite, or they accepted someone else's). */
	private async closeHostedBy(userId: string, notify: boolean): Promise<void> {
		const code = this.byUser.get(userId);
		if (!code) return;
		await this.run(`code:${code}`, async () => {
			const host = this.byCode.get(code);
			if (host && host.userId === userId) await this.close(host, 'CANCELLED', notify);
		});
	}

	// ── Creating ──

	/** Opens an invite for the user on this socket, or sends battle:error. */
	create(userId: string, socketId: string, ip: string | null, p: Partial<ChallengeCreatePayload> | null | undefined): Promise<void> {
		return this.run(`user:${userId}`, async () => {
			const payload = p || {};
			const refused = await checkBattleEntry(this.deps.entry, {userId, puzzle: payload.puzzle, cube: payload.cube});
			if (refused) {
				this.deps.emitToSocket(socketId, BattleServerEvent.ERROR, refused);
				return;
			}
			if (await getQueueEntry(this.deps.store, userId)) return this.error(socketId, BATTLE_ERROR_KEYS.inQueue);

			const now = this.now();
			const recent = await this.deps.repo.createdSince(userId, new Date(now - HOUR_MS));
			if (recent.length >= CHALLENGE_CREATE_LIMIT_PER_HOUR) {
				const oldest = new Date(recent[0]).getTime();
				return this.error(socketId, BATTLE_ERROR_KEYS.challengeLimit, {minutes: minutesUntil(oldest + HOUR_MS - now)});
			}

			let to: HostedChallenge['to'] = null;
			if (payload.toUsername != null) {
				const name = String(payload.toUsername).trim().slice(0, USERNAME_MAX);
				const target = name ? await this.deps.repo.findUserByUsername(name) : null;
				if (target && target.id === userId) return this.error(socketId, BATTLE_ERROR_KEYS.challengeSelf);
				// One answer for "no such user", banned, blocked and "cannot play yet": none of
				// them is the inviter's business.
				const config = target ? await this.deps.entry.getSiteConfig() : null;
				if (
					!target ||
					target.banned ||
					!this.deps.entry.isOnlineBattleOpen(config, {id: target.id, admin: target.admin}) ||
					(await this.deps.repo.isBlockedEither(userId, target.id))
				) {
					return this.error(socketId, BATTLE_ERROR_KEYS.challengeTargetNotFound);
				}
				const unanswered = await this.deps.repo.unansweredToTarget(userId, target.id, new Date(now - DAY_MS));
				if (unanswered.length >= CHALLENGE_TARGET_DAILY_LIMIT) {
					return this.error(socketId, BATTLE_ERROR_KEYS.challengeTargetLimit);
				}
				const last = unanswered.length ? new Date(unanswered[0]).getTime() : null;
				if (last != null && now - last < CHALLENGE_TARGET_COOLDOWN_SEC * 1000) {
					return this.error(socketId, BATTLE_ERROR_KEYS.challengeTargetCooldown, {
						minutes: minutesUntil(last + CHALLENGE_TARGET_COOLDOWN_SEC * 1000 - now),
					});
				}
				to = {id: target.id, username: target.username};
			}

			// A new invite replaces the one the user had open (another tab, a second try).
			await this.closeHostedBy(userId, false);

			const code = this.deps.newCode();
			const expiresAt = now + CHALLENGE_TTL_SEC * 1000;
			const row = await this.deps.repo.create({code, fromUserId: userId, toUserId: to?.id ?? null, expiresAt: new Date(expiresAt)});
			const host: HostedChallenge = {id: row.id, code, userId, socketId, ip, to, expiresAt, createdAt: now};
			this.register(host);
			try {
				await setBattleSession(this.deps.store, userId, {kind: 'challenge', socketId, code, since: now});
			} catch (e) {
				// Without the session the queue could not see the invite; it is not opened.
				await this.close(host, 'CANCELLED', false);
				throw e;
			}
			this.deps.emitToSocket(socketId, BattleServerEvent.CHALLENGE_STATE, this.statePayload(host, 'PENDING'));

			if (to && this.deps.notifyTarget) {
				const notify = this.deps.notifyTarget({code, fromUserId: userId, toUserId: to.id}).catch((e) => {
					this.deps.log?.warn('[battle] challenge notification failed', {code, error: (e as Error)?.message});
				});
				this.track(notify);
			}
		});
	}

	// ── The inviter ──

	cancel(userId: string, p: Partial<ChallengeCodePayload> | null | undefined): Promise<void> {
		const code = p?.code;
		if (!isChallengeCode(code)) return Promise.resolve();
		return this.run(`code:${code}`, async () => {
			const host = this.byCode.get(code);
			if (!host || host.userId !== userId) return;
			await this.close(host, 'CANCELLED');
		});
	}

	/** The inviter's new socket after a reconnect. Answers with the invite's state either way. */
	resume(userId: string, socketId: string, p: Partial<ChallengeCodePayload> | null | undefined): Promise<void> {
		const code = p?.code;
		if (!isChallengeCode(code)) return Promise.resolve();
		return this.run(`code:${code}`, async () => {
			const host = this.byCode.get(code);
			if (host && host.userId === userId) {
				host.socketId = socketId;
				this.clearTimer(code, 'grace');
				await setBattleSession(this.deps.store, userId, {kind: 'challenge', socketId, code, since: host.createdAt});
				this.deps.emitToSocket(socketId, BattleServerEvent.CHALLENGE_STATE, this.statePayload(host, 'PENDING'));
				return;
			}
			// Gone from memory: tell the screen how it ended (an accepted one is a running match,
			// which the client's own RESUME brings back).
			const row = await this.deps.repo.findByCode(code);
			if (!row || row.from_user_id !== userId) return;
			const status = challengeStatusAt(row, this.now());
			const payload: ChallengeStatePayload = {
				code,
				status: status === 'PENDING' ? 'CANCELLED' : status,
				expiresAt: new Date(row.expires_at).getTime(),
				to: null,
			};
			this.deps.emitToSocket(socketId, BattleServerEvent.CHALLENGE_STATE, payload);
		});
	}

	/** A socket went away. Only the inviter's bound socket counts; it has the grace to come back. */
	handleDisconnect(userId: string, socketId: string): Promise<void> {
		const code = this.byUser.get(userId);
		if (!code) return Promise.resolve();
		return this.run(`code:${code}`, async () => {
			const host = this.byCode.get(code);
			if (!host || host.userId !== userId || host.socketId !== socketId) return;
			host.socketId = null;
			this.schedule(code, 'grace', this.now() + CHALLENGE_HOST_GRACE_SEC * 1000, async () => {
				const h = this.byCode.get(code);
				if (h && !h.socketId) await this.close(h, 'CANCELLED', false);
			});
		});
	}

	private async onExpire(code: string): Promise<void> {
		const host = this.byCode.get(code);
		if (host) await this.close(host, 'EXPIRED');
	}

	// ── Accepting ──

	accept(userId: string, socketId: string, ip: string | null, p: Partial<ChallengeAcceptPayload> | null | undefined): Promise<void> {
		const code = p?.code;
		if (!isChallengeCode(code)) {
			this.error(socketId, BATTLE_ERROR_KEYS.challengeNotFound);
			return Promise.resolve();
		}
		return this.run(`code:${code}`, async () => {
			const row = await this.deps.repo.findByCode(code);
			if (!row) return this.error(socketId, BATTLE_ERROR_KEYS.challengeNotFound);
			if (row.from_user_id === userId) return this.error(socketId, BATTLE_ERROR_KEYS.challengeOwn);

			const now = this.now();
			const status = challengeStatusAt(row, now);
			if (status === 'ACCEPTED') return this.error(socketId, BATTLE_ERROR_KEYS.challengeUsed);
			if (status === 'EXPIRED') return this.error(socketId, BATTLE_ERROR_KEYS.challengeExpired);
			if (status === 'CANCELLED') return this.error(socketId, BATTLE_ERROR_KEYS.challengeCancelled);
			if (row.to_user_id && row.to_user_id !== userId) return this.error(socketId, BATTLE_ERROR_KEYS.challengeNotForYou);
			if (await this.deps.repo.isBlockedEither(row.from_user_id, userId)) {
				return this.error(socketId, BATTLE_ERROR_KEYS.challengeNotFound);
			}

			const refused = await checkBattleEntry(this.deps.entry, {userId, puzzle: p?.puzzle, cube: p?.cube});
			if (refused) {
				this.deps.emitToSocket(socketId, BattleServerEvent.ERROR, refused);
				return;
			}
			if (await getQueueEntry(this.deps.store, userId)) return this.error(socketId, BATTLE_ERROR_KEYS.inQueue);

			const host = this.byCode.get(code);
			if (!host) {
				// PENDING in the database but nobody waits on it in this process.
				await this.deps.repo.close(row.id, 'CANCELLED').catch((): void => undefined);
				return this.error(socketId, BATTLE_ERROR_KEYS.challengeCancelled);
			}
			if (!host.socketId) return this.error(socketId, BATTLE_ERROR_KEYS.challengeHostAway);

			if (!(await this.deps.repo.claim(row.id, userId, new Date(now)))) {
				return this.error(socketId, BATTLE_ERROR_KEYS.challengeUsed);
			}

			// The accepting player's own invite (another tab) ends: they are going into a match.
			await this.closeHostedBy(userId, true);
			this.forget(host);

			try {
				const match = await this.deps.createMatch(
					{userId: host.userId, socketId: host.socketId, ip: host.ip},
					{userId, socketId, ip},
					{mode: 'challenge'}
				);
				await this.deps.repo.setMatch(row.id, match.id).catch((e) => {
					this.deps.log?.warn('[battle] challenge match id write failed', {code, error: (e as Error)?.message});
				});
			} catch (e) {
				// The duel did not start: the invite is open again and the inviter keeps waiting.
				this.deps.log?.error('[battle] duel could not start', {code, error: (e as Error)?.message});
				await this.deps.repo.release(row.id).catch((): void => undefined);
				if (this.now() < host.expiresAt) {
					this.register(host);
					await setBattleSession(this.deps.store, host.userId, {
						kind: 'challenge',
						socketId: host.socketId as string,
						code,
						since: host.createdAt,
					}).catch((): void => undefined);
					this.deps.emitToSocket(host.socketId as string, BattleServerEvent.CHALLENGE_STATE, this.statePayload(host, 'PENDING'));
				}
				this.error(socketId, BATTLE_ERROR_KEYS.generic);
			}
		});
	}
}

/** Startup: invites of the previous process have no inviter waiting any more. */
export async function cancelStaleChallenges(repo: ChallengeRepo, log?: BattleLogger): Promise<number> {
	try {
		return await repo.cancelAllPending();
	} catch (e) {
		log?.warn('[battle] stale challenge cleanup failed', {error: (e as Error)?.message});
		return 0;
	}
}
