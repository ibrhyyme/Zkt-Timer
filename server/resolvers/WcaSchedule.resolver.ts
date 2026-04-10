import {Resolver, Query, Arg, Ctx, Authorized} from 'type-graphql';
import {
	WcaCompetitionDetail,
	WcaScheduleInput,
	WcaLiveRoundResults,
	WcaLiveRoundInput,
	WcaLiveCompetitionOverview,
	WcaLiveOverviewInput,
	WcaLiveCompetitorResults,
	WcaLiveCompetitorInput,
} from '../schemas/WcaSchedule.schema';
import {GraphQLContext} from '../@types/interfaces/server.interface';
import {getIntegration} from '../models/integration';
import {WcaApiService} from '../services/WcaApiService';
import {buildCompetitionDetail} from '../services/WcifTransformer';
import {fetchDataFromCache, createRedisKey, RedisNamespace, deleteKeyInRedis} from '../services/redis';
import {logger} from '../services/logger';

function getErrorType(err: any): string {
	if (!err) return 'unknown';
	if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) return 'timeout';
	if (err.code === 'ENOTFOUND' || err.code === 'ECONNREFUSED') return 'network';
	if (err.response?.status >= 500) return `http_5xx_${err.response.status}`;
	if (err.response?.status >= 400) return `http_4xx_${err.response.status}`;
	if (err.name === 'SyntaxError') return 'parse';
	return 'unknown';
}

const WCIF_CACHE_TTL = 60 * 60; // 1 saat — WCIF nadir degisir
const WCA_LIVE_CACHE_TTL = 60 * 60;
const WCA_LIVE_ROUND_TTL = 60;
const WCA_LIVE_OVERVIEW_TTL = 60;
const WCA_LIVE_COMPETITOR_TTL = 60;

const WCA_LIVE_ENDPOINT = process.env.WCA_LIVE_API_URL || 'https://live.worldcubeassociation.org/api';

