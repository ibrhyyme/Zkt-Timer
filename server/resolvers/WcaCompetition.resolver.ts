import {Resolver, Query, Arg, Ctx, Authorized} from 'type-graphql';
import {WcaCompetition, WcaCompetitionFilterInput} from '../schemas/WcaCompetition.schema';
import {WcaApiService} from '../services/WcaApiService';
import {fetchDataFromCache, createRedisKey, RedisNamespace} from '../services/redis';
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

		return fetchDataFromCache<WcaCompetition[]>(
			cacheKey,
			async () => {
				const raw = await WcaApiService.fetchUpcomingCompetitions(country || undefined);
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
			},
			CACHE_TTL_SECONDS
		);
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
		} catch {
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
