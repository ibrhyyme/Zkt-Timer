// Online Battle duel invites (owner decision 2026-10-20) on a fake clock, an in-memory store
// and an in-memory battle_challenge table, with the real match manager behind them: the
// invite lives 15 minutes and is used once, the inviter's leaving or a long drop kills it,
// the accepting player passes the queue's entry checks, a profile challenge only opens for
// its addressee and notifies them, and the abuse limits (per hour, per addressee) hold.

jest.mock('../../services/logger', () => ({logger: {warn: jest.fn(), info: jest.fn(), error: jest.fn(), debug: jest.fn()}}));
jest.mock('../../database', () => ({getPrisma: () => ({})}));

import {
	CHALLENGE_CREATE_LIMIT_PER_HOUR,
	CHALLENGE_HOST_GRACE_SEC,
	CHALLENGE_TARGET_COOLDOWN_SEC,
	CHALLENGE_TARGET_DAILY_LIMIT,
	CHALLENGE_TTL_SEC,
} from '../../../shared/battle/config';
import {BATTLE_ERROR_KEYS, BattleServerEvent} from '../../../shared/battle/events';
import {isOnlineBattleOpen, PersistMatchInput, PersistMatchResult, planMatchPersistence} from '../../models/battle';
import {BattleChallengeManager, cancelStaleChallenges, ChallengeRepo, ChallengeRow, ChallengeTarget} from '../challenge';
import {BattleMatchManager} from '../match_manager';
import {BattleEligibility, BattleEntryDeps, joinQueue, putQueueEntry} from '../queue';
import {getBattleSession} from '../session';
import {FakeClock, MemoryStore} from '../testing/memory';

const A = {userId: 'user-a', socketId: 'sock-a', ip: '10.0.0.1'};
const B = {userId: 'user-b', socketId: 'sock-b', ip: '10.0.0.2'};
const C = {userId: 'user-c', socketId: 'sock-c', ip: '10.0.0.3'};
const CUBE = {brand: 'gan', hasClock: true};
const PUZZLE = '333' as const;

interface Emitted {
	socketId: string;
	event: string;
	payload: any;
}

/** battle_challenge with the conditional updates the Prisma repo runs. */
class MemoryChallengeRepo implements ChallengeRepo {
	rows: Array<ChallengeRow & {accepted_by_id: string | null; match_id: string | null}> = [];
	users = new Map<string, ChallengeTarget>();
	blocks: Array<[string, string]> = [];
	private seq = 0;

	constructor(private clock: FakeClock) {}

	async create(data: {code: string; fromUserId: string; toUserId: string | null; expiresAt: Date}) {
		const row = {
			id: `ch-${++this.seq}`,
			code: data.code,
			from_user_id: data.fromUserId,
			to_user_id: data.toUserId,
			status: 'PENDING',
			expires_at: data.expiresAt,
			created_at: new Date(this.clock.now()),
			accepted_by_id: null as string | null,
			match_id: null as string | null,
		};
		this.rows.push(row);
		return row;
	}
	async findByCode(code: string) {
		return this.rows.find((r) => r.code === code) || null;
	}
	async claim(id: string, userId: string, now: Date) {
		const row = this.rows.find((r) => r.id === id);
		if (!row || row.status !== 'PENDING' || row.expires_at.getTime() <= now.getTime()) return false;
		row.status = 'ACCEPTED';
		row.accepted_by_id = userId;
		return true;
	}
	async release(id: string) {
		const row = this.rows.find((r) => r.id === id);
		if (row && row.status === 'ACCEPTED' && !row.match_id) {
			row.status = 'PENDING';
			row.accepted_by_id = null;
		}
	}
	async setMatch(id: string, matchId: string) {
		const row = this.rows.find((r) => r.id === id);
		if (row) row.match_id = matchId;
	}
	async close(id: string, status: 'EXPIRED' | 'CANCELLED') {
		const row = this.rows.find((r) => r.id === id);
		if (row && row.status === 'PENDING') row.status = status;
	}
	async cancelAllPending() {
		let n = 0;
		for (const row of this.rows) {
			if (row.status === 'PENDING') {
				row.status = 'CANCELLED';
				n++;
			}
		}
		return n;
	}
	async createdSince(fromUserId: string, since: Date) {
		return this.rows
			.filter((r) => r.from_user_id === fromUserId && r.created_at.getTime() >= since.getTime())
			.map((r) => r.created_at)
			.sort((x, y) => x.getTime() - y.getTime());
	}
	async unansweredToTarget(fromUserId: string, toUserId: string, since: Date) {
		return this.rows
			.filter(
				(r) =>
					r.from_user_id === fromUserId &&
					r.to_user_id === toUserId &&
					r.status !== 'ACCEPTED' &&
					r.created_at.getTime() >= since.getTime()
			)
			.map((r) => r.created_at)
			.sort((x, y) => y.getTime() - x.getTime());
	}
	async findUserByUsername(username: string) {
		return [...this.users.values()].find((u) => u.username === username) || null;
	}
	async isBlockedEither(a: string, b: string) {
		return this.blocks.some(([x, y]) => (x === a && y === b) || (x === b && y === a));
	}
}

