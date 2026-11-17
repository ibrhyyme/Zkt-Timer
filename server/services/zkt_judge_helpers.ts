// Online score entry (ZKT), "Yardımcılar" (owner, 2026-11-17): an admin picks a
// Zkt-Timer member in the judge panel, and that member approves judges and
// corrections at that one competition (never extras), without registering and
// without any role on the federation site.
//
// The site keeps the helper list (its ZktJudgeHelper) and decides every
// approval, and only a member holding its `judge.assign_helpers` may change
// the list; every call here goes out as the admin, so the site checks that
// each time. The one thing this server stores is the wait for a link: a member
// without a linked ZKT account has no site identity yet, so the pick becomes a
// ZktJudgeHelperInvite. The member's first zktJudgeMe at that competition after
// linking hands it to the site as the inviting admin (claimHelperInvite).

import {getPrisma} from '../database';
import {logger} from './logger';
import {JudgeRelayError, ZktJudgeRelay} from './ZktJudgeRelay';

export const HELPER_SEARCH_MIN_QUERY = 2;
const HELPER_SEARCH_LIMIT = 10;

/** A refusal that will not change by asking again: the invite is dropped. */
const FINAL_REFUSALS = new Set(['NO_PERMISSION', 'UNKNOWN_MEMBER', 'SUSPENDED', 'COMPETITION_NOT_FOUND']);

export interface PendingHelper {
	userId: string;
	username: string;
	invitedAt: string;
}

export interface HelperState {
	/** The site's helpers (memberId = site User.id). */
	helpers: Record<string, unknown>[];
	/** Picked before they linked a ZKT account. */
	pending: PendingHelper[];
}

export interface HelperCandidate {
	userId: string;
	username: string;
	zktName: string | null;
	zktId: string | null;
	linked: boolean;
	/** Already a helper, or waiting for the link. */
	status: 'helper' | 'pending' | null;
}

function zktLinkOf(userId: string) {
	return getPrisma().integration.findFirst({
		where: {user_id: userId, service_name: 'zkt', zkt_user_id: {not: null}},
		select: {zkt_user_id: true},
	});
}

async function pendingOf(competitionId: string): Promise<PendingHelper[]> {
	const rows = await getPrisma().zktJudgeHelperInvite.findMany({
		where: {competition_id: competitionId},
		orderBy: {created_at: 'desc'},
		select: {user_id: true, created_at: true, user: {select: {username: true}}},
	});
	return rows.map((r) => ({userId: r.user_id, username: r.user.username, invitedAt: r.created_at.toISOString()}));
}

/** The list the panel shows. The site's answer doubles as the admin's permission check. */
export async function helperState(adminMemberId: string, competitionId: string): Promise<HelperState> {
	const site = await ZktJudgeRelay.listHelpers(adminMemberId, competitionId);
	return {helpers: site.helpers || [], pending: await pendingOf(competitionId)};
}

/** Zkt-Timer members by username, ZKT name or ZKT ID. */
export async function searchHelperCandidates(
	adminMemberId: string,
	competitionId: string,
	query: string
): Promise<HelperCandidate[]> {
	const term = query.trim().slice(0, 64);
	if (term.length < HELPER_SEARCH_MIN_QUERY) return [];
	const state = await helperState(adminMemberId, competitionId);
	const helperMembers = new Set(state.helpers.map((h) => h.memberId));
	const pendingUsers = new Set(state.pending.map((p) => p.userId));

	const users = await getPrisma().userAccount.findMany({
		where: {
			banned_forever: false,
			OR: [
				{username: {contains: term, mode: 'insensitive'}},
				{
					integrations: {
						some: {
							service_name: 'zkt',
							OR: [{zkt_name: {contains: term, mode: 'insensitive'}}, {zkt_id: term.toUpperCase()}],
						},
					},
				},
			],
		},
		orderBy: {username: 'asc'},
		take: HELPER_SEARCH_LIMIT,
		select: {
			id: true,
			username: true,
			integrations: {where: {service_name: 'zkt'}, select: {zkt_user_id: true, zkt_name: true, zkt_id: true}},
		},
	});
	return users.map((u) => {
		const zkt = u.integrations[0];
		const memberId = zkt?.zkt_user_id || null;
		return {
			userId: u.id,
			username: u.username,
			zktName: zkt?.zkt_name || null,
			zktId: zkt?.zkt_id || null,
			linked: !!memberId,
			status: memberId && helperMembers.has(memberId) ? 'helper' : pendingUsers.has(u.id) ? 'pending' : null,
		};
	});
}

