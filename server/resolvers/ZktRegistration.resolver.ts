import {Arg, Authorized, Ctx, Mutation, Resolver} from 'type-graphql';
import {GraphQLContext} from '../@types/interfaces/server.interface';
import {Role} from '../middlewares/auth';
import GraphQLError from '../util/graphql_error';
import {ErrorCode} from '../constants/errors';
import {
	ZktRegistration,
	ZktCompDelegate,
	ZktRegistrationInput,
	UpdateZktRegistrationStatusInput,
	AddZktDelegateInput,
	AddZktCompetitorManuallyInput,
} from '../schemas/ZktCompetition.schema';
import {getPrisma} from '../database';
import {
	assertCanModifyCompetition,
	getZktCompetitionById,
	publicUserInclude,
} from '../models/zkt_competition';
import {emitZktRegistrationUpdated} from '../zkt_competition';

@Resolver()
export class ZktRegistrationResolver {
	@Authorized([Role.LOGGED_IN])
	@Mutation(() => ZktRegistration)
	async registerForZktCompetition(
		@Ctx() context: GraphQLContext,
		@Arg('input') input: ZktRegistrationInput
	) {
		const comp = await getZktCompetitionById(input.competitionId);
		if (!comp) throw new GraphQLError(ErrorCode.NOT_FOUND);
		if (comp.status !== 'REGISTRATION_OPEN') {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'Registration is not open');
		}
		if (comp.visibility === 'PRIVATE') {
			throw new GraphQLError(ErrorCode.FORBIDDEN, 'This competition is private');
		}

		if (comp.competitor_limit) {
			const approvedCount = await getPrisma().zktRegistration.count({
				where: {competition_id: input.competitionId, status: 'APPROVED'},
			});
			if (approvedCount >= comp.competitor_limit) {
				throw new GraphQLError(ErrorCode.BAD_INPUT, 'Competitor limit reached');
			}
		}

		const compEvents = await getPrisma().zktCompEvent.findMany({
			where: {competition_id: input.competitionId},
		});
		const validEventIds = new Set(compEvents.map((e) => e.id));
		for (const compEventId of input.eventIds) {
			if (!validEventIds.has(compEventId)) {
				throw new GraphQLError(ErrorCode.BAD_INPUT, `Invalid event: ${compEventId}`);
			}
		}

		const existing = await getPrisma().zktRegistration.findUnique({
			where: {
				competition_id_user_id: {
					competition_id: input.competitionId,
					user_id: context.user.id,
				},
			},
		});

