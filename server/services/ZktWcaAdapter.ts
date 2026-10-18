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
 * Dual Chance (ZKT "Çift Şans") is a round option, not a WCA dual round: the
 * round number and format stay the same, every competitor does the format twice
 * and the better chance counts. Groups carry no chance field; with 2N groups the
 * federation numbers 1..N as chance 1 and N+1..2N as chance 2, so the chance is
 * derived from the group number and the round's group count.
 */
export function chanceOfGroup(groupNumber: number | null | undefined, totalGroups: number): 1 | 2 | null {
	if (!groupNumber || totalGroups < 2) return null;
	return groupNumber <= totalGroups / 2 ? 1 : 2;
}

/**
 * Dual Chance rounds of a federation competition detail, keyed by the WCIF round
 * code ("333-r1") with the round's group count. A day-split event has two rounds
 * under one code; if either is a Dual Chance round its group count is the one kept.
 */
export function zktDualChanceRounds(d: any): Map<string, number> {
	const out = new Map<string, number>();
	for (const ev of d?.events || []) {
		for (const r of ev.rounds || []) {
			if (r?.dualChance !== true) continue;
			out.set(`${ev.eventId}-r${r.roundNumber}`, (r.groups || []).length);
		}
	}
	return out;
}

const GROUP_CODE = /^(.+-r\d+)-g(\d+)$/;

/**
 * Mark the Dual Chance rounds on a CompetitionDetail built from WCIF. The WCIF
 * itself only shows them as two "…, Şans 1 / Şans 2" activities under one round
 * code, so the flag comes from the federation detail (`fed`). Without it (the
 * federation unreachable and nothing cached) the page simply shows no chance
 * labels, which is what it showed before.
 */
export function applyZktDualChance(detail: any, fed: any): void {
	const dual = zktDualChanceRounds(fed);
	if (!detail || dual.size === 0) return;

	const chanceOfCode = (activityCode: string | null | undefined): number | null => {
		const m = GROUP_CODE.exec(activityCode || '');
		if (!m || !dual.has(m[1])) return null;
		return chanceOfGroup(parseInt(m[2], 10), dual.get(m[1])!);
	};

	for (const ev of detail.events || []) {
		for (const r of ev.rounds || []) {
			const key = `${ev.eventId}-r${r.roundNumber}`;
			if (!dual.has(key)) continue;
			r.dualChance = true;
			for (const g of r.groups || []) {
				g.chance = chanceOfGroup(g.groupNumber, dual.get(key)!);
			}
		}
	}
	for (const c of detail.competitors || []) {
		for (const a of c.assignments || []) {
			const chance = chanceOfCode(a.activityCode);
			if (chance) a.chance = chance;
		}
	}
	for (const day of detail.schedule || []) {
		for (const a of day.assignments || []) {
			const chance = chanceOfCode(a.activityCode);
			if (chance) a.chance = chance;
		}
	}
}

/** One Dual Chance round result's chances, WCA Live shaped. */
function chancesOf(res: any): any[] | undefined {
	if (!Array.isArray(res?.chances)) return undefined;
	return res.chances.map((c: any) => ({
		chance: c.chance,
		attempts: (c.attempts || []).map((a: number) => ({result: a})),
		best: c.best ?? 0,
		average: c.average ?? 0,
		noShow: !!c.noShow,
		counting: !!c.counting,
	}));
}

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

/**
 * federation PublicRecordEntry[] → WcaLiveCompetitionOverview.records.
 *
 * The overview's record list is what the "records broken here" section renders.
 * A ZKT record is always national, so `tag` comes through as 'NR'; `type` is
 * 'single' | 'average', matching the WCA Live field the component reads.
 */
export function zktRecordsToWcaLive(items: any[]): any[] {
	return (items || []).map((r: any) => ({
		type: r.type || 'single',
		tag: r.tag || 'NR',
		eventId: r.eventId || '',
		eventName: r.eventName || WcaApiService.getEventName(r.eventId),
		attemptResult: r.attemptResult ?? 0,
		personName: r.personName || '',
		personCountryIso2: r.personCountryIso2 || undefined,
		roundNumber: r.roundNumber ?? undefined,
	}));
}