/**
 * Make a Zkt-Timer member a helper. Linked: straight onto the site's list.
 * Not linked yet: an invite here, after the site confirmed the admin may pick.
 */
export async function addHelper(
	adminMemberId: string,
	adminUserId: string,
	competitionId: string,
	userId: string
): Promise<HelperState> {
	const user = await getPrisma().userAccount.findUnique({where: {id: userId}, select: {id: true}});
	if (!user) throw new JudgeRelayError('UNKNOWN_MEMBER', 404, 'Üye bulunamadı.');
	const link = await zktLinkOf(userId);
	if (link?.zkt_user_id) {
		await ZktJudgeRelay.addHelper(adminMemberId, competitionId, link.zkt_user_id);
		await getPrisma().zktJudgeHelperInvite.deleteMany({where: {competition_id: competitionId, user_id: userId}});
	} else {
		await ZktJudgeRelay.listHelpers(adminMemberId, competitionId);
		await getPrisma().zktJudgeHelperInvite.upsert({
			where: {competition_id_user_id: {competition_id: competitionId, user_id: userId}},
			create: {competition_id: competitionId, user_id: userId, invited_by_id: adminUserId},
			update: {},
		});
	}
	return helperState(adminMemberId, competitionId);
}

/** Take a helper off the site's list (memberId) or drop an invite (userId). */
export async function removeHelper(
	adminMemberId: string,
	competitionId: string,
	target: {memberId?: string | null; userId?: string | null}
): Promise<HelperState> {
	if (target.memberId) {
		await ZktJudgeRelay.removeHelper(adminMemberId, competitionId, target.memberId);
	} else if (target.userId) {
		await ZktJudgeRelay.listHelpers(adminMemberId, competitionId);
		await getPrisma().zktJudgeHelperInvite.deleteMany({where: {competition_id: competitionId, user_id: target.userId}});
	}
	return helperState(adminMemberId, competitionId);
}

/**
 * A member who was picked before linking has linked now: hand the pick to the
 * site as the admin who made it, so the site checks that admin's right today.
 * Never fails the caller: the site down keeps the invite for the next call, a
 * final refusal (the admin lost the right, the account is suspended) drops it.
 */
export async function claimHelperInvite(userId: string, competitionId: string, memberId: string): Promise<void> {
	try {
		const invite = await getPrisma().zktJudgeHelperInvite.findUnique({
			where: {competition_id_user_id: {competition_id: competitionId, user_id: userId}},
			select: {id: true, invited_by_id: true},
		});
		if (!invite) return;
		const drop = () => getPrisma().zktJudgeHelperInvite.deleteMany({where: {id: invite.id}});
		const admin = await zktLinkOf(invite.invited_by_id);
		if (!admin?.zkt_user_id) {
			logger.warn('[zkt_judge_helpers] inviting admin has no ZKT link, invite dropped', {competitionId, userId});
			await drop();
			return;
		}
		try {
			await ZktJudgeRelay.addHelper(admin.zkt_user_id, competitionId, memberId);
			await drop();
		} catch (error) {
			if (error instanceof JudgeRelayError && FINAL_REFUSALS.has(error.code)) {
				logger.warn('[zkt_judge_helpers] site refused the invite, dropped', {competitionId, userId, code: error.code});
				await drop();
				return;
			}
			throw error;
		}
	} catch (error) {
		logger.warn('[zkt_judge_helpers] invite not handed over yet', {
			competitionId,
			userId,
			reason: error instanceof Error ? error.message : String(error),
		});
	}
}
