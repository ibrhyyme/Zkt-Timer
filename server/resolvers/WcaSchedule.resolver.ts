import {Resolver, Query, Arg, Ctx, Authorized} from 'type-graphql';
import {WcaCompetitionDetail, WcaScheduleInput} from '../schemas/WcaSchedule.schema';
import {GraphQLContext} from '../@types/interfaces/server.interface';
import {getIntegration} from '../models/integration';
import {WcaApiService} from '../services/WcaApiService';
import {buildCompetitionDetail} from '../services/WcifTransformer';
import {fetchDataFromCache, createRedisKey, RedisNamespace} from '../services/redis';

const WCIF_CACHE_TTL = 15 * 60; // 15 dakika
const WCA_LIVE_CACHE_TTL = 60 * 60; // 1 saat

@Resolver()
export class WcaScheduleResolver {
	@Authorized()
	@Query(() => WcaCompetitionDetail, {nullable: true})
	async wcaCompetitionDetail(
		@Arg('input') input: WcaScheduleInput,
		@Ctx() ctx: GraphQLContext
	): Promise<WcaCompetitionDetail | null> {
		const integration = await getIntegration(ctx.user, 'wca');
		const wcaId = integration?.wca_id || '';

		const cacheKey = createRedisKey(RedisNamespace.WCA_WCIF, input.competitionId);

		const wcifData = await fetchDataFromCache(
			cacheKey,
			() => WcaApiService.fetchCompetitionWcif(input.competitionId),
			WCIF_CACHE_TTL
		);

		if (!wcifData) {
			return null;
		}

		const detail = buildCompetitionDetail(wcifData, wcaId);

		// WCA Live - Redis cache'li, bloklamamasi icin hata sessiz
		try {
			const liveData = await fetchDataFromCache(
				createRedisKey(RedisNamespace.WCA_WCIF, `live:${input.competitionId}`),
				() => this.fetchWcaLiveData(input.competitionId),
				WCA_LIVE_CACHE_TTL
			);

			if (liveData) {
				detail.wcaLiveCompId = liveData.compId;
				detail.wcaLiveCompetitors = liveData.competitors;
			}
		} catch {
			// WCA Live erisilemez
		}

		return detail;
	}

	private async fetchWcaLiveData(competitionId: string): Promise<{compId: string; competitors: {wcaId: string; liveId: string}[]} | null> {
		const axios = (await import('axios')).default;

		// Tek istekte tum yarismalar + bu yarismadaki yarismacilari cek
		const listRes = await axios.post('https://live.worldcubeassociation.org/api', {
			query: `{ competitions { id wcaId } }`,
		}, {timeout: 5000});

		const allComps = listRes.data?.data?.competitions || [];
		const liveComp = allComps.find((c: any) => c.wcaId === competitionId);

		if (!liveComp) return null;

		const compRes = await axios.post('https://live.worldcubeassociation.org/api', {
			query: `{ competition(id: "${liveComp.id}") { id competitors { id wcaId } } }`,
		}, {timeout: 5000});

		const comp = compRes.data?.data?.competition;
		if (!comp) return null;

		return {
			compId: String(comp.id),
			competitors: (comp.competitors || [])
				.filter((c: any) => c.wcaId)
				.map((c: any) => ({wcaId: c.wcaId, liveId: String(c.id)})),
		};
	}
}
