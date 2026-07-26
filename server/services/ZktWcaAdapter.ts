// Adapters that turn the ZKT federation public payloads into the WCA-shaped
// structures the WCA competition components already consume. The competition
// DETAIL itself goes through WCIF (federation /wcif → WcifTransformer), so the
// only things adapted here are the WCA Live surfaces (overview / round results /
// competitor results), whose data comes from the federation's live endpoints.
//
// A ZKT competition is addressed in the WCA flow as `zkt-<slug>`; strip the
// prefix to get the federation slug.

import {WcaApiService} from './WcaApiService';

export const ZKT_PREFIX = 'zkt-';
export const isZktCompetitionId = (id: string): boolean => id.startsWith(ZKT_PREFIX);
export const zktSlugOf = (id: string): string => id.slice(ZKT_PREFIX.length);

// AO12 is the ZKT-only long-average format (12 attempts). It has to be listed
// here as well: falling through to the default made a twelve-attempt round come
// out as a five-attempt one sorted by single, which is why the live view showed
// "Mo5" and dropped attempts 6-12.
const ATTEMPTS: Record<string, number> = {BO1: 1, BO2: 2, BO3: 3, MO3: 3, AO5: 5, AO12: 12};
const attemptsOf = (f: string): number => ATTEMPTS[f] ?? 5;
const AVERAGE_FORMATS = new Set(['AO5', 'MO3', 'AO12']);
const sortByOf = (f: string): string => (AVERAGE_FORMATS.has(f) ? 'average' : 'best');
const advTypeOf = (t: string | null | undefined): string => (t === 'PERCENT' ? 'percent' : 'ranking');
const roundName = (n: number): string => `${n}. Tur`;

/**
 * Wire the WCA Live fields onto a CompetitionDetail built from federation WCIF.
 * `roundMap` (activityCode → ZKT roundId) rides in the WCIF's ZKT extension;
 * competitors are keyed by the competition-local registrantId (== the WCIF
 * registrantId == the federation registration_number) so the live competitor
 * lookup resolves.
 */
export function zktWcifLiveFields(
	wcif: any,
	compId: string,
	competitors: {wcaId: string | null; registrantId: number; name: string}[]
): {
	wcaLiveCompId: string;
	wcaLiveRoundMap: {activityCode: string; liveRoundId: string}[];
	wcaLiveCompetitors: {wcaId?: string; liveId: string; name: string}[];
} {
	const ext = (wcif?.extensions || []).find(
		(e: any) => typeof e?.id === 'string' && e.id.startsWith('org.zktimer')
	);
	const roundMap = (ext?.data?.roundMap || []).map((m: any) => ({
		activityCode: m.activityCode,
		liveRoundId: m.roundId,
	}));
	return {
		wcaLiveCompId: compId,
		wcaLiveRoundMap: roundMap,
		wcaLiveCompetitors: competitors.map((c) => ({
			wcaId: c.wcaId ?? undefined,
			liveId: String(c.registrantId),
			name: c.name,
		})),
	};
}

