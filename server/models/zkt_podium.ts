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
 * All-time ZKT rankings across all finalized rounds. Event + type (single|average).
 * Returns one row per user with their best-ever value for the event.
 */
export async function getZktAllTimeRankings(params: {
	eventId: string;
	recordType: 'single' | 'average';
	limit?: number;
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

	// Keep best-per-user. Prisma can't distinctOn across JSON so we fold here.
	const bestByUser = new Map<string, (typeof results)[number]>();
	for (const r of results) {
		const v = (r as any)[column] as number;
		const existing = bestByUser.get(r.user_id);
		if (!existing || v < ((existing as any)[column] as number)) {
			bestByUser.set(r.user_id, r);
		}
	}

	const sorted = Array.from(bestByUser.values()).sort(
		(a, b) => ((a as any)[column] as number) - ((b as any)[column] as number)
	);
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
