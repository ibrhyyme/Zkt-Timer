/**
 * Online Battle Socket.IO listeners and production wiring (design ranking-battle.md 4.11).
 *
 * `listenForBattleEvents(client)` sits next to listenForFriendlyRoomEvents in
 * server/services/socket.ts; `initBattleRealtime()` runs once when the socket server starts
 * (startup cleanup, then the matcher loop).
 *
 * Every event needs a logged-in socket and is rate limited per user under `battle:` keys.
 * Payloads to clients are built by hand in match_manager.ts / matcher.ts; no Prisma row
 * ever goes through a socket.
 */

import {Socket} from 'socket.io';
import {randomUUID} from 'crypto';
import {getSocketIO} from '../services/socket';
import {getUserFromClient} from '../services/socket_util';
import {checkRateLimit} from '../services/rate_limit';
import {logger} from '../services/logger';
import {getPrisma} from '../database';
import {getSiteConfig} from '../models/site_config';
import {
	appendBattleFlags,
	countPairRatedMatches,
	createBattleReport,
	getStoredBattleRating,
	isOnlineBattleOpen,
	persistMatch,
} from '../models/battle';
import {BATTLE_PUZZLE, HISTORY_SAMPLE_SIZE} from '../../shared/battle/config';
import {BATTLE_ERROR_KEYS, BattleClientEvent, BattleServerEvent, SearchingCountAck, TimeSyncAck} from '../../shared/battle/events';
import {generateScramble} from '../../shared/scramble/registry';
import '../../shared/scramble/generators/scramble-333';
import {getStorageURL} from '../../client/util/storage';
import {BattleStore, createRedisBattleStore, realClock} from './store';
import {clearAllBattleSessions, clearBattleSession} from './session';
import {
	clearQueue,
	confirmStillHere,
	countSearching,
	getQueueEntry,
	joinQueue,
	JoinQueueDeps,
	removeFromQueue,
} from './queue';
import {BattleMatcher} from './matcher';
import {BattleMatchManager, voidInterruptedMatches} from './match_manager';

// ── Runtime (one per process) ────────────────────────────────────────────────

interface BattleRuntime {
	store: BattleStore;
	manager: BattleMatchManager;
	matcher: BattleMatcher;
	joinDeps: JoinQueueDeps;
}

let runtime: BattleRuntime | null = null;

function emitToSocket(socketId: string, event: string, payload: unknown): void {
	const io = getSocketIO();
	if (io) io.to(socketId).emit(event, payload);
}

async function loadSolveHistoryMs(userId: string): Promise<number[]> {
	const rows = await getPrisma().solve.findMany({
		where: {user_id: userId, is_smart_cube: true, cube_type: BATTLE_PUZZLE, dnf: false},
		orderBy: {created_at: 'desc'},
		take: HISTORY_SAMPLE_SIZE,
		select: {time: true},
	});
	// solve.time is in seconds.
	return rows.map((r) => Math.round(r.time * 1000)).filter((t) => t > 0);
}

function getRuntime(): BattleRuntime {
	if (runtime) return runtime;
	const store = createRedisBattleStore();
	const clock = realClock;

	const manager = new BattleMatchManager({
		store,
		clock,
		emitToSocket,
		generateScramble: () => generateScramble(BATTLE_PUZZLE).replace(/\s+/g, ' ').trim(),
		newId: () => randomUUID(),
		loadProfile: async (userId) => {
			const user = await getPrisma().userAccount.findUnique({
				where: {id: userId},
				select: {username: true, profile: {select: {pfp_image: {select: {storage_path: true}}}}},
			});
			if (!user) return null;
			const path = user.profile?.pfp_image?.storage_path;
			return {username: user.username || '', avatar: path ? getStorageURL(path) : null};
		},
		getStoredRating: (userId) => getStoredBattleRating(userId, BATTLE_PUZZLE),
		countPairRatedMatches,
		persistMatch,
		appendBattleFlags,
		loadSolveHistoryMs,
		log: logger,
	});

	const matcher = new BattleMatcher({
		store,
		clock,
		isSocketAlive: async (socketId) => {
			const io = getSocketIO();
			if (!io) return false;
			const sockets = await io.in(socketId).fetchSockets();
			return sockets.length > 0;
		},
		emitToSocket,
		onPair: async (a, b) => {
			try {
				await manager.createMatch(
					{userId: a.userId, socketId: a.socketId, ip: a.ip},
					{userId: b.userId, socketId: b.socketId, ip: b.ip}
				);
			} catch (e) {
				// Both were taken out of the queue; tell them so their screen can search again.
				for (const entry of [a, b]) {
					emitToSocket(entry.socketId, BattleServerEvent.ERROR, {i18nKey: BATTLE_ERROR_KEYS.generic});
					await clearBattleSession(store, entry.userId, {kind: 'queue'});
				}
				throw e;
			}
		},
		log: logger,
	});

	const joinDeps: JoinQueueDeps = {
		store,
		now: () => clock.now(),
		getSiteConfig: async () => getSiteConfig(),
		isOnlineBattleOpen,
		loadEligibility: async (userId) =>
			getPrisma().userAccount.findUnique({
				where: {id: userId},
				select: {admin: true, email_verified: true, banned_forever: true, banned_until: true},
			}),
		getStoredRating: (userId) => getStoredBattleRating(userId, BATTLE_PUZZLE),
		matches: manager,
	};

	runtime = {store, manager, matcher, joinDeps};
	return runtime;
}

