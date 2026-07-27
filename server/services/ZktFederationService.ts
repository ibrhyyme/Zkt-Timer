// Read-only client for the Zeka Kupu Turkiye federation public API
// (zekakuputurkiye, REST /api/public/v1/). Zkt-Timer consumes ZKT competitions
// as a viewer — competition management lives on the federation. Mirrors the
// WcaApiService + WcaSchedule.resolver pattern: server-to-server fetch (no CORS,
// works in SSR) wrapped in a short Redis cache so a live competition's polling
// doesn't hammer the federation.
//
// The federation payload shape is documented in the federation's lib/zkt/
// serialize.ts and mirrored 1:1 by server/schemas/ZktPublic.schema.ts, so the
// resolver returns these results verbatim.

import axios from 'axios';
import {RedisNamespace, createRedisKey, fetchDataFromCache, setKeyInRedis} from './redis';
import {logger} from './logger';

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

// Cache TTLs (seconds). Live surfaces (round results) stay short so scoreboards
// converge quickly; structural surfaces (detail/list/groups) tolerate a minute.
const TTL_LIST = 60;
const TTL_DETAIL = 45;
const TTL_RESULTS = 15;
const TTL_GROUP = 45;
const TTL_COMPETITOR = 20;
const TTL_RECENT_RECORDS = 3 * 60;

/**
 * GET a federation endpoint. Returns null on 404 (competition/round/competitor
 * not found or not public) so the resolver can surface an empty state; rethrows
 * on any other failure so the client opens a real error UI instead of treating
 * a transient outage as "truly empty".
 */
async function fetchJson<T>(path: string): Promise<T | null> {
	try {
		const res = await axios.get(`${BASE_URL}${path}`, {
			timeout: 15000,
			headers: {Accept: 'application/json'},
		});
		return res.data as T;
	} catch (error) {
		if (axios.isAxiosError(error) && error.response?.status === 404) {
			return null;
		}
		const message = axios.isAxiosError(error) ? error.message : String(error);
		logger.warn('[ZktFederation] fetch failed', {path, message});
		throw new Error(`ZKT federation fetch failed: ${message}`);
	}
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
		return fetchDataFromCache(
			createRedisKey(RedisNamespace.ZKT_FED_LIST, hash),
			async () => (await fetchJson(`/competitions/?${query.toString()}`)) ?? {items: [], total: 0, hasMore: false, page, pageSize},
			TTL_LIST
		);
	}

	// Full WCIF document — fed to the existing WcifTransformer so a ZKT competition
	// renders through the WCA competition components. Assignments/results change
	// during a live competition, so keep the cache short (matches detail).
	static async fetchWcif(idOrSlug: string): Promise<unknown | null> {
		return fetchDataFromCache(
			createRedisKey(RedisNamespace.ZKT_FED_WCIF, idOrSlug),
			() => fetchJson(`/competitions/${encodeURIComponent(idOrSlug)}/wcif/`),
			TTL_DETAIL
		);
	}

	static async fetchCompetitionDetail(idOrSlug: string): Promise<unknown | null> {
		return fetchDataFromCache(
			createRedisKey(RedisNamespace.ZKT_FED_DETAIL, idOrSlug),
			() => fetchJson(`/competitions/${encodeURIComponent(idOrSlug)}/`),
			TTL_DETAIL
		);
	}

	static async fetchRoundResults(idOrSlug: string, roundId: string): Promise<unknown | null> {
		return fetchDataFromCache(
			createRedisKey(RedisNamespace.ZKT_FED_RESULTS, `${idOrSlug}:${roundId}`),
			() =>
				fetchJson(
					`/competitions/${encodeURIComponent(idOrSlug)}/rounds/${encodeURIComponent(roundId)}/results/`
				),
			TTL_RESULTS
		);
	}

	/**
	 * Cache-bypassing round read used by the live poller. The poller runs faster
	 * than TTL_RESULTS, so going through the cache would pin it to the cache
	 * interval instead of its own — the push would arrive no sooner than a plain
	 * client poll. It writes the fresh payload back so the resolver (and every
	 * other viewer) reads the same value the push carried.
	 */
	static async fetchRoundResultsFresh(idOrSlug: string, roundId: string): Promise<unknown | null> {
		const data = await fetchJson(
			`/competitions/${encodeURIComponent(idOrSlug)}/rounds/${encodeURIComponent(roundId)}/results/`
		);
		if (data) {
			try {
				await setKeyInRedis(
					createRedisKey(RedisNamespace.ZKT_FED_RESULTS, `${idOrSlug}:${roundId}`),
					JSON.stringify(data),
					TTL_RESULTS
				);
			} catch (error) {
				logger.warn('[ZktFederation] cache write failed', {idOrSlug, roundId});
			}
		}
		return data;
	}

	static async fetchGroupAssignments(idOrSlug: string, groupId: string): Promise<unknown | null> {
		return fetchDataFromCache(
			createRedisKey(RedisNamespace.ZKT_FED_GROUP, `${idOrSlug}:${groupId}`),
			() =>
				fetchJson(
					`/competitions/${encodeURIComponent(idOrSlug)}/groups/${encodeURIComponent(groupId)}/`
				),
			TTL_GROUP
		);
	}

	// Competitions one person is registered for, keyed by WCA id (the identity
	// both sides share). Short TTL: a fresh registration should surface quickly.
	static async fetchPersonCompetitions(wcaId: string): Promise<unknown | null> {
		return fetchDataFromCache(
			createRedisKey(RedisNamespace.ZKT_FED_MY_COMPS, wcaId),
			() => fetchJson(`/persons/${encodeURIComponent(wcaId)}/competitions/`),
			TTL_DETAIL
		);
	}

	// National records set at one competition — the ZKT counterpart of WCA Live's
	// competitionRecords. Structural surface, so it tolerates the detail TTL.
	static async fetchCompetitionRecords(idOrSlug: string): Promise<unknown | null> {
		return fetchDataFromCache(
			createRedisKey(RedisNamespace.ZKT_FED_COMP_RECORDS, idOrSlug),
			() => fetchJson(`/competitions/${encodeURIComponent(idOrSlug)}/records/`),
			TTL_DETAIL
		);
	}

	// Global "recently set NR" feed behind the record radar. Changes slowly, so
	// it gets the longest TTL here.
	static async fetchRecentRecords(limit = 25): Promise<unknown | null> {
		return fetchDataFromCache(
			createRedisKey(RedisNamespace.ZKT_FED_RECENT_RECORDS, String(limit)),
			() => fetchJson(`/records/recent/?limit=${limit}`),
			TTL_RECENT_RECORDS
		);
	}

	static async fetchCompetitorDetail(idOrSlug: string, key: string): Promise<unknown | null> {
		return fetchDataFromCache(
			createRedisKey(RedisNamespace.ZKT_FED_COMPETITOR, `${idOrSlug}:${key}`),
			() =>
				fetchJson(
					`/competitions/${encodeURIComponent(idOrSlug)}/competitors/${encodeURIComponent(key)}/`
				),
			TTL_COMPETITOR
		);
	}
}
