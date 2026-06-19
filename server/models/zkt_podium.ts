import {getPrisma} from '../database';

/**
 * Podium per event: top 3 results of the final round (largest round_number).
 * Ties are kept — if two results share rank 3, both are returned.
 * Only returns a podium block for events whose final round is FINISHED.
 */
export async function getZktPodiums(competitionId: string) {
	const prisma = getPrisma();
	const compEvents = await prisma.zktCompEvent.findMany({
		where: {competition_id: competitionId},
		include: {
			rounds: {
				include: {
					results: {
						include: {
							user: {
								include: {
									profile: {include: {pfp_image: true}},
									integrations: true,
									badges: {include: {badge_type: true}},
								},
							},
							person: true,
						},
						where: {ranking: {not: null}},
						orderBy: {ranking: 'asc'},
					},
				},
				orderBy: {round_number: 'desc'},
			},
		},
		orderBy: {event_order: 'asc'},
	});

	const podiums = [];
	for (const ce of compEvents) {
		const finalRound = ce.rounds[0];
		if (!finalRound || finalRound.status !== 'FINISHED') continue;
		// Keep every result whose ranking <= 3. Ties handled naturally.
		const podiumResults = finalRound.results.filter(
			(r) => r.ranking !== null && r.ranking <= 3 && (r.best ?? 0) > 0
		);
		if (podiumResults.length === 0) continue;
		podiums.push({
			event_id: ce.event_id,
			round_id: finalRound.id,
			results: podiumResults,
		});
	}
	return podiums;
}

/**
 * Participation data for certificates: every competitor (registered user OR ghost
 * person) who has at least one valid result, grouped by competitor, each with
 * their per-event final-round result (value + ranking). Only FINISHED rounds.
 * Mirrors getZktPodiums' traversal but keeps ALL rankings (not just top 3).
 */
export async function getZktParticipation(competitionId: string) {
	const prisma = getPrisma();
	const compEvents = await prisma.zktCompEvent.findMany({
		where: {competition_id: competitionId},
		include: {
			rounds: {
				include: {
					results: {
						include: {
							user: {select: {first_name: true, last_name: true, username: true, join_country: true}},
							person: true,
						},
						where: {ranking: {not: null}},
						orderBy: {ranking: 'asc'},
					},
				},
				orderBy: {round_number: 'desc'},
			},
		},
		orderBy: {event_order: 'asc'},
	});

	interface PRow {
		event_id: string;
		value: number;
		ranking: number;
		has_average: boolean;
	}
	const byCompetitor = new Map<string, {name: string; country: string; results: PRow[]}>();

	for (const ce of compEvents) {
		const finalRound = ce.rounds[0];
		if (!finalRound || finalRound.status !== 'FINISHED') continue;
		const hasAverage = finalRound.format === 'MO3' || finalRound.format === 'AO5';
		for (const r of finalRound.results) {
			if (r.ranking === null || r.ranking === undefined) continue;
			const value = hasAverage ? r.average ?? r.best : r.best;
			if (value === null || value === undefined || value <= 0) continue; // skip DNF/DNS/blank
			const key = r.user_id ?? r.person_id;
			if (!key) continue;
			const u: any = r.user;
			const p: any = r.person;
			const name = u
				? [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || u.username || ''
				: [p?.first_name, p?.last_name].filter(Boolean).join(' ').trim();
			if (!name) continue;
			const country = u?.join_country || p?.country_code || '';
			let entry = byCompetitor.get(key);
			if (!entry) {
				entry = {name, country, results: []};
				byCompetitor.set(key, entry);
			}
			entry.results.push({event_id: ce.event_id, value, ranking: r.ranking, has_average: hasAverage});
		}
	}

	return Array.from(byCompetitor.values()).sort((a, b) => a.name.localeCompare(b.name, 'tr'));
}

/**
 * All-time ZKT rankings across all finalized rounds. Event + type (single|average).
 * Returns one row per user with their best-ever value for the event.
 */
export async function getZktAllTimeRankings(params: {
	eventId: string;
	recordType: 'single' | 'average';
	limit?: number;
	mode?: 'persons' | 'results';
}) {
	const prisma = getPrisma();
	const column = params.recordType === 'single' ? 'best' : 'average';

	const results = await prisma.zktResult.findMany({
		where: {
			round: {
				comp_event: {event_id: params.eventId},
				status: 'FINISHED',
			},
			// Valid positive values only — DNF (-1) and DNS (-2) excluded.
			[column]: {gt: 0},
			// Ghost competitors (no account) never enter global all-time rankings.
			user_id: {not: null},
		},
		include: {
			user: {
				include: {
					profile: {include: {pfp_image: true}},
					integrations: true,
					badges: {include: {badge_type: true}},
				},
			},
			round: {
				include: {
					comp_event: {include: {competition: true}},
				},
			},
		},
	} as any);

	// "persons" (default): best result per user. "results": every result ranked
	// (recordranks "Top Persons / Top Results" toggle).
	let pool: typeof results;
	if (params.mode === 'results') {
		pool = results;
	} else {
		const bestByUser = new Map<string, (typeof results)[number]>();
		for (const r of results) {
			const v = (r as any)[column] as number;
			const existing = bestByUser.get(r.user_id!);
			if (!existing || v < ((existing as any)[column] as number)) {
				bestByUser.set(r.user_id!, r);
			}
		}
		pool = Array.from(bestByUser.values());
	}

	const sorted = pool
		.slice()
		.sort((a, b) => ((a as any)[column] as number) - ((b as any)[column] as number));
	const sliced = params.limit ? sorted.slice(0, params.limit) : sorted;
	return sliced.map((r, i) => {
		const row = r as any;
		return {
			ranking: i + 1,
			value: row[column] as number,
			user: row.user,
			result_id: row.id,
			round_id: row.round_id,
			competition: row.round?.comp_event?.competition,
			event_id: params.eventId,
			record_type: params.recordType,
		};
	});
}
