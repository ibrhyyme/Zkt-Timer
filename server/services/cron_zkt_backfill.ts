import {CronJob} from 'cron';
import {logger} from './logger';
import {acquireRedisLock, createRedisKey, RedisNamespace} from './redis';
import {runZktBackfill} from './ZktBackfillService';
import {getSiteConfig} from '../models/site_config';

const TICK_LOCK_TTL_MS = 30 * 60 * 1000; // 30 minutes
const LOCK_KEY = createRedisKey(RedisNamespace.ZKT_FED_PERSON, 'backfill_cron_lock');

/**
 * Every night at LA 03:15 (= TR 13:15) — ask the federation for the ZKT IDs of
 * members who did not have one yet. Runs a quarter hour after the WCA backfill
 * so the two do not hit the database at the same moment.
 *
 * One bulk request covers every pending member, so a nightly run costs a single
 * HTTP call whether or not a competition was published that day. That is why
 * there is no attempt to detect "results were published today": the cheap thing
 * is to just ask, and a run that finds nothing is free.
 *
 * Can be disabled via site config "zkt_backfill_enabled=false".
 * Redis distributed lock — in multi-instance deploy, only one instance runs.
 */
export function initZktBackfillCronJob() {
	const job = new CronJob(
		'0 15 3 * * *',
		async () => {
			try {
				const config = await getSiteConfig();
				if ((config as any).zkt_backfill_enabled === false) {
					logger.info('[ZktBackfill] disabled via site config, skipping tick');
					return;
				}

				const lock = await acquireRedisLock(LOCK_KEY, TICK_LOCK_TTL_MS);
				if (!lock) {
					logger.info('[ZktBackfill] tick skipped — busy');
					return;
				}

				logger.info('[ZktBackfill] starting tick');
				const result = await runZktBackfill();
				// In ES log mapping "error" is indexed as object — rename to avoid conflict
				const {error: errorCount, ...logSafeResult} = result;
				logger.info('[ZktBackfill] tick done', {...logSafeResult, errorCount});
			} catch (e: any) {
				logger.error('[ZktBackfill] cron failed', {error: e?.message});
			}
		},
		null,
		true,
		'America/Los_Angeles',
	);
	logger.debug('Initiated cron job for ZKT backfill.', {running: job.running});
}
