// Resilient read-through cache in front of the ZKT federation public API.
//
// Why this exists instead of the plain `fetchDataFromCache` TTL cache:
//
// The federation throttles its public API per client IP (60 requests per
// rolling minute, zekakuputurkiye-site lib/attempt-limit.ts API_LIMITS), and
// every Zkt-Timer user reaches it through this ONE server, so the whole user
// base shares that single budget. On a competition day the old cache spent it
// in seconds: each key expired on its own clock with no stale copy behind it,
// so an expiry was a forced upstream call, concurrent misses each made their
// own call, the live poller bypassed the cache entirely, and once the
// federation answered 429 the page had nothing to show at all.
//
// The rules here:
//   - Stale-while-revalidate. Every value is kept long after it stops being
//     fresh. A stale value is served immediately while one background refresh
//     runs, so a viewer never waits on (or fails because of) the federation
//     when we have ever seen the data.
//   - Single-flight per key. Concurrent readers of the same key share one
//     upstream request.
//   - Errors are never cached. A failed refresh leaves the last good value in
//     place; only a key we have never fetched can surface an error.
//   - Backoff. A 429 pauses ALL upstream calls for its Retry-After, and an
//     unreachable host pauses them for an exponentially growing time, so a
//     struggling federation is not hammered while it recovers. A 5xx or a
//     timeout on one URL pauses only that key (see isHostWideFailure).
//   - Outbound budget. A rolling one-minute counter keeps this server under
//     the federation's limit by itself, with headroom left for the OAuth and
//     internal calls that share the same IP. Background work gives way first.
//
// State is in-process (one server container, see docker-compose.yml). Values
// live in Redis so a restart keeps serving them.

import {logger} from './logger';

export type FetchPriority = 'high' | 'normal' | 'low';

export interface EnvelopeStore {
	get(key: string): Promise<string | null>;
	set(key: string, value: string, ttlSeconds: number): Promise<void>;
}

export interface CacheEnvelope<T> {
	v: T;
	t: number;
}

export interface CacheReadOptions {
	/** How long a value counts as fresh, in milliseconds. */
	freshMs: number;
	/**
	 * `swr` (default): stale values are served at once and refreshed in the
	 * background. `refresh`: a stale value is refreshed and the caller waits
	 * for it (falling back to the stale value if the refresh cannot run). The
	 * live poller uses `refresh`, because pushing the previous value again
	 * would delay every live update by one poll.
	 */
	mode?: 'swr' | 'refresh';
	/** Budget class for the upstream call this read may cause. */
	priority?: FetchPriority;
	/**
	 * How long a written value is kept as a fallback, in seconds. Defaults to
	 * three days. Keys built from free input (search text) pass a short value
	 * so they cannot pile up in Redis.
	 */
	keepSeconds?: number;
}

/** Thrown only when there is no value at all to fall back on. */
export class FederationUnavailableError extends Error {
	readonly reason: 'cooldown' | 'budget' | 'upstream';
	readonly retryAfterS: number;

	constructor(reason: 'cooldown' | 'budget' | 'upstream', retryAfterS: number, message?: string) {
		super(message || `ZKT federation unavailable (${reason}), retry in ${retryAfterS}s`);
		this.name = 'FederationUnavailableError';
		this.reason = reason;
		this.retryAfterS = retryAfterS;
	}
}

// --- Outbound budget ----------------------------------------------------------

/**
 * Per-priority ceilings on upstream calls in any rolling 60 seconds. The
 * federation allows 60 for this IP; 45 leaves 15 for ZKT sign-ins (token +
 * userinfo) and the ID backfill, which are counted in the same bucket over
 * there. Background refreshes (the live poller included) stop at 36 so a
 * viewer with nothing cached still gets through. `low` is for work that can
 * wait for a quiet minute.
 */
export const DEFAULT_BUDGET: Record<FetchPriority, number> = {
	high: 45,
	normal: 36,
	low: 24,
};

const BUDGET_WINDOW_MS = 60 * 1000;

export interface RequestBudget {
	tryAcquire(priority: FetchPriority, at?: number): boolean;
	used(at?: number): number;
	/** Seconds until the oldest counted call leaves the window. */
	secondsUntilSlot(at?: number): number;
}

