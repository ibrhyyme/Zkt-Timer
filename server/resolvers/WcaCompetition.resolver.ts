import {Resolver, Query, Arg, Ctx, Authorized} from 'type-graphql';
import {WcaCompetition, WcaCompetitionFilterInput} from '../schemas/WcaCompetition.schema';
import {WcaApiService} from '../services/WcaApiService';
import {createRedisKey, RedisNamespace, getValueFromRedis, setKeyInRedis} from '../services/redis';
import {GraphQLContext} from '../@types/interfaces/server.interface';
import {getAuthToken} from '../integrations/oauth';

const CACHE_TTL_SECONDS = 2 * 60 * 60; // 2 saat

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
			// Bos array cache'lenmis (eski deploy bug'i) — gormezden gel, fresh cek
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

		// Sadece gercek data cache'lenir. WCA API hatasi durumunda bos array
		// cache'e yazilirsa 2 saat boyunca herkes "bulunamadi" gorur.
		if (mapped.length > 0) {
			await setKeyInRedis(cacheKey, JSON.stringify(mapped), CACHE_TTL_SECONDS);
		} else {
			console.warn('[wcaCompetitions] WCA API bos liste dondurdu — cache atlandi');
		}

		return mapped;
	}

	@Query(() => [WcaCompetition])
	async wcaSearchCompetitions(
		@Arg('query') query: string
	): Promise<WcaCompetition[]> {
		if (!query || query.trim().length < 2) return [];

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
