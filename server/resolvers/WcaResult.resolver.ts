import {Resolver, Query, Arg} from 'type-graphql';
import {WcaResult} from '../schemas/WcaResult.schema';
import {WcaApiService} from '../services/WcaApiService';
import {fetchDataFromCache, createRedisKey, RedisNamespace} from '../services/redis';

const CACHE_TTL_SECONDS = 6 * 60 * 60; // 6 saat

@Resolver()
export class WcaResultResolver {
	@Query(() => [WcaResult])
	async wcaResults(
		@Arg('wcaId') wcaId: string
	): Promise<WcaResult[]> {
		const cacheKey = createRedisKey(RedisNamespace.WCA_RESULTS, wcaId);

		return fetchDataFromCache<WcaResult[]>(
			cacheKey,
			async () => {
				// Results ve competitions'i paralel cek
				const [rawResults, rawCompetitions] = await Promise.all([
					WcaApiService.fetchPersonResults(wcaId),
					WcaApiService.fetchPersonCompetitions(wcaId),
				]);

				// Competition ID -> isim/tarih map'i
				const compMap = new Map<string, {name: string; date: string}>();
				for (const comp of rawCompetitions) {
					compMap.set(comp.id, {
						name: comp.name || comp.id,
						date: comp.start_date || '',
					});
				}

				// Merge ve map
				const results: WcaResult[] = rawResults.map((r: any) => {
					const comp = compMap.get(r.competition_id);
					return {
						competition_id: r.competition_id,
						competition_name: comp?.name || r.competition_id,
						competition_date: comp?.date || '',
						event_id: r.event_id,
						round_type_id: r.round_type_id,
						pos: r.pos || 0,
						best: r.best || 0,
						average: r.average || 0,
						attempts: r.attempts || [],
						regional_single_record: r.regional_single_record || null,
						regional_average_record: r.regional_average_record || null,
					};
				});

				// Yarisma tarihine gore DESC sirala
				results.sort((a, b) => {
					if (a.competition_date !== b.competition_date) {
						return b.competition_date.localeCompare(a.competition_date);
					}
					return 0;
				});

				return results;
			},
			CACHE_TTL_SECONDS
		);
	}
}
