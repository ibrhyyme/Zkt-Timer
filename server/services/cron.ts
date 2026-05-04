import {CronJob} from 'cron';
import {logger} from './logger';
import {initSiteMapGeneration} from './sitemap';
import {getPrisma} from '../database';
import {sendPushToUser} from './push';
import {initWcaCompetitionNotificationCronJob} from './cron_wca_notifications';
import {initWcaCompetitionCountdownCronJob} from './cron_wca_countdown';
import {syncAllWorldRecords} from './WorldRecordSyncService';
import {freezeOldArchives} from './CompetitionArchiveService';

const CUBE_NAMES: Record<string, string> = {
	'222': '2x2', '333': '3x3', '444': '4x4', '555': '5x5',
	'666': '6x6', '777': '7x7', 'sq1': 'Square-1', 'pyram': 'Pyraminx',
	'clock': 'Clock', 'skewb': 'Skewb', 'minx': 'Megaminx',
	'333mirror': '3x3 Mirror', '222oh': '2x2 OH', '333oh': '3x3 OH',
	'333bl': '3x3 Blind', 'other': 'Other',
};

export function initCronJobs() {
	initSiteMapGenerationCronJob();
	initUnverifiedAccountCleanupCronJob();
	initDailyGoalReminderCronJob();
	initProPremiumExpiryCronJob();
	initWcaCompetitionNotificationCronJob();
	initWcaCompetitionCountdownCronJob();
	initWorldRecordSyncCronJob();
	initRankingRecalculationCronJob();
	initCompetitionFollowCleanupCronJob();
	initArchiveFreezeCronJob();
}

function initArchiveFreezeCronJob() {
	// Her gun 04:00 LA — end_date'i 30 gun gecen arsivleri donmus yap
	// Donmus arsivler artik re-sync'lenmez, sadece okunur
	const job = new CronJob(
		'0 0 4 * * *',
		async () => {
			try {
				await freezeOldArchives();
			} catch (e) {
				logger.error('[Archive] freeze cron failed', {error: e});
			}
		},
		null,
		true,
		'America/Los_Angeles',
	);
	logger.debug('Initiated cron job for archive freeze.', {running: job.running});
}

function initCompetitionFollowCleanupCronJob() {
	// Her gun 03:30 — bitmis yarismalarin takip kayitlarini sil
	// 1) state'i olan comps: end_date + 7 gun gecince
	// 2) state'i olmayan comps (sadece takipci): created_at + 60 gun gecince fallback
	const job = new CronJob(
		'0 30 3 * * *',
		async () => {
			try {
				const prisma = getPrisma();
				const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
				const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

				// 1. State-based: end_date'i 7+ gun gecmis yarismalardaki follow'lari sil
				const expiredStates = await prisma.wcaCompetitionNotificationState.findMany({
					where: {end_date: {lt: sevenDaysAgo}},
					select: {competition_id: true},
					distinct: ['competition_id'],
				});
				let stateBasedCount = 0;
				if (expiredStates.length > 0) {
					const ids = expiredStates.map((s) => s.competition_id);
					const result = await prisma.competitionFollow.deleteMany({
						where: {competition_id: {in: ids}},
					});
					stateBasedCount = result.count;
				}

				// 2. Fallback: 60+ gun once olusturulmus follow kayitlari (state yoksa)
				// Cogu WCA yarismasi 1-3 gun, en uzunu da 7 gun. 60 gun guvenli sinir.
				const orphanResult = await prisma.competitionFollow.deleteMany({
					where: {created_at: {lt: sixtyDaysAgo}},
				});

				const total = stateBasedCount + orphanResult.count;
				if (total > 0) {
					logger.info(
						`[CompFollowCleanup] removed ${stateBasedCount} state-based + ${orphanResult.count} orphan follow record(s)`,
					);
				}
			} catch (e) {
				logger.error('[CompFollowCleanup] cleanup failed', {error: e});
			}
		},
		null,
		true,
		'America/Los_Angeles',
	);
	logger.debug('Initiated cron job for competition follow cleanup.', {running: job.running});
}

function initWorldRecordSyncCronJob() {
	// Haftada bir pazar 04:00 — WR'lari Robin WCA REST API'dan cek, DB'ye yaz
	const job = new CronJob(
		'0 0 4 * * 0',
		async () => {
			try {
				logger.info('[WRSync] Weekly world record sync starting');
				await syncAllWorldRecords();
			} catch (e) {
				logger.error('[WRSync] Cron run failed', {error: e});
			}
		},
		null,
		true,
		'America/Los_Angeles'
	);
	logger.debug('Initiated cron job for world record sync.', {running: job.running});
}

function initRankingRecalculationCronJob() {
	// Her gece 03:00 — tum WCA bagli kullanicilarin Kinch+SoR skorlarini yeniden hesapla
	const job = new CronJob(
		'0 0 3 * * *',
		async () => {
			try {
				const {recalculateAllRankings} = require('../models/ranking');
				logger.info('[Rankings] Daily recalculation starting');
				await recalculateAllRankings();
			} catch (e) {
				logger.error('[Rankings] Daily recalculation failed', {error: e});
			}
		},
		null,
		true,
		'America/Los_Angeles'
	);
	logger.debug('Initiated cron job for daily ranking recalculation.', {running: job.running});
}

