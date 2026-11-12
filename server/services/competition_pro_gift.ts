import axios from 'axios';
import {getPrisma} from '../database';
import {getZktOrigin} from '../../shared/integration';
import {logger} from './logger';
import {sendPushToUser} from './push';
import {getUserByIdWithSettings} from '../models/user_account';
import MembershipGrantedNotification from '../resources/notification_types/membership_granted';
import {decideCompetitionGift} from '../util/pro_gift_rules';

// Competition Pro gift: Pro for competing at a ZKT competition, once per person
// for life. The admin attaches a gift to a competition before its results are
// out (admin > Promo > Competition); once the federation publishes the results,
// this hands it out.
//
// The federation decides who competed and who was a first-timer
// (zekakuputurkiye-site lib/zkt/pro-gift.ts, /api/internal/v1/pro-gift). This
// side only maps federation accounts to ours and writes the Pro. A pull, like
// the registration feed: a publish never waits on this app, and a tick that
// missed one simply catches up.
//
// What keeps it watertight:
// - CompetitionProGift has two uniques (person, account), so nobody gets a
//   second gift from another competition, a re-publish or a second account.
// - A gift waits 15 minutes after the publish, so a publish undone right away
//   hands nothing out, and keeps picking up late corrections for a week.
// - Paying store subscribers are held (deferred_store) and Pro that never ends
//   or Premium is skipped (util/pro_gift_rules.ts).
// - A member with no linked Timer account keeps the gift for 30 days and gets it
//   from the moment they link, so no day is lost to the wait.

const DAY_MS = 24 * 60 * 60 * 1000;
/** Wait after the publish before anything is handed out. */
export const SETTLE_MS = 15 * 60 * 1000;
/** How long a processed campaign keeps checking for corrections (a competitor added later). */
export const FOLLOW_UP_MS = 7 * DAY_MS;
/** How long a gift waits for its owner to link a Timer account. */
export const LINK_WINDOW_MS = 30 * DAY_MS;

export interface FederationGiftCompetition {
	id: string;
	slug: string | null;
	name: string;
	date_start: string;
	date_end: string;
	status: string;
	results_published_at: string | null;
}

interface FederationCompetitor {
	sub: string;
	identity: string;
	kind: 'newcomer' | 'returning';
	name: string;
}

interface FederationParticipants {
	competition: FederationGiftCompetition;
	published: boolean;
	competitors: FederationCompetitor[];
}

function secretOrThrow(): string {
	const secret = process.env.ZKT_INTERNAL_API_SECRET;
	if (!secret) throw new Error('ZKT_INTERNAL_API_SECRET is not set');
	return secret;
}

// Trailing slashes are load-bearing: the federation runs Next.js with
// trailingSlash, a slash-less URL costs a 308 hop.
export async function fetchGiftCompetitions(): Promise<FederationGiftCompetition[]> {
	const res = await axios.get<{competitions: FederationGiftCompetition[]}>(
		`${getZktOrigin()}/api/internal/v1/pro-gift/competitions/`,
		{headers: {Authorization: `Bearer ${secretOrThrow()}`}, timeout: 15000}
	);
	return res.data?.competitions ?? [];
}

/** Null when the federation no longer knows the competition (deleted, or turned into a rehearsal). */
async function fetchParticipants(competitionId: string): Promise<FederationParticipants | null> {
	try {
		const res = await axios.get<FederationParticipants>(
			`${getZktOrigin()}/api/internal/v1/pro-gift/competitions/${encodeURIComponent(competitionId)}/`,
			{headers: {Authorization: `Bearer ${secretOrThrow()}`}, timeout: 15000}
		);
		return res.data;
	} catch (err: any) {
		if (err?.response?.status === 404) return null;
		throw err;
	}
}

/** One campaign: record a gift for every competitor who has none yet. */
async function processCampaign(
	campaign: {id: string; zkt_competition_id: string; newcomer_days: number; returning_days: number; status: string; processed_at: Date | null},
	now: Date
): Promise<void> {
	const prisma = getPrisma();

	if (campaign.status === 'processing' && campaign.processed_at && now.getTime() - campaign.processed_at.getTime() > FOLLOW_UP_MS) {
		await prisma.competitionProCampaign.update({where: {id: campaign.id}, data: {status: 'done'}});
		return;
	}

	const data = await fetchParticipants(campaign.zkt_competition_id);
	if (!data) {
		logger.warn('[CompetitionProGift] competition gone from the federation', {campaign: campaign.id});
		return;
	}
	if (!data.published || !data.competition.results_published_at) return;
	const publishedAt = new Date(data.competition.results_published_at);
	if (now.getTime() - publishedAt.getTime() < SETTLE_MS) return;

	if (data.competitors.length > 0) {
		// skipDuplicates + the two uniques: someone who already holds a gift from
		// any competition, under either account, is silently passed over.
		const created = await prisma.competitionProGift.createMany({
			data: data.competitors.map((c) => ({
				campaign_id: campaign.id,
				identity_sub: c.identity,
				zkt_user_id: c.sub,
				name: c.name,
				kind: c.kind,
				days: c.kind === 'newcomer' ? campaign.newcomer_days : campaign.returning_days,
				status: 'pending_link',
			})),
			skipDuplicates: true,
		});
		if (created.count > 0) {
			logger.info('[CompetitionProGift] gifts recorded', {campaign: campaign.id, count: created.count});
		}
	}

	if (campaign.status === 'armed') {
		await prisma.competitionProCampaign.update({
			where: {id: campaign.id},
			data: {status: 'processing', processed_at: now},
		});
	}
}

