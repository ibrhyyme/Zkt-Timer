// Adapters for WCA's own live results (worldcubeassociation.org/competitions/<id>/live),
// the system WCA is moving every competition to from the separate WCA Live app
// (live.worldcubeassociation.org). A competition reports which one it uses in
// `scoretaking_software` ("internal" is this one, "wca_live" the old app), and
// the live API answers 403 for any competition it does not score.
//
// The payloads come from the public REST API under /api/v1/competitions/<id>/live
// and are turned into the same WCA Live shapes the classic GraphQL source
// produces, so the live components need no second code path.
//
// Ids are self-contained (`wcav1:<competitionId>[:<part>]`). A classic WCA Live
// round or person id is a bare number that is unique on its own, and several
// callers (the socket poller, the crons) pass nothing but that id; a v1 round is
// only addressable together with its competition, so the competition rides in
// the id.

import {WcaApiService} from './WcaApiService';

const WCA_V1_PREFIX = 'wcav1:';
export const isWcaV1Id = (id: string | null | undefined): boolean => !!id && id.startsWith(WCA_V1_PREFIX);

// These ids arrive from clients and end up in a request path, so every part is
// held to the exact shape WCA uses: alphanumeric competition ids, "333oh-r2"
// round ids, numeric registration ids.
const COMPETITION_ID = /^[A-Za-z0-9]+$/;
const ROUND_ID = /^[a-z0-9]+-r\d+$/;
const REGISTRATION_ID = /^\d+$/;

export const v1CompId = (competitionId: string): string => `${WCA_V1_PREFIX}${competitionId}`;
export const v1RoundId = (competitionId: string, roundWcifId: string): string =>
	`${WCA_V1_PREFIX}${competitionId}:${roundWcifId}`;
export const v1PersonId = (competitionId: string, registrationId: number | string): string =>
	`${WCA_V1_PREFIX}${competitionId}:${registrationId}`;

function splitId(id: string): [string, string | undefined] | null {
	if (!isWcaV1Id(id)) return null;
	const [competitionId, part, ...rest] = id.slice(WCA_V1_PREFIX.length).split(':');
	if (rest.length > 0 || !COMPETITION_ID.test(competitionId || '')) return null;
	return [competitionId, part];
}

export function parseV1CompId(id: string): string | null {
	const parts = splitId(id);
	return parts && parts[1] === undefined ? parts[0] : null;
}

export function parseV1RoundId(id: string): {competitionId: string; roundWcifId: string} | null {
	const parts = splitId(id);
	if (!parts || !parts[1] || !ROUND_ID.test(parts[1])) return null;
	return {competitionId: parts[0], roundWcifId: parts[1]};
}

export function parseV1PersonId(id: string): {competitionId: string; registrationId: string} | null {
	const parts = splitId(id);
	if (!parts || !parts[1] || !REGISTRATION_ID.test(parts[1])) return null;
	return {competitionId: parts[0], registrationId: parts[1]};
}

export function isValidWcaCompetitionId(id: string): boolean {
	return COMPETITION_ID.test(id);
}

// WCA format ids: "a" average of 5, "m" mean of 3, digits best of N.
const ATTEMPTS: Record<string, number> = {'1': 1, '2': 2, '3': 3, '5': 5, a: 5, m: 3};
const attemptsOf = (f: string): number => ATTEMPTS[f] ?? 5;
const sortByOf = (f: string): string => (f === 'a' || f === 'm' ? 'average' : 'best');

// Same English names the classic WCA Live app sends; a final is flagged
// separately and the client localizes that one.
const ROUND_NAMES = ['First round', 'Second round', 'Third round'];
const roundName = (n: number, isFinal: boolean): string =>
	isFinal ? 'Final' : ROUND_NAMES[n - 1] || `Round ${n}`;

const ROUND_CODE = /^(.+)-r(\d+)$/;

export function parseRoundCode(code: string): {eventId: string; number: number} | null {
	const m = ROUND_CODE.exec(code || '');
	return m ? {eventId: m[1], number: parseInt(m[2], 10)} : null;
}

