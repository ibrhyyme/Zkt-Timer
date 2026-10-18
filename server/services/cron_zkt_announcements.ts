// ZKT competition announcements, broadcast to every user with push enabled:
//
// 1. a new competition appears in the federation list as ANNOUNCED (or straight
//    to REGISTRATION_OPEN): "X announced, registration opens <date time>"
// 2. shortly before the planned opening: "registration opens soon"
//
// ZKT only. WCA competitions are never announced: they are not ours to
// announce, and a registrant of one still gets the per-registrant lifecycle
// notifications from cron_competition_lifecycle.ts.
//
// The federation list carries status but no registration dates, so the opening
// time comes from the competition's WCIF (registrationInfo.openTime). Opening is
// a manual action on the federation; the WCIF time is the plan, which is why the
// reminder re-reads it right before sending.

import {CronJob} from 'cron';
import {getPrisma} from '../database';
import {logger} from './logger';
import {acquireRedisLock, createRedisKey, RedisNamespace} from './redis';
import {sendPushToAllLocalized} from './push';
import {ZktFederationService} from './ZktFederationService';
import {
	announcementVariant,
	decideAnnouncement,
	decideReminder,
	REGISTRATION_REMINDER_LEAD_MS,
	wcifRegistrationOpenAt,
	wcifTimezone,
	ZKT_ANNOUNCEABLE_STATUSES,
} from './CompetitionLifecycle';
import {buildZktAnnouncementText, ZktAnnouncementStage} from '../resources/notification_types/zkt_competition_announced';
import {LIFECYCLE_LOCALES} from '../resources/notification_types/competition_lifecycle_base';
import {NotificationType} from '../@types/enums';

const TICK_LOCK_TTL_MS = 240_000; // < 5 min interval
const LOCK_KEY = createRedisKey(RedisNamespace.COMPETITION_LIFECYCLE, 'zkt_announce_lock');

// WCIF reads per tick, against the federation's shared 60/min budget.
const MAX_WCIF_READS_PER_TICK = 3;
// How stale a stored opening time may get before it is re-read.
const OPEN_REFRESH_NEAR_MS = 60 * 60 * 1000; // opening within a day
const OPEN_REFRESH_FAR_MS = 6 * 60 * 60 * 1000;
const NEAR_WINDOW_MS = 24 * 60 * 60 * 1000;
// Rows for competitions long gone are dropped.
const RETENTION_DAYS = 60;

type Row = Awaited<ReturnType<typeof loadRows>>[number];

function loadRows() {
	return getPrisma().zktCompetitionAnnouncement.findMany();
}

export function initZktAnnouncementCronJob() {
	const job = new CronJob(
		'15 */5 * * * *', // Every 5 minutes
		async () => {
			try {
				await runZktAnnouncementTick();
			} catch (err: any) {
				logger.error('[ZktAnnounce] tick crashed', {err: err?.message});
			}
		},
		null,
		true,
		'America/Los_Angeles'
	);
	logger.debug('[ZktAnnounce] cron initialized', {running: job.running});
}

/** One tick. Exported so a script or an admin action can run it on demand. */
export async function runZktAnnouncementTick() {
	const lock = await acquireRedisLock(LOCK_KEY, TICK_LOCK_TTL_MS);
	if (!lock) {
		logger.info('[ZktAnnounce] tick skipped, busy');
		return;
	}

	try {
		const now = new Date();
		let payload: any;
		try {
			payload = await ZktFederationService.fetchCompetitions({page: 0, pageSize: 100});
		} catch (err: any) {
			logger.warn('[ZktAnnounce] list fetch failed', {err: err?.message});
			return;
		}

		const rows = await syncRows(payload?.items || []);
		const budget = {wcifReads: MAX_WCIF_READS_PER_TICK};

		for (const row of rows) {
			if (!row.seeded && !row.announced_at && !row.cancelled) {
				await tryAnnounce(row, now, budget).catch((err: any) => {
					logger.warn('[ZktAnnounce] announce failed', {competitionId: row.competition_id, err: err?.message});
				});
			}
		}
		for (const row of rows) {
			await refreshOpenTime(row, now, budget).catch((err: any) => {
				logger.warn('[ZktAnnounce] open time refresh failed', {competitionId: row.competition_id, err: err?.message});
			});
		}
		for (const row of rows) {
			if (!row.reminder_sent_at) {
				await tryRemind(row, now, budget).catch((err: any) => {
					logger.warn('[ZktAnnounce] reminder failed', {competitionId: row.competition_id, err: err?.message});
				});
			}
		}

		await getPrisma().zktCompetitionAnnouncement.deleteMany({
			where: {
				start_date: {not: '', lt: new Date(now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)},
			},
		});
	} finally {
		try {
			await (lock as any).release();
		} catch {
			// ignore
		}
	}
}

/**
 * Mirror the federation list into our table. A competition seen for the first
 * time is pending announcement only when it is announceable; everything present
 * on the very first scan, or first seen past that stage, is seeded silently.
 */