async function notifyGranted(userId: string, until: Date): Promise<void> {
	try {
		const user = await getUserByIdWithSettings(userId);
		if (!user) return;
		const notification = new MembershipGrantedNotification({user, triggeringUser: user, sendEmail: false}, 'pro', until);
		await notification.send();
		await sendPushToUser(user.id, notification.subject(), notification.inAppMessage(), {
			type: 'membership_granted',
			membershipType: 'pro',
		});
	} catch (err: any) {
		logger.warn('[CompetitionProGift] notification failed', {userId, err: err?.message});
	}
}

/** Try to hand out one waiting gift. */
async function applyGift(
	gift: {id: string; zkt_user_id: string; days: number; status: string; created_at: Date},
	now: Date
): Promise<void> {
	const prisma = getPrisma();

	const link = await prisma.integration.findFirst({
		where: {service_name: 'zkt', zkt_user_id: gift.zkt_user_id, revoked_at: null},
		select: {user_id: true},
	});
	if (!link) {
		if (gift.status === 'pending_link' && now.getTime() - gift.created_at.getTime() > LINK_WINDOW_MS) {
			await prisma.competitionProGift.updateMany({
				where: {id: gift.id, status: 'pending_link'},
				data: {status: 'expired'},
			});
		}
		return;
	}

	const account = await prisma.userAccount.findUnique({
		where: {id: link.user_id},
		select: {is_pro: true, pro_expires_at: true, is_premium: true, premium_expires_at: true, iap_product_id: true},
	});
	if (!account) return;

	const decision = decideCompetitionGift(account, gift.days, now);

	if (decision.action === 'skip') {
		await prisma.competitionProGift.updateMany({
			where: {id: gift.id, status: gift.status},
			data: {status: 'skipped', skip_reason: decision.reason, user_id: link.user_id},
		});
		return;
	}
	if (decision.action === 'defer') {
		if (gift.status !== 'deferred_store') {
			await prisma.competitionProGift.updateMany({
				where: {id: gift.id, status: gift.status},
				data: {status: 'deferred_store', user_id: link.user_id},
			});
		}
		return;
	}

	// Claim the gift and write the Pro in one transaction; the status guard makes
	// a second instance (or a second tick) that read the same row a no-op.
	const applied = await prisma.$transaction(async (tx) => {
		const claimed = await tx.competitionProGift.updateMany({
			where: {id: gift.id, status: gift.status},
			data: {status: 'granted', user_id: link.user_id, granted_at: now, pro_until: decision.until},
		});
		if (claimed.count === 0) return false;
		await tx.userAccount.update({
			where: {id: link.user_id},
			data: {is_pro: true, pro_expires_at: decision.until},
		});
		return true;
	});
	if (applied) {
		logger.info('[CompetitionProGift] granted', {gift: gift.id, userId: link.user_id, until: decision.until.toISOString()});
		await notifyGranted(link.user_id, decision.until);
	}
}

/** One tick: new results first, then every gift still waiting. Exported for a script or a test. */
export async function runCompetitionProGiftTick(now: Date = new Date()): Promise<void> {
	if (!process.env.ZKT_INTERNAL_API_SECRET) return;
	const prisma = getPrisma();

	const campaigns = await prisma.competitionProCampaign.findMany({
		where: {status: {in: ['armed', 'processing']}},
		select: {id: true, zkt_competition_id: true, newcomer_days: true, returning_days: true, status: true, processed_at: true},
	});
	for (const campaign of campaigns) {
		try {
			await processCampaign(campaign, now);
		} catch (err: any) {
			logger.warn('[CompetitionProGift] campaign failed', {campaign: campaign.id, err: err?.message});
		}
	}

	const waiting = await prisma.competitionProGift.findMany({
		where: {status: {in: ['pending_link', 'deferred_store']}},
		select: {id: true, zkt_user_id: true, days: true, status: true, created_at: true},
	});
	for (const gift of waiting) {
		try {
			await applyGift(gift, now);
		} catch (err: any) {
			logger.warn('[CompetitionProGift] gift failed', {gift: gift.id, err: err?.message});
		}
	}
}
