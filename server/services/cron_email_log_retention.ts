import {CronJob} from 'cron';
import {getPrisma} from '../database';
import {logger} from './logger';
import {acquireRedisLock, createRedisKey, RedisNamespace} from './redis';

/**
 * Email log retention.
 *
 * The log only answers "did this email go out?", a question that stops mattering after a
 * few weeks, while each row keeps an address and a subject line. Rows with no user go
 * regardless of age: they are left by accounts deleted before the relation became a
 * cascade, or sent to a pending email address, which nothing ties back to the account.
 */
const RETENTION_DAYS = 90;
const LOCK_KEY = createRedisKey(RedisNamespace.PRO_DATA, 'email_log_retention_cron_lock');
const LOCK_TTL_MS = 10 * 60 * 1000;

export async function runTick() {
	// Several app instances share one database, so only one of them should sweep.
	const acquired = await acquireRedisLock(LOCK_KEY, LOCK_TTL_MS);
	if (!acquired) {
		return;
	}

	const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

	const deleted = await getPrisma().emailLog.deleteMany({
		where: {OR: [{created_at: {lt: cutoff}}, {user_id: null}]},
	});

	if (deleted.count > 0) {
		logger.info('[EmailLogRetention] swept', {rows: deleted.count, retention_days: RETENTION_DAYS});
	}
}

export function initEmailLogRetentionCronJob() {
	const job = new CronJob(
		'0 40 4 * * *', // Daily at 04:40
		async () => {
			try {
				await runTick();
			} catch (err: any) {
				logger.error('[EmailLogRetention] tick crashed', {err: err?.message});
			}
		},
		null,
		true,
		'America/Los_Angeles'
	);

	logger.debug('[EmailLogRetention] cron initialized', {running: job.running, retention_days: RETENTION_DAYS});
}
