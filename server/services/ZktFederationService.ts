// Read-only client for the Zeka Kupu Turkiye federation public API
// (zekakuputurkiye, REST /api/public/v1/). Zkt-Timer consumes ZKT competitions
// as a viewer — competition management lives on the federation. Mirrors the
// WcaApiService + WcaSchedule.resolver pattern: server-to-server fetch (no CORS,
// works in SSR) behind the stale-while-revalidate cache in zkt_federation_cache.ts,
// which keeps this whole server under the federation's per-IP rate limit and
// keeps serving the last good data while the federation is slow or refusing.
//
// The federation payload shape is documented in the federation's lib/zkt/
// serialize.ts and mirrored 1:1 by server/schemas/ZktPublic.schema.ts, so the
// resolver returns these results verbatim.

import axios from 'axios';
import {RedisNamespace, createRedisKey, getValueFromRedis, setKeyInRedis} from './redis';
import {logger} from './logger';
import {createResilientCache, FetchPriority} from './zkt_federation_cache';

// Base URL of the federation public API. Overridable via env so ops can point at
// an internal address once the containers share a network; defaults to the live
// public domain (server-to-server through Cloudflare).
// Env-aware default so local dev talks to the local federation (port 4000) while
// production talks to the live site. `ZKT_FEDERATION_API` overrides either.
const DEFAULT_FEDERATION_API =
	process.env.NODE_ENV === 'production'
		? 'https://zekakuputurkiye.com/api/public/v1'
		: 'http://localhost:4000/api/public/v1';
const BASE_URL = (process.env.ZKT_FEDERATION_API || DEFAULT_FEDERATION_API).replace(/\/+$/, '');

// How long a cached value counts as fresh (milliseconds). Past this it is still
// served while one background refresh runs (see zkt_federation_cache.ts), so
// these numbers set the upstream request rate, not what a viewer waits for.
// Every key is its own clock, so per-entity keys (one per competitor, group,
// member) multiply: they get the longer values.
const FRESH_LIST = 60 * 1000;
const FRESH_DETAIL = 45 * 1000;
const FRESH_RESULTS = 15 * 1000;
const FRESH_GROUP = 60 * 1000;
const FRESH_COMPETITOR = 30 * 1000;
const FRESH_COMP_RECORDS = 60 * 1000;
const FRESH_MY_COMPS = 60 * 1000;
const FRESH_PERSON = 5 * 60 * 1000;
const FRESH_RECENT_RECORDS = 3 * 60 * 1000;
// Fallback lifetime for search results, in seconds (see fetchCompetitions).
const SEARCH_KEEP_SECONDS = 10 * 60;

const REQUEST_TIMEOUT_MS = 10000;

/** A failed federation call, carrying what the backoff needs. */
export class FederationHttpError extends Error {
	readonly status?: number;
	readonly retryAfterS?: number;
	/** Transport error code when there was no HTTP answer (ECONNABORTED, ECONNREFUSED...). */
	readonly code?: string;

	constructor(message: string, status?: number, retryAfterS?: number, code?: string) {
		super(message);
		this.name = 'FederationHttpError';
		this.status = status;
		this.retryAfterS = retryAfterS;
		this.code = code;
	}
}

function parseRetryAfter(value: unknown): number | undefined {
	const n = Number(value);
	return Number.isFinite(n) && n > 0 ? Math.ceil(n) : undefined;
}

/**
 * Identify this server to the federation as the trusted Zkt-Timer backend.
 * The federation counts its public API per client IP, and every Zkt-Timer
 * viewer arrives from this one IP; with the shared secret it can give us our
 * own allowance instead (zekakuputurkiye-site lib/api-rate-limit.ts). A
 * federation build that does not know the header simply ignores it.
 */
function federationHeaders(): Record<string, string> {
	const headers: Record<string, string> = {Accept: 'application/json'};
	const secret = process.env.ZKT_INTERNAL_API_SECRET;
	if (secret) headers.Authorization = `Bearer ${secret}`;
	return headers;
}

