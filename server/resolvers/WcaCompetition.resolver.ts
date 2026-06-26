import {Resolver, Query, Arg, Ctx, Authorized} from 'type-graphql';
import {WcaCompetition, WcaCompetitionFilterInput} from '../schemas/WcaCompetition.schema';
import {WcaApiService} from '../services/WcaApiService';
import {createRedisKey, RedisNamespace, getValueFromRedis, setKeyInRedis} from '../services/redis';
import {GraphQLContext} from '../@types/interfaces/server.interface';
import {getAuthToken} from '../integrations/oauth';
import {checkRateLimit} from '../services/rate_limit';
import {extractIp} from '../util/request';
import GraphQLError from '../util/graphql_error';
import {ErrorCode} from '../constants/errors';

const CACHE_TTL_SECONDS = 2 * 60 * 60; // 2 hours

@Resolver()
export class WcaCompetitionResolver {
	@Query(() => [WcaCompetition])
	async wcaCompetitions(
		@Arg('filter', () => WcaCompetitionFilterInput, {nullable: true}) filter?: WcaCompetitionFilterInput
	): Promise<WcaCompetition[]> {
		const country = filter?.country_iso2 || '';
		const cacheKey = createRedisKey(RedisNamespace.WCA_COMPETITIONS, country || 'all2');

		// Cache hit?
		const cached = await getValueFromRedis(cacheKey);
		if (cached) {
			const parsed = JSON.parse(cached);
			if (Array.isArray(parsed) && parsed.length > 0) {
				return parsed;
			}
			// Empty array cached (old deploy bug) — ignore, fetch fresh
		}

		const raw = await WcaApiService.fetchUpcomingCompetitions(country || undefined);
		const mapped = raw.map((c) => ({
			id: c.id,
			name: c.name,
			city: c.city,
			country_iso2: c.country_iso2,
			venue: c.venue || '',
			start_date: c.start_date,
			end_date: c.end_date,
			date_range: c.date_range,
			event_ids: c.event_ids || [],
			latitude_degrees: c.latitude_degrees,
			longitude_degrees: c.longitude_degrees,
			url: c.url,
			competitor_limit: c.competitor_limit || null,
		}));

		// Only real data is cached. If WCA API fails and an empty array is written
		// to cache, everyone will see "not found" for 2 hours.
		if (mapped.length > 0) {
			await setKeyInRedis(cacheKey, JSON.stringify(mapped), CACHE_TTL_SECONDS);
		} else {
			console.warn('[wcaCompetitions] WCA API returned empty list — cache skipped');
		}

		return mapped;
	}

	@Query(() => [WcaCompetition])
	async wcaSearchCompetitions(
		@Ctx() ctx: GraphQLContext,
		@Arg('query') query: string
	): Promise<WcaCompetition[]> {
		if (!query || query.trim().length < 2) return [];

		// Public, uncached WCA API proxy — throttle per IP to prevent search amplification.
		const ip = extractIp(ctx.req);
		if (ip) {
			const limit = await checkRateLimit(`wca_search:ip:${ip}`, 15, 60);
			if (!limit.allowed) {
				throw new GraphQLError(ErrorCode.BAD_INPUT, 'Cok fazla arama. Lutfen biraz bekleyin.');
			}
		}

		const raw = await WcaApiService.searchCompetitions(query.trim());
		return raw.map((c) => ({
			id: c.id,
			name: c.name,
			city: c.city,
			country_iso2: c.country_iso2,
			venue: c.venue || '',
			start_date: c.start_date,
			end_date: c.end_date,
			date_range: c.date_range,
			event_ids: c.event_ids || [],
			latitude_degrees: c.latitude_degrees,
			longitude_degrees: c.longitude_degrees,
			url: c.url,
			competitor_limit: c.competitor_limit || null,
		}));
	}

	@Authorized()
	@Query(() => [WcaCompetition])
	async myWcaCompetitions(
		@Ctx() ctx: GraphQLContext
	): Promise<WcaCompetition[]> {
		let authToken: string;
		try {
			authToken = await getAuthToken('wca', ctx.user);
		} catch (e) {
			console.warn('myWcaCompetitions: Failed to get auth token:', e?.message);
			return [];
		}
		if (!authToken) {
			console.warn('myWcaCompetitions: Auth token is null (token refresh may have failed)');
			return [];
		}
		const raw = await WcaApiService.fetchMyCompetitions(authToken);
		const today = new Date().toISOString().split('T')[0];
		return raw
			.filter((c: any) => c.end_date >= today)
			.map((c) => ({
				id: c.id,
				name: c.name,
				city: c.city,
				country_iso2: c.country_iso2,
				venue: c.venue || '',
				start_date: c.start_date,
				end_date: c.end_date,
				date_range: c.date_range || '',
				event_ids: c.event_ids || [],
				latitude_degrees: c.latitude_degrees || 0,
				longitude_degrees: c.longitude_degrees || 0,
				url: c.url || '',
				competitor_limit: c.competitor_limit || null,
			}));
	}
}