/**
 * Startup (design 4.6): queued sockets and sessions belong to the previous process, its
 * running matches are written VOID. Then the matcher loop starts. One process assumed
 * (design 4.8).
 */
export async function initBattleRealtime(): Promise<void> {
	const rt = getRuntime();
	try {
		await clearQueue(rt.store, BATTLE_PUZZLE);
		const sessions = await clearAllBattleSessions(rt.store);
		const voided = await voidInterruptedMatches(rt.store, persistMatch, Date.now(), logger);
		if (sessions || voided) logger.info('[battle] startup cleanup', {sessions, voided});
	} catch (e) {
		logger.error('[battle] startup cleanup failed', {error: (e as Error)?.message});
	}
	rt.matcher.start();
}

// ── Listeners ────────────────────────────────────────────────────────────────

type Ack = (res: unknown) => void;

interface EventRule {
	max: number;
	windowSec: number;
	/** In-match events keep working through a short Redis hiccup; the match state gates them anyway. */
	failOpen?: boolean;
	/** Tell the client when it is throttled (otherwise the event is dropped quietly). */
	reportLimit?: boolean;
	/** Allowed without a login (the landing card's searching count). */
	anonymous?: boolean;
}

const RULES: Record<BattleClientEvent, EventRule> = {
	[BattleClientEvent.QUEUE_JOIN]: {max: 10, windowSec: 60, reportLimit: true},
	[BattleClientEvent.QUEUE_LEAVE]: {max: 20, windowSec: 60, failOpen: true},
	[BattleClientEvent.QUEUE_STILL_HERE]: {max: 10, windowSec: 60, failOpen: true},
	[BattleClientEvent.SEARCHING_COUNT]: {max: 30, windowSec: 60, failOpen: true, anonymous: true},
	[BattleClientEvent.TIME_SYNC]: {max: 30, windowSec: 30, failOpen: true},
	[BattleClientEvent.RESUME]: {max: 20, windowSec: 60, failOpen: true},
	[BattleClientEvent.SCRAMBLE_DONE]: {max: 30, windowSec: 60, failOpen: true},
	[BattleClientEvent.SOLVE_START]: {max: 20, windowSec: 60, failOpen: true},
	[BattleClientEvent.PROGRESS]: {max: 60, windowSec: 60, failOpen: true},
	[BattleClientEvent.SOLVE_DONE]: {max: 20, windowSec: 60, failOpen: true},
	[BattleClientEvent.GIVE_UP]: {max: 10, windowSec: 60, failOpen: true},
	[BattleClientEvent.REMATCH]: {max: 20, windowSec: 60, failOpen: true},
	[BattleClientEvent.REPORT]: {max: 5, windowSec: 60 * 60, reportLimit: true},
};

/** The address of the player behind Cloudflare / nginx, for the same_ip flag only. */
export function clientIp(client: Pick<Socket, 'handshake'>): string | null {
	const headers = (client.handshake?.headers || {}) as Record<string, string | string[] | undefined>;
	const cf = headers['cf-connecting-ip'];
	if (typeof cf === 'string' && cf.trim()) return cf.trim();
	const xff = headers['x-forwarded-for'];
	const first = (Array.isArray(xff) ? xff[0] : xff || '').split(',')[0].trim();
	if (first) return first;
	return client.handshake?.address || null;
}

