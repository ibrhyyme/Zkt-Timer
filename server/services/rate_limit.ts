import {getRedisPubClient} from './redis';
import {logger} from './logger';

export type RateLimitResult = {
	allowed: boolean;
	count: number;
	ttl: number;
};

export type RateLimitOptions = {
	// When Redis is unreachable the default is to refuse (right for writes and
	// anything abuse prone). A read that should keep working through a short Redis
	// outage (a shared set page, a public list) passes `failOpen: true` instead.
	failOpen?: boolean;
};

// Reads a counter without consuming from it. Use when the budget should only be
// spent on specific outcomes (e.g. only wrong OTP guesses, not correct ones).
// Fails closed like checkRateLimit does when Redis is unreachable, unless failOpen
// is set, in which case it reports an empty counter.
export async function peekRateLimit(key: string, options?: RateLimitOptions): Promise<number> {
	const failValue = options?.failOpen ? 0 : Number.MAX_SAFE_INTEGER;
	try {
		const client = getRedisPubClient();
		if (!client) {
			logger.warn(
				options?.failOpen
					? 'Rate limit peek skipped: Redis not available, letting request through'
					: 'Rate limit peek skipped: Redis not available, blocking request',
				{key}
			);
			return failValue;
		}

		const raw = await client.get(`cd:ratelimit:${key}`);
		return raw ? parseInt(raw, 10) || 0 : 0;
	} catch (e) {
		logger.error(
			options?.failOpen
				? 'Rate limit peek failed, letting request through'
				: 'Rate limit peek failed, blocking request as safety measure',
			{key, error: e}
		);
		return failValue;
	}
}

export async function checkRateLimit(
	key: string,
	max: number,
	windowSeconds: number,
	options?: RateLimitOptions
): Promise<RateLimitResult> {
	const failResult: RateLimitResult = {allowed: !!options?.failOpen, count: 0, ttl: windowSeconds};
	try {
		const client = getRedisPubClient();
		if (!client) {
			logger.warn(
				options?.failOpen
					? 'Rate limit check skipped: Redis not available, letting request through'
					: 'Rate limit check skipped: Redis not available, blocking request',
				{key}
			);
			return failResult;
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
		logger.error(
			options?.failOpen
				? 'Rate limit check failed, letting request through'
				: 'Rate limit check failed, blocking request as safety measure',
			{key, error: e}
		);
		return failResult;
	}
}