// Lifecycle states from WCA's Round#lifecycle_state. "open" means results are
// being entered (WCA's own page badges it "live"), "locked" that the round is
// closed. pending / ready / blocked are all rounds that have not started.
const isOpenState = (s: string | undefined): boolean => s === 'open' || s === 'locked';

/** Highest round number per event: what makes a round the final. */
export function v1LastRoundByEvent(rounds: any[]): Map<string, number> {
	const out = new Map<string, number>();
	for (const r of rounds) {
		const code = parseRoundCode(r.id);
		if (!code) continue;
		if ((out.get(code.eventId) ?? 0) < code.number) out.set(code.eventId, code.number);
	}
	return out;
}

/**
 * Advancement out of each round, keyed by round id.
 *
 * WCIF v2 no longer puts the condition on the round people advance FROM; the
 * round they advance TO names its source and the condition. A linked source
 * (dual rounds) means the same condition applies to every round in the link.
 */
function advancementByRound(rounds: any[]): Map<string, {type: string; level: number}> {
	const out = new Map<string, {type: string; level: number}>();
	for (const r of rounds) {
		const source = r.participationRuleset?.participationSource;
		const cond = source?.resultCondition;
		if (!cond || typeof cond.value !== 'number') continue;
		// The client's labels speak WCIF v1, where "resultAchieved" was "attemptResult".
		const advancement = {type: cond.type === 'resultAchieved' ? 'attemptResult' : cond.type, level: cond.value};
		const fromIds: string[] =
			source.type === 'round' ? [source.roundId] : source.type === 'linkedRounds' ? source.roundIds || [] : [];
		for (const id of fromIds) out.set(id, advancement);
	}
	return out;
}

/** v1 rounds list → roundMap (activityCode → self-contained live round id). */
export function v1RoundMap(competitionId: string, rounds: any[]): {activityCode: string; liveRoundId: string}[] {
	return (rounds || [])
		.filter((r: any) => parseRoundCode(r?.id))
		.map((r: any) => ({activityCode: r.id, liveRoundId: v1RoundId(competitionId, r.id)}));
}

/**
 * WCIF persons → live competitors. The live API keys a person by the WCA
 * registration id, which the WCIF carries as `registration.wcaRegistrationId`,
 * so the list comes out of the WCIF the page already loaded and name/wcaId
 * match the page's own competitor list exactly.
 */
export function v1Competitors(competitionId: string, wcif: any): {wcaId: string | null; liveId: string; name: string}[] {
	return (wcif?.persons || [])
		.filter((p: any) => p?.registration?.wcaRegistrationId)
		.map((p: any) => ({
			wcaId: p.wcaId || null,
			liveId: v1PersonId(competitionId, p.registration.wcaRegistrationId),
			name: p.name || '',
		}));
}

/** v1 rounds list → WcaLiveCompetitionOverview.events, in the WCIF's event order. */
export function v1OverviewEvents(competitionId: string, rounds: any[], wcif?: any): any[] {
	const lastRound = v1LastRoundByEvent(rounds);
	const advancement = advancementByRound(rounds);

	const byEvent = new Map<string, any[]>();
	for (const r of rounds || []) {
		const code = parseRoundCode(r?.id);
		if (!code) continue;
		if (!byEvent.has(code.eventId)) byEvent.set(code.eventId, []);
		const isFinal = lastRound.get(code.eventId) === code.number;
		const state: string | undefined = r.state;
		const total = r.total_competitors ?? 0;
		byEvent.get(code.eventId)!.push({
			liveRoundId: v1RoundId(competitionId, r.id),
			number: code.number,
			name: roundName(code.number, isFinal),
			isFinal,
			open: isOpenState(state),
			finished: state === 'locked',
			active: state === 'open',
			// WCA only reports progress on an open round; a locked one is complete.
			numEntered: state === 'locked' ? total : r.completed_competitors ?? 0,
			numResults: total,
			format: {numberOfAttempts: attemptsOf(r.format), sortBy: sortByOf(r.format)},
			timeLimit: r.timeLimit
				? {
						centiseconds: r.timeLimit.centiseconds || 0,
						cumulativeRoundWcifIds: r.timeLimit.cumulativeRoundIds || [],
					}
				: undefined,
			cutoff: r.cutoff
				? {attemptResult: r.cutoff.resultValue || 0, numberOfAttempts: r.cutoff.numberOfAttempts || 0}
				: undefined,
			advancementCondition: advancement.get(r.id),
		});
	}

	const order: string[] = (wcif?.events || []).map((e: any) => e.id);
	const rank = (id: string) => {
		const i = order.indexOf(id);
		return i === -1 ? order.length : i;
	};
	return [...byEvent.entries()]
		.sort(([a], [b]) => rank(a) - rank(b))
		.map(([eventId, eventRounds]) => ({
			eventId,
			eventName: WcaApiService.getEventName(eventId),
			rounds: eventRounds.sort((a, b) => a.number - b.number),
		}));
}