function initSiteMapGenerationCronJob() {
	// Every 2nd hour
	const job = new CronJob(
		'0 0 */2 * * *',
		async () => {
			logger.info('Requesting sitemap to be updated');
			initSiteMapGeneration();
		},
		null,
		true,
		'America/Los_Angeles'
	);
	logger.debug('Initiated dev cron job for generating sitemap.', {
		running: job.running,
	});
}

function initUnverifiedAccountCleanupCronJob() {
	const job = new CronJob(
		'0 */5 * * * *',
		async () => {
			try {
				const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
				const result = await getPrisma().userAccount.deleteMany({
					where: {
						email_verified: false,
						created_at: {
							lt: thirtyMinAgo,
						},
					},
				});
				if (result.count > 0) {
					logger.info(`Deleted ${result.count} unverified account(s)`);
				}
			} catch (e) {
				logger.error('Error cleaning up unverified accounts', {error: e});
			}
		},
		null,
		true,
		'America/Los_Angeles'
	);

	logger.debug('Initiated cron job for unverified account cleanup.', {
		running: job.running,
	});
}

function initProPremiumExpiryCronJob() {
	const job = new CronJob(
		'0 0 * * * *',
		async () => {
			try {
				const prisma = getPrisma();
				const now = new Date();

				const proResult = await prisma.userAccount.updateMany({
					where: {
						is_pro: true,
						pro_expires_at: {lt: now},
					},
					data: {
						is_pro: false,
						pro_expires_at: null,
					},
				});

				const premiumResult = await prisma.userAccount.updateMany({
					where: {
						is_premium: true,
						premium_expires_at: {lt: now},
					},
					data: {
						is_premium: false,
						premium_expires_at: null,
					},
				});

				const total = proResult.count + premiumResult.count;
				if (total > 0) {
					logger.info(`[ProExpiry] Expired ${proResult.count} Pro and ${premiumResult.count} Premium membership(s)`);
				}
			} catch (e) {
				logger.error('[ProExpiry] Error expiring memberships', {error: e});
			}
		},
		null,
		true,
		'America/Los_Angeles'
	);

	logger.debug('Initiated cron job for Pro/Premium expiry.', {running: job.running});
}

function initDailyGoalReminderCronJob() {
	// Her saat basinda
	const job = new CronJob(
		'0 0 * * * *',
		async () => {
			await checkDailyGoalReminders();
		},
		null,
		true,
		'America/Los_Angeles'
	);

	logger.debug('Initiated cron job for daily goal reminders.', {
		running: job.running,
	});
}

async function checkDailyGoalReminders() {
	try {
		const prisma = getPrisma();
		const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

		// Reminder acik + son 1 saat icinde bildirim gonderilmemis kullanicilar
		const users = await prisma.userAccount.findMany({
			where: {
				daily_goal_reminder: true,
				OR: [
					{last_daily_goal_reminder: null},
					{last_daily_goal_reminder: {lt: oneHourAgo}},
				],
			},
			select: {
				id: true,
				daily_goals: {where: {enabled: true}},
			},
		});

		if (users.length === 0) return;

		const todayStart = new Date();
		todayStart.setHours(0, 0, 0, 0);
		const todayStartMs = BigInt(todayStart.getTime());

		let sentCount = 0;

		for (const user of users) {
			if (user.daily_goals.length === 0) continue;

			const incompleteGoals: Array<{cube_type: string; current: number; target: number}> = [];

			for (const goal of user.daily_goals) {
				const count = await prisma.solve.count({
					where: {
						user_id: user.id,
						cube_type: goal.cube_type,
						from_timer: true,
						started_at: {gte: todayStartMs},
					},
				});

				if (count < goal.target) {
					incompleteGoals.push({
						cube_type: goal.cube_type,
						current: count,
						target: goal.target,
					});
				}
			}

			if (incompleteGoals.length === 0) continue;

			// Bildirim gonder
			const first = incompleteGoals[0];
			const cubeName = CUBE_NAMES[first.cube_type] || first.cube_type;
			const body =
				incompleteGoals.length === 1
					? `${cubeName}: ${first.current}/${first.target}`
					: `${cubeName}: ${first.current}/${first.target} (+${incompleteGoals.length - 1})`;

			sendPushToUser(user.id, 'Zkt Timer', body).catch(() => {});
			sentCount++;

			// Son bildirim zamanini guncelle
			await prisma.userAccount.update({
				where: {id: user.id},
				data: {last_daily_goal_reminder: new Date()},
			});
		}

		if (sentCount > 0) {
			logger.info(`[DailyGoal] Sent reminders to ${sentCount} user(s)`);
		}
	} catch (error) {
		logger.error('[DailyGoal] Reminder cron error:', error);
	}
}
