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
			include: {user: publicUserInclude},
		});
	}

	@Authorized([Role.LOGGED_IN])
	@Query(() => [ZktAssignment])
	async zktGroupAssignments(@Arg('groupId') groupId: string) {
		return getPrisma().zktAssignment.findMany({
			where: {group_id: groupId},
			orderBy: [{role: 'asc'}, {station_number: 'asc'}, {seed_result: 'asc'}],
			include: {user: publicUserInclude},
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
				round: {include: {comp_event: true}},
				group: true,
			},
		});
	}

	@Authorized([Role.LOGGED_IN])
	@Query(() => [ZktAssignment])
	async zktUserAssignments(
		@Arg('competitionId') competitionId: string,
		@Arg('userId') userId: string
	) {
		return getPrisma().zktAssignment.findMany({
			where: {
				user_id: userId,
				round: {
					comp_event: {competition_id: competitionId},
				},
			},
			orderBy: [{created_at: 'asc'}],
			include: {
				user: publicUserInclude,
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

		// WCA-live parity: aynı kullanıcı aynı grup içinde birden fazla rolde olamaz
		// (yarışmacı aynı anda aynı grupta hakemlik edemez). Farklı gruplarda
		// farklı roller serbest (COMPETITOR grup A, JUDGE grup B OK).
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

		// Upsert: ayni (round, user, role) icin tek kayit
		const existing = await getPrisma().zktAssignment.findUnique({
			where: {
				round_id_user_id_role: {
					round_id: input.roundId,
					user_id: input.userId,
					role: input.role,
				},
			},
		});

		let result;
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

	/**
	 * Otomatik dagitim: onaylanan yarismacilari N grupa dagit.
	 * Round >= 2 ise önceki tur ranking'ine göre serpentine seeding
	 * (en iyiler gruplara dengeli dağıtılır: #1→G1, #2→G2, ..., #N→GN,
	 * sonraki katman ters: #N+1→GN, ..., #2N→G1). Round 1'de userIds sırası
	 * kullanılır (stable fallback).
	 * Station number her grup içinde 1'den başlayarak seed sırasına verilir.
	 * Mevcut gruplar + COMPETITOR assignment'ları silinip yeniden oluşturulur.
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

		// Determine seed order. If this is a >1 round, pull ranked results
		// from the previous round of the same comp_event. Fallback: input order.
		const seededUserIds = await seedUsersForRound(
			round.id,
			round.comp_event_id,
			round.round_number,
			input.userIds
		);

		// Also compute a seed_result map (best time) for persisted tie-break info.
		const seedResultByUser = await getPreviousRoundBestByUser(
			round.comp_event_id,
			round.round_number
		);

		await getPrisma().zktGroup.deleteMany({where: {round_id: input.roundId}});

		const groups = await Promise.all(
			Array.from({length: input.groupCount}).map((_, i) =>
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
		for (let i = 0; i < seededUserIds.length; i++) {
			const layer = Math.floor(i / input.groupCount);
			const posInLayer = i % input.groupCount;
			const groupIdx =
				layer % 2 === 0 ? posInLayer : input.groupCount - 1 - posInLayer;
			const groupId = groups[groupIdx].id;
			const userId = seededUserIds[i];
			const nextStation = (stationByGroup.get(groupId) ?? 0) + 1;
			stationByGroup.set(groupId, nextStation);

			const a = await getPrisma().zktAssignment.create({
				data: {
					round_id: input.roundId,
					group_id: groupId,
					user_id: userId,
					role: 'COMPETITOR',
					station_number: nextStation,
					seed_result: seedResultByUser.get(userId) ?? null,
				},
				include: {user: publicUserInclude},
			});
			assignments.push(a);
		}

		return assignments;
	}
}

/**
 * Return userIds ordered by previous-round ranking (best first). Users without
 * a previous result stay in input order after ranked ones. Round 1 just returns
 * input unchanged.
 */
async function seedUsersForRound(
	_roundId: string,
	compEventId: string,
	roundNumber: number,
	inputUserIds: string[]
): Promise<string[]> {
	if (roundNumber <= 1) return inputUserIds;

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
	if (!prevRound) return inputUserIds;

	const inputSet = new Set(inputUserIds);
	const ranked = prevRound.results
		.map((r) => r.user_id)
		.filter((uid) => inputSet.has(uid));
	const rankedSet = new Set(ranked);
	const unranked = inputUserIds.filter((uid) => !rankedSet.has(uid));

	return [...ranked, ...unranked];
}

async function getPreviousRoundBestByUser(
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
		if (r.best !== null && r.best !== undefined) {
			map.set(r.user_id, r.best);
		}
	}
	return map;
}
