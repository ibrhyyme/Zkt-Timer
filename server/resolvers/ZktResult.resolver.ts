import {Arg, Authorized, Ctx, Mutation, Query, Resolver} from 'type-graphql';
import {GraphQLContext} from '../@types/interfaces/server.interface';
import {Role} from '../middlewares/auth';
import GraphQLError from '../util/graphql_error';
import {ErrorCode} from '../constants/errors';
import {
	ZktResult,
	ZktRound,
	SubmitZktResultInput,
	SubmitZktResultsBatchInput,
	CreateZktRoundInput,
	UpdateZktRoundInput,
	UpdateZktRoundStatusInput,
	MarkZktNoShowInput,
} from '../schemas/ZktCompetition.schema';
import {getPrisma} from '../database';
import {
	assertCanModifyCompetition,
	getRoundWithCompetition,
	publicUserInclude,
} from '../models/zkt_competition';
import {upsertZktResult, finalizeRound, markResultNoShow} from '../models/zkt_result';
import {assertRoundTransition, revokeAdvancementCarry} from '../models/zkt_round';
import {checkAndApplyRecords} from '../models/zkt_record';
import {emitZktResultUpdated, emitZktResultDeleted, emitZktRoundStatusChanged} from '../zkt_competition';

@Resolver()
export class ZktResultResolver {
	@Authorized([Role.LOGGED_IN])
	@Query(() => [ZktResult])
	async zktRoundResults(@Arg('roundId') roundId: string) {
		return getPrisma().zktResult.findMany({
			where: {round_id: roundId},
			orderBy: [{ranking: {sort: 'asc', nulls: 'last'}}, {created_at: 'asc'}],
			include: {user: publicUserInclude},
		});
	}

	@Authorized([Role.LOGGED_IN])
	@Query(() => [ZktResult])
	async zktCompetitorResults(
		@Arg('competitionId') competitionId: string,
		@Arg('userId') userId: string
	) {
		return getPrisma().zktResult.findMany({
			where: {
				user_id: userId,
				round: {
					comp_event: {
						competition_id: competitionId,
					},
				},
			},
			orderBy: {created_at: 'asc'},
			include: {
				user: publicUserInclude,
				round: {include: {comp_event: true}},
			},
		});
	}

	@Authorized([Role.LOGGED_IN])
	@Mutation(() => ZktResult)
	async submitZktResult(
		@Ctx() context: GraphQLContext,
		@Arg('input') input: SubmitZktResultInput
	) {
		const round = await getRoundWithCompetition(input.roundId);
		if (!round) throw new GraphQLError(ErrorCode.NOT_FOUND);

		const competitionId = round.comp_event.competition_id;
		await assertCanModifyCompetition(context.user, competitionId);

		const result = await upsertZktResult({
			round_id: input.roundId,
			user_id: input.userId,
			attempt_1: input.attempt1 ?? null,
			attempt_2: input.attempt2 ?? null,
			attempt_3: input.attempt3 ?? null,
			attempt_4: input.attempt4 ?? null,
			attempt_5: input.attempt5 ?? null,
			entered_by_id: context.user.id,
		});

		emitZktResultUpdated(competitionId, {
			roundId: input.roundId,
			resultId: result.id,
			userId: input.userId,
		});

		return getPrisma().zktResult.findUnique({
			where: {id: result.id},
			include: {user: publicUserInclude},
		});
	}

	@Authorized([Role.LOGGED_IN])
	@Mutation(() => [ZktResult])
	async submitZktResultsBatch(
		@Ctx() context: GraphQLContext,
		@Arg('input') input: SubmitZktResultsBatchInput
	) {
		const round = await getRoundWithCompetition(input.roundId);
		if (!round) throw new GraphQLError(ErrorCode.NOT_FOUND);
		const competitionId = round.comp_event.competition_id;
		await assertCanModifyCompetition(context.user, competitionId);

		// Sequential upsert so time_limit/cutoff logic runs per-row. We don't
		// wrap in a prisma transaction because upsertZktResult already reads
		// round config and would self-conflict inside an implicit tx.
		const saved = [];
		for (const item of input.results) {
			const r = await upsertZktResult({
				round_id: input.roundId,
				user_id: item.userId,
				attempt_1: item.attempt1 ?? null,
				attempt_2: item.attempt2 ?? null,
				attempt_3: item.attempt3 ?? null,
				attempt_4: item.attempt4 ?? null,
				attempt_5: item.attempt5 ?? null,
				entered_by_id: context.user.id,
			});
			saved.push(r);
		}

		for (const r of saved) {
			emitZktResultUpdated(competitionId, {
				roundId: input.roundId,
				resultId: r.id,
				userId: r.user_id,
			});
		}

		const ids = saved.map((r) => r.id);
		return getPrisma().zktResult.findMany({
			where: {id: {in: ids}},
			include: {user: publicUserInclude},
		});
	}

	@Authorized([Role.LOGGED_IN])
	@Mutation(() => Boolean)
	async deleteZktResult(
		@Ctx() context: GraphQLContext,
		@Arg('resultId') resultId: string
	) {
		const result = await getPrisma().zktResult.findUnique({
			where: {id: resultId},
			include: {round: {include: {comp_event: true}}},
		});
		if (!result) throw new GraphQLError(ErrorCode.NOT_FOUND);

		const competitionId = result.round.comp_event.competition_id;
		await assertCanModifyCompetition(context.user, competitionId);

		await getPrisma().zktResult.delete({where: {id: resultId}});

		emitZktResultDeleted(competitionId, {
			roundId: result.round_id,
			resultId: result.id,
			userId: result.user_id,
		});

		return true;
	}

