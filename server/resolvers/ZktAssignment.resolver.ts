import {Arg, Authorized, Ctx, Mutation, Query, Resolver} from 'type-graphql';
import {GraphQLContext} from '../@types/interfaces/server.interface';
import {Role} from '../middlewares/auth';
import GraphQLError from '../util/graphql_error';
import {ErrorCode} from '../constants/errors';
import {
	ZktAssignment,
	ZktGroup,
	AssignUserInput,
	CreateGroupInput,
	BulkAssignCompetitorsInput,
	UpdateZktGroupScheduleInput,
} from '../schemas/ZktCompetition.schema';
import {getPrisma} from '../database';
import {assertCanModifyCompetition, publicUserInclude, getRoundWithCompetition} from '../models/zkt_competition';
import {emitZktAssignmentUpdated} from '../zkt_competition';

@Resolver()
export class ZktAssignmentResolver {
	@Authorized([Role.LOGGED_IN])
	@Query(() => [ZktAssignment])
	async zktRoundAssignments(@Arg('roundId') roundId: string) {
		return getPrisma().zktAssignment.findMany({
			where: {round_id: roundId},
			orderBy: [{role: 'asc'}, {station_number: 'asc'}, {created_at: 'asc'}],
			include: {user: publicUserInclude, person: true},
		});
	}

	@Authorized([Role.LOGGED_IN])
	@Query(() => [ZktAssignment])
	async zktGroupAssignments(@Arg('groupId') groupId: string) {
		return getPrisma().zktAssignment.findMany({
			where: {group_id: groupId},
			orderBy: [{role: 'asc'}, {station_number: 'asc'}, {seed_result: 'asc'}],
			include: {
				user: publicUserInclude,
				person: true,
				group: true,
				round: {include: {comp_event: {include: {competition: true}}}},
			},
		});
	}

	@Authorized([Role.LOGGED_IN])
	@Query(() => [ZktAssignment])
	async zktMyAssignments(
		@Ctx() context: GraphQLContext,
		@Arg('competitionId') competitionId: string
	) {
		return getPrisma().zktAssignment.findMany({
			where: {
				user_id: context.user.id,
				round: {
					comp_event: {competition_id: competitionId},
				},
			},
			orderBy: [{role: 'asc'}, {created_at: 'asc'}],
			include: {
				user: publicUserInclude,
				person: true,
				round: {include: {comp_event: true}},
				group: true,
			},
		});
	}

	@Authorized([Role.LOGGED_IN])
	@Query(() => [ZktAssignment])
	async zktUserAssignments(
		@Arg('competitionId') competitionId: string,
		@Arg('userId', {nullable: true}) userId?: string,
		@Arg('personId', {nullable: true}) personId?: string
	) {
		// competitorId may be a user id or a ghost-person id (both unique).
		const competitorId = personId || userId;
		if (!competitorId) return [];
		return getPrisma().zktAssignment.findMany({
			where: {
				OR: [{user_id: competitorId}, {person_id: competitorId}],
				round: {
					comp_event: {competition_id: competitionId},
				},
			},
			orderBy: [{created_at: 'asc'}],
			include: {
				user: publicUserInclude,
				person: true,
				round: {include: {comp_event: true}},
				group: true,
			},
		});
	}

	@Authorized([Role.LOGGED_IN])
	@Mutation(() => ZktAssignment)
	async assignUserToRound(
		@Ctx() context: GraphQLContext,
		@Arg('input') input: AssignUserInput
	) {
		const round = await getRoundWithCompetition(input.roundId);
		if (!round) throw new GraphQLError(ErrorCode.NOT_FOUND);

		await assertCanModifyCompetition(context.user, round.comp_event.competition_id);

		// WCA-live parity: same user cannot have multiple roles within the same group
		// (competitor cannot be judge in same group). Different roles in different groups are OK
		// (COMPETITOR in group A, JUDGE in group B OK).
		if (input.groupId) {
			const conflicting = await getPrisma().zktAssignment.findFirst({
				where: {
					round_id: input.roundId,
					user_id: input.userId,
					group_id: input.groupId,
					role: {not: input.role},
				},
			});
			if (conflicting) {
				throw new GraphQLError(
					ErrorCode.BAD_INPUT,
					`User already assigned as ${conflicting.role} in this group`
				);
			}
		}

		// Upsert: single record per (round, user, role)
		const existing = await getPrisma().zktAssignment.findUnique({
			where: {
				round_id_user_id_role: {
					round_id: input.roundId,
					user_id: input.userId,
					role: input.role,
				},
			},
		});

		let result: any;
		if (existing) {
			result = await getPrisma().zktAssignment.update({
				where: {id: existing.id},
				data: {
					group_id: input.groupId ?? null,
					station_number: input.stationNumber ?? null,
				},
				include: {user: publicUserInclude},
			});
		} else {
			result = await getPrisma().zktAssignment.create({
				data: {
					round_id: input.roundId,
					group_id: input.groupId ?? null,
					user_id: input.userId,
					role: input.role,
					station_number: input.stationNumber ?? null,
				},
				include: {user: publicUserInclude},
			});
		}

		emitZktAssignmentUpdated(round.comp_event.competition_id, {
			roundId: input.roundId,
			groupId: input.groupId,
			userId: input.userId,
		});

		return result;
	}

