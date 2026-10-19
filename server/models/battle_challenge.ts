/**
 * battle_challenge: duel invites of Online Battle (owner decision 2026-10-20).
 *
 * The realtime side (server/battle/challenge.ts) owns the flow; this file is its database
 * seam (prismaChallengeRepo) and the read behind /duel/<code> (getBattleChallengeInfo),
 * which the page and its link preview use.
 */

import {getPrisma} from '../database';
import {challengeStatusAt, isChallengeCode} from '../../shared/battle/challenge';
import {BattleChallengeStatus} from '../../shared/battle/types';
import type {ChallengeRepo, ChallengeRow} from '../battle/challenge';
import {BattlePlayerData, toBattlePlayer} from './battle';

const rowSelect = {
	id: true,
	code: true,
	from_user_id: true,
	to_user_id: true,
	status: true,
	expires_at: true,
	created_at: true,
} as const;

export const prismaChallengeRepo: ChallengeRepo = {
	async create({code, fromUserId, toUserId, expiresAt}) {
		return getPrisma().battleChallenge.create({
			data: {code, from_user_id: fromUserId, to_user_id: toUserId, expires_at: expiresAt, status: 'PENDING'},
			select: rowSelect,
		}) as Promise<ChallengeRow>;
	},

	async findByCode(code) {
		return getPrisma().battleChallenge.findUnique({where: {code}, select: rowSelect}) as Promise<ChallengeRow | null>;
	},

	async claim(id, userId, now) {
		// The single use guarantee: only one conditional update can move PENDING to ACCEPTED.
		const res = await getPrisma().battleChallenge.updateMany({
			where: {id, status: 'PENDING', expires_at: {gt: now}},
			data: {status: 'ACCEPTED', accepted_by_id: userId, accepted_at: now},
		});
		return res.count === 1;
	},

	async release(id) {
		await getPrisma().battleChallenge.updateMany({
			where: {id, status: 'ACCEPTED', match_id: null},
			data: {status: 'PENDING', accepted_by_id: null, accepted_at: null},
		});
	},

	async setMatch(id, matchId) {
		await getPrisma().battleChallenge.update({where: {id}, data: {match_id: matchId}});
	},

	async close(id, status) {
		await getPrisma().battleChallenge.updateMany({where: {id, status: 'PENDING'}, data: {status}});
	},

	async cancelAllPending() {
		const res = await getPrisma().battleChallenge.updateMany({where: {status: 'PENDING'}, data: {status: 'CANCELLED'}});
		return res.count;
	},

	async createdSince(fromUserId, since) {
		const rows = await getPrisma().battleChallenge.findMany({
			where: {from_user_id: fromUserId, created_at: {gte: since}},
			orderBy: {created_at: 'asc'},
			select: {created_at: true},
		});
		return rows.map((r) => r.created_at);
	},

	async unansweredToTarget(fromUserId, toUserId, since) {
		const rows = await getPrisma().battleChallenge.findMany({
			where: {from_user_id: fromUserId, to_user_id: toUserId, created_at: {gte: since}, status: {not: 'ACCEPTED'}},
			orderBy: {created_at: 'desc'},
			select: {created_at: true},
		});
		return rows.map((r) => r.created_at);
	},

	async findUserByUsername(username) {
		const user = await getPrisma().userAccount.findUnique({
			where: {username},
			select: {id: true, username: true, admin: true, banned_forever: true, banned_until: true},
		});
		if (!user || !user.username) return null;
		const bannedUntil = user.banned_until ? new Date(user.banned_until).getTime() : 0;
		return {
			id: user.id,
			username: user.username,
			admin: !!user.admin,
			banned: !!user.banned_forever || bannedUntil > Date.now(),
		};
	},

	async isBlockedEither(userIdA, userIdB) {
		const n = await getPrisma().userBlock.count({
			where: {
				OR: [
					{blocker_id: userIdA, blocked_id: userIdB},
					{blocker_id: userIdB, blocked_id: userIdA},
				],
			},
		});
		return n > 0;
	},
};

// ── /duel/<code> ─────────────────────────────────────────────────────────────

export interface BattleChallengeInfoData {
	code: string;
	status: BattleChallengeStatus;
	expires_at: Date;
	from: BattlePlayerData;
	/** A profile challenge: only its addressee may accept. */
	restricted: boolean;
	/** The viewer opened their own invite. */
	own: boolean;
	/** Restricted and the viewer is the addressee. */
	for_you: boolean;
}

/**
 * What the invite page and its link preview show. Null for an unknown or malformed code. The
 * addressee of a profile challenge is never named: the link alone must not tell a stranger who
 * was challenged.
 */
export async function getBattleChallengeInfo(code: string, viewerId: string | null): Promise<BattleChallengeInfoData | null> {
	if (!isChallengeCode(code)) return null;
	const row = await getPrisma().battleChallenge.findUnique({
		where: {code},
		select: {
			...rowSelect,
			from_user: {select: {id: true, username: true, profile: {select: {pfp_image: {select: {storage_path: true}}}}}},
		},
	});
	if (!row) return null;
	return {
		code: row.code,
		status: challengeStatusAt(row, Date.now()),
		expires_at: row.expires_at,
		from: toBattlePlayer(row.from_user),
		restricted: !!row.to_user_id,
		own: !!viewerId && row.from_user_id === viewerId,
		for_you: !!viewerId && !!row.to_user_id && row.to_user_id === viewerId,
	};
}
