import {Resolver, Query, Arg} from 'type-graphql';
import {WcaCompetition, WcaCompetitionFilterInput} from '../schemas/WcaCompetition.schema';
import {WcaApiService} from '../services/WcaApiService';
import {fetchDataFromCache, createRedisKey, RedisNamespace} from '../services/redis';

const CACHE_TTL_SECONDS = 6 * 60 * 60; // 6 saat

@Resolver()
export class WcaCompetitionResolver {
	@Query(() => [WcaCompetition])
	async wcaCompetitions(
		@Arg('filter', () => WcaCompetitionFilterInput, {nullable: true}) filter?: WcaCompetitionFilterInput
	): Promise<WcaCompetition[]> {
		const country = filter?.country_iso2 || '';
		const cacheKey = createRedisKey(RedisNamespace.WCA_COMPETITIONS, country || 'all');

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
}
