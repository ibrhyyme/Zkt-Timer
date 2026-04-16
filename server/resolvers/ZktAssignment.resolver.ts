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
	 * Otomatik dagitim: onaylanan yarismacilari N grupa esit dagit.
	 * Mevcut COMPETITOR assignment'larini silip yeniden olusturur.
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

		// Var olan gruplari sil (yeniden olustur)
		await getPrisma().zktGroup.deleteMany({where: {round_id: input.roundId}});

		// Gruplari olustur
		const groups = await Promise.all(
			Array.from({length: input.groupCount}).map((_, i) =>
				getPrisma().zktGroup.create({
					data: {round_id: input.roundId, group_number: i + 1},
				})
			)
		);

		// Mevcut COMPETITOR assignment'larini sil
		await getPrisma().zktAssignment.deleteMany({
			where: {round_id: input.roundId, role: 'COMPETITOR'},
		});

		// User'lari gruplara distribute et (round-robin)
		const assignments = [];
		for (let i = 0; i < input.userIds.length; i++) {
			const groupIdx = i % input.groupCount;
			const userId = input.userIds[i];
			const a = await getPrisma().zktAssignment.create({
				data: {
					round_id: input.roundId,
					group_id: groups[groupIdx].id,
					user_id: userId,
					role: 'COMPETITOR',
				},
				include: {user: publicUserInclude},
			});
			assignments.push(a);
		}

		return assignments;
	}
}