function setup(opts: {eligibility?: Partial<BattleEligibility>; flag?: boolean; failCreateMatch?: boolean} = {}) {
	const clock = new FakeClock();
	const store = new MemoryStore(clock);
	const emitted: Emitted[] = [];
	const persisted: PersistMatchInput[] = [];
	const repo = new MemoryChallengeRepo(clock);
	for (const u of [A, B, C]) {
		repo.users.set(u.userId, {id: u.userId, username: u.userId.replace('user-', 'name_'), admin: false, banned: false});
	}
	const emitToSocket = (socketId: string, event: string, payload: unknown) => emitted.push({socketId, event, payload});

	const manager = new BattleMatchManager({
		store,
		clock,
		emitToSocket,
		generateScramble: () => "R U R' U'",
		newId: (() => {
			let n = 0;
			return () => `match-${++n}`;
		})(),
		loadProfile: async (userId) => ({username: userId, avatar: null}),
		getStoredRating: async () => null,
		countPairRatedMatches: jest.fn(async () => 0),
		persistMatch: jest.fn(async (input: PersistMatchInput): Promise<PersistMatchResult> => {
			persisted.push(input);
			return {...planMatchPersistence(input, null, null).result, matchId: input.id as string};
		}),
		appendBattleFlags: jest.fn(async () => undefined),
		loadSolveHistoryMs: jest.fn(async () => []),
	});

	const eligibility: Record<string, Partial<BattleEligibility>> = {};
	const entry: BattleEntryDeps = {
		store,
		now: () => clock.now(),
		getSiteConfig: async () => ({online_battle_enabled: opts.flag ?? true}),
		isOnlineBattleOpen,
		loadEligibility: async (userId) => ({
			admin: false,
			email_verified: true,
			banned_forever: false,
			banned_until: null,
			...opts.eligibility,
			...eligibility[userId],
		}),
		matches: manager,
	};

	let codes = 0;
	const notifyTarget = jest.fn(async () => undefined);
	const createMatch = jest.fn(async (a: any, b: any, o: any) => {
		if (opts.failCreateMatch) throw new Error('boom');
		return manager.createMatch(a, b, o);
	});
	const challenges = new BattleChallengeManager({
		store,
		clock,
		emitToSocket,
		// zzzzzz + the counter in letters: zzzzzzaaab, zzzzzzaaac ...
		newCode: () =>
			`zzzzzz${String(++codes)
				.padStart(4, '0')
				.split('')
				.map((d) => 'abcdefghjk'[Number(d)])
				.join('')}`,
		repo,
		entry,
		createMatch,
		notifyTarget,
	});

	const events = (socketId: string, event: BattleServerEvent) =>
		emitted.filter((e) => e.socketId === socketId && e.event === event).map((e) => e.payload);
	const last = (socketId: string, event: BattleServerEvent) => {
		const list = events(socketId, event);
		return list[list.length - 1];
	};

	const create = async (p: typeof A = A, toUsername?: string) => {
		await challenges.create(p.userId, p.socketId, p.ip, {puzzle: PUZZLE, cube: CUBE, ...(toUsername ? {toUsername} : {})});
		await challenges.idle();
		return last(p.socketId, BattleServerEvent.CHALLENGE_STATE);
	};
	const accept = async (code: string, p: typeof B = B, cube: any = CUBE) => {
		await challenges.accept(p.userId, p.socketId, p.ip, {code, puzzle: PUZZLE, cube});
		await challenges.idle();
	};
	const lastError = (socketId: string) => last(socketId, BattleServerEvent.ERROR)?.i18nKey;

	return {clock, store, emitted, persisted, repo, manager, challenges, entry, eligibility, notifyTarget, createMatch, events, last, create, accept, lastError};
}