	@Authorized([Role.LOGGED_IN])
	@Mutation(() => ZktRound)
	async finalizeZktRound(
		@Ctx() context: GraphQLContext,
		@Arg('roundId') roundId: string
	) {
		const round = await getRoundWithCompetition(roundId);
		if (!round) throw new GraphQLError(ErrorCode.NOT_FOUND);

		const competitionId = round.comp_event.competition_id;
		await assertCanModifyCompetition(context.user, competitionId);

		await finalizeRound(roundId, context.user.id);

		const results = await getPrisma().zktResult.findMany({where: {round_id: roundId}});
		for (const r of results) {
			const tags = await checkAndApplyRecords({
				resultId: r.id,
				userId: r.user_id,
				eventId: round.comp_event.event_id,
				competitionId,
				best: r.best,
				average: r.average,
			});
			if (tags.singleTag || tags.averageTag) {
				await getPrisma().zktResult.update({
					where: {id: r.id},
					data: {
						single_record_tag: tags.singleTag,
						average_record_tag: tags.averageTag,
					},
				});
			}
		}

		emitZktRoundStatusChanged(competitionId, {roundId, status: 'FINISHED'});

		return getPrisma().zktRound.findUnique({
			where: {id: roundId},
			include: {results: {include: {user: publicUserInclude}}, groups: true},
		});
	}

	@Authorized([Role.LOGGED_IN])
	@Mutation(() => ZktRound)
	async updateZktRoundStatus(
		@Ctx() context: GraphQLContext,
		@Arg('input') input: UpdateZktRoundStatusInput
	) {
		const round = await getRoundWithCompetition(input.roundId);
		if (!round) throw new GraphQLError(ErrorCode.NOT_FOUND);

		const competitionId = round.comp_event.competition_id;
		await assertCanModifyCompetition(context.user, competitionId);

		assertRoundTransition(round.status, input.status);

		const updated = await getPrisma().zktRound.update({
			where: {id: input.roundId},
			data: {status: input.status},
			include: {results: true, groups: true},
		});

		emitZktRoundStatusChanged(competitionId, {roundId: input.roundId, status: input.status});

		return updated;
	}

	@Authorized([Role.LOGGED_IN])
	@Mutation(() => ZktRound)
	async reopenZktRound(
		@Ctx() context: GraphQLContext,
		@Arg('roundId') roundId: string
	) {
		const round = await getRoundWithCompetition(roundId);
		if (!round) throw new GraphQLError(ErrorCode.NOT_FOUND);
		if (round.status !== 'FINISHED') {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'Round is not finished');
		}

		const competitionId = round.comp_event.competition_id;
		await assertCanModifyCompetition(context.user, competitionId);

		// Remove untouched carry rows from the next round so rankings can be
		// recomputed without phantom competitors once the admin re-finalizes.
		await revokeAdvancementCarry(roundId);

		const updated = await getPrisma().zktRound.update({
			where: {id: roundId},
			data: {status: 'ACTIVE'},
			include: {results: true, groups: true},
		});

		emitZktRoundStatusChanged(competitionId, {roundId, status: 'ACTIVE'});
		return updated;
	}

	@Authorized([Role.LOGGED_IN])
	@Mutation(() => ZktResult)
	async markZktNoShow(
		@Ctx() context: GraphQLContext,
		@Arg('input') input: MarkZktNoShowInput
	) {
		const round = await getRoundWithCompetition(input.roundId);
		if (!round) throw new GraphQLError(ErrorCode.NOT_FOUND);

		const competitionId = round.comp_event.competition_id;
		await assertCanModifyCompetition(context.user, competitionId);

		const result = await markResultNoShow({
			round_id: input.roundId,
			user_id: input.userId,
			entered_by_id: context.user.id,
		});

		emitZktResultUpdated(competitionId, {
			roundId: input.roundId,
			resultId: result.id,
			userId: input.userId,
		});

		return getPrisma().zktResult.findUnique({
			where: {id: result.id},
			include: {user: publicUserInclude},
		});
	}

	@Authorized([Role.MOD])
	@Mutation(() => ZktRound)
	async createZktRound(@Arg('input') input: CreateZktRoundInput) {
		return getPrisma().zktRound.create({
			data: {
				comp_event_id: input.compEventId,
				round_number: input.roundNumber,
				format: input.format,
				time_limit_cs: input.timeLimitCs ?? null,
				cutoff_cs: input.cutoffCs ?? null,
				cutoff_attempts: input.cutoffAttempts ?? null,
				advancement_type: input.advancementType ?? null,
				advancement_level: input.advancementLevel ?? null,
			},
		});
	}

	@Authorized([Role.MOD])
	@Mutation(() => ZktRound)
	async updateZktRound(@Arg('input') input: UpdateZktRoundInput) {
		const data: any = {};
		if (input.format !== undefined) data.format = input.format;
		if (input.timeLimitCs !== undefined) data.time_limit_cs = input.timeLimitCs;
		if (input.cutoffCs !== undefined) data.cutoff_cs = input.cutoffCs;
		if (input.cutoffAttempts !== undefined) data.cutoff_attempts = input.cutoffAttempts;
		if (input.advancementType !== undefined) data.advancement_type = input.advancementType;
		if (input.advancementLevel !== undefined) data.advancement_level = input.advancementLevel;
		return getPrisma().zktRound.update({
			where: {id: input.roundId},
			data,
		});
	}

	@Authorized([Role.MOD])
	@Mutation(() => Boolean)
	async deleteZktRound(@Arg('roundId') roundId: string) {
		await getPrisma().zktRound.delete({where: {id: roundId}});
		return true;
	}
}