/** federation PublicCompetitionDetail → WcaLiveCompetitionOverview */
export function zktDetailToLiveOverview(d: any, compId: string): any {
	const events = (d.events || []).map((ev: any) => ({
		eventId: ev.eventId,
		eventName: ev.eventName || WcaApiService.getEventName(ev.eventId),
		rounds: (ev.rounds || []).map((r: any) => ({
			liveRoundId: r.roundId,
			number: r.roundNumber,
			name: roundName(r.roundNumber),
			open: r.status === 'OPEN',
			finished: r.status === 'FINISHED',
			active: r.status === 'ACTIVE',
			numEntered: 0,
			numResults: 0,
			format: {numberOfAttempts: attemptsOf(r.format), sortBy: sortByOf(r.format)},
			timeLimit: r.timeLimitCs ? {centiseconds: r.timeLimitCs, cumulativeRoundWcifIds: []} : undefined,
			cutoff: r.cutoffCs && r.cutoffAttempts ? {attemptResult: r.cutoffCs, numberOfAttempts: r.cutoffAttempts} : undefined,
			advancementCondition:
				r.advancementType && r.advancementLevel
					? {type: advTypeOf(r.advancementType), level: r.advancementLevel}
					: undefined,
		})),
	}));

	// Final-round format per event drives the podium sortBy.
	const finalFormat = new Map<string, string>();
	for (const ev of d.events || []) {
		const fr = [...(ev.rounds || [])].sort((a: any, b: any) => b.roundNumber - a.roundNumber)[0];
		if (fr) finalFormat.set(ev.eventId, fr.format);
	}
	const podiums = (d.podiums || []).map((p: any) => ({
		eventId: p.eventId,
		eventName: p.eventName || WcaApiService.getEventName(p.eventId),
		sortBy: sortByOf(finalFormat.get(p.eventId) || 'AO5'),
		entries: (p.entries || []).map((e: any) => ({
			ranking: e.ranking ?? undefined,
			personName: e.competitor?.name || '',
			personCountryIso2: e.competitor?.country || undefined,
			best: e.best ?? 0,
			average: e.average ?? 0,
			singleRecordTag: e.recordTags?.single || undefined,
			averageRecordTag: e.recordTags?.average || undefined,
		})),
	}));

	// Schedule: a single venue/room whose activities are the competition rounds
	// (span derived from their groups). Feeds the WCA Live welcome schedule.
	let activityId = 1;
	const activities: any[] = [];
	for (const ev of d.events || []) {
		for (const r of ev.rounds || []) {
			const starts = (r.groups || []).map((g: any) => g.startTime).filter(Boolean).sort();
			const ends = (r.groups || []).map((g: any) => g.endTime || g.startTime).filter(Boolean).sort();
			if (starts.length === 0) continue;
			activities.push({
				activityId: activityId++,
				name: ev.eventName || WcaApiService.getEventName(ev.eventId),
				activityCode: `${ev.eventId}-r${r.roundNumber}`,
				startTime: starts[0],
				endTime: ends[ends.length - 1] || starts[starts.length - 1],
			});
		}
	}
	const schedule = activities.length
		? [{name: d.location || '', rooms: [{name: d.location || '', color: undefined, activities}]}]
		: [];

	return {compId, name: d.name || '', events, schedule, records: [], podiums};
}

/** federation PublicRoundResults → WcaLiveRoundResults */
export function zktRoundToWcaLiveResults(r: any): any {
	return {
		roundActivityCode: `${r.eventId}-r${r.roundNumber}`,
		roundName: roundName(r.roundNumber),
		active: r.status === 'ACTIVE',
		finished: r.status === 'FINISHED',
		numberOfAttempts: attemptsOf(r.format),
		sortBy: sortByOf(r.format),
		results: (r.results || []).map((res: any) => ({
			ranking: res.ranking ?? undefined,
			best: res.best ?? 0,
			average: res.average ?? 0,
			attempts: (res.attempts || []).map((a: number) => ({result: a})),
			personName: res.competitor?.name || '',
			personWcaId: res.competitor?.wcaId || undefined,
			personCountryIso2: res.competitor?.country || undefined,
			personLiveId: String(res.competitor?.id ?? ''),
			singleRecordTag: res.recordTags?.single || undefined,
			averageRecordTag: res.recordTags?.average || undefined,
			// Federation already computes advancement: clinched = green, questionable = orange.
			advancing: !!res.advancing,
			advancingQuestionable: !!res.questionable,
		})),
	};
}

/** federation PublicCompetitorDetail → WcaLiveCompetitorResults */
export function zktCompetitorToWcaLive(c: any): any {
	return {
		personName: c.competitor?.name || '',
		personWcaId: c.competitor?.wcaId || undefined,
		personCountryIso2: c.competitor?.country || undefined,
		results: (c.results || []).map((r: any) => ({
			eventId: r.eventId,
			eventName: r.eventName || WcaApiService.getEventName(r.eventId),
			roundNumber: r.roundNumber,
			roundName: roundName(r.roundNumber),
			ranking: r.ranking ?? undefined,
			best: r.best ?? 0,
			average: r.average ?? 0,
			attempts: (r.attempts || []).map((a: number) => ({result: a})),
			singleRecordTag: r.recordTags?.single || undefined,
			averageRecordTag: r.recordTags?.average || undefined,
			advancing: !!r.proceeds,
			advancingQuestionable: false,
			format: {numberOfAttempts: attemptsOf(r.format), sortBy: sortByOf(r.format)},
		})),
	};
}