async function syncRows(items: any[]): Promise<Row[]> {
	const prisma = getPrisma();
	const rows = await loadRows();
	const byId = new Map(rows.map((r) => [r.competition_id, r]));
	const firstScan = rows.length === 0;
	let created = 0;

	for (const item of items) {
		if (!item?.id) continue;
		const status = String(item.status || '').toUpperCase();
		const fields = {
			slug: item.slug || item.id,
			name: item.name || item.shortName || item.slug || item.id,
			status,
			start_date: String(item.startDate || '').slice(0, 10),
			cancelled: status === 'CANCELLED',
		};
		const row = byId.get(item.id);
		if (!row) {
			const createdRow = await prisma.zktCompetitionAnnouncement.create({
				data: {
					competition_id: item.id,
					...fields,
					seeded: firstScan || !ZKT_ANNOUNCEABLE_STATUSES.has(status) || fields.cancelled,
				},
			});
			byId.set(item.id, createdRow);
			created++;
			continue;
		}
		const changed =
			row.slug !== fields.slug ||
			row.name !== fields.name ||
			row.status !== fields.status ||
			row.start_date !== fields.start_date ||
			row.cancelled !== fields.cancelled;
		if (changed) {
			byId.set(item.id, await prisma.zktCompetitionAnnouncement.update({where: {competition_id: item.id}, data: fields}));
		}
	}

	if (created) logger.info('[ZktAnnounce] new competitions', {created, seeded: firstScan});
	return [...byId.values()];
}

async function readWcif(row: Row, now: Date): Promise<{openAt: Date | null; timezone: string | null} | null> {
	let wcif: any = null;
	try {
		wcif = await ZktFederationService.fetchWcif(row.slug);
	} catch {
		return null;
	}
	if (!wcif) return null;
	const openAt = wcifRegistrationOpenAt(wcif);
	const timezone = wcifTimezone(wcif);
	await getPrisma().zktCompetitionAnnouncement.update({
		where: {competition_id: row.competition_id},
		data: {registration_open_at: openAt, timezone, open_checked_at: now},
	});
	Object.assign(row, {registration_open_at: openAt, timezone, open_checked_at: now});
	return {openAt, timezone};
}

async function broadcast(row: Row, stage: ZktAnnouncementStage) {
	const result = await sendPushToAllLocalized({
		prefKey: NotificationType.ZKT_COMPETITION_ANNOUNCED,
		locales: LIFECYCLE_LOCALES,
		fallbackLocale: 'en',
		build: (locale) =>
			buildZktAnnouncementText(locale, {
				stage,
				competitionName: row.name,
				openAt: row.registration_open_at,
				timezone: row.timezone,
			}),
		data: {
			type: NotificationType.ZKT_COMPETITION_ANNOUNCED,
			stage,
			competitionId: `zkt-${row.slug}`,
			link: `/competitions/zkt-${row.slug}`,
		},
	});
	logger.info('[ZktAnnounce] broadcast', {competitionId: row.competition_id, stage, ...result});
}

async function tryAnnounce(row: Row, now: Date, budget: {wcifReads: number}) {
	const prisma = getPrisma();
	const decision = decideAnnouncement({status: row.status, startDate: row.start_date, cancelled: row.cancelled, now});
	if (decision === 'wait') return;
	if (decision === 'skip') {
		await prisma.zktCompetitionAnnouncement.update({where: {competition_id: row.competition_id}, data: {seeded: true}});
		row.seeded = true;
		return;
	}

	if (budget.wcifReads <= 0) return;
	budget.wcifReads--;
	const wcif = await readWcif(row, now);
	if (!wcif) return; // try again next tick; the announcement needs the opening time

	const claim = await prisma.zktCompetitionAnnouncement.updateMany({
		where: {competition_id: row.competition_id, announced_at: null},
		data: {announced_at: now},
	});
	if (claim.count !== 1) return;
	row.announced_at = now;

	await broadcast(row, announcementVariant({status: row.status, openAt: wcif.openAt, now}));
}

/** Keep the stored opening time current, more often as it gets close. */
async function refreshOpenTime(row: Row, now: Date, budget: {wcifReads: number}) {
	if (row.cancelled || row.reminder_sent_at || !ZKT_ANNOUNCEABLE_STATUSES.has(row.status)) return;
	if (!row.seeded && !row.announced_at) return;
	if (budget.wcifReads <= 0) return;

	const openAt = row.registration_open_at;
	const near = openAt && openAt.getTime() - now.getTime() < NEAR_WINDOW_MS;
	const maxAge = near ? OPEN_REFRESH_NEAR_MS : OPEN_REFRESH_FAR_MS;
	if (row.open_checked_at && now.getTime() - row.open_checked_at.getTime() < maxAge) return;

	budget.wcifReads--;
	await readWcif(row, now);
}

async function tryRemind(row: Row, now: Date, budget: {wcifReads: number}) {
	const prisma = getPrisma();
	const decide = () =>
		decideReminder({
			openAt: row.registration_open_at,
			now,
			status: row.status,
			cancelled: row.cancelled,
			announcedAt: row.announced_at,
			eligible: row.seeded || !!row.announced_at,
		});

	let decision = decide();
	if (decision === 'wait') return;
	if (decision === 'send') {
		// Confirm the time right before sending: organizers move openings.
		const stale = !row.open_checked_at || now.getTime() - row.open_checked_at.getTime() > REGISTRATION_REMINDER_LEAD_MS / 4;
		if (stale) {
			if (budget.wcifReads <= 0) return;
			budget.wcifReads--;
			if (!(await readWcif(row, now))) return;
			decision = decide();
			if (decision === 'wait') return;
		}
	}

	const claim = await prisma.zktCompetitionAnnouncement.updateMany({
		where: {competition_id: row.competition_id, reminder_sent_at: null},
		data: {reminder_sent_at: now},
	});
	if (claim.count !== 1) return;
	row.reminder_sent_at = now;

	if (decision === 'send') {
		await broadcast(row, row.status === 'REGISTRATION_OPEN' ? 'opened' : 'reminder');
	}
}
