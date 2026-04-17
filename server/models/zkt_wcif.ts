import {getPrisma} from '../database';
import {ZktRoundFormat, ZktAdvancementType} from '@prisma/client';

/**
 * Build a WCIF v1.1 (subset) document for a ZKT competition.
 * This is an unofficial export — wca_user_id/wca_id fields are nulled
 * when the linked user has no WCA account. The consumer (e.g. wca-live
 * viewer components or an archival backup) should tolerate those nulls.
 */

const FORMAT_MAP: Record<ZktRoundFormat, string> = {
	BO1: '1',
	BO2: '2',
	BO3: '3',
	MO3: 'm',
	AO5: 'a',
};

type WcifPerson = {
	registrantId: number;
	name: string;
	wcaUserId: number | null;
	wcaId: string | null;
	countryIso2: string;
	gender: string;
	birthdate: string | null;
	email: string | null;
	registration: {
		wcaRegistrationId: number;
		eventIds: string[];
		status: string;
		guests: number;
		comments: string;
		administrativeNotes: string;
		isCompeting: boolean;
	} | null;
	assignments: Array<{
		activityId: number;
		assignmentCode: string;
		stationNumber: number | null;
	}>;
	roles: string[];
	avatar: null;
	personalBests: Array<unknown>;
	extensions: Array<unknown>;
};

type WcifRound = {
	id: string;
	format: string;
	timeLimit: {centiseconds: number; cumulativeRoundIds: string[]} | null;
	cutoff: {attemptResult: number; numberOfAttempts: number} | null;
	advancementCondition:
		| {type: 'ranking' | 'percent' | 'attemptResult'; level: number}
		| null;
	scrambleSetCount: number;
	scrambleSets: Array<unknown>;
	results: Array<{
		personId: number;
		ranking: number | null;
		attempts: Array<{result: number; reconstruction?: string}>;
		best: number;
		average: number;
		recordTags: {single: string | null; average: string | null};
	}>;
	extensions: Array<unknown>;
};

function mapRegStatus(status: string): string {
	switch (status) {
		case 'APPROVED':
			return 'accepted';
		case 'WAITLISTED':
		case 'PENDING':
			return 'pending';
		case 'REJECTED':
		case 'WITHDRAWN':
			return 'deleted';
		default:
			return 'pending';
	}
}

function mapAdvancement(
	type: ZktAdvancementType | null,
	level: number | null
): WcifRound['advancementCondition'] {
	if (!type || level == null) return null;
	if (type === 'RANKING') return {type: 'ranking', level};
	if (type === 'PERCENT') return {type: 'percent', level};
	return null;
}

function zero(cs: number | null | undefined): number {
	return cs == null ? 0 : cs;
}