export function createRequestBudget(
	caps: Record<FetchPriority, number> = DEFAULT_BUDGET,
	now: () => number = Date.now
): RequestBudget {
	let hits: number[] = [];
	const prune = (at: number) => {
		const cutoff = at - BUDGET_WINDOW_MS;
		if (hits.length && hits[0] <= cutoff) hits = hits.filter((t) => t > cutoff);
	};
	return {
		tryAcquire(priority, at = now()) {
			prune(at);
			if (hits.length >= caps[priority]) return false;
			hits.push(at);
			return true;
		},
		used(at = now()) {
			prune(at);
			return hits.length;
		},
		secondsUntilSlot(at = now()) {
			prune(at);
			if (!hits.length) return 0;
			return Math.max(1, Math.ceil((hits[0] + BUDGET_WINDOW_MS - at) / 1000));
		},
	};
}

// --- Backoff ------------------------------------------------------------------

const RATE_LIMIT_DEFAULT_PAUSE_S = 30;
const FAILURE_BASE_PAUSE_S = 3;
const FAILURE_MAX_PAUSE_S = 60;

export interface UpstreamFailureInfo {
	status?: number;
	retryAfterS?: number;
	/** Transport error code (axios `code`), e.g. ECONNABORTED on a timeout. */
	code?: string;
}

const TIMEOUT_CODES = new Set(['ECONNABORTED', 'ETIMEDOUT']);

/**
 * Whether a failure says something about the whole federation (pause every
 * call) or only about the one endpoint that failed (pause that key only).
 *
 * A 429 is the federation telling this IP to stop, and a refused or reset
 * connection means the host itself is unreachable: both pause everything. A
 * 5xx or a timeout on one URL is that URL's problem. Pausing everything for it
 * let one broken endpoint (a competition whose WCIF the federation fails to
 * build, say) freeze the live scoreboard and every other refresh, because each
 * new request for the broken key restarted and doubled the global pause.
 */
export function isHostWideFailure(info: UpstreamFailureInfo): boolean {
	if (info.status === 429) return true;
	if (info.status != null) return false;
	return !(info.code && TIMEOUT_CODES.has(info.code));
}

export interface Backoff {
	/** Milliseconds left in the current pause, 0 when calls may go out. */
	remainingMs(at?: number): number;
	onSuccess(): void;
	onFailure(info: UpstreamFailureInfo, at?: number): void;
}

export function createBackoff(now: () => number = Date.now): Backoff {
	let until = 0;
	let failures = 0;
	return {
		remainingMs(at = now()) {
			return Math.max(0, until - at);
		},
		onSuccess() {
			failures = 0;
			until = 0;
		},
		onFailure(info, at = now()) {
			let pauseS: number;
			if (info.status === 429) {
				// The federation says exactly when a slot frees up. Trust it, but
				// never retry sooner than a few seconds.
				pauseS = Math.max(5, info.retryAfterS || RATE_LIMIT_DEFAULT_PAUSE_S);
			} else {
				pauseS = Math.min(FAILURE_MAX_PAUSE_S, FAILURE_BASE_PAUSE_S * Math.pow(2, failures));
			}
			failures += 1;
			until = Math.max(until, at + pauseS * 1000);
		},
	};
}

// --- Cache --------------------------------------------------------------------

/** A stale value is served at once while it is younger than freshMs times this. */
const SWR_WINDOW_FACTOR = 4;
/** Older than that, the reader waits this long for a refresh before falling back. */
const STALE_REFRESH_WAIT_MS = 4000;
/** How long a value is kept as a fallback after it stops being fresh. */
const KEEP_SECONDS = 3 * 24 * 60 * 60;

export interface ResilientCache {
	read<T>(key: string, fetcher: () => Promise<T>, options: CacheReadOptions): Promise<T>;
	/** Store a value fetched elsewhere, so every reader sees it. */
	prime<T>(key: string, value: T): Promise<void>;
}

export function parseEnvelope<T>(raw: string | null): CacheEnvelope<T> | null {
	if (!raw) return null;
	try {
		const parsed = JSON.parse(raw);
		if (parsed && typeof parsed === 'object' && typeof parsed.t === 'number' && 'v' in parsed) {
			return parsed as CacheEnvelope<T>;
		}
	} catch {
		// Unreadable entry: treat as a miss and let the refresh overwrite it.
	}
	return null;
}