	@Authorized([Role.LOGGED_IN])
	@Mutation(() => Boolean)
	async unassignUser(
		@Ctx() context: GraphQLContext,
		@Arg('assignmentId') assignmentId: string
	) {
		const assignment = await getPrisma().zktAssignment.findUnique({
			where: {id: assignmentId},
			include: {round: {include: {comp_event: true}}},
		});
		if (!assignment) throw new GraphQLError(ErrorCode.NOT_FOUND);

		await assertCanModifyCompetition(context.user, assignment.round.comp_event.competition_id);

		await getPrisma().zktAssignment.delete({where: {id: assignmentId}});

		emitZktAssignmentUpdated(assignment.round.comp_event.competition_id, {
			roundId: assignment.round_id,
			groupId: assignment.group_id ?? undefined,
			userId: assignment.user_id,
		});

		return true;
	}

	@Authorized([Role.LOGGED_IN])
	@Mutation(() => ZktGroup)
	async createZktGroup(
		@Ctx() context: GraphQLContext,
		@Arg('input') input: CreateGroupInput
	) {
		const round = await getRoundWithCompetition(input.roundId);
		if (!round) throw new GraphQLError(ErrorCode.NOT_FOUND);

		await assertCanModifyCompetition(context.user, round.comp_event.competition_id);

		return getPrisma().zktGroup.create({
			data: {
				round_id: input.roundId,
				group_number: input.groupNumber,
			},
		});
	}

	@Authorized([Role.LOGGED_IN])
	@Mutation(() => Boolean)
	async deleteZktGroup(
		@Ctx() context: GraphQLContext,
		@Arg('groupId') groupId: string
	) {
		const group = await getPrisma().zktGroup.findUnique({
			where: {id: groupId},
			include: {round: {include: {comp_event: true}}},
		});
		if (!group) throw new GraphQLError(ErrorCode.NOT_FOUND);

		await assertCanModifyCompetition(context.user, group.round.comp_event.competition_id);

		await getPrisma().zktGroup.delete({where: {id: groupId}});
		return true;
	}

	@Authorized([Role.LOGGED_IN])
	@Mutation(() => ZktGroup)
	async updateZktGroupSchedule(
		@Ctx() context: GraphQLContext,
		@Arg('input') input: UpdateZktGroupScheduleInput
	) {
		const group = await getPrisma().zktGroup.findUnique({
			where: {id: input.groupId},
			include: {round: {include: {comp_event: true}}},
		});
		if (!group) throw new GraphQLError(ErrorCode.NOT_FOUND);

		await assertCanModifyCompetition(context.user, group.round.comp_event.competition_id);

		return getPrisma().zktGroup.update({
			where: {id: input.groupId},
			data: {
				start_time: input.startTime ?? null,
				end_time: input.endTime ?? null,
			},
		});
	}

