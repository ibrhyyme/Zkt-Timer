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

export interface WcaLiveRecordEntry {
	type: string; // 'single' | 'average'
	tag: string; // 'WR' | 'CR' | 'NR'
	eventId: string;
	attemptResult: number;
	personName: string;
	personCountryIso2?: string;
	roundNumber?: number;
}

/**
 * Lightweight records-only fetch for the record radar cron. Takes the WCA Live
 * numeric competition id (from `getWcaLiveData().compId`) and returns only the
 * WR/CR/NR records set within that competition. PR records are dropped since the
 * radar never notifies on them.
 */
export async function fetchCompetitionRecords(liveCompId: string): Promise<WcaLiveRecordEntry[]> {
	const axios = (await import('axios')).default;

	const res = await axios.post(WCA_LIVE_ENDPOINT, {
		query: `{ competition(id: "${liveCompId}") {
			competitionRecords {
				type tag attemptResult
				result {
					person { name country { iso2 } }
					round { number competitionEvent { event { id } } }
				}
			}
		} }`,
	}, {timeout: 8000});

	const records = res.data?.data?.competition?.competitionRecords || [];
	return records
		.map((rec: any): WcaLiveRecordEntry => ({
			type: rec.type || '',
			tag: rec.tag || '',
			eventId: rec.result?.round?.competitionEvent?.event?.id || '',
			attemptResult: rec.attemptResult ?? 0,
			personName: rec.result?.person?.name || '',
			personCountryIso2: rec.result?.person?.country?.iso2 || undefined,
			roundNumber: rec.result?.round?.number ?? undefined,
		}))
		.filter((r: WcaLiveRecordEntry) => r.eventId && (r.tag === 'WR' || r.tag === 'CR' || r.tag === 'NR'));
}

export interface WcaRecentRecordEntry {
	id: string;
	tag: string; // 'WR' | 'CR' | 'NR'
	type: string; // 'single' | 'average'
	eventId: string;
	eventName: string;
	attemptResult: number;
	personName: string;
	personCountryIso2?: string;
	competitionId?: string; // WCA competition id (wcaId) for deep-linking
	competitionName: string;
	roundNumber?: number;
}

/**
 * Global "recent records" feed — the same source WCA Live uses on its homepage.
 * One call returns the ~100 most recently set records across all competitions.
 */
export async function fetchRecentRecords(): Promise<WcaRecentRecordEntry[]> {
	const axios = (await import('axios')).default;

	const res = await axios.post(WCA_LIVE_ENDPOINT, {
		query: `{ recentRecords {
			id type tag attemptResult
			result {
				person { name country { iso2 } }
				round {
					number
					competitionEvent {
						event { id name }
						competition { id wcaId name }
					}
				}
			}
		} }`,
	}, {timeout: 10000});

	const records = res.data?.data?.recentRecords || [];
	return records
		.map((rec: any): WcaRecentRecordEntry => {
			const ce = rec.result?.round?.competitionEvent;
			return {
				id: rec.id || '',
				tag: rec.tag || '',
				type: rec.type || '',
				eventId: ce?.event?.id || '',
				eventName: ce?.event?.name || '',
				attemptResult: rec.attemptResult ?? 0,
				personName: rec.result?.person?.name || '',
				personCountryIso2: rec.result?.person?.country?.iso2 || undefined,
				competitionId: ce?.competition?.wcaId || undefined,
				competitionName: ce?.competition?.name || '',
				roundNumber: rec.result?.round?.number ?? undefined,
			};
		})
		.filter((r: WcaRecentRecordEntry) => r.eventId && r.tag);
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

// MBLD (3x3 Multi-Blind) result decoding — mirrors client shared.tsx formatMbldResult.
function formatMbld(result: number): string {
	const missed = result % 100;
	const seconds = Math.floor(result / 100) % 100000;
	const points = 99 - Math.floor(result / 10000000);
	const solved = points + missed;
	const attempted = solved + missed;
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	const s = seconds % 60;
	const timeStr = h > 0
		? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
		: `${m}:${s.toString().padStart(2, '0')}`;
	return `${solved}/${attempted} ${timeStr}`;
}

// Event-aware, type-aware record formatter (matches client shared.tsx formatResult).
// FMC single = move count, FMC average = moves x100; MBLD = decoded; else time.
export function formatRecordResult(result: number, eventId: string, isAverage: boolean): string {
	if (result === -1) return 'DNF';
	if (result === -2) return 'DNS';
	if (!result || result <= 0) return '-';
	if (eventId === '333mbf') return formatMbld(result);
	if (eventId === '333fm') return isAverage ? (result / 100).toFixed(2) : String(result);
	const totalSeconds = Math.floor(result / 100);
	const cs = result % 100;
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return minutes > 0
		? `${minutes}:${seconds.toString().padStart(2, '0')}.${cs.toString().padStart(2, '0')}`
		: `${seconds}.${cs.toString().padStart(2, '0')}`;
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
