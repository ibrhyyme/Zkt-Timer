import {Arg, Args, Authorized, Ctx, Mutation, Query, Resolver} from 'type-graphql';
import {GraphQLContext} from '../@types/interfaces/server.interface';
import {Role} from '../middlewares/auth';
import GraphQLError from '../util/graphql_error';
import {ErrorCode} from '../constants/errors';
import {
	ZktCompetition,
	PaginatedZktCompetitions,
	CreateZktCompetitionInput,
	UpdateZktCompetitionInput,
	UpdateZktCompetitionStatusInput,
	ZktCompetitionFilterInput,
} from '../schemas/ZktCompetition.schema';
import {PaginationArgs} from '../schemas/Pagination.schema';
import {getPrisma} from '../database';
import {
	createZktCompetitionWithEvents,
	getMyZktCompetitions,
	getZktCompetitionById,
	getZktCompetitionWithDetails,
	listZktCompetitions,
	updateZktCompetitionStatus,
} from '../models/zkt_competition';
import {emitZktCompStatusChanged} from '../zkt_competition';

@Resolver()
export class ZktCompetitionResolver {
	@Authorized([Role.LOGGED_IN])
	@Query(() => PaginatedZktCompetitions)
	async zktCompetitions(
		@Args() pageArgs: PaginationArgs,
		@Arg('filter', () => ZktCompetitionFilterInput, {nullable: true}) filter?: ZktCompetitionFilterInput
	) {
		return listZktCompetitions({
			page: pageArgs.page,
			pageSize: pageArgs.pageSize,
			searchQuery: pageArgs.searchQuery,
			status: filter?.status ?? null,
			onlyPublic: true,
		});
	}

	@Authorized([Role.LOGGED_IN])
	@Query(() => ZktCompetition, {nullable: true})
	async zktCompetition(@Arg('id') id: string) {
		return getZktCompetitionWithDetails(id);
	}

	@Authorized([Role.LOGGED_IN])
	@Query(() => [ZktCompetition])
	async zktMyCompetitions(@Ctx() context: GraphQLContext) {
		return getMyZktCompetitions(context.user.id);
	}

	@Authorized([Role.MOD])
	@Query(() => PaginatedZktCompetitions)
	async zktCompetitionsForAdmin(
		@Args() pageArgs: PaginationArgs,
		@Arg('filter', () => ZktCompetitionFilterInput, {nullable: true}) filter?: ZktCompetitionFilterInput
	) {
		return listZktCompetitions({
			page: pageArgs.page,
			pageSize: pageArgs.pageSize,
			searchQuery: pageArgs.searchQuery,
			status: filter?.status ?? null,
			onlyPublic: false,
		});
	}

	@Authorized([Role.MOD])
	@Query(() => ZktCompetition, {nullable: true})
	async zktCompetitionForAdmin(@Arg('id') id: string) {
		return getZktCompetitionWithDetails(id);
	}

	@Authorized([Role.MOD])
	@Mutation(() => ZktCompetition)
	async createZktCompetition(
		@Ctx() context: GraphQLContext,
		@Arg('input') input: CreateZktCompetitionInput
	) {
		const start = new Date(input.dateStart);
		const end = new Date(input.dateEnd);
		if (isNaN(start.getTime()) || isNaN(end.getTime())) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'Invalid date');
		}
		if (end < start) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'End date before start');
		}
		if (!input.eventIds || input.eventIds.length === 0) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'At least one event required');
		}
		return createZktCompetitionWithEvents({
			createdById: context.user.id,
			name: input.name,
			description: input.description ?? null,
			dateStart: start,
			dateEnd: end,
			location: input.location,
			locationAddress: input.locationAddress ?? null,
			competitorLimit: input.competitorLimit ?? null,
			visibility: input.visibility,
			eventIds: input.eventIds,
		});
	}

	@Authorized([Role.MOD])
	@Mutation(() => ZktCompetition)
	async updateZktCompetition(
		@Arg('id') id: string,
		@Arg('input') input: UpdateZktCompetitionInput
	) {
		const current = await getZktCompetitionById(id);
		if (!current) throw new GraphQLError(ErrorCode.NOT_FOUND);
		if (current.status !== 'DRAFT' && current.status !== 'ANNOUNCED') {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'Can only edit DRAFT or ANNOUNCED competitions');
		}

		const data: any = {};
		if (input.name !== undefined) data.name = input.name;
		if (input.description !== undefined) data.description = input.description;
		if (input.dateStart !== undefined) data.date_start = new Date(input.dateStart);
		if (input.dateEnd !== undefined) data.date_end = new Date(input.dateEnd);
		if (input.location !== undefined) data.location = input.location;
		if (input.locationAddress !== undefined) data.location_address = input.locationAddress;
		if (input.competitorLimit !== undefined) data.competitor_limit = input.competitorLimit;
		if (input.visibility !== undefined) data.visibility = input.visibility;

		const updated = await getPrisma().zktCompetition.update({
			where: {id},
			data,
		});

		if (input.eventIds && current.status === 'DRAFT') {
			await getPrisma().zktCompEvent.deleteMany({where: {competition_id: id}});
			await Promise.all(
				input.eventIds.map((eventId, index) =>
					getPrisma().zktCompEvent.create({
						data: {
							competition_id: id,
							event_id: eventId,
							event_order: index,
							rounds: {create: {round_number: 1, format: 'AO5'}},
						},
					})
				)
			);
		}

		return updated;
	}

	@Authorized([Role.MOD])
	@Mutation(() => ZktCompetition)
	async updateZktCompetitionStatus(@Arg('input') input: UpdateZktCompetitionStatusInput) {
		const updated = await updateZktCompetitionStatus(input.competitionId, input.status);
		emitZktCompStatusChanged(input.competitionId, input.status);
		return updated;
	}

	@Authorized([Role.MOD])
	@Mutation(() => Boolean)
	async deleteZktCompetition(@Arg('id') id: string) {
		const current = await getZktCompetitionById(id);
		if (!current) throw new GraphQLError(ErrorCode.NOT_FOUND);
		// Cascade: events -> rounds -> results, registrations, delegates hepsi otomatik silinir
		await getPrisma().zktCompetition.delete({where: {id}});
		return true;
	}
}
