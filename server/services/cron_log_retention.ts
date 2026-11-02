import {CronJob} from 'cron';
import {logger} from './logger';
import {acquireRedisLock, createRedisKey, RedisNamespace} from './redis';
import {getSearchClient} from './search';

/**
 * Server log retention.
 *
 * Request logs hold IP addresses, and winston-elasticsearch opens a new index every day
 * with nothing to ever close one. The privacy page gives a limit, so this is what enforces
 * it: whole daily indices are dropped once they pass it.
 */
const RETENTION_DAYS = 365;
const LOCK_KEY = createRedisKey(RedisNamespace.PRO_DATA, 'log_retention_cron_lock');
const LOCK_TTL_MS = 10 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// Exact on purpose: this cluster also holds the competition archive, which is permanent.
const LOG_INDEX = /^logs-(\d{4})\.(\d{2})\.(\d{2})$/;

export function expiredLogIndices(indices: string[], now: number): string[] {
	const cutoff = now - RETENTION_DAYS * DAY_MS;

	return indices.filter((index) => {
		const match = LOG_INDEX.exec(index);
		if (!match) return false;
		const [, year, month, day] = match.map(Number);
		return Date.UTC(year, month - 1, day) < cutoff;
	});
}

export async function runTick() {
	const client = getSearchClient();
	if (!client) {
		return;
	}

	// Several app instances share one cluster, so only one of them should sweep.
	const acquired = await acquireRedisLock(LOCK_KEY, LOCK_TTL_MS);
	if (!acquired) {
		return;
	}

	const rows = await client.cat.indices({index: 'logs-*', format: 'json', h: 'index'});
	const expired = expiredLogIndices(
		rows.map((row) => row.index),
		Date.now()
	);

	// One at a time: a full year can be waiting on the first run, too long for one URL.
	for (const index of expired) {
		await client.indices.delete({index});
	}

	if (expired.length > 0) {
		logger.info('[LogRetention] swept', {indices: expired.length, retention_days: RETENTION_DAYS});
	}
}

export function initLogRetentionCronJob() {
	const job = new CronJob(
		'0 50 4 * * *', // Daily at 04:50
		async () => {
			try {
				await runTick();
			} catch (err: any) {
				logger.error('[LogRetention] tick crashed', {err: err?.message});
			}
		},
		null,
		true,
		'America/Los_Angeles'
	);

	logger.debug('[LogRetention] cron initialized', {running: job.running, retention_days: RETENTION_DAYS});
}
