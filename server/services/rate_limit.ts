import {getRedisPubClient} from './redis';
import {logger} from './logger';

export type RateLimitResult = {
	allowed: boolean;
	count: number;
	ttl: number;
};

export async function checkRateLimit(
	key: string,
	max: number,
	windowSeconds: number
): Promise<RateLimitResult> {
	try {
		const client = getRedisPubClient();
		if (!client) {
			return {allowed: true, count: 0, ttl: 0};
		}

		const fullKey = `cd:ratelimit:${key}`;
		const count = await client.incr(fullKey);

		if (count === 1) {
			await client.expire(fullKey, windowSeconds);
		}

		const ttl = await client.ttl(fullKey);

		return {
			allowed: count <= max,
			count,
			ttl: ttl > 0 ? ttl : windowSeconds,
		};
	} catch (e) {
		logger.error('Rate limit check failed', {key, error: e});
		return {allowed: true, count: 0, ttl: 0};
	}
}