afterEach(() => jest.clearAllMocks());

describe('opening an invite', () => {
	it('opens a link invite for 15 minutes and holds the inviter in it', async () => {
		const ctx = setup();
		const state = await create(ctx);
		expect(state).toMatchObject({status: 'PENDING', to: null, expiresAt: ctx.clock.now() + CHALLENGE_TTL_SEC * 1000});
		expect(ctx.repo.rows).toHaveLength(1);
		expect(ctx.repo.rows[0]).toMatchObject({code: state.code, from_user_id: A.userId, to_user_id: null, status: 'PENDING'});
		expect(ctx.challenges.hostedCode(A.userId)).toBe(state.code);
		expect(await getBattleSession(ctx.store, A.userId)).toMatchObject({kind: 'challenge', code: state.code, socketId: A.socketId});
		expect(ctx.notifyTarget).not.toHaveBeenCalled();
	});

	it('runs the queue entry checks for the inviter', async () => {
		const noCube = setup();
		await noCube.challenges.create(A.userId, A.socketId, A.ip, {puzzle: PUZZLE, cube: {brand: 'giiker', hasClock: false}});
		expect(noCube.lastError(A.socketId)).toBe(BATTLE_ERROR_KEYS.cubeNotSupported);

		const closed = setup({flag: false});
		await create(closed);
		expect(closed.lastError(A.socketId)).toBe(BATTLE_ERROR_KEYS.disabled);

		const unverified = setup({eligibility: {email_verified: false}});
		await create(unverified);
		expect(unverified.lastError(A.socketId)).toBe(BATTLE_ERROR_KEYS.emailNotVerified);
		expect(unverified.repo.rows).toHaveLength(0);
	});

	it('refuses while the inviter is searching the queue, and the queue refuses while an invite is open', async () => {
		const ctx = setup();
		await putQueueEntry(ctx.store, {
			userId: A.userId,
			socketId: A.socketId,
			joinedAt: 0,
			rating: 1500,
			rd: 350,
			lastConfirmAt: 0,
			askDeadline: null,
			lastOpponentId: null,
			lastOpponentUntil: 0,
			ip: null,
		});
		await create(ctx);
		expect(ctx.lastError(A.socketId)).toBe(BATTLE_ERROR_KEYS.inQueue);

		const other = setup();
		await create(other, B);
		const res = await joinQueue(
			{...other.entry, getStoredRating: async () => null, challenges: other.challenges},
			{userId: B.userId, socketId: B.socketId, ip: null, payload: {puzzle: PUZZLE, cube: CUBE}}
		);
		expect(res).toEqual({ok: false, error: {i18nKey: BATTLE_ERROR_KEYS.challengeOpen}});
	});

	it('replaces the open invite when the inviter opens a new one', async () => {
		const ctx = setup();
		const first = await create(ctx);
		const second = await create(ctx);
		expect(second.code).not.toBe(first.code);
		expect(ctx.repo.rows.map((r) => r.status)).toEqual(['CANCELLED', 'PENDING']);
		expect(ctx.challenges.hostedCode(A.userId)).toBe(second.code);
	});

	it('allows 10 invites per hour', async () => {
		const ctx = setup();
		for (let i = 0; i < CHALLENGE_CREATE_LIMIT_PER_HOUR; i++) {
			await create(ctx);
			await ctx.clock.advance(60_000);
		}
		await create(ctx);
		expect(ctx.lastError(A.socketId)).toBe(BATTLE_ERROR_KEYS.challengeLimit);
		const err = ctx.last(A.socketId, BattleServerEvent.ERROR);
		// The oldest invite leaves the hour 50 minutes from now.
		expect(err.params).toEqual({minutes: 50});
		expect(ctx.repo.rows).toHaveLength(CHALLENGE_CREATE_LIMIT_PER_HOUR);

		await ctx.clock.advance(50 * 60_000 + 1000);
		await create(ctx);
		expect(ctx.repo.rows).toHaveLength(CHALLENGE_CREATE_LIMIT_PER_HOUR + 1);
	});

	it('cancels open invites after a restart', async () => {
		const ctx = setup();
		await create(ctx);
		expect(await cancelStaleChallenges(ctx.repo)).toBe(1);
		expect(ctx.repo.rows[0].status).toBe('CANCELLED');
	});
});