/**
 * GET a federation endpoint. Returns null on 404 (competition/round/competitor
 * not found or not public), which is a real answer and is cached like one.
 * Any other failure throws, and the cache layer keeps serving the last good
 * value instead of storing the failure.
 */
async function fetchJson<T>(path: string): Promise<T | null> {
	try {
		const res = await axios.get(`${BASE_URL}${path}`, {
			timeout: REQUEST_TIMEOUT_MS,
			headers: federationHeaders(),
		});
		return res.data as T;
	} catch (error) {
		if (axios.isAxiosError(error) && error.response?.status === 404) {
			return null;
		}
		let status: number | undefined;
		let retryAfterS: number | undefined;
		let code: string | undefined;
		let reason: string;
		if (axios.isAxiosError(error)) {
			status = error.response?.status;
			code = error.code;
			retryAfterS = parseRetryAfter(error.response?.headers?.['retry-after']);
			if (error.code === 'ECONNABORTED') reason = 'timeout';
			else if (status) reason = `http_${status}`;
			else reason = error.code || error.message;
		} else {
			reason = String(error);
		}
		logger.warn('[ZktFederation] fetch failed', {path, reason, retryAfterS});
		throw new FederationHttpError(`ZKT federation request failed (${reason}): ${path}`, status, retryAfterS, code);
	}
}

const cache = createResilientCache({
	store: {
		get: (key) => getValueFromRedis({key}),
		set: async (key, value, ttlSeconds) => {
			await setKeyInRedis({key}, value, ttlSeconds);
		},
	},
});

// The `swr:` prefix keeps these entries apart from the plain values the old
// TTL cache wrote under the same namespaces; those simply expire.
function cacheKey(namespace: RedisNamespace, hash: string): string {
	return createRedisKey(namespace, `swr:${hash}`).key;
}

function cached<T>(
	namespace: RedisNamespace,
	hash: string,
	path: string,
	freshMs: number,
	options: {mode?: 'swr' | 'refresh'; priority?: FetchPriority; keepSeconds?: number} = {}
): Promise<T | null> {
	return cache.read<T | null>(cacheKey(namespace, hash), () => fetchJson<T>(path), {freshMs, ...options});
}

export class ZktFederationService {
	static async fetchCompetitions(params: {
		page?: number;
		pageSize?: number;
		q?: string;
	}): Promise<unknown> {
		const page = Math.max(0, params.page ?? 0);
		const pageSize = Math.min(100, Math.max(1, params.pageSize ?? 30));
		const q = params.q?.trim() || '';
		const query = new URLSearchParams({page: String(page), pageSize: String(pageSize)});
		if (q) query.set('q', q);
		const hash = `${page}:${pageSize}:${q}`;
		// Trailing slash BEFORE the query: the federation runs Next.js with
		// trailingSlash enabled, so `/competitions?…` 308-redirects to
		// `/competitions/?…`. Hitting the canonical form avoids the extra hop.
		// A search (`q`) is keyed by free text the public query accepts from
		// anyone, so its entries are kept briefly instead of three days (no Redis
		// growth from arbitrary strings) and a search miss spends `normal` budget,
		// leaving the `high` headroom to pages with nothing cached.
		const payload = await cached(
			RedisNamespace.ZKT_FED_LIST,
			hash,
			`/competitions/?${query.toString()}`,
			FRESH_LIST,
			q ? {priority: 'normal', keepSeconds: SEARCH_KEEP_SECONDS} : {}
		);
		return payload ?? {items: [], total: 0, hasMore: false, page, pageSize};
	}

	// Full WCIF document — fed to the existing WcifTransformer so a ZKT competition
	// renders through the WCA competition components. Assignments/results change
	// during a live competition, so keep the cache short (matches detail).
	static async fetchWcif(idOrSlug: string): Promise<unknown | null> {
		return cached(
			RedisNamespace.ZKT_FED_WCIF,
			idOrSlug,
			`/competitions/${encodeURIComponent(idOrSlug)}/wcif/`,
			FRESH_DETAIL
		);
	}

	static async fetchCompetitionDetail(idOrSlug: string): Promise<unknown | null> {
		return cached(
			RedisNamespace.ZKT_FED_DETAIL,
			idOrSlug,
			`/competitions/${encodeURIComponent(idOrSlug)}/`,
			FRESH_DETAIL
		);
	}

