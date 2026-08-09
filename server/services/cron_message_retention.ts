import {CronJob} from 'cron';
import {getPrisma} from '../database';
import {logger} from './logger';
import {acquireRedisLock, createRedisKey, RedisNamespace} from './redis';

/**
 * Message retention.
 *
 * Keeping private messages forever is not a neutral default. KVKK requires personal
 * data to be held only as long as the purpose that justified collecting it, and the
 * purpose here (letting two people carry on a conversation) does not survive a year of
 * silence. So old message rows are deleted outright rather than anonymised: there is
 * nothing useful left once the text is gone.
 *
 * Conversations that end up with no messages at all are removed too, which cascades to
 * their participant rows and stops empty threads accumulating in everyone's inbox.
 */
const RETENTION_DAYS = 365;
const LOCK_KEY = createRedisKey(RedisNamespace.PRO_DATA, 'message_retention_cron_lock');
const LOCK_TTL_MS = 10 * 60 * 1000;

async function runTick() {
	// Several app instances share one database, so only one of them should sweep.
	const acquired = await acquireRedisLock(LOCK_KEY, LOCK_TTL_MS);
	if (!acquired) {
		return;
	}

	const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

	const deletedMessages = await getPrisma().message.deleteMany({
		where: {created_at: {lt: cutoff}},
	});

	// Only threads that are now completely empty; a thread with one recent message
	// still belongs to its participants.
	const emptyConversations = await getPrisma().conversation.deleteMany({
		where: {messages: {none: {}}, created_at: {lt: cutoff}},
	});

	if (deletedMessages.count > 0 || emptyConversations.count > 0) {
		logger.info('[MessageRetention] swept', {
			messages: deletedMessages.count,
			conversations: emptyConversations.count,
			retention_days: RETENTION_DAYS,
		});
	}
}

export function initMessageRetentionCronJob() {
	const job = new CronJob(
		'0 30 4 * * *', // Daily at 04:30
		async () => {
			try {
				await runTick();
			} catch (err: any) {
				logger.error('[MessageRetention] tick crashed', {err: err?.message});
			}
		},
		null,
		true,
		'America/Los_Angeles'
	);

	logger.debug('[MessageRetention] cron initialized', {running: job.running, retention_days: RETENTION_DAYS});
}
