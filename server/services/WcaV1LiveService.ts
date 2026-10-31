// Network side of WCA's own live results (see WcaV1LiveAdapter for the shapes
// and the id scheme). Every function here answers in the WCA Live shapes that
// WcaLiveService already returns for the classic source.

import axios from 'axios';
import {fetchDataFromCache, createRedisKey, RedisNamespace} from './redis';
import {logger} from './logger';
import {WcaApiService} from './WcaApiService';
import type {WcaLiveData, WcaLiveRoundData, WcaLiveRecordEntry} from './WcaLiveService';
import {
	isValidWcaCompetitionId,
	parseRoundCode,
	parseV1CompId,
	parseV1PersonId,
	parseV1RoundId,
	v1CompId,
	v1Competitors,
	v1LastRoundByEvent,
	v1OverviewEvents,
	v1Podiums,
	v1RecordsFromRounds,
	v1RegistrationToCompetitorResults,
	v1RoundMap,
	v1RoundToWcaLiveResults,
	v1RoundsWithResults,
	v1Schedule,
} from './WcaV1LiveAdapter';

const V1_BASE = 'https://www.worldcubeassociation.org/api/v1/competitions';

// The rounds list is the only source of a round's state, and every reader
// needs it, so it is shared briefly.
const ROUNDS_TTL = 30;
// Round payloads read in bulk (overview, record radar). A locked round only
// changes when a delegate reopens it.
const OPEN_ROUND_TTL = 60;
const LOCKED_ROUND_TTL = 10 * 60;
// The competition page's own WCIF key and TTL (WcaSchedule.resolver).
const WCIF_TTL = 60;
// Parallel round reads per competition.
const ROUND_FETCH_CONCURRENCY = 4;

async function getJson(path: string, timeout = 8000): Promise<any> {
	const res = await axios.get(`${V1_BASE}/${path}`, {timeout});
	return res.data;
}

// 403 is what the API answers for a competition scored on the classic WCA Live
// app (or anywhere else), 404 for an unknown competition.
const isNotOnV1 = (err: any): boolean => err?.response?.status === 403 || err?.response?.status === 404;

async function fetchRounds(competitionId: string): Promise<any[] | null> {
	try {
		const data = await getJson(`${encodeURIComponent(competitionId)}/live/rounds`);
		return Array.isArray(data?.rounds) ? data.rounds : [];
	} catch (err: any) {
		if (isNotOnV1(err)) return null;
		throw err;
	}
}

/** The competition's live rounds, or null when it is not scored on WCA's own system. */
function getRounds(competitionId: string): Promise<any[] | null> {
	return fetchDataFromCache(
		createRedisKey(RedisNamespace.WCA_WCIF, `v1rounds:${competitionId}`),
		() => fetchRounds(competitionId),
		ROUNDS_TTL
	);
}

function getWcif(competitionId: string): Promise<any | null> {
	return fetchDataFromCache(
		createRedisKey(RedisNamespace.WCA_WCIF, competitionId),
		() => WcaApiService.fetchCompetitionWcif(competitionId),
		WCIF_TTL
	);
}

function fetchRoundPayload(competitionId: string, roundWcifId: string): Promise<any> {
	return getJson(`${encodeURIComponent(competitionId)}/live/rounds/${encodeURIComponent(roundWcifId)}`);
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
	const out: R[] = new Array(items.length);
	let next = 0;
	const worker = async () => {
		while (next < items.length) {
			const i = next++;
			out[i] = await fn(items[i]);
		}
	};
	await Promise.all(Array.from({length: Math.min(limit, items.length)}, worker));
	return out;
}

/** Payloads of every round that has results. A round that fails to load is left out, not fatal. */
async function getRoundPayloads(competitionId: string, rounds: any[]): Promise<any[]> {
	const payloads = await mapWithConcurrency(v1RoundsWithResults(rounds), ROUND_FETCH_CONCURRENCY, (round) =>
		fetchDataFromCache(
			createRedisKey(RedisNamespace.WCA_WCIF, `v1round:${competitionId}:${round.id}`),
			() => fetchRoundPayload(competitionId, round.id),
			round.state === 'locked' ? LOCKED_ROUND_TTL : OPEN_ROUND_TTL
		).catch((err: any) => {
			logger.warn('[WcaV1Live] round payload failed', {competitionId, roundId: round.id, error: err?.message});
			return null;
		})
	);
	return payloads.filter(Boolean);
}

/**
 * Live structure of a competition scored on WCA's own system, or null when it
 * is not (the caller then tries the classic WCA Live app). Any other failure
 * throws, so a passing outage is never cached as "no live results".
 */
export async function fetchV1LiveData(competitionId: string): Promise<WcaLiveData | null> {
	if (!isValidWcaCompetitionId(competitionId)) return null;
	const rounds = await getRounds(competitionId);
	if (!rounds || rounds.length === 0) return null;

	// Without the WCIF the tab still works; only the competitor → results link
	// has nothing to match on.
	const wcif = await getWcif(competitionId).catch(() => null);
	return {
		compId: v1CompId(competitionId),
		competitors: v1Competitors(competitionId, wcif),
		roundMap: v1RoundMap(competitionId, rounds),
	};
}

export async function fetchV1RoundResults(liveRoundId: string): Promise<WcaLiveRoundData | null> {
	const id = parseV1RoundId(liveRoundId);
	if (!id) return null;
	const [rounds, payload] = await Promise.all([
		getRounds(id.competitionId),
		fetchRoundPayload(id.competitionId, id.roundWcifId),
	]);
	if (!payload) return null;
	const info = (rounds || []).find((r: any) => r.id === id.roundWcifId);
	const code = parseRoundCode(id.roundWcifId)!;
	const isFinal = v1LastRoundByEvent(rounds || []).get(code.eventId) === code.number;
	return v1RoundToWcaLiveResults(id.competitionId, payload, info, isFinal);
}

export async function fetchV1Overview(liveCompId: string): Promise<any | null> {
	const competitionId = parseV1CompId(liveCompId);
	if (!competitionId) return null;
	const rounds = await getRounds(competitionId);
	if (!rounds || rounds.length === 0) return null;

	const [wcif, payloads] = await Promise.all([
		getWcif(competitionId).catch(() => null),
		getRoundPayloads(competitionId, rounds),
	]);
	return {
		compId: liveCompId,
		name: wcif?.name || competitionId,
		events: v1OverviewEvents(competitionId, rounds, wcif),
		schedule: v1Schedule(wcif),
		records: v1RecordsFromRounds(payloads),
		podiums: v1Podiums(rounds, payloads),
	};
}

export async function fetchV1CompetitorResults(personLiveId: string): Promise<any | null> {
	const id = parseV1PersonId(personLiveId);
	if (!id) return null;
	const [rounds, registration] = await Promise.all([
		getRounds(id.competitionId),
		getJson(`${encodeURIComponent(id.competitionId)}/live/registrations/${id.registrationId}`),
	]);
	return v1RegistrationToCompetitorResults(registration, rounds || []);
}

export async function fetchV1Records(liveCompId: string): Promise<WcaLiveRecordEntry[]> {
	const competitionId = parseV1CompId(liveCompId);
	if (!competitionId) return [];
	const rounds = await getRounds(competitionId);
	if (!rounds) return [];
	return v1RecordsFromRounds(await getRoundPayloads(competitionId, rounds));
}
