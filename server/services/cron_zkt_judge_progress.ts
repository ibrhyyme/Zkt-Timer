import axios from 'axios';
import {CronJob} from 'cron';
import {Prisma} from '@prisma/client';
import {logger} from './logger';
import {getPrisma} from '../database';
import {acquireRedisLock, createRedisKey, RedisNamespace} from './redis';
import {sendPushToUser} from './push';
import {judgeApiBase} from './ZktJudgeRelay';
import {getUserIdsWithPrefDisabled} from '../models/notification_preference';
import {
	decideProgress,
	noticeLevel,
	progressThresholds,
	type JudgeProgressCompetition,
	type JudgeProgressFeed,
	type JudgeProgressGroup,
} from './zkt_judge_progress';
import ZktJudgeGroupProgressNotification from '../resources/notification_types/zkt_judge_group_progress';

// Online score entry (ZKT), plan K10: when a group's 3rd and 4th attempts are
// in, the competition's delegates and organisers get one in-app notification
// and one push each. At most two per group, nothing in between.
//
// The federation never calls this app (plan §5). This job polls
// GET /api/internal/v1/judge/progress/ with ZKT_JUDGE_API_SECRET; the site
// answers only for competitions with online score entry on, never a rehearsal
// (is_test), and computes each group's level by the K4 rule.
//
// Once only: the unique key of ZktJudgeProgressNotice is the claim. A notice
// is sent only by the server whose insert won, so two servers, a retried tick
// or a restart never send it twice. The other side of that choice: a crash
// between the claim and the push loses that notice (at most once). The Redis
// lock only saves the second server a useless poll.

const TICK_LOCK_TTL_MS = 25 * 1000;
const LOCK_KEY = createRedisKey(RedisNamespace.ZKT_JUDGE_PROGRESS, 'lock');
const REQUEST_TIMEOUT_MS = 15 * 1000;
/** Claims are worth nothing once the competition is over. */
const NOTICE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export function initZktJudgeProgressCronJob() {
	const job = new CronJob(
		'5,35 * * * * *', // every 30 seconds: a group's 3rd attempts are news for a minute or two
		async () => {
			try {
				await runZktJudgeProgressTick();
			} catch (err: any) {
				logger.error('[ZktJudgeProgress] tick crashed', {err: err?.message});
			}
		},
		null,
		true,
		'America/Los_Angeles'
	);
	logger.debug('[ZktJudgeProgress] cron initialized', {running: job.running});
}

/** Null when the site has no secret set, is an older deploy, or does not answer. */
export async function fetchJudgeProgress(secret: string): Promise<JudgeProgressFeed | null> {
	try {
		// trailingSlash on the site: without the slash this is a redirect.
		const res = await axios.get<JudgeProgressFeed>(`${judgeApiBase()}/progress/`, {
			headers: {Accept: 'application/json', Authorization: `Bearer ${secret}`},
			timeout: REQUEST_TIMEOUT_MS,
			maxRedirects: 0,
		});
		// A proxy error page answers 200 with HTML.
		if (!res.data || !Array.isArray(res.data.competitions)) return null;
		return res.data;
	} catch (err: any) {
		const status = err?.response?.status;
		if (status === 404 || status === 503) {
			logger.debug('[ZktJudgeProgress] progress not available', {status});
			return null;
		}
		logger.warn('[ZktJudgeProgress] site did not answer', {status, err: err?.code || err?.message});
		return null;
	}
}

/** One tick. Exported so a script or a test can run it on demand. */
export async function runZktJudgeProgressTick(): Promise<void> {
	const secret = process.env.ZKT_JUDGE_API_SECRET;
	if (!secret) return;

	// Without Redis the unique key still keeps every notice single.
	const lock = await acquireRedisLock(LOCK_KEY, TICK_LOCK_TTL_MS).catch(() => null);
	try {
		const feed = await fetchJudgeProgress(secret);
		if (feed) await processJudgeProgress(feed);
		await getPrisma()
			.zktJudgeProgressNotice.deleteMany({where: {created_at: {lt: new Date(Date.now() - NOTICE_RETENTION_MS)}}})
			.catch(() => undefined);
	} finally {
		try {
			await (lock as any)?.release();
		} catch {
			// ignore
		}
	}
}

