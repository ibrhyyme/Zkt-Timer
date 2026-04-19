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
	CancelZktCompetitionInput,
	ZktPodium,
	ZktAllTimeRanking,
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
	confirmZktCompetition as confirmCompetition,
	announceZktCompetition as announceCompetition,
	cancelZktCompetition as cancelCompetition,
	publishZktResults as publishResults,
	unpublishZktResults as unpublishResults,
} from '../models/zkt_competition';
import {buildZktWcif} from '../models/zkt_wcif';
import {getZktPodiums, getZktAllTimeRankings} from '../models/zkt_podium';
import {emitZktCompStatusChanged, emitZktCompListChanged} from '../zkt_competition';
import {sendEmailWithTemplate} from '../services/ses';

function formatCompDate(d: Date): string {
	return d.toLocaleDateString('tr-TR', {year: 'numeric', month: 'long', day: 'numeric'});
}

function formatDateRange(start: Date, end: Date): string {
	const s = formatCompDate(start);
	const e = formatCompDate(end);
	return s === e ? s : `${s} – ${e}`;
}

@Resolver()
export class ZktCompetitionResolver {
	@Authorized([Role.LOGGED_IN])
	@Query(() => PaginatedZktCompetitions)
	async zktCompetitions(
		@Ctx() context: GraphQLContext,
		@Args() pageArgs: PaginationArgs,
		@Arg('filter', () => ZktCompetitionFilterInput, {nullable: true}) filter?: ZktCompetitionFilterInput
	) {
		return listZktCompetitions({
			page: pageArgs.page,
			pageSize: pageArgs.pageSize,
			searchQuery: pageArgs.searchQuery,
			status: filter?.status ?? null,
			onlyPublic: true,
			viewerId: context.user?.id ?? null,
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

	@Authorized([Role.LOGGED_IN])
	@Query(() => String)
	async exportZktCompetitionWcif(@Arg('id') id: string): Promise<string> {
		const wcif = await buildZktWcif(id);
		return JSON.stringify(wcif);
	}

	@Authorized([Role.LOGGED_IN])
	@Query(() => [ZktPodium])
	async zktCompetitionPodiums(@Arg('id') id: string) {
		return getZktPodiums(id);
	}

	@Authorized([Role.LOGGED_IN])
	@Query(() => [ZktAllTimeRanking])
	async zktAllTimeRankings(
		@Arg('eventId') eventId: string,
		@Arg('recordType') recordType: string,
		@Arg('limit', () => Number, {nullable: true}) limit?: number
	) {
		if (recordType !== 'single' && recordType !== 'average') {
			throw new Error('recordType must be "single" or "average"');
		}
		return getZktAllTimeRankings({
			eventId,
			recordType: recordType as 'single' | 'average',
			limit: limit ?? 100,
		});
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
		const created = await createZktCompetitionWithEvents({
			createdById: context.user.id,
			name: input.name,
			description: input.description ?? null,
			dateStart: start,
			dateEnd: end,
			location: input.location,
			locationAddress: input.locationAddress ?? null,
			competitorLimit: input.competitorLimit ?? null,
			visibility: input.visibility,
			championshipType: input.championshipType ?? null,
			eventIds: input.eventIds,
		});
		emitZktCompListChanged({action: 'created', competitionId: created.id});
		return created;
	}

	@Authorized([Role.MOD])
	@Mutation(() => ZktCompetition)
	async updateZktCompetition(
		@Arg('id') id: string,
		@Arg('input') input: UpdateZktCompetitionInput
	) {
		const current = await getZktCompetitionById(id);
		if (!current) throw new GraphQLError(ErrorCode.NOT_FOUND);
		const editableStates = ['DRAFT', 'CONFIRMED', 'ANNOUNCED'];
		if (!editableStates.includes(current.status)) {
			throw new GraphQLError(
				ErrorCode.BAD_INPUT,
				'Only DRAFT, CONFIRMED or ANNOUNCED competitions can be edited'
			);
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
		if (input.championshipType !== undefined) data.championship_type = input.championshipType;

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
		emitZktCompListChanged({action: 'updated', competitionId: input.competitionId});
		return updated;
	}

	@Authorized([Role.MOD])
	@Mutation(() => ZktCompetition)
	async confirmZktCompetition(@Arg('id') id: string) {
		const updated = await confirmCompetition(id);
		emitZktCompStatusChanged(id, updated.status);
		emitZktCompListChanged({action: 'updated', competitionId: id});
		return updated;
	}

	@Authorized([Role.MOD])
	@Mutation(() => ZktCompetition)
	async announceZktCompetition(
		@Ctx() context: GraphQLContext,
		@Arg('id') id: string
	) {
		const updated = await announceCompetition(id, context.user.id);
		emitZktCompStatusChanged(id, updated.status);
		emitZktCompListChanged({action: 'updated', competitionId: id});

		// Notify creator + delegates. Fire-and-forget: one bad email shouldn't
		// roll back the announcement state transition.
		const comp = await getPrisma().zktCompetition.findUnique({
			where: {id},
			include: {
				created_by: true,
				delegates: {include: {user: true}},
			},
		});
		if (comp) {
			const recipients = [
				comp.created_by,
				...comp.delegates.map((d) => d.user),
			].filter(
				(u, i, arr) =>
					u && u.email && arr.findIndex((x) => x?.id === u.id) === i
			);
			const vars = {
				competitionName: comp.name,
				dateRange: formatDateRange(comp.date_start, comp.date_end),
				location: comp.location,
				locationAddress: comp.location_address,
				description: comp.description,
				link: `https://zktimer.app/community/zkt-competitions/${comp.id}`,
			};
			for (const user of recipients) {
				sendEmailWithTemplate(
					user as any,
					`${comp.name} yarışması duyuruldu`,
					'zkt_competition_announcement',
					vars
				).catch((err) => {
					console.error('Failed to send announcement email:', err);
				});
			}
		}

		return updated;
	}

	@Authorized([Role.MOD])
	@Mutation(() => ZktCompetition)
	async cancelZktCompetition(@Arg('input') input: CancelZktCompetitionInput) {
		const updated = await cancelCompetition(input.competitionId, input.reason ?? null);
		emitZktCompStatusChanged(input.competitionId, updated.status);
		emitZktCompListChanged({action: 'updated', competitionId: input.competitionId});
		return updated;
	}

	@Authorized([Role.MOD])
	@Mutation(() => ZktCompetition)
	async publishZktResults(@Arg('id') id: string) {
		const updated = await publishResults(id);
		emitZktCompStatusChanged(id, updated.status);
		emitZktCompListChanged({action: 'updated', competitionId: id});
		return updated;
	}

	@Authorized([Role.MOD])
	@Mutation(() => ZktCompetition)
	async unpublishZktResults(@Arg('id') id: string) {
		const updated = await unpublishResults(id);
		emitZktCompStatusChanged(id, updated.status);
		emitZktCompListChanged({action: 'updated', competitionId: id});
		return updated;
	}

	@Authorized([Role.MOD])
	@Mutation(() => Boolean)
	async deleteZktCompetition(@Arg('id') id: string) {
		const current = await getZktCompetitionById(id);
		if (!current) throw new GraphQLError(ErrorCode.NOT_FOUND);
		// Cascade: events -> rounds -> results, registrations, delegates hepsi otomatik silinir
		await getPrisma().zktCompetition.delete({where: {id}});
		emitZktCompListChanged({action: 'deleted', competitionId: id});
		return true;
	}
}