/**
 * federation PublicRecordEntry[] → WcaRecentRecord[] (the record radar feed).
 *
 * `competitionId` goes out prefixed so the feed's deep link lands on the ZKT
 * competition route rather than being read as a WCA competition id.
 */
export function zktRecordsToRecentFeed(items: any[]): any[] {
	return (items || []).map((r: any) => ({
		id: `zkt:${r.id}`,
		tag: r.tag || 'NR',
		type: r.type || 'single',
		eventId: r.eventId || '',
		eventName: r.eventName || WcaApiService.getEventName(r.eventId),
		attemptResult: r.attemptResult ?? 0,
		personName: r.personName || '',
		personCountryIso2: r.personCountryIso2 || 'TR',
		competitionId: `${ZKT_PREFIX}${r.competitionSlug || r.competitionId}`,
		competitionName: r.competitionName || '',
		roundNumber: r.roundNumber ?? undefined,
	}));
}

/**
 * federation PublicRecordEntry[] → WcaLiveRecordEntry[] (the record radar cron).
 *
 * Kept separate from `zktRecordsToWcaLive` even though the shapes nearly match,
 * because of one line: the country default. The federation's `User.countryIso2`
 * is nullable, and `zktRecordsToWcaLive` passes a missing one through as
 * undefined — fine for a flag icon, fatal here. The radar's NR rule is
 * `!!rec.personCountryIso2 && rec.personCountryIso2 === watch.region`, so a
 * Turkish national record set by a member with no country on file would match
 * no watch at all and be silently dropped. Every ZKT record is by definition
 * Turkish, so default it, exactly as `zktRecordsToRecentFeed` already does.
 */
