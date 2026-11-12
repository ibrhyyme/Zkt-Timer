import {getRedisPubClient} from './redis';
import {logger} from './logger';

/**
 * Escalating GIF cooldown, shared by room chat and direct messages.
 *
 * GIFs cost the server almost nothing (the media never touches us), so this is not a
 * load guard: it keeps one person from burying a room under a wall of pictures. A short
 * burst is normal (a solve, a "YESSS", a reaction to that), so the limit only trips on a
 * run nobody sends by accident, and each repeat within the hour costs more:
 * 1 minute, then 5, then 10. An hour without tripping it clears the record.
 *
 * Per user, not per room or thread: hopping rooms or switching to DMs does not reset it.
 */

/** More than this many GIFs inside BURST_WINDOW_SECONDS trips the cooldown. */
export const GIF_BURST_MAX = 5;
export const GIF_BURST_WINDOW_SECONDS = 30;
/** Cooldown per strike: 1st, 2nd, 3rd and every later one. */
export const GIF_COOLDOWN_STEPS_SECONDS = [60, 5 * 60, 10 * 60];
/** A strike is forgotten after this long without a new one. */
export const GIF_STRIKE_MEMORY_SECONDS = 60 * 60;

export interface GifSendCheck {
	allowed: boolean;
	/** Seconds until GIFs open again; 0 when allowed. */
	retryAfter: number;
}

/** The subset of ioredis this needs, so the escalation can be tested without Redis. */
export interface GifSpamStore {
	ttl(key: string): Promise<number>;
	incr(key: string): Promise<number>;
	expire(key: string, seconds: number): Promise<unknown>;
	set(key: string, value: string, mode: 'EX', seconds: number): Promise<unknown>;
	del(key: string): Promise<unknown>;
	zadd(key: string, score: number, member: string): Promise<unknown>;
	zremrangebyscore(key: string, min: number | string, max: number | string): Promise<unknown>;
	zcard(key: string): Promise<number>;
}

export function cooldownForStrike(strike: number): number {
	const index = Math.min(Math.max(strike, 1), GIF_COOLDOWN_STEPS_SECONDS.length) - 1;
	return GIF_COOLDOWN_STEPS_SECONDS[index];
}

const blockKey = (userId: string) => `zt:gif:block:${userId}`;
const burstKey = (userId: string) => `zt:gif:burst:${userId}`;
const strikeKey = (userId: string) => `zt:gif:strikes:${userId}`;

/**
 * Counts one GIF attempt and says whether it may go out.
 *
 * A refused attempt while blocked does not extend the block: someone hammering the
 * button during a cooldown gets the same countdown back, not a longer one.
 */
export async function checkGifSendWith(
	store: GifSpamStore,
	userId: string,
	now: number = Date.now()
): Promise<GifSendCheck> {
	const blockedFor = await store.ttl(blockKey(userId));
	if (blockedFor > 0) {
		return {allowed: false, retryAfter: blockedFor};
	}

	// A sliding window: the GIFs of the last 30 seconds, counted from now. A fixed window
	// (one counter that expires) let a burst straddle the reset and pass twice the limit,
	// which a browser test on 2026-11-12 did by accident with six in a row.
	const key = burstKey(userId);
	await store.zremrangebyscore(key, 0, now - GIF_BURST_WINDOW_SECONDS * 1000);
	await store.zadd(key, now, now + '-' + Math.random().toString(36).slice(2, 8));
	await store.expire(key, GIF_BURST_WINDOW_SECONDS);
	const count = await store.zcard(key);
	if (count <= GIF_BURST_MAX) {
		return {allowed: true, retryAfter: 0};
	}

	const strike = await store.incr(strikeKey(userId));
	await store.expire(strikeKey(userId), GIF_STRIKE_MEMORY_SECONDS);

	const cooldown = cooldownForStrike(strike);
	await store.set(blockKey(userId), '1', 'EX', cooldown);
	// The burst starts from zero once the cooldown is over.
	await store.del(burstKey(userId));

	return {allowed: false, retryAfter: cooldown};
}

/**
 * Fails open: with Redis down a GIF goes through. This is a spam brake, not a security
 * boundary, and refusing every GIF in the app during an outage would be worse than a
 * few minutes without the brake.
 */
export async function checkGifSend(userId: string): Promise<GifSendCheck> {
	const client = getRedisPubClient();
	if (!client) return {allowed: true, retryAfter: 0};

	try {
		return await checkGifSendWith(client as unknown as GifSpamStore, userId);
	} catch (error) {
		logger.warn('GIF cooldown check failed, letting it through', {error: (error as Error)?.message});
		return {allowed: true, retryAfter: 0};
	}
}
