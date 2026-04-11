import {fetchDataFromCache, createRedisKey, RedisNamespace} from './redis';
import {logger} from './logger';

const WCA_LIVE_ENDPOINT = process.env.WCA_LIVE_API_URL || 'https://live.worldcubeassociation.org/api';
const WCA_LIVE_CACHE_TTL = 60 * 60; // 1 saat

export interface WcaLiveData {
	compId: string;
	competitors: {wcaId: string | null; liveId: string; name: string}[];
	roundMap: {activityCode: string; liveRoundId: string}[];
}

export interface WcaLiveRoundResult {
	ranking?: number;
	best: number;
	average: number;
	attempts: {result: number}[];
	personName: string;
	personWcaId?: string;
	personCountryIso2?: string;
	personLiveId: string;
	singleRecordTag?: string;
	averageRecordTag?: string;
	advancing: boolean;
	advancingQuestionable: boolean;
}

export interface WcaLiveRoundData {
	roundActivityCode: string;
	roundName: string;
	active: boolean;
	finished: boolean;
	numberOfAttempts: number;
	sortBy: string;
	results: WcaLiveRoundResult[];
}

export async function getWcaLiveData(competitionId: string): Promise<WcaLiveData | null> {
	return fetchDataFromCache(
		createRedisKey(RedisNamespace.WCA_WCIF, `live:${competitionId}`),
		() => fetchWcaLiveData(competitionId),
		WCA_LIVE_CACHE_TTL
	);
}

async function fetchWcaLiveData(competitionId: string): Promise<WcaLiveData | null> {
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

export async function fetchLiveRoundResults(liveRoundId: string): Promise<WcaLiveRoundData | null> {
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

// Centiseconds → "MM:SS.cs" / "SS.cs" formati
// BLD/FMC/MBLD v1'de basit formatlanir, gelistirme sonraki iterasyonda
export function formatCentiseconds(cs: number, eventId?: string): string {
	if (!cs || cs <= 0) return '-';
	if (cs === -1) return 'DNF';
	if (cs === -2) return 'DNS';

	// FMC: en iyi 0.01 birimi = move sayisi (orn. 2800 = 28.00 moves)
	if (eventId === '333fm') {
		return (cs / 100).toFixed(2);
	}

	// MBLD: kompleks, sonraki iterasyonda
	if (eventId === '333mbf') {
		return String(cs);
	}

	const totalSeconds = Math.floor(cs / 100);
	const centis = cs % 100;
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;

	const centiStr = centis.toString().padStart(2, '0');
	if (minutes > 0) {
		return `${minutes}:${seconds.toString().padStart(2, '0')}.${centiStr}`;
	}
	return `${seconds}.${centiStr}`;
}

export {logger};