interface WcaLiveData {
	compId: string;
	competitors: {wcaId: string | null; liveId: string; name: string}[];
	roundMap: {activityCode: string; liveRoundId: string}[];
}

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

		if (!wcifData) return null;

		const detail = buildCompetitionDetail(wcifData, wcaId);

		try {
			const liveData = await this.getWcaLiveData(input.competitionId);
			if (liveData) {
				detail.wcaLiveCompId = liveData.compId;
				detail.wcaLiveCompetitors = liveData.competitors;
				detail.wcaLiveRoundMap = liveData.roundMap;
			}
		} catch (err: any) {
			logger.warn('[WcaLive] getWcaLiveData failed', {
				competitionId: input.competitionId,
				error: err?.message || String(err),
				errorType: getErrorType(err),
			});
		}

		return detail;
	}

	@Authorized()
	@Query(() => WcaLiveCompetitionOverview, {nullable: true})
	async wcaLiveCompetitionOverview(
		@Arg('input') input: WcaLiveOverviewInput
	): Promise<WcaLiveCompetitionOverview | null> {
		try {
			const cacheKey = createRedisKey(
				RedisNamespace.WCA_WCIF,
				`liveoverview:${input.competitionId}`
			);

			return await fetchDataFromCache(
				cacheKey,
				() => this.fetchLiveOverview(input.competitionId),
				WCA_LIVE_OVERVIEW_TTL
			);
		} catch (err: any) {
			logger.warn('[WcaLive] overview failed', {
				competitionId: input.competitionId,
				error: err?.message || String(err),
				errorType: getErrorType(err),
			});
			return null;
		}
	}

	@Authorized()
	@Query(() => WcaLiveRoundResults, {nullable: true})
	async wcaLiveRoundResults(
		@Arg('input') input: WcaLiveRoundInput
	): Promise<WcaLiveRoundResults | null> {
		try {
			const cacheKey = createRedisKey(
				RedisNamespace.WCA_WCIF,
				`liveround:${input.competitionId}:${input.liveRoundId}`
			);

			const result = await fetchDataFromCache(
				cacheKey,
				() => this.fetchLiveRoundResults(input.liveRoundId),
				WCA_LIVE_ROUND_TTL
			);

			// Bos/null sonuc geldiyse cache'i sil ki sonraki istek tekrar denesin
			if (!result || !result.results || result.results.length === 0) {
				try {
					await deleteKeyInRedis(cacheKey);
				} catch (err: any) {
					logger.warn('[WcaLive] cache delete failed', {error: err?.message});
				}
			}

			return result;
		} catch (err: any) {
			logger.warn('[WcaLive] round results failed', {
				liveRoundId: input.liveRoundId,
				error: err?.message || String(err),
				errorType: getErrorType(err),
			});
			return null;
		}
	}

	@Authorized()
	@Query(() => WcaLiveCompetitorResults, {nullable: true})
	async wcaLiveCompetitorResults(
		@Arg('input') input: WcaLiveCompetitorInput
	): Promise<WcaLiveCompetitorResults | null> {
		try {
			// personLiveId numerik olmali (WCA Live person ID), guvenlik icin sanitize
			const sanitizedId = String(parseInt(input.personLiveId, 10));
			if (sanitizedId === 'NaN') return null;

			const cacheKey = createRedisKey(
				RedisNamespace.WCA_WCIF,
				`livecompetitor:${input.competitionId}:${sanitizedId}`
			);

			const result = await fetchDataFromCache(
				cacheKey,
				() => this.fetchLiveCompetitorResults(sanitizedId),
				WCA_LIVE_COMPETITOR_TTL
			);

			// Bos/null sonuc geldiyse cache'i sil ki sonraki istek tekrar denesin
			if (!result || !result.results || result.results.length === 0) {
				try {
					await deleteKeyInRedis(cacheKey);
				} catch (err: any) {
					logger.warn('[WcaLive] cache delete failed', {error: err?.message});
				}
			}

			return result;
		} catch (err: any) {
			logger.warn('[WcaLive] competitor results failed', {
				personLiveId: input.personLiveId,
				error: err?.message || String(err),
				errorType: getErrorType(err),
			});
			return null;
		}
	}

	private async getWcaLiveData(competitionId: string): Promise<WcaLiveData | null> {
		return fetchDataFromCache(
			createRedisKey(RedisNamespace.WCA_WCIF, `live:${competitionId}`),
			() => this.fetchWcaLiveData(competitionId),
			WCA_LIVE_CACHE_TTL
		);
	}

	private async fetchWcaLiveData(competitionId: string): Promise<WcaLiveData | null> {
		const axios = (await import('axios')).default;

		const listRes = await axios.post(WCA_LIVE_ENDPOINT, {
			query: `{ competitions { id wcaId } }`,
		}, {timeout: 5000});

		const allComps = listRes.data?.data?.competitions || [];
		const liveComp = allComps.find((c: any) => c.wcaId === competitionId);

		if (!liveComp?.id) return null;

		const compRes = await axios.post(WCA_LIVE_ENDPOINT, {
			query: `{ competition(id: "${liveComp.id}") {
				id
				competitors { id wcaId name }
				competitionEvents { event { id } rounds { id number } }
			} }`,
		}, {timeout: 5000});

		const comp = compRes.data?.data?.competition;
		if (!comp) return null;

		const roundMap: {activityCode: string; liveRoundId: string}[] = [];
		for (const ce of comp.competitionEvents || []) {
			for (const round of ce.rounds || []) {
				roundMap.push({
					activityCode: `${ce.event.id}-r${round.number}`,
					liveRoundId: String(round.id),
				});
			}
		}

		return {
			compId: String(comp.id),
			competitors: (comp.competitors || [])
				.map((c: any) => ({wcaId: c.wcaId || null, liveId: String(c.id), name: c.name || ''})),
			roundMap,
		};
	}

	private async fetchPodiumsForRounds(rounds: {liveRoundId: string; eventId: string; eventName: string; sortBy: string}[]): Promise<any[]> {
		if (rounds.length === 0) return [];
		const axios = (await import('axios')).default;

		const results = await Promise.all(rounds.map(async (r) => {
			try {
				const res = await axios.post(WCA_LIVE_ENDPOINT, {
					query: `{ round(id: "${r.liveRoundId}") {
						format { sortBy }
						results {
							ranking best average
							person { name country { iso2 } }
							singleRecordTag averageRecordTag
						}
					} }`,
				}, {timeout: 6000});
				const round = res.data?.data?.round;
				if (!round) return null;
				const top3 = (round.results || [])
					.filter((x: any) => x.ranking != null && x.ranking <= 3)
					.slice(0, 3)
					.map((x: any) => ({
						ranking: x.ranking,
						personName: x.person?.name || '',
						personCountryIso2: x.person?.country?.iso2 || undefined,
						best: x.best || 0,
						average: x.average || 0,
						singleRecordTag: x.singleRecordTag || undefined,
						averageRecordTag: x.averageRecordTag || undefined,
					}));
				if (top3.length === 0) return null;
				return {
					eventId: r.eventId,
					eventName: r.eventName,
					sortBy: round.format?.sortBy || r.sortBy || 'best',
					entries: top3,
				};
			} catch (err: any) {
				logger.warn('[WcaLive] podium fetch failed', {
					liveRoundId: r.liveRoundId,
					error: err?.message,
				});
				return null;
			}
		}));

		return results.filter((x) => x != null);
	}

	private async fetchLiveOverview(competitionId: string): Promise<WcaLiveCompetitionOverview | null> {
		const axios = (await import('axios')).default;

		// Once liveCompId'yi al
		const liveData = await this.getWcaLiveData(competitionId);
		if (!liveData) return null;

		const res = await axios.post(WCA_LIVE_ENDPOINT, {
			query: `{ competition(id: "${liveData.compId}") {
				id name
				competitionEvents {
					event { id name }
					rounds {
						id number name open finished active numEnteredResults numResults
						format { numberOfAttempts sortBy }
						timeLimit { centiseconds cumulativeRoundWcifIds }
						cutoff { attemptResult numberOfAttempts }
						advancementCondition { type level }
					}
				}
				venues {
					name
					rooms {
						name color
						activities { id name activityCode startTime endTime }
					}
				}
				competitionRecords {
					type tag attemptResult
					result {
						person { name country { iso2 } }
						round { number competitionEvent { event { id name } } }
					}
				}
			} }`,
		}, {timeout: 8000});

		const comp = res.data?.data?.competition;
		if (!comp) return null;

		// Podium icin: her event'in son finished round'unu bul
		const finalRounds: {liveRoundId: string; eventId: string; eventName: string; sortBy: string}[] = [];
		for (const ce of comp.competitionEvents || []) {
			const rounds = ce.rounds || [];
			const finished = rounds.filter((r: any) => r.finished);
			if (finished.length === 0) continue;
			// Son finished round (en yuksek number)
			const last = finished.reduce((a: any, b: any) => (a.number > b.number ? a : b));
			// Sadece event'in genel finali (last finished) her zaman secilir;
			// daha kati: sadece tum round'lar finished ise hesapla
			const allFinished = rounds.every((r: any) => r.finished);
			if (!allFinished) continue;
			finalRounds.push({
				liveRoundId: String(last.id),
				eventId: ce.event?.id || '',
				eventName: ce.event?.name || '',
				sortBy: last.format?.sortBy || 'best',
			});
		}

		const podiums = await this.fetchPodiumsForRounds(finalRounds);

		return {
			compId: String(comp.id),
			name: comp.name || '',
			podiums,
			events: (comp.competitionEvents || []).map((ce: any) => ({
				eventId: ce.event?.id || '',
				eventName: ce.event?.name || '',
				rounds: (ce.rounds || []).map((r: any) => ({
					liveRoundId: String(r.id),
					number: r.number || 0,
					name: r.name || '',
					open: !!r.open,
					finished: !!r.finished,
					active: !!r.active,
					numEntered: r.numEnteredResults || 0,
					numResults: r.numResults || 0,
					format: r.format ? {
						numberOfAttempts: r.format.numberOfAttempts || 0,
						sortBy: r.format.sortBy || 'best',
					} : undefined,
					timeLimit: r.timeLimit ? {
						centiseconds: r.timeLimit.centiseconds || 0,
						cumulativeRoundWcifIds: r.timeLimit.cumulativeRoundWcifIds || [],
					} : undefined,
					cutoff: r.cutoff ? {
						attemptResult: r.cutoff.attemptResult || 0,
						numberOfAttempts: r.cutoff.numberOfAttempts || 0,
					} : undefined,
					advancementCondition: r.advancementCondition ? {
						type: r.advancementCondition.type || 'ranking',
						level: r.advancementCondition.level || 0,
					} : undefined,
				})),
			})),
			schedule: (comp.venues || []).map((v: any) => ({
				name: v.name || '',
				rooms: (v.rooms || []).map((rm: any) => ({
					name: rm.name || '',
					color: rm.color || undefined,
					activities: (rm.activities || []).map((a: any) => ({
						activityId: Number(a.id) || 0,
						name: a.name || '',
						activityCode: a.activityCode || '',
						startTime: a.startTime || '',
						endTime: a.endTime || '',
					})),
				})),
			})),
			records: (comp.competitionRecords || []).map((rec: any) => ({
				type: rec.type || '',
				tag: rec.tag || '',
				eventId: rec.result?.round?.competitionEvent?.event?.id || '',
				eventName: rec.result?.round?.competitionEvent?.event?.name || '',
				attemptResult: rec.attemptResult || 0,
				personName: rec.result?.person?.name || '',
				personCountryIso2: rec.result?.person?.country?.iso2 || undefined,
				roundNumber: rec.result?.round?.number || undefined,
			})),
		};
	}

	private async fetchLiveRoundResults(liveRoundId: string): Promise<WcaLiveRoundResults | null> {
		const axios = (await import('axios')).default;

		const res = await axios.post(WCA_LIVE_ENDPOINT, {
			query: `{ round(id: "${liveRoundId}") {
				id name finished active
				format { numberOfAttempts sortBy }
				results {
					ranking best average
					attempts { result }
					person { id name wcaId country { iso2 } }
					singleRecordTag averageRecordTag advancing advancingQuestionable
				}
			} }`,
		}, {timeout: 8000});

		const round = res.data?.data?.round;
		if (!round) return null;

		return {
			roundActivityCode: liveRoundId,
			roundName: round.name || '',
			active: !!round.active,
			finished: !!round.finished,
			numberOfAttempts: round.format?.numberOfAttempts || 0,
			sortBy: round.format?.sortBy || 'best',
			results: (round.results || []).map((r: any) => ({
				ranking: r.ranking ?? undefined,
				best: r.best ?? 0,
				average: r.average ?? 0,
				attempts: (r.attempts || []).map((a: any) => ({result: a.result})),
				personName: r.person?.name || '',
				personWcaId: r.person?.wcaId || undefined,
				personCountryIso2: r.person?.country?.iso2 || undefined,
				personLiveId: String(r.person?.id || ''),
				singleRecordTag: r.singleRecordTag || undefined,
				averageRecordTag: r.averageRecordTag || undefined,
				advancing: !!r.advancing,
				advancingQuestionable: !!r.advancingQuestionable,
			})),
		};
	}

	private async fetchLiveCompetitorResults(personLiveId: string): Promise<WcaLiveCompetitorResults | null> {
		const axios = (await import('axios')).default;

		const res = await axios.post(WCA_LIVE_ENDPOINT, {
			query: `{ person(id: "${personLiveId}") {
				id name wcaId
				country { iso2 }
				results {
					ranking best average
					attempts { result }
					singleRecordTag averageRecordTag advancing advancingQuestionable
					round {
						number name
						format { numberOfAttempts sortBy }
						competitionEvent { event { id name } }
					}
				}
			} }`,
		}, {timeout: 8000});

		const person = res.data?.data?.person;
		if (!person) return null;

		// Round'lari event ID'ye, sonra round number'a gore sirala
		const sorted = (person.results || []).slice().sort((a: any, b: any) => {
			const eA = a.round?.competitionEvent?.event?.id || '';
			const eB = b.round?.competitionEvent?.event?.id || '';
			if (eA !== eB) return eA.localeCompare(eB);
			return (a.round?.number || 0) - (b.round?.number || 0);
		});

		return {
			personName: person.name || '',
			personWcaId: person.wcaId || undefined,
			personCountryIso2: person.country?.iso2 || undefined,
			results: sorted.map((r: any) => ({
				eventId: r.round?.competitionEvent?.event?.id || '',
				eventName: r.round?.competitionEvent?.event?.name || '',
				roundNumber: r.round?.number || 0,
				roundName: r.round?.name || '',
				ranking: r.ranking ?? undefined,
				best: r.best ?? 0,
				average: r.average ?? 0,
				attempts: (r.attempts || []).map((a: any) => ({result: a.result})),
				singleRecordTag: r.singleRecordTag || undefined,
				averageRecordTag: r.averageRecordTag || undefined,
				advancing: !!r.advancing,
				advancingQuestionable: !!r.advancingQuestionable,
				format: r.round?.format ? {
					numberOfAttempts: r.round.format.numberOfAttempts || 0,
					sortBy: r.round.format.sortBy || 'best',
				} : undefined,
			})),
		};
	}
}
