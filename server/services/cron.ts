import {CronJob} from 'cron';
import {logger} from './logger';
import {matchPlayersInLobby} from '../match/pair/pair_logic';
import {initSiteMapGeneration} from './sitemap';
import {getPrisma} from '../database';

export function initCronJobs() {
	initMatchPairingCronJob();
	initSiteMapGenerationCronJob();
	initUnverifiedAccountCleanupCronJob();
}

function initMatchPairingCronJob() {
	// Every minute
	const job = new CronJob(
		'*/3 * * * * *',
		async () => {
			await matchPlayersInLobby();
		},
		null,
		true,
		'America/Los_Angeles'
	);

	logger.debug('Initiated dev cron job for match pairing.', {
		running: job.running,
	});
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