export async function buildZktWcif(competitionId: string): Promise<any> {
	const prisma = getPrisma();
	const comp = await prisma.zktCompetition.findUnique({
		where: {id: competitionId},
		include: {
			created_by: {include: {integrations: true}},
			events: {
				include: {
					rounds: {
						include: {
							results: {
								include: {user: {include: {integrations: true}}},
							},
							groups: {
								include: {
									assignments: {include: {user: true}},
								},
							},
							assignments: {include: {user: true}},
						},
						orderBy: {round_number: 'asc'},
					},
				},
				orderBy: {event_order: 'asc'},
			},
			registrations: {
				include: {
					user: {include: {integrations: true}},
					events: true,
				},
			},
			delegates: {include: {user: {include: {integrations: true}}}},
		},
	});
	if (!comp) throw new Error('Competition not found');

	// Build a stable registrantId map: creator, delegates, competitors in
	// insertion order. Assignments below look up by user_id.
	const personByUserId = new Map<string, WcifPerson>();
	let nextRegistrantId = 1;

	function ensurePerson(
		user: {
			id: string;
			username: string;
			integrations?: Array<{service_name: string; wca_id?: string | null}>;
			profile?: unknown;
			email?: string | null;
		} | null | undefined,
		roles: string[]
	): WcifPerson | null {
		if (!user) return null;
		const existing = personByUserId.get(user.id);
		if (existing) {
			for (const role of roles) {
				if (!existing.roles.includes(role)) existing.roles.push(role);
			}
			return existing;
		}
		const wca = user.integrations?.find((i) => i.service_name === 'wca');
		const person: WcifPerson = {
			registrantId: nextRegistrantId++,
			name: user.username,
			wcaUserId: null,
			wcaId: wca?.wca_id ?? null,
			countryIso2: 'TR',
			gender: 'o',
			birthdate: null,
			email: null,
			registration: null,
			assignments: [],
			roles: [...roles],
			avatar: null,
			personalBests: [],
			extensions: [],
		};
		personByUserId.set(user.id, person);
		return person;
	}

	// Creator & delegates first so they get the low registrantIds.
	ensurePerson(comp.created_by as any, ['delegate']);
	for (const d of comp.delegates) {
		ensurePerson(d.user as any, ['delegate']);
	}

	// Registrations.
	const compEventIdToEventId = new Map<string, string>();
	for (const ev of comp.events) {
		compEventIdToEventId.set(ev.id, ev.event_id);
	}

	for (const reg of comp.registrations) {
		const person = ensurePerson(reg.user as any, []);
		if (!person) continue;
		const eventIds = reg.events
			.map((re) => compEventIdToEventId.get(re.comp_event_id))
			.filter((x): x is string => !!x);
		person.registration = {
			wcaRegistrationId: 0,
			eventIds,
			status: mapRegStatus(reg.status),
			guests: (reg as any).guests ?? 0,
			comments: reg.notes ?? '',
			administrativeNotes: (reg as any).admin_comment ?? '',
			isCompeting: reg.status === 'APPROVED',
		};
	}

	// Events + rounds + results.
	const events = comp.events.map((ce) => {
		const rounds: WcifRound[] = ce.rounds.map((r) => {
			const roundId = `${ce.event_id}-r${r.round_number}`;
			const timeLimit = r.time_limit_cs
				? {centiseconds: r.time_limit_cs, cumulativeRoundIds: []}
				: null;
			const cutoff =
				r.cutoff_cs && r.cutoff_attempts
					? {attemptResult: r.cutoff_cs, numberOfAttempts: r.cutoff_attempts}
					: null;

			const results = r.results
				.map((res): WcifRound['results'][number] | null => {
					const person = personByUserId.get(res.user_id);
					if (!person) return null;
					const attempts = [
						res.attempt_1,
						res.attempt_2,
						res.attempt_3,
						res.attempt_4,
						res.attempt_5,
					]
						.filter((a) => a !== null && a !== undefined)
						.map((a) => ({result: a as number}));
					return {
						personId: person.registrantId,
						ranking: res.ranking ?? null,
						attempts,
						best: zero(res.best),
						average: zero(res.average),
						recordTags: {
							single: res.single_record_tag ?? null,
							average: res.average_record_tag ?? null,
						},
					};
				})
				.filter((x): x is NonNullable<typeof x> => !!x);

			return {
				id: roundId,
				format: FORMAT_MAP[r.format],
				timeLimit,
				cutoff,
				advancementCondition: mapAdvancement(r.advancement_type, r.advancement_level),
				scrambleSetCount: r.groups.length || 1,
				scrambleSets: [],
				results,
				extensions: [],
			};
		});
		return {
			id: ce.event_id,
			rounds,
			competitorLimit: null,
			qualification: null,
			extensions: [],
		};
	});

	// Assignments: we derive an activityId from (eventId, round#, group#) and
	// attach them to the relevant person. Schedule model proper is not yet
	// implemented so the schedule block stays empty (valid WCIF).
	let nextActivityId = 1;
	const activityIdByKey = new Map<string, number>();
	for (const ce of comp.events) {
		for (const r of ce.rounds) {
			for (const g of r.groups) {
				const key = `${ce.event_id}-r${r.round_number}-g${g.group_number}`;
				activityIdByKey.set(key, nextActivityId++);
				for (const a of g.assignments) {
					const person = personByUserId.get(a.user_id);
					if (!person) continue;
					person.assignments.push({
						activityId: activityIdByKey.get(key)!,
						assignmentCode: assignmentCodeFor(a.role),
						stationNumber: a.station_number ?? null,
					});
				}
			}
			// round-level assignments (no group)
			for (const a of r.assignments) {
				if (a.group_id) continue;
				const person = personByUserId.get(a.user_id);
				if (!person) continue;
				const key = `${ce.event_id}-r${r.round_number}`;
				if (!activityIdByKey.has(key)) {
					activityIdByKey.set(key, nextActivityId++);
				}
				person.assignments.push({
					activityId: activityIdByKey.get(key)!,
					assignmentCode: assignmentCodeFor(a.role),
					stationNumber: a.station_number ?? null,
				});
			}
		}
	}

	const startDate = comp.date_start.toISOString().slice(0, 10);
	const endDate = comp.date_end.toISOString().slice(0, 10);
	const numberOfDays =
		Math.floor(
			(comp.date_end.getTime() - comp.date_start.getTime()) / 86400000
		) + 1;

	return {
		formatVersion: '1.1',
		id: comp.id,
		name: comp.name,
		shortName: comp.name.slice(0, 32),
		persons: Array.from(personByUserId.values()),
		events,
		schedule: {
			startDate,
			numberOfDays: Math.max(numberOfDays, 1),
			venues: [],
		},
		competitorLimit: comp.competitor_limit ?? null,
		extensions: [
			{
				id: 'org.zktimer.zktCompetition.v1',
				specUrl: 'https://zktimer.app',
				data: {
					status: comp.status,
					visibility: comp.visibility,
					location: comp.location,
					locationAddress: comp.location_address,
					endDate,
					announcedAt: comp.announced_at ?? null,
					resultsPublishedAt: comp.results_published_at ?? null,
				},
			},
		],
	};
}

function assignmentCodeFor(role: string): string {
	switch (role) {
		case 'COMPETITOR':
			return 'competitor';
		case 'JUDGE':
			return 'staff-judge';
		case 'SCRAMBLER':
			return 'staff-scrambler';
		case 'RUNNER':
			return 'staff-runner';
		case 'ORGANIZER':
			return 'staff-organizer';
		case 'STAFF':
		default:
			return 'staff-other';
	}
}