export function zktRecordsToRecordEntries(items: any[]): any[] {
	return (items || [])
		.filter((r: any) => !!r?.eventId)
		.map((r: any) => ({
			type: r.type || 'single',
			tag: r.tag || 'NR', // ZKT has no WR/CR concept — national records only
			eventId: r.eventId,
			eventName: r.eventName || WcaApiService.getEventName(r.eventId),
			attemptResult: r.attemptResult ?? 0,
			personName: r.personName || '',
			personCountryIso2: r.personCountryIso2 || 'TR',
			roundNumber: r.roundNumber ?? undefined,
		}));
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
			// A day-split event runs a chain per day, so it has two rounds numbered
			// 1. Dropping the day here left the viewer with "1. Tur, 2. Tur, 1. Tur,
			// 2. Tur" and no way to tell which pair is the day they are attending.
			dayIndex: r.dayIndex ?? 0,
			dayLabel: r.dayLabel ?? undefined,
			isFinal: r.isFinal ?? undefined,
			dualChance: r.dualChance === true ? true : undefined,
			open: r.status === 'OPEN',
			finished: r.status === 'FINISHED',
			active: r.status === 'ACTIVE',
			// WCA Live semantics: numEntered = results typed in so far, numResults =
			// the round's field size. The federation ships both; hardcoding 0 made
			// every ZKT round render its progress as "0/0".
			numEntered: r.numEntered ?? 0,
			numResults: r.totalExpected ?? 0,
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

	// Schedule: the competition's whole programme, in the rooms the organizer
	// defined. Feeds the WCA Live welcome schedule and the Programme tab.
	//
	// Rounds are spanned from their groups; the organizer's own items (check-in,
	// lunch, the award ceremony) come from `d.schedule` and used to be dropped
	// entirely, which is why the programme read as nothing but event rounds.
	const roomById = new Map<string, {name: string; color?: string}>(
		(d.rooms || []).map((r: any) => [r.id, {name: r.name, color: r.color}])
	);
	const fallbackRoom = d.location || '';
	let activityId = 1;
	// Keyed by room name so parallel stages stay separate columns downstream.
	const byRoom = new Map<string, {name: string; color?: string; activities: any[]}>();
	const roomBucket = (roomId?: string | null) => {
		const room = roomId ? roomById.get(roomId) : undefined;
		const name = room?.name || fallbackRoom;
		if (!byRoom.has(name)) byRoom.set(name, {name, color: room?.color, activities: []});
		return byRoom.get(name)!;
	};

	// "Skewb 1. Tur". The bare event name left the reader with two identical
	// "Skewb" blocks and no way to tell round 1 from the final. This Turkish label
	// is the fallback for older clients; current ones build their own from the
	// structured fields next to it, in the viewer's language.
	const activityLabel = (ev: any, r: any, chance: number | null) => {
		const known = WcaApiService.getEventName(ev.eventId);
		const event = known !== ev.eventId ? known : ev.eventName || ev.eventId;
		const label = `${event} ${r.isFinal ? 'Final' : roundName(r.roundNumber)}`;
		return chance ? `${label}, Şans ${chance}` : label;
	};
	const roundFields = (ev: any, r: any, chance: number | null) => ({
		name: activityLabel(ev, r, chance),
		activityCode: `${ev.eventId}-r${r.roundNumber}`,
		roundNumber: r.roundNumber,
		isFinal: r.isFinal ?? undefined,
		chance: chance ?? undefined,
		dayIndex: r.dayIndex ?? 0,
		dayLabel: r.dayLabel ?? undefined,
	});

	for (const ev of d.events || []) {
		for (const r of ev.rounds || []) {
			const groups = r.groups || [];
			const timed = groups.filter((g: any) => g.startTime);
			if (timed.length === 0) {
				// No timed groups, but the organizer may have placed the ROUND on the
				// calendar. That is how the second day of a day-split event is usually
				// laid out (groups get times only once assignments are made), and
				// ignoring it made those rounds disappear from the programme.
				if (!r.startTime) continue;
				roomBucket(r.roomId ?? null).activities.push({
					activityId: activityId++,
					...roundFields(ev, r, null),
					startTime: r.startTime,
					endTime: r.endTime || r.startTime,
				});
				continue;
			}
			// One block per room the round actually runs in: a round split across two
			// stages is two sessions, not one spanning both. A Dual Chance round is
			// also two sessions, one per chance; a single block from the first
			// chance-1 group to the last chance-2 group would cover whatever the
			// organizer scheduled between them.
			const dual = r.dualChance === true;
			const perBlock = new Map<string, {start: string; end: string; roomId: string | null; chance: number | null}>();
			for (const g of timed) {
				const roomId = g.roomId ?? null;
				const chance = dual ? chanceOfGroup(g.groupNumber, groups.length) : null;
				const key = `${roomId ?? ''}|${chance ?? ''}`;
				const end = g.endTime || g.startTime;
				const cur = perBlock.get(key);
				if (!cur) perBlock.set(key, {start: g.startTime, end, roomId, chance});
				else {
					if (g.startTime < cur.start) cur.start = g.startTime;
					if (end > cur.end) cur.end = end;
				}
			}
			for (const [, span] of perBlock) {
				roomBucket(span.roomId).activities.push({
					activityId: activityId++,
					...roundFields(ev, r, span.chance),
					startTime: span.start,
					endTime: span.end,
				});
			}
		}
	}

	for (const item of d.schedule || []) {
		if (!item.startTime) continue;
		roomBucket(item.roomId).activities.push({
			activityId: activityId++,
			name: item.title,
			// No activity code: these are not rounds, and a parser that reads one
			// would route "Lunch" to an event page.
			activityCode: '',
			startTime: item.startTime,
			endTime: item.endTime || item.startTime,
		});
	}

	for (const room of byRoom.values()) {
		room.activities.sort((a, b) => String(a.startTime).localeCompare(String(b.startTime)));
	}
	const rooms = [...byRoom.values()].filter((r) => r.activities.length > 0);
	const schedule = rooms.length ? [{name: d.location || '', rooms}] : [];

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
		dualChance: r.dualChance === true ? true : undefined,
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
			chances: chancesOf(res),
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