/** WCIF schedule → WcaLiveCompetitionOverview.schedule (top-level activities, as WCA Live sends them). */
export function v1Schedule(wcif: any): any[] {
	return (wcif?.schedule?.venues || []).map((v: any) => ({
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
	}));
}

/**
 * Record tags as the client knows them. WCA marks a continental record by its
 * continent ("ER", "AsR", ...), WCA Live by the generic "CR".
 */
const CONTINENTAL = new Set(['AfR', 'AsR', 'ER', 'NAR', 'OcR', 'SAR']);
export function normalizeRecordTag(tag: string | null | undefined): string | undefined {
	if (!tag) return undefined;
	return CONTINENTAL.has(tag) ? 'CR' : tag;
}

function competitorsById(payload: any): Map<number, any> {
	return new Map((payload?.competitors || []).map((c: any) => [c.id, c]));
}

/** Ranking within the round. On a dual round global_pos ranks the linked pair together. */
const rankingOf = (res: any): number | undefined => res.local_pos ?? res.global_pos ?? undefined;

function sortResults<T extends {ranking?: number; personName: string}>(rows: T[]): T[] {
	return rows.sort((a, b) => {
		const ra = a.ranking ?? Number.MAX_SAFE_INTEGER;
		const rb = b.ranking ?? Number.MAX_SAFE_INTEGER;
		return ra !== rb ? ra - rb : a.personName.localeCompare(b.personName);
	});
}

/**
 * One v1 round (its results payload plus its entry in the rounds list, which is
 * the only place that carries the state) → WcaLiveRoundResults.
 */
export function v1RoundToWcaLiveResults(competitionId: string, payload: any, roundInfo: any, isFinal: boolean): any {
	const code = parseRoundCode(payload?.id || roundInfo?.id || '');
	const format = payload?.format || roundInfo?.format || 'a';
	const people = competitorsById(payload);
	const state: string | undefined = roundInfo?.state;

	const results = (payload?.results || []).map((res: any) => {
		const person = people.get(res.registration_id);
		return {
			ranking: rankingOf(res),
			best: res.best ?? 0,
			average: res.average ?? 0,
			attempts: [...(res.attempts || [])]
				.sort((a: any, b: any) => (a.attempt_number ?? 0) - (b.attempt_number ?? 0))
				.map((a: any) => ({result: a.value ?? 0})),
			personName: person?.name || '',
			personWcaId: person?.wca_id || undefined,
			personCountryIso2: person?.country_iso2 || undefined,
			personLiveId: v1PersonId(competitionId, res.registration_id),
			singleRecordTag: normalizeRecordTag(res.single_record_tag),
			averageRecordTag: normalizeRecordTag(res.average_record_tag),
			advancing: !!res.advancing,
			advancingQuestionable: !!res.advancing_questionable,
		};
	});

	return {
		roundActivityCode: v1RoundId(competitionId, payload?.id || roundInfo?.id || ''),
		roundName: code ? roundName(code.number, isFinal) : '',
		active: state === 'open',
		finished: state === 'locked',
		numberOfAttempts: attemptsOf(format),
		sortBy: sortByOf(format),
		results: sortResults(results),
	};
}

/** Rounds whose payload is worth reading: anything with results in it. */
export function v1RoundsWithResults(rounds: any[]): any[] {
	return (rounds || []).filter((r: any) => isOpenState(r?.state) && parseRoundCode(r.id));
}

/**
 * Records set at the competition, from the round payloads. The live API has no
 * records endpoint; every result row carries its own record tags instead.
 * PR is dropped, like in the classic source.
 */