export function listenForBattleEvents(client: Socket): void {
	const userIdOf = async (): Promise<string | null> => {
		const cached = client.data?.userId;
		if (typeof cached === 'string' && cached) return cached;
		try {
			const user = await getUserFromClient(client);
			return user?.id || null;
		} catch {
			return null;
		}
	};

	const on = (
		event: BattleClientEvent,
		handler: (ctx: {userId: string | null; rt: BattleRuntime}, payload: any, ack?: Ack) => Promise<void>
	) => {
		const rule = RULES[event];
		client.on(event, async (payload: unknown, maybeAck?: unknown) => {
			// Socket.IO passes the ack as the last argument; an event sent without a payload
			// puts it first.
			const ack = (typeof maybeAck === 'function' ? maybeAck : typeof payload === 'function' ? payload : undefined) as
				| Ack
				| undefined;
			const body = typeof payload === 'function' ? {} : payload;
			try {
				const userId = await userIdOf();
				if (!userId && !rule.anonymous) {
					if (event === BattleClientEvent.QUEUE_JOIN) {
						client.emit(BattleServerEvent.ERROR, {i18nKey: BATTLE_ERROR_KEYS.notLoggedIn});
					}
					return;
				}
				const {allowed} = await checkRateLimit(`battle:${event.slice('battle:'.length)}:${userId || client.id}`, rule.max, rule.windowSec, {
					failOpen: !!rule.failOpen,
				});
				if (!allowed) {
					if (rule.reportLimit) client.emit(BattleServerEvent.ERROR, {i18nKey: BATTLE_ERROR_KEYS.rateLimited});
					return;
				}
				await handler({userId, rt: getRuntime()}, body && typeof body === 'object' ? body : {}, ack);
			} catch (e) {
				logger.error('[battle] socket event failed', {event, error: (e as Error)?.message});
				if (event === BattleClientEvent.QUEUE_JOIN) {
					client.emit(BattleServerEvent.ERROR, {i18nKey: BATTLE_ERROR_KEYS.generic});
				}
			}
		});
	};

	on(BattleClientEvent.QUEUE_JOIN, async ({userId, rt}, payload) => {
		const res = await joinQueue(rt.joinDeps, {userId: userId as string, socketId: client.id, ip: clientIp(client), payload});
		// `in` narrows without strictNullChecks; `!res.ok` does not in this repo's tsconfig.
		if ('error' in res) {
			client.emit(BattleServerEvent.ERROR, res.error);
			return;
		}
		await rt.matcher.sendState(res.entry);
	});

	on(BattleClientEvent.QUEUE_LEAVE, async ({userId, rt}) => {
		await removeFromQueue(rt.store, userId as string, {socketId: client.id});
	});

	on(BattleClientEvent.QUEUE_STILL_HERE, async ({userId, rt}) => {
		const ok = await confirmStillHere(rt.store, userId as string, client.id, Date.now());
		if (!ok) return;
		const entry = await getQueueEntry(rt.store, userId as string);
		if (entry) await rt.matcher.sendState(entry);
	});

	on(BattleClientEvent.SEARCHING_COUNT, async ({rt}, _payload, ack) => {
		const res: SearchingCountAck = {searchingCount: await countSearching(rt.store, BATTLE_PUZZLE)};
		if (ack) ack(res);
	});

	on(BattleClientEvent.TIME_SYNC, async (_ctx, _payload, ack) => {
		const res: TimeSyncAck = {serverNow: Date.now()};
		if (ack) ack(res);
	});

	on(BattleClientEvent.RESUME, async ({userId, rt}, payload) => {
		await rt.manager.handleResume(userId as string, client.id, payload);
	});

	on(BattleClientEvent.SCRAMBLE_DONE, async ({userId, rt}, payload) => {
		await rt.manager.handleScrambleDone(userId as string, client.id, payload);
	});

	on(BattleClientEvent.SOLVE_START, async ({userId, rt}, payload) => {
		await rt.manager.handleSolveStart(userId as string, client.id, payload);
	});

	on(BattleClientEvent.PROGRESS, async ({userId, rt}, payload) => {
		await rt.manager.handleProgress(userId as string, client.id, payload);
	});

	on(BattleClientEvent.SOLVE_DONE, async ({userId, rt}, payload) => {
		await rt.manager.handleSolveDone(userId as string, client.id, payload);
	});

	on(BattleClientEvent.GIVE_UP, async ({userId, rt}, payload) => {
		await rt.manager.handleGiveUp(userId as string, client.id, payload);
	});

	on(BattleClientEvent.REMATCH, async ({userId, rt}, payload) => {
		await rt.manager.handleRematch(userId as string, client.id, payload);
	});

	on(BattleClientEvent.REPORT, async ({userId}, payload, ack) => {
		const matchId = typeof payload?.matchId === 'string' ? payload.matchId : '';
		const reason = typeof payload?.reason === 'string' ? payload.reason : '';
		const ok = matchId ? await createBattleReport(matchId, userId as string, reason) : false;
		if (ack) ack({ok});
	});

	client.on('disconnect', () => {
		void (async () => {
			const userId = client.data?.userId;
			if (typeof userId !== 'string' || !userId || !runtime) return;
			try {
				// Queue: out at once, no grace, no penalty (design 4.6).
				await removeFromQueue(runtime.store, userId, {socketId: client.id});
				await runtime.manager.handleDisconnect(userId, client.id);
			} catch (e) {
				logger.warn('[battle] disconnect cleanup failed', {error: (e as Error)?.message});
			}
		})();
	});
}