	static async fetchRoundResults(idOrSlug: string, roundId: string): Promise<unknown | null> {
		return cached(
			RedisNamespace.ZKT_FED_RESULTS,
			`${idOrSlug}:${roundId}`,
			`/competitions/${encodeURIComponent(idOrSlug)}/rounds/${encodeURIComponent(roundId)}/results/`,
			FRESH_RESULTS
		);
	}

	/**
	 * Round read for the live poller. Shares the key the resolver reads, so the
	 * poller keeps it warm for every viewer instead of adding its own upstream
	 * traffic. `refresh` mode waits for the new value (pushing the previous one
	 * again would delay every live update by a poll). It competes with page
	 * refreshes at `normal` priority rather than `low`: on competition day the
	 * live scoreboard is the surface people watch most, so it must not be the
	 * one starved. When the budget is spent a tick keeps the current scoreboard.
	 */
	static async fetchRoundResultsFresh(
		idOrSlug: string,
		roundId: string,
		freshMs: number = 5000
	): Promise<unknown | null> {
		return cached(
			RedisNamespace.ZKT_FED_RESULTS,
			`${idOrSlug}:${roundId}`,
			`/competitions/${encodeURIComponent(idOrSlug)}/rounds/${encodeURIComponent(roundId)}/results/`,
			freshMs,
			{mode: 'refresh', priority: 'normal'}
		);
	}

	static async fetchGroupAssignments(idOrSlug: string, groupId: string): Promise<unknown | null> {
		return cached(
			RedisNamespace.ZKT_FED_GROUP,
			`${idOrSlug}:${groupId}`,
			`/competitions/${encodeURIComponent(idOrSlug)}/groups/${encodeURIComponent(groupId)}/`,
			FRESH_GROUP
		);
	}

	// Competitions one person is registered for, keyed by the federation person
	// key. Short freshness: a new registration should surface quickly.
	static async fetchPersonCompetitions(personKey: string): Promise<unknown | null> {
		return cached(
			RedisNamespace.ZKT_FED_MY_COMPS,
			personKey,
			`/persons/${encodeURIComponent(personKey)}/competitions/`,
			FRESH_MY_COMPS
		);
	}

	// One member's ZKT career summary (competitions, medals, records, PBs) —
	// what the profile's "ZKT data" panel renders, the counterpart of the WCA
	// numbers stored on the integration row. Keyed by ZKT id. Changes only when
	// results are published, so it gets a long freshness.
	static async fetchPersonSummary(zktId: string): Promise<unknown | null> {
		return cached(
			RedisNamespace.ZKT_FED_PERSON,
			zktId,
			`/persons/${encodeURIComponent(zktId)}/`,
			FRESH_PERSON
		);
	}

	// National records set at one competition — the ZKT counterpart of WCA Live's
	// competitionRecords. Structural surface.
	static async fetchCompetitionRecords(idOrSlug: string): Promise<unknown | null> {
		return cached(
			RedisNamespace.ZKT_FED_COMP_RECORDS,
			idOrSlug,
			`/competitions/${encodeURIComponent(idOrSlug)}/records/`,
			FRESH_COMP_RECORDS
		);
	}

	// Global "recently set NR" feed behind the record radar. Changes slowly, so
	// it gets the longest freshness here.
	static async fetchRecentRecords(limit = 25): Promise<unknown | null> {
		return cached(
			RedisNamespace.ZKT_FED_RECENT_RECORDS,
			String(limit),
			`/records/recent/?limit=${limit}`,
			FRESH_RECENT_RECORDS
		);
	}

	static async fetchCompetitorDetail(idOrSlug: string, key: string): Promise<unknown | null> {
		return cached(
			RedisNamespace.ZKT_FED_COMPETITOR,
			`${idOrSlug}:${key}`,
			`/competitions/${encodeURIComponent(idOrSlug)}/competitors/${encodeURIComponent(key)}/`,
			FRESH_COMPETITOR
		);
	}
}
