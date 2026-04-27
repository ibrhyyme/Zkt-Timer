import {Ctx, Query, Resolver} from 'type-graphql';
import {GraphQLContext} from '../@types/interfaces/server.interface';
import {LandingStats} from '../schemas/LandingStats.schema';
import {WcaApiService} from '../services/WcaApiService';
import {createRedisKey, RedisNamespace, getValueFromRedis, setKeyInRedis} from '../services/redis';

const CACHE_TTL_SECONDS = 15 * 60; // 15 dk
const CACHE_KEY = 'landing_stats_v2';

// Statik destek metrikleri
const SUPPORTED_EVENT_COUNT = 17; // WCA resmi etkinlik sayisi
const SUPPORTED_LANGUAGE_COUNT = 5; // tr, en, es, ru, zh

@Resolver()
export class LandingStatsResolver {
	@Query(() => LandingStats)
	async landingStats(@Ctx() ctx: GraphQLContext): Promise<LandingStats> {
		const cacheKey = createRedisKey(RedisNamespace.WCA_COMPETITIONS, CACHE_KEY);
		const cached = await getValueFromRedis(cacheKey);
		if (cached) {
			try {
				return JSON.parse(cached);
			} catch {}
		}

		const {prisma} = ctx;

		const [cuberCount, solveCount, wcaList] = await Promise.all([
			prisma.userAccount.count(),
			prisma.solve.count(),
			WcaApiService.fetchUpcomingCompetitions().catch(() => [] as any[]),
		]);

		const upcomingCount = Array.isArray(wcaList) ? wcaList.length : 0;
		const totalCompetitorCapacity = Array.isArray(wcaList)
			? wcaList.reduce((sum, c: any) => sum + (c?.competitor_limit || 0), 0)
			: 0;

		const result: LandingStats = {
			upcoming_wca_competition_count: upcomingCount,
			total_competitor_capacity: totalCompetitorCapacity,
			supported_event_count: SUPPORTED_EVENT_COUNT,
			supported_language_count: SUPPORTED_LANGUAGE_COUNT,
			cuber_count: cuberCount,
			solve_count: solveCount,
		};

		await setKeyInRedis(cacheKey, JSON.stringify(result), CACHE_TTL_SECONDS);
		return result;
	}
}