		if (existing && existing.status !== 'WITHDRAWN') {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'Already registered');
		}

		const registration = existing
			? await getPrisma().zktRegistration.update({
					where: {id: existing.id},
					data: {status: 'PENDING', notes: input.notes ?? null},
			  })
			: await getPrisma().zktRegistration.create({
					data: {
						competition_id: input.competitionId,
						user_id: context.user.id,
						status: 'PENDING',
						notes: input.notes ?? null,
					},
			  });

		await getPrisma().zktRegistrationEvent.deleteMany({
			where: {registration_id: registration.id},
		});
		await Promise.all(
			input.eventIds.map((eid) =>
				getPrisma().zktRegistrationEvent.create({
					data: {registration_id: registration.id, comp_event_id: eid},
				})
			)
		);

		emitZktRegistrationUpdated(input.competitionId, {
			registrationId: registration.id,
			status: registration.status,
		});

		return getPrisma().zktRegistration.findUnique({
			where: {id: registration.id},
			include: {user: publicUserInclude, events: true},
		});
	}

	@Authorized([Role.LOGGED_IN])
	@Mutation(() => ZktRegistration)
	async withdrawZktRegistration(
		@Ctx() context: GraphQLContext,
		@Arg('competitionId') competitionId: string
	) {
		const existing = await getPrisma().zktRegistration.findUnique({
			where: {
				competition_id_user_id: {
					competition_id: competitionId,
					user_id: context.user.id,
				},
			},
		});
		if (!existing) throw new GraphQLError(ErrorCode.NOT_FOUND);

		const updated = await getPrisma().zktRegistration.update({
			where: {id: existing.id},
			data: {status: 'WITHDRAWN'},
			include: {user: publicUserInclude, events: true},
		});

		emitZktRegistrationUpdated(competitionId, {
			registrationId: updated.id,
			status: updated.status,
		});

		return updated;
	}

	@Authorized([Role.LOGGED_IN])
	@Mutation(() => ZktRegistration)
	async updateZktRegistrationStatus(
		@Ctx() context: GraphQLContext,
		@Arg('input') input: UpdateZktRegistrationStatusInput
	) {
		const reg = await getPrisma().zktRegistration.findUnique({
			where: {id: input.registrationId},
		});
		if (!reg) throw new GraphQLError(ErrorCode.NOT_FOUND);

		await assertCanModifyCompetition(context.user, reg.competition_id);

		const updated = await getPrisma().zktRegistration.update({
			where: {id: input.registrationId},
			data: {status: input.status},
			include: {user: publicUserInclude, events: true},
		});

		emitZktRegistrationUpdated(reg.competition_id, {
			registrationId: updated.id,
			status: updated.status,
		});

		return updated;
	}

	@Authorized([Role.LOGGED_IN])
	@Mutation(() => ZktRegistration)
	async addZktCompetitorManually(
		@Ctx() context: GraphQLContext,
		@Arg('input') input: AddZktCompetitorManuallyInput
	) {
		await assertCanModifyCompetition(context.user, input.competitionId);

		const compEvents = await getPrisma().zktCompEvent.findMany({
			where: {competition_id: input.competitionId},
		});
		const validEventIds = new Set(compEvents.map((e) => e.id));
		for (const compEventId of input.eventIds) {
			if (!validEventIds.has(compEventId)) {
				throw new GraphQLError(ErrorCode.BAD_INPUT, `Invalid event: ${compEventId}`);
			}
		}

		const existing = await getPrisma().zktRegistration.findUnique({
			where: {
				competition_id_user_id: {
					competition_id: input.competitionId,
					user_id: input.userId,
				},
			},
		});

		const registration = existing
			? await getPrisma().zktRegistration.update({
					where: {id: existing.id},
					data: {status: 'APPROVED'},
			  })
			: await getPrisma().zktRegistration.create({
					data: {
						competition_id: input.competitionId,
						user_id: input.userId,
						status: 'APPROVED',
					},
			  });

		await getPrisma().zktRegistrationEvent.deleteMany({
			where: {registration_id: registration.id},
		});
		await Promise.all(
			input.eventIds.map((eid) =>
				getPrisma().zktRegistrationEvent.create({
					data: {registration_id: registration.id, comp_event_id: eid},
				})
			)
		);

		emitZktRegistrationUpdated(input.competitionId, {
			registrationId: registration.id,
			status: registration.status,
		});

		return getPrisma().zktRegistration.findUnique({
			where: {id: registration.id},
			include: {user: publicUserInclude, events: true},
		});
	}

	@Authorized([Role.MOD])
	@Mutation(() => ZktCompDelegate)
	async addZktDelegate(@Arg('input') input: AddZktDelegateInput) {
		const existing = await getPrisma().zktCompDelegate.findUnique({
			where: {
				competition_id_user_id: {
					competition_id: input.competitionId,
					user_id: input.userId,
				},
			},
		});
		if (existing) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'Already a delegate');
		}
		return getPrisma().zktCompDelegate.create({
			data: {
				competition_id: input.competitionId,
				user_id: input.userId,
			},
			include: {user: publicUserInclude},
		});
	}

	@Authorized([Role.MOD])
	@Mutation(() => Boolean)
	async removeZktDelegate(
		@Arg('competitionId') competitionId: string,
		@Arg('userId') userId: string
	) {
		await getPrisma().zktCompDelegate.delete({
			where: {
				competition_id_user_id: {
					competition_id: competitionId,
					user_id: userId,
				},
			},
		});
		return true;
	}
}
