import { getPrisma } from '../database';
import { logger } from './logger';

const THROTTLE_MS = 5 * 60 * 1000;
const lastWriteByUserId = new Map<string, number>();

export function updateLastSeen(userId: string) {
	if (!userId) return;
	const now = Date.now();
	const lastWrite = lastWriteByUserId.get(userId);
	if (lastWrite && now - lastWrite < THROTTLE_MS) return;

	lastWriteByUserId.set(userId, now);

	getPrisma().userAccount.update({
		where: { id: userId },
		data: { last_seen_at: new Date(now) },
	}).catch((err) => {
		lastWriteByUserId.delete(userId);
		logger.error('updateLastSeen failed', { userId, error: err?.message });
	});
}