describe('profile challenges', () => {
	it('notifies the addressee and only they can accept', async () => {
		const ctx = setup();
		const state = await create(ctx, A, 'name_b');
		expect(state.to).toEqual({id: B.userId, username: 'name_b'});
		expect(ctx.notifyTarget).toHaveBeenCalledWith({code: state.code, fromUserId: A.userId, toUserId: B.userId});

		await accept(ctx, state.code, C);
		expect(ctx.lastError(C.socketId)).toBe(BATTLE_ERROR_KEYS.challengeNotForYou);
		await accept(ctx, state.code, B);
		expect(ctx.last(B.socketId, BattleServerEvent.MATCHED)).toMatchObject({challenge: true, rated: false});
	});

	it('refuses an unknown, banned, blocked or closed-off addressee with one answer, and oneself', async () => {
		const ctx = setup();
		await create(ctx, A, 'nobody');
		expect(ctx.lastError(A.socketId)).toBe(BATTLE_ERROR_KEYS.challengeTargetNotFound);

		await create(ctx, A, 'name_a');
		expect(ctx.lastError(A.socketId)).toBe(BATTLE_ERROR_KEYS.challengeSelf);

		ctx.repo.blocks.push([B.userId, A.userId]);
		await create(ctx, A, 'name_b');
		expect(ctx.lastError(A.socketId)).toBe(BATTLE_ERROR_KEYS.challengeTargetNotFound);

		(ctx.repo.users.get(C.userId) as ChallengeTarget).banned = true;
		await create(ctx, A, 'name_c');
		expect(ctx.lastError(A.socketId)).toBe(BATTLE_ERROR_KEYS.challengeTargetNotFound);
		expect(ctx.repo.rows).toHaveLength(0);
		expect(ctx.notifyTarget).not.toHaveBeenCalled();
	});

	it('waits 10 minutes after an unanswered challenge to the same person, 3 a day at most', async () => {
		const ctx = setup();
		const first = await create(ctx, A, 'name_b');
		await ctx.challenges.cancel(A.userId, {code: first.code});
		await create(ctx, A, 'name_b');
		expect(ctx.lastError(A.socketId)).toBe(BATTLE_ERROR_KEYS.challengeTargetCooldown);
		expect(ctx.last(A.socketId, BattleServerEvent.ERROR).params).toEqual({minutes: 10});

		// A link invite is not held up by it.
		expect((await create(ctx)).to).toBeNull();

		for (let i = 1; i < CHALLENGE_TARGET_DAILY_LIMIT; i++) {
			await ctx.clock.advance(CHALLENGE_TARGET_COOLDOWN_SEC * 1000);
			expect((await create(ctx, A, 'name_b')).to?.id).toBe(B.userId);
		}
		await ctx.clock.advance(CHALLENGE_TARGET_COOLDOWN_SEC * 1000);
		await create(ctx, A, 'name_b');
		expect(ctx.lastError(A.socketId)).toBe(BATTLE_ERROR_KEYS.challengeTargetLimit);
		expect(ctx.notifyTarget).toHaveBeenCalledTimes(CHALLENGE_TARGET_DAILY_LIMIT);
	});

	it('does not hold an accepted challenge against the next one', async () => {
		const ctx = setup();
		const first = await create(ctx, A, 'name_b');
		await accept(ctx, first.code, B);
		await ctx.manager.handleGiveUp(B.userId, B.socketId, {matchId: ctx.last(B.socketId, BattleServerEvent.MATCHED).matchId});
		await ctx.manager.idle();
		await ctx.manager.leaveFinished(A.userId);
		await ctx.manager.leaveFinished(B.userId);
		expect((await create(ctx, A, 'name_b')).status).toBe('PENDING');
	});
});

