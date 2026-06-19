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
	ZktParticipation,
	ZktAllTimeRanking,
	ZktScheduleItem,
	CreateZktScheduleItemInput,
	UpdateZktScheduleItemInput,
} from '../schemas/ZktCompetition.schema';
import {PaginationArgs} from '../schemas/Pagination.schema';
import {getPrisma} from '../database';
import {
	assertCanModifyCompetition,
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
import {getZktPodiums, getZktParticipation, getZktAllTimeRankings} from '../models/zkt_podium';
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
			viewerCountry: context.user?.join_country ?? null,
			viewerIsStaff: !!(context.user?.admin || context.user?.mod),
		});
	}

	@Authorized([Role.LOGGED_IN])
	@Query(() => ZktCompetition, {nullable: true})
	async zktCompetition(@Ctx() context: GraphQLContext, @Arg('id') id: string) {
		const comp = await getZktCompetitionWithDetails(id);
		if (!comp) return null;

		const user = context.user;
		const isStaff = !!(user?.admin || user?.mod);
		if (isStaff) return comp;

		// Tied users (creator, delegate, organizer) run the competition — they can
		// always open it, including DRAFT, for the admin dashboard ("Yönet").
		const tied =
			comp.created_by_id === user?.id ||
			(comp.delegates || []).some((d: any) => d.user_id === user?.id) ||
			(comp.organizers || []).some((o: any) => o.user_id === user?.id);
		if (tied) return comp;

		// Public (non-tied) access rules — mirror listZktCompetitions so the detail
		// endpoint can't be used to bypass list filtering via direct ID lookup.
		if (comp.status === 'DRAFT' || comp.status === 'CONFIRMED') return null;
		// Country scoping: non-staff can't open competitions outside their country.
		if (user?.join_country && comp.country_code && comp.country_code !== user.join_country) {
			return null;
		}
		// PRIVATE competitions: visible to registered competitors only (tied handled above).
		if (comp.visibility === 'PRIVATE') {
			const registrant = (comp.registrations || []).some((r: any) => r.user_id === user?.id);
			if (!registrant) return null;
		}
		return comp;
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
	@Query(() => [ZktParticipation])
	async zktCompetitionParticipation(@Arg('id') id: string) {
		return getZktParticipation(id);
	}

	@Authorized([Role.LOGGED_IN])
	@Query(() => [ZktAllTimeRanking])
	async zktAllTimeRankings(
		@Arg('eventId') eventId: string,
		@Arg('recordType') recordType: string,
		@Arg('limit', () => Number, {nullable: true}) limit?: number,
		@Arg('mode', {nullable: true}) mode?: string
	) {
		if (recordType !== 'single' && recordType !== 'average') {
			throw new Error('recordType must be "single" or "average"');
		}
		return getZktAllTimeRankings({
			eventId,
			recordType: recordType as 'single' | 'average',
			limit: limit ?? 100,
			mode: mode === 'results' ? 'results' : 'persons',
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
			shortName: input.shortName ?? null,
			latitude: input.latitude ?? null,
			longitude: input.longitude ?? null,
			registrationOpensAt: input.registrationOpensAt ? new Date(input.registrationOpensAt) : null,
			registrationClosesAt: input.registrationClosesAt ? new Date(input.registrationClosesAt) : null,
			registrationEditDeadline: input.registrationEditDeadline
				? new Date(input.registrationEditDeadline)
				: null,
			onSpotRegistration: input.onSpotRegistration ?? false,
			cancellationPolicy: input.cancellationPolicy ?? null,
			guestsEnabled: input.guestsEnabled ?? true,
			forceComment: input.forceComment ?? false,
			extraRequirements: input.extraRequirements ?? null,
			contact: input.contact ?? null,
			mainEventId: input.mainEventId ?? null,
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
		// Finished/published/cancelled competitions are historical records and stay
		// locked. Everything up to (and including) ONGOING is editable so organisers
		// can still fix venue, competitor limit, contact, dates etc. after the
		// registration has opened.
		const lockedStates = ['FINISHED', 'PUBLISHED', 'CANCELLED'];
		if (lockedStates.includes(current.status)) {
			throw new GraphQLError(
				ErrorCode.BAD_INPUT,
				'Finished, published or cancelled competitions cannot be edited'
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
		if (input.shortName !== undefined) data.short_name = input.shortName;
		if (input.latitude !== undefined) data.latitude = input.latitude;
		if (input.longitude !== undefined) data.longitude = input.longitude;
		if (input.registrationOpensAt !== undefined)
			data.registration_opens_at = input.registrationOpensAt ? new Date(input.registrationOpensAt) : null;
		if (input.registrationClosesAt !== undefined)
			data.registration_closes_at = input.registrationClosesAt ? new Date(input.registrationClosesAt) : null;
		if (input.registrationEditDeadline !== undefined)
			data.registration_edit_deadline = input.registrationEditDeadline
				? new Date(input.registrationEditDeadline)
				: null;
		if (input.onSpotRegistration !== undefined) data.on_spot_registration = input.onSpotRegistration;
		if (input.cancellationPolicy !== undefined) data.cancellation_policy = input.cancellationPolicy;
		if (input.guestsEnabled !== undefined) data.guests_enabled = input.guestsEnabled;
		if (input.forceComment !== undefined) data.force_comment = input.forceComment;
		if (input.extraRequirements !== undefined) data.extra_requirements = input.extraRequirements;
		if (input.contact !== undefined) data.contact = input.contact;
		if (input.mainEventId !== undefined) data.main_event_id = input.mainEventId;

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
				link: `https://zktimer.app/zkt-competitions/${comp.slug || comp.id}`,
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

	// ── Schedule items (custom rows: opening, lunch, awards...) ──

	@Authorized([Role.LOGGED_IN])
	@Mutation(() => ZktScheduleItem)
	async createZktScheduleItem(
		@Ctx() context: GraphQLContext,
		@Arg('input') input: CreateZktScheduleItemInput
	) {
		await assertCanModifyCompetition(context.user, input.competitionId);
		const start = new Date(input.startTime);
		if (isNaN(start.getTime())) throw new GraphQLError(ErrorCode.BAD_INPUT, 'Invalid start time');
		const item = await getPrisma().zktScheduleItem.create({
			data: {
				competition_id: input.competitionId,
				title: input.title.trim(),
				start_time: start,
				end_time: input.endTime ? new Date(input.endTime) : null,
			},
		});
		emitZktCompListChanged({action: 'updated', competitionId: input.competitionId});
		return item;
	}

	@Authorized([Role.LOGGED_IN])
	@Mutation(() => ZktScheduleItem)
	async updateZktScheduleItem(
		@Ctx() context: GraphQLContext,
		@Arg('input') input: UpdateZktScheduleItemInput
	) {
		const item = await getPrisma().zktScheduleItem.findUnique({where: {id: input.itemId}});
		if (!item) throw new GraphQLError(ErrorCode.NOT_FOUND);
		await assertCanModifyCompetition(context.user, item.competition_id);

		const data: any = {};
		if (input.title !== undefined) data.title = input.title.trim();
		if (input.startTime !== undefined) data.start_time = new Date(input.startTime);
		if (input.endTime !== undefined) data.end_time = input.endTime ? new Date(input.endTime) : null;

		return getPrisma().zktScheduleItem.update({where: {id: input.itemId}, data});
	}

	@Authorized([Role.LOGGED_IN])
	@Mutation(() => Boolean)
	async deleteZktScheduleItem(@Ctx() context: GraphQLContext, @Arg('itemId') itemId: string) {
		const item = await getPrisma().zktScheduleItem.findUnique({where: {id: itemId}});
		if (!item) throw new GraphQLError(ErrorCode.NOT_FOUND);
		await assertCanModifyCompetition(context.user, item.competition_id);
		await getPrisma().zktScheduleItem.delete({where: {id: itemId}});
		return true;
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