	/**
	 * Automatic distribution: split competitors into groups sized by stationCount
	 * (group count = ceil(competitors / stationCount)). Round >= 2 seeds by the
	 * previous round's ranking (serpentine: best performers spread across groups,
	 * direction reversed each layer); round 1 keeps the input competitor order.
	 * Station numbers start at 1 within each group, in seed order. Works for both
	 * registered users and account-less ghost persons. Existing groups +
	 * COMPETITOR assignments are deleted and recreated.
	 */
	@Authorized([Role.LOGGED_IN])
	@Mutation(() => [ZktAssignment])
	async bulkAssignCompetitors(
		@Ctx() context: GraphQLContext,
		@Arg('input') input: BulkAssignCompetitorsInput
	) {
		const round = await getRoundWithCompetition(input.roundId);
		if (!round) throw new GraphQLError(ErrorCode.NOT_FOUND);

		await assertCanModifyCompetition(context.user, round.comp_event.competition_id);

		// Normalise competitor refs to one key (userId XOR personId).
		const refs = input.competitors
			.map((c) => ({key: c.userId ?? c.personId ?? '', isPerson: !c.userId}))
			.filter((c) => c.key);

		// Derive group count from station capacity: ceil(competitors / stations).
		const stationCount = Math.max(1, input.stationCount);
		const groupCount = Math.max(1, Math.ceil(refs.length / stationCount));

		// Seed order: round >1 uses previous-round ranking (competitor-key based),
		// round 1 keeps input order.
		const seededRefs = await seedCompetitorsForRound(
			round.comp_event_id,
			round.round_number,
			refs
		);

		// Best-time map for persisted seed_result (tie-break info).
		const seedResultByCompetitor = await getPreviousRoundBestByCompetitor(
			round.comp_event_id,
			round.round_number
		);

		await getPrisma().zktGroup.deleteMany({where: {round_id: input.roundId}});

		const groups = await Promise.all(
			Array.from({length: groupCount}).map((_, i) =>
				getPrisma().zktGroup.create({
					data: {round_id: input.roundId, group_number: i + 1},
				})
			)
		);

		await getPrisma().zktAssignment.deleteMany({
			where: {round_id: input.roundId, role: 'COMPETITOR'},
		});

		// Serpentine distribution — avoids stacking top seeds in the same group.
		const assignments = [];
		const stationByGroup = new Map<string, number>();
		for (let i = 0; i < seededRefs.length; i++) {
			const layer = Math.floor(i / groupCount);
			const posInLayer = i % groupCount;
			const groupIdx = layer % 2 === 0 ? posInLayer : groupCount - 1 - posInLayer;
			const groupId = groups[groupIdx].id;
			const ref = seededRefs[i];
			const nextStation = (stationByGroup.get(groupId) ?? 0) + 1;
			stationByGroup.set(groupId, nextStation);

			const a = await getPrisma().zktAssignment.create({
				data: {
					round_id: input.roundId,
					group_id: groupId,
					user_id: ref.isPerson ? null : ref.key,
					person_id: ref.isPerson ? ref.key : null,
					role: 'COMPETITOR',
					station_number: nextStation,
					seed_result: seedResultByCompetitor.get(ref.key) ?? null,
				},
				include: {user: publicUserInclude, person: true},
			});
			assignments.push(a);
		}

		// One emit per competitor — consumers debounce.
		for (const a of assignments) {
			emitZktAssignmentUpdated(round.comp_event.competition_id, {
				roundId: input.roundId,
				groupId: a.group_id ?? undefined,
				userId: a.user_id ?? a.person_id ?? undefined,
			});
		}

		return assignments;
	}
}

/**
 * Return competitor refs ordered by previous-round ranking (best first).
 * Refs without a previous result keep input order after ranked ones. Round 1
 * returns input unchanged. Competitor identity = user_id ?? person_id.
 */
async function seedCompetitorsForRound(
	compEventId: string,
	roundNumber: number,
	inputRefs: Array<{key: string; isPerson: boolean}>
): Promise<Array<{key: string; isPerson: boolean}>> {
	if (roundNumber <= 1) return inputRefs;

	const prevRound = await getPrisma().zktRound.findUnique({
		where: {
			comp_event_id_round_number: {
				comp_event_id: compEventId,
				round_number: roundNumber - 1,
			},
		},
		include: {
			results: {
				orderBy: [
					{ranking: {sort: 'asc', nulls: 'last'}},
					{best: {sort: 'asc', nulls: 'last'}},
				],
			},
		},
	});
	if (!prevRound) return inputRefs;

	const byKey = new Map(inputRefs.map((r) => [r.key, r]));
	const ranked: Array<{key: string; isPerson: boolean}> = [];
	const seen = new Set<string>();
	for (const res of prevRound.results) {
		const k = res.user_id ?? res.person_id;
		if (!k) continue;
		const ref = byKey.get(k);
		if (ref && !seen.has(k)) {
			ranked.push(ref);
			seen.add(k);
		}
	}
	const unranked = inputRefs.filter((r) => !seen.has(r.key));
	return [...ranked, ...unranked];
}

/**
 * Map competitor key (user_id ?? person_id) → previous-round best time.
 */
async function getPreviousRoundBestByCompetitor(
	compEventId: string,
	roundNumber: number
): Promise<Map<string, number>> {
	const map = new Map<string, number>();
	if (roundNumber <= 1) return map;

	const prev = await getPrisma().zktRound.findUnique({
		where: {
			comp_event_id_round_number: {
				comp_event_id: compEventId,
				round_number: roundNumber - 1,
			},
		},
		include: {results: true},
	});
	if (!prev) return map;

	for (const r of prev.results) {
		const k = r.user_id ?? r.person_id;
		if (k && r.best !== null && r.best !== undefined) {
			map.set(k, r.best);
		}
	}
	return map;
}
