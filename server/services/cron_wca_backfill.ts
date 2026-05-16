import {CronJob} from 'cron';
import {logger} from './logger';
import {acquireRedisLock, createRedisKey, RedisNamespace} from './redis';
import {runWcaBackfill} from './WcaBackfillService';
import {getSiteConfig} from '../models/site_config';

const TICK_LOCK_TTL_MS = 30 * 60 * 1000; // 30 dakika
const LOCK_KEY = createRedisKey(RedisNamespace.WCA_WCIF, 'backfill_cron_lock');

/**
 * Her gece LA 03:00 (= TR 13:00) — eksik wca_user_id / wca_id kayitlari tarayip doldurur.
 * Site config "wca_backfill_enabled=false" ile durdurulabilir.
 * Redis distributed lock — multi-instance deploy'da sadece bir instance calistirir.
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
				logger.info('[WcaBackfill] tick done', result);
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