export function createResilientCache(deps: {
	store: EnvelopeStore;
	budget?: RequestBudget;
	backoff?: Backoff;
	now?: () => number;
	keepSeconds?: number;
}): ResilientCache {
	const now = deps.now || Date.now;
	const budget = deps.budget || createRequestBudget(DEFAULT_BUDGET, now);
	const backoff = deps.backoff || createBackoff(now);
	const keepSeconds = deps.keepSeconds || KEEP_SECONDS;
	const inflight = new Map<string, Promise<unknown>>();
	// Pauses for failures that concern one key only (see isHostWideFailure).
	// Removed on the key's next success; expired entries are pruned when the map
	// grows, so a stream of distinct failing keys cannot grow it without bound.
	const keyPauses = new Map<string, {until: number; failures: number}>();
	const KEY_PAUSE_PRUNE_AT = 500;

	function keyPauseRemainingMs(key: string, at: number): number {
		const entry = keyPauses.get(key);
		return entry ? Math.max(0, entry.until - at) : 0;
	}

	function onKeyFailure(key: string, at: number): void {
		if (keyPauses.size >= KEY_PAUSE_PRUNE_AT) {
			keyPauses.forEach((entry, k) => {
				if (entry.until <= at) keyPauses.delete(k);
			});
		}
		const failures = keyPauses.get(key)?.failures || 0;
		const pauseS = Math.min(FAILURE_MAX_PAUSE_S, FAILURE_BASE_PAUSE_S * Math.pow(2, failures));
		keyPauses.set(key, {until: at + pauseS * 1000, failures: failures + 1});
	}

	async function readEnvelope<T>(key: string): Promise<CacheEnvelope<T> | null> {
		try {
			return parseEnvelope<T>(await deps.store.get(key));
		} catch (error: any) {
			logger.warn('[ZktFedCache] store read failed', {key, err: error?.message});
			return null;
		}
	}

	async function writeEnvelope<T>(key: string, value: T, keepFor: number = keepSeconds): Promise<void> {
		try {
			await deps.store.set(key, JSON.stringify({v: value, t: now()}), keepFor);
		} catch (error: any) {
			logger.warn('[ZktFedCache] store write failed', {key, err: error?.message});
		}
	}

	function refresh<T>(
		key: string,
		fetcher: () => Promise<T>,
		priority: FetchPriority,
		keepFor: number = keepSeconds
	): Promise<T> {
		const running = inflight.get(key);
		if (running) return running as Promise<T>;

		const pauseMs = Math.max(backoff.remainingMs(), keyPauseRemainingMs(key, now()));
		if (pauseMs > 0) {
			return Promise.reject(new FederationUnavailableError('cooldown', Math.ceil(pauseMs / 1000)));
		}
		if (!budget.tryAcquire(priority)) {
			return Promise.reject(new FederationUnavailableError('budget', budget.secondsUntilSlot()));
		}

		const task = (async () => {
			try {
				const value = await fetcher();
				backoff.onSuccess();
				keyPauses.delete(key);
				await writeEnvelope(key, value, keepFor);
				return value;
			} catch (error: any) {
				const info: UpstreamFailureInfo = {
					status: error?.status,
					retryAfterS: error?.retryAfterS,
					code: error?.code,
				};
				const at = now();
				if (isHostWideFailure(info)) backoff.onFailure(info, at);
				else onKeyFailure(key, at);
				const pausedMs = Math.max(backoff.remainingMs(at), keyPauseRemainingMs(key, at));
				const retryAfterS = Math.max(1, Math.ceil(pausedMs / 1000));
				throw new FederationUnavailableError('upstream', retryAfterS, error?.message);
			} finally {
				inflight.delete(key);
			}
		})();
		inflight.set(key, task);
		return task;
	}

	return {
		async read<T>(key: string, fetcher: () => Promise<T>, options: CacheReadOptions): Promise<T> {
			const envelope = await readEnvelope<T>(key);
			const at = now();

			if (!envelope) {
				// Nothing to fall back on: this is the one case that can fail.
				return refresh(key, fetcher, options.priority || 'high', options.keepSeconds);
			}

			const age = at - envelope.t;
			if (age < options.freshMs) return envelope.v;

			const stale = envelope.v;
			const background = () =>
				refresh(key, fetcher, options.priority || 'normal', options.keepSeconds).catch((error: any) => {
					if (!(error instanceof FederationUnavailableError) || error.reason === 'upstream') {
						logger.warn('[ZktFedCache] refresh failed, serving stale', {key, err: error?.message});
					}
					return stale;
				});

			if (options.mode === 'refresh') {
				return background();
			}

			if (age < options.freshMs * SWR_WINDOW_FACTOR) {
				void background();
				return stale;
			}

			// Long stale (nobody looked for a while): give the refresh a moment so
			// the first viewer gets current data when the federation is healthy,
			// but never wait on a slow one.
			let timer: ReturnType<typeof setTimeout> | null = null;
			const deadline = new Promise<T>((resolve) => {
				timer = setTimeout(() => resolve(stale), STALE_REFRESH_WAIT_MS);
			});
			try {
				return await Promise.race([background(), deadline]);
			} finally {
				if (timer) clearTimeout(timer);
			}
		},

		async prime<T>(key: string, value: T): Promise<void> {
			await writeEnvelope(key, value);
		},
	};
}
