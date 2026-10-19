import axios from 'axios';
import {CronJob} from 'cron';
import {logger} from './logger';
import {getPrisma} from '../database';
import {acquireRedisLock, createRedisKey, getRedisPubClient, RedisNamespace} from './redis';
import {sendPushToUser} from './push';
import {getZktOrigin} from '../../shared/integration';
import {digestBody, groupFeedEvents, type ZktFeedEvent} from './zkt_registration_digest';
import ZktAdminRegistrationNotification from '../resources/notification_types/zkt_admin_registration';

// Tells the federation's admins when a member enters or withdraws from a ZKT
// competition: e-mail is out (the federation's mail plan allows 100 a day) and
// the federation has no app of its own, but its admins use this one with their
// ZKT accounts linked (Integration.zkt_user_id, service_name 'zkt').
//
// The federation decides who is told (its ADMIN role, sent back as
// `recipients`); this side only maps those accounts to ours. Polls the feed
// (/api/internal/v1/registration-events) rather than taking a webhook, so a
// registration on the federation never waits on this app, and a poller that was
// down catches up from its cursor.
//
// Delivery is at least once: the cursor moves only after the notifications are
// out. A crash in between, or Redis losing its last snapshot, repeats a digest;
// it never drops one.

const TICK_LOCK_TTL_MS = 55 * 1000;
const LOCK_KEY = createRedisKey(RedisNamespace.ZKT_FED_REGISTRATIONS, 'lock');
const CURSOR_KEY = createRedisKey(RedisNamespace.ZKT_FED_REGISTRATIONS, 'cursor').key;
/** Feed pages per tick (200 rows each). Catching up after a long outage spreads over a few ticks. */
const MAX_PAGES_PER_TICK = 5;

interface FeedResponse {
	events: ZktFeedEvent[];
	cursor: string;
	more: boolean;
	recipients: string[];
}

export function initZktRegistrationNotifyCronJob() {
	const job = new CronJob(
		'30 * * * * *', // every minute
		async () => {
			try {
				await runZktRegistrationNotifyTick();
			} catch (err: any) {
				logger.error('[ZktRegistrationNotify] tick crashed', {err: err?.message});
			}
		},
		null,
		true,
		'America/Los_Angeles'
	);
	logger.debug('[ZktRegistrationNotify] cron initialized', {running: job.running});
}

/** Null when the federation does not serve the feed yet (older deploy) or has no secret set. */
async function fetchFeed(after: string | null, secret: string): Promise<FeedResponse | null> {
	try {
		const res = await axios.get<FeedResponse>(`${getZktOrigin()}/api/internal/v1/registration-events/`, {
			params: after ? {after} : {},
			headers: {Authorization: `Bearer ${secret}`},
			timeout: 15000,
		});
		return res.data;
	} catch (err: any) {
		const status = err?.response?.status;
		if (status === 404 || status === 503) {
			logger.debug('[ZktRegistrationNotify] feed not available', {status});
			return null;
		}
		throw err;
	}
}

/** One tick. Exported so a script can run it on demand. */
export async function runZktRegistrationNotifyTick(): Promise<void> {
	const secret = process.env.ZKT_INTERNAL_API_SECRET;
	const redis = getRedisPubClient();
	if (!secret || !redis) return;

	const lock = await acquireRedisLock(LOCK_KEY, TICK_LOCK_TTL_MS);
	if (!lock) return;

	try {
		let cursor: string | null = await redis.get(CURSOR_KEY);
		const events: ZktFeedEvent[] = [];
		let recipients: string[] = [];

		for (let page = 0; page < MAX_PAGES_PER_TICK; page++) {
			const feed = await fetchFeed(cursor, secret);
			if (!feed) return;
			events.push(...feed.events);
			recipients = feed.recipients;
			cursor = feed.cursor;
			if (!feed.more) break;
		}

		if (events.length > 0) await notify(events, recipients);
		if (cursor) await redis.set(CURSOR_KEY, cursor);
	} finally {
		try {
			await (lock as any).release();
		} catch {
			// ignore
		}
	}
}

async function notify(events: ZktFeedEvent[], recipients: string[]): Promise<void> {
	if (recipients.length === 0) return;
	// The ZKT identity lives on the integration row. revoked_at is not checked on
	// purpose: it only marks a dead refresh token, the identity link still holds
	// (same as CompetitionLifecycleDiscovery).
	const links = await getPrisma().integration.findMany({
		where: {service_name: 'zkt', zkt_user_id: {in: recipients}},
		select: {user: true},
	});
	const admins = [...new Map(links.map((l) => [l.user.id, l.user])).values()];
	if (admins.length === 0) {
		logger.info('[ZktRegistrationNotify] no linked admin account to notify', {events: events.length});
		return;
	}

	for (const digest of groupFeedEvents(events)) {
		const body = digestBody(digest);
		for (const admin of admins) {
			try {
				await new ZktAdminRegistrationNotification(
					{user: admin as any, triggeringUser: admin as any, sendEmail: false},
					digest
				).send();
				await sendPushToUser(admin.id, digest.competition.name, body);
			} catch (err: any) {
				logger.warn('[ZktRegistrationNotify] notify failed', {adminId: admin.id, err: err?.message});
			}
		}
	}
	logger.info('[ZktRegistrationNotify] notified', {events: events.length, admins: admins.length});
}