describe('accepting', () => {
	it('starts a duel with the inviter as A and uses the invite up', async () => {
		const ctx = setup();
		const state = await create(ctx);
		await accept(ctx, state.code);

		expect(ctx.createMatch).toHaveBeenCalledWith(
			{userId: A.userId, socketId: A.socketId, ip: A.ip},
			{userId: B.userId, socketId: B.socketId, ip: B.ip},
			{mode: 'challenge'}
		);
		const matchedA = ctx.last(A.socketId, BattleServerEvent.MATCHED);
		expect(matchedA).toMatchObject({side: 'A', challenge: true, rated: false, preview: null});
		expect(ctx.last(B.socketId, BattleServerEvent.MATCHED)).toMatchObject({side: 'B', challenge: true});
		expect(ctx.repo.rows[0]).toMatchObject({status: 'ACCEPTED', accepted_by_id: B.userId, match_id: matchedA.matchId});
		expect(ctx.challenges.hostedCode(A.userId)).toBeNull();
		expect(await getBattleSession(ctx.store, A.userId)).toMatchObject({kind: 'match', matchId: matchedA.matchId});
	});

	it('is single use', async () => {
		const ctx = setup();
		const state = await create(ctx);
		await accept(ctx, state.code, B);
		await accept(ctx, state.code, C);
		expect(ctx.lastError(C.socketId)).toBe(BATTLE_ERROR_KEYS.challengeUsed);
		expect(ctx.createMatch).toHaveBeenCalledTimes(1);
	});

	it('takes only one of two players accepting at the same moment', async () => {
		const ctx = setup();
		const state = await create(ctx);
		await Promise.all([
			ctx.challenges.accept(B.userId, B.socketId, B.ip, {code: state.code, puzzle: PUZZLE, cube: CUBE}),
			ctx.challenges.accept(C.userId, C.socketId, C.ip, {code: state.code, puzzle: PUZZLE, cube: CUBE}),
		]);
		await ctx.challenges.idle();
		expect(ctx.createMatch).toHaveBeenCalledTimes(1);
		expect(ctx.lastError(C.socketId)).toBe(BATTLE_ERROR_KEYS.challengeUsed);
	});

	it('expires after 15 minutes', async () => {
		const ctx = setup();
		const state = await create(ctx);
		await ctx.clock.advance(CHALLENGE_TTL_SEC * 1000 - 1000);
		expect(ctx.repo.rows[0].status).toBe('PENDING');
		await ctx.clock.advance(1000);
		await ctx.challenges.idle();

		expect(ctx.last(A.socketId, BattleServerEvent.CHALLENGE_STATE)).toMatchObject({code: state.code, status: 'EXPIRED'});
		expect(ctx.repo.rows[0].status).toBe('EXPIRED');
		expect(ctx.challenges.hostedCode(A.userId)).toBeNull();
		expect(await getBattleSession(ctx.store, A.userId)).toBeNull();

		await accept(ctx, state.code);
		expect(ctx.lastError(B.socketId)).toBe(BATTLE_ERROR_KEYS.challengeExpired);
		expect(ctx.createMatch).not.toHaveBeenCalled();
	});

	it('dies when the inviter cancels', async () => {
		const ctx = setup();
		const state = await create(ctx);
		await ctx.challenges.cancel(B.userId, {code: state.code});
		expect(ctx.repo.rows[0].status).toBe('PENDING');
		await ctx.challenges.cancel(A.userId, {code: state.code});
		expect(ctx.repo.rows[0].status).toBe('CANCELLED');
		await accept(ctx, state.code);
		expect(ctx.lastError(B.socketId)).toBe(BATTLE_ERROR_KEYS.challengeCancelled);
	});

	it('waits out a short drop of the inviter and dies after a long one', async () => {
		const ctx = setup();
		const state = await create(ctx);
		await ctx.challenges.handleDisconnect(A.userId, A.socketId);
		await accept(ctx, state.code);
		expect(ctx.lastError(B.socketId)).toBe(BATTLE_ERROR_KEYS.challengeHostAway);
		expect(ctx.repo.rows[0].status).toBe('PENDING');

		// Back on a new socket within the grace: the invite is theirs again.
		await ctx.clock.advance((CHALLENGE_HOST_GRACE_SEC - 5) * 1000);
		await ctx.challenges.resume(A.userId, 'sock-a2', {code: state.code});
		await ctx.challenges.idle();
		expect(ctx.last('sock-a2', BattleServerEvent.CHALLENGE_STATE)).toMatchObject({status: 'PENDING'});
		await ctx.clock.advance(10_000);
		await accept(ctx, state.code);
		expect(ctx.last('sock-a2', BattleServerEvent.MATCHED)).toMatchObject({challenge: true});

		const gone = setup();
		const s2 = await create(gone);
		await gone.challenges.handleDisconnect(A.userId, A.socketId);
		await gone.clock.advance(CHALLENGE_HOST_GRACE_SEC * 1000);
		await gone.challenges.idle();
		expect(gone.repo.rows[0].status).toBe('CANCELLED');
		await gone.challenges.resume(A.userId, 'sock-a2', {code: s2.code});
		await gone.challenges.idle();
		expect(gone.last('sock-a2', BattleServerEvent.CHALLENGE_STATE)).toMatchObject({status: 'CANCELLED'});
	});

	it('runs the queue entry checks for the accepting player', async () => {
		const ctx = setup();
		const state = await create(ctx);
		await accept(ctx, state.code, B, {brand: 'giiker', hasClock: false});
		expect(ctx.lastError(B.socketId)).toBe(BATTLE_ERROR_KEYS.cubeNotSupported);

		ctx.eligibility[B.userId] = {email_verified: false};
		await accept(ctx, state.code, B);
		expect(ctx.lastError(B.socketId)).toBe(BATTLE_ERROR_KEYS.emailNotVerified);

		ctx.eligibility[B.userId] = {banned_forever: true};
		await accept(ctx, state.code, B);
		expect(ctx.lastError(B.socketId)).toBe(BATTLE_ERROR_KEYS.banned);

		ctx.eligibility[B.userId] = {};
		await putQueueEntry(ctx.store, {
			userId: B.userId,
			socketId: B.socketId,
			joinedAt: 0,
			rating: 1500,
			rd: 350,
			lastConfirmAt: 0,
			askDeadline: null,
			lastOpponentId: null,
			lastOpponentUntil: 0,
			ip: null,
		});
		await accept(ctx, state.code, B);
		expect(ctx.lastError(B.socketId)).toBe(BATTLE_ERROR_KEYS.inQueue);
		expect(ctx.repo.rows[0].status).toBe('PENDING');
		expect(ctx.createMatch).not.toHaveBeenCalled();
	});

	it('refuses the inviter, an unknown code and a blocked player', async () => {
		const ctx = setup();
		const state = await create(ctx);
		await accept(ctx, state.code, A);
		expect(ctx.lastError(A.socketId)).toBe(BATTLE_ERROR_KEYS.challengeOwn);
		await accept(ctx, 'zzzzzzzzzz', B);
		expect(ctx.lastError(B.socketId)).toBe(BATTLE_ERROR_KEYS.challengeNotFound);
		await accept(ctx, 'not a code', B);
		expect(ctx.lastError(B.socketId)).toBe(BATTLE_ERROR_KEYS.challengeNotFound);
		ctx.repo.blocks.push([A.userId, C.userId]);
		await accept(ctx, state.code, C);
		expect(ctx.lastError(C.socketId)).toBe(BATTLE_ERROR_KEYS.challengeNotFound);
	});

	it("ends the accepting player's own open invite", async () => {
		const ctx = setup();
		const mine = await create(ctx, B);
		const theirs = await create(ctx, A);
		await accept(ctx, theirs.code, B);
		expect(ctx.repo.rows.find((r) => r.code === mine.code)?.status).toBe('CANCELLED');
		expect(ctx.challenges.hostedCode(B.userId)).toBeNull();
		expect(ctx.last(B.socketId, BattleServerEvent.MATCHED)).toMatchObject({challenge: true});
	});

	it('opens the invite again when the duel cannot start', async () => {
		const ctx = setup({failCreateMatch: true});
		const state = await create(ctx);
		await accept(ctx, state.code);
		expect(ctx.lastError(B.socketId)).toBe(BATTLE_ERROR_KEYS.generic);
		expect(ctx.repo.rows[0]).toMatchObject({status: 'PENDING', accepted_by_id: null});
		expect(ctx.challenges.hostedCode(A.userId)).toBe(state.code);
		expect(ctx.last(A.socketId, BattleServerEvent.CHALLENGE_STATE)).toMatchObject({status: 'PENDING'});
	});
});

async function create(ctx: ReturnType<typeof setup>, p: typeof A = A, toUsername?: string) {
	return ctx.create(p, toUsername);
}

async function accept(ctx: ReturnType<typeof setup>, code: string, p: typeof B = B, cube: any = CUBE) {
	return ctx.accept(code, p, cube);
}
