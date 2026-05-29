import {CronJob} from 'cron';
import {logger} from './logger';
import {acquireRedisLock, createRedisKey, RedisNamespace} from './redis';
import {runWcaBackfill} from './WcaBackfillService';
import {getSiteConfig} from '../models/site_config';

const TICK_LOCK_TTL_MS = 30 * 60 * 1000; // 30 minutes
const LOCK_KEY = createRedisKey(RedisNamespace.WCA_WCIF, 'backfill_cron_lock');

/**
 * Every night at LA 03:00 (= TR 13:00) — scan and fill missing wca_user_id / wca_id records.
 * Can be disabled via site config "wca_backfill_enabled=false".
 * Redis distributed lock — in multi-instance deploy, only one instance runs at a time.
 */
export function initWcaBackfillCronJob() {
	const job = new CronJob(
		'0 0 3 * * *',
		async () => {
			try {
				const config = await getSiteConfig();
				if ((config as any).wca_backfill_enabled === false) {
					logger.info('[WcaBackfill] disabled via site config, skipping tick');
					return;
				}

				const lock = await acquireRedisLock(LOCK_KEY, TICK_LOCK_TTL_MS);
				if (!lock) {
					logger.info('[WcaBackfill] tick skipped — busy');
					return;
				}

				logger.info('[WcaBackfill] starting tick');
				const result = await runWcaBackfill({batchSize: 500});
				// In ES log mapping "error" field is indexed as object — rename to avoid integer conflict
				const {error: errorCount, ...logSafeResult} = result;
				logger.info('[WcaBackfill] tick done', {...logSafeResult, errorCount});
			} catch (e: any) {
				logger.error('[WcaBackfill] cron failed', {error: e?.message});
			}
		},
		null,
		true,
		'America/Los_Angeles',
	);
	logger.debug('Initiated cron job for WCA backfill.', {running: job.running});
}