/** Claim and send what the feed calls for. Exported for the tests. */
export async function processJudgeProgress(feed: JudgeProgressFeed): Promise<void> {
	for (const competition of feed.competitions) {
		for (const group of competition.groups) {
			try {
				const attempt = await claimGroup(competition, group);
				if (attempt != null) await notify(competition, group, attempt);
			} catch (err: any) {
				logger.warn('[ZktJudgeProgress] group failed', {competition: competition.id, round: group.roundId, err: err?.message});
			}
		}
	}
}

const isUniqueViolation = (err: unknown) => err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';

/**
 * Decide for one group and take the claim. Returns the attempt to notify when
 * this server won it, else null.
 */
async function claimGroup(competition: JudgeProgressCompetition, group: JudgeProgressGroup): Promise<number | null> {
	const thresholds = progressThresholds(group.attemptCount);
	const level = noticeLevel(group);
	if (thresholds.length === 0 || level < Math.min(...thresholds)) return null;

	const prisma = getPrisma();
	const key = {round_id: group.roundId, group_key: group.groupKey, since: group.since};
	const done = await prisma.zktJudgeProgressNotice.findMany({where: key, select: {threshold: true}});
	const decision = decideProgress(thresholds, level, new Set(done.map((d) => d.threshold)));
	if (decision.send == null) return null;

	const row = {...key, competition_id: competition.id, level};
	try {
		await prisma.zktJudgeProgressNotice.create({data: {...row, threshold: decision.send, sent: true}});
	} catch (err) {
		if (isUniqueViolation(err)) return null; // another server, or an earlier tick, has it
		throw err;
	}
	if (decision.quiet.length > 0) {
		await prisma.zktJudgeProgressNotice.createMany({
			data: decision.quiet.map((threshold) => ({...row, threshold, sent: false})),
			skipDuplicates: true,
		});
	}
	return decision.send;
}

async function notify(competition: JudgeProgressCompetition, group: JudgeProgressGroup, attempt: number): Promise<void> {
	if (competition.recipients.length === 0) return;
	// The ZKT identity lives on the integration row. revoked_at is not checked on
	// purpose: it only marks a dead refresh token, the identity link still holds
	// (same as cron_zkt_registration_notify.ts).
	const links = await getPrisma().integration.findMany({
		where: {service_name: 'zkt', zkt_user_id: {in: competition.recipients}},
		select: {user: {include: {settings: true}}},
	});
	const users = [...new Map(links.map((l) => [l.user.id, l.user])).values()];
	if (users.length === 0) {
		logger.info('[ZktJudgeProgress] no linked staff account to notify', {competition: competition.id});
		return;
	}
	const optedOut = await getUserIdsWithPrefDisabled(
		users.map((u) => u.id),
		'zkt_judge_group_progress'
	);

	let sent = 0;
	for (const user of users) {
		if (optedOut.has(user.id)) continue;
		try {
			const notification = new ZktJudgeGroupProgressNotification(
				{user: user as any, triggeringUser: user as any, sendEmail: false},
				{competition, group, attempt, locale: (user as any).settings?.locale}
			);
			await notification.send();
			await sendPushToUser(user.id, notification.subject(), notification.detail(), notification.pushData());
			sent++;
		} catch (err: any) {
			logger.warn('[ZktJudgeProgress] notify failed', {userId: user.id, err: err?.message});
		}
	}
	logger.info('[ZktJudgeProgress] notified', {competition: competition.id, round: group.roundId, group: group.groupNumber, attempt, sent});
}
