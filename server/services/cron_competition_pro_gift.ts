import {CronJob} from 'cron';
import {logger} from './logger';
import {acquireRedisLock, createRedisKey, RedisNamespace} from './redis';
import {runCompetitionProGiftTick} from './competition_pro_gift';

// Hands out competition Pro gifts once a competition's results are published
// (competition_pro_gift.ts). Every five minutes: a gift waits 15 minutes after
// the publish anyway, so a faster tick buys nothing. Redis lock, so in a
// multi-instance deploy only one instance runs a tick.

const TICK_LOCK_TTL_MS = 4 * 60 * 1000;
const LOCK_KEY = createRedisKey(RedisNamespace.COMPETITION_PRO_GIFT, 'lock');

export function initCompetitionProGiftCronJob() {
	const job = new CronJob(
		'0 */5 * * * *',
		async () => {
			try {
				const lock = await acquireRedisLock(LOCK_KEY, TICK_LOCK_TTL_MS);
				if (!lock) return;
				await runCompetitionProGiftTick();
			} catch (err: any) {
				logger.error('[CompetitionProGift] tick crashed', {err: err?.message});
			}
		},
		null,
		true,
		'America/Los_Angeles'
	);
	logger.debug('[CompetitionProGift] cron initialized', {running: job.running});
}