export function v1RecordsFromRounds(payloads: any[]): any[] {
	const out: any[] = [];
	for (const payload of payloads) {
		const code = parseRoundCode(payload?.id || '');
		if (!code) continue;
		const people = competitorsById(payload);
		for (const res of payload.results || []) {
			const person = people.get(res.registration_id);
			const entries: [string, string | undefined, number][] = [
				['single', normalizeRecordTag(res.single_record_tag), res.best],
				['average', normalizeRecordTag(res.average_record_tag), res.average],
			];
			for (const [type, tag, value] of entries) {
				if (tag !== 'WR' && tag !== 'CR' && tag !== 'NR') continue;
				out.push({
					type,
					tag,
					eventId: code.eventId,
					eventName: WcaApiService.getEventName(code.eventId),
					attemptResult: value ?? 0,
					personName: person?.name || '',
					personCountryIso2: person?.country_iso2 || undefined,
					roundNumber: code.number,
				});
			}
		}
	}
	return out;
}

/**
 * Podiums of the events whose final is locked, the same "only once the event
 * is over" rule the classic source applies.
 */
export function v1Podiums(rounds: any[], payloads: any[]): any[] {
	const lastRound = v1LastRoundByEvent(rounds);
	const stateOf = new Map((rounds || []).map((r: any) => [r.id, r.state]));
	const out: any[] = [];
	for (const payload of payloads) {
		const code = parseRoundCode(payload?.id || '');
		if (!code || lastRound.get(code.eventId) !== code.number) continue;
		if (stateOf.get(payload.id) !== 'locked') continue;
		const people = competitorsById(payload);
		const entries = sortResults(
			(payload.results || [])
				.map((res: any) => ({
					ranking: rankingOf(res),
					personName: people.get(res.registration_id)?.name || '',
					personCountryIso2: people.get(res.registration_id)?.country_iso2 || undefined,
					best: res.best ?? 0,
					average: res.average ?? 0,
					singleRecordTag: normalizeRecordTag(res.single_record_tag),
					averageRecordTag: normalizeRecordTag(res.average_record_tag),
				}))
				.filter((e: any) => e.ranking != null && e.ranking <= 3)
		);
		if (entries.length === 0) continue;
		out.push({
			eventId: code.eventId,
			eventName: WcaApiService.getEventName(code.eventId),
			sortBy: sortByOf(payload.format),
			entries,
		});
	}
	return out;
}

/** v1 registration payload (person + every result) → WcaLiveCompetitorResults. */
export function v1RegistrationToCompetitorResults(registration: any, rounds: any[]): any | null {
	if (!registration) return null;
	const lastRound = v1LastRoundByEvent(rounds);
	const formatOf = new Map((rounds || []).map((r: any) => [r.id, r.format]));

	const results = (registration.results || [])
		.map((res: any) => {
			const code = parseRoundCode(res.round_wcif_id || '');
			if (!code) return null;
			const format = formatOf.get(res.round_wcif_id) || 'a';
			return {
				eventId: code.eventId,
				eventName: WcaApiService.getEventName(code.eventId),
				roundNumber: code.number,
				roundName: roundName(code.number, lastRound.get(code.eventId) === code.number),
				ranking: rankingOf(res),
				best: res.best ?? 0,
				average: res.average ?? 0,
				attempts: [...(res.attempts || [])]
					.sort((a: any, b: any) => (a.attempt_number ?? 0) - (b.attempt_number ?? 0))
					.map((a: any) => ({result: a.value ?? 0})),
				singleRecordTag: normalizeRecordTag(res.single_record_tag),
				averageRecordTag: normalizeRecordTag(res.average_record_tag),
				advancing: !!res.advancing,
				advancingQuestionable: !!res.advancing_questionable,
				format: {numberOfAttempts: attemptsOf(format), sortBy: sortByOf(format)},
			};
		})
		.filter(Boolean)
		.sort((a: any, b: any) => (a.eventId !== b.eventId ? a.eventId.localeCompare(b.eventId) : a.roundNumber - b.roundNumber));

	return {
		personName: registration.name || '',
		personWcaId: registration.wcaId || undefined,
		personCountryIso2: registration.countryIso2 || undefined,
		results,
	};
}
