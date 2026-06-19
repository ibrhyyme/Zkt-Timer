import {Arg, Authorized, Ctx, Int, Mutation, Query, Resolver} from 'type-graphql';
import {GraphQLContext} from '../@types/interfaces/server.interface';
import {Role} from '../middlewares/auth';
import GraphQLError from '../util/graphql_error';
import {ErrorCode} from '../constants/errors';
import {
	ZktRegistration,
	ZktRegistrationHistory,
	ZktCompDelegate,
	ZktCompOrganizer,
	ZktCompTab,
	ZktRegistrationInput,
	UpdateZktRegistrationStatusInput,
	UpdateMyZktRegistrationInput,
	BulkUpdateZktRegistrationsInput,
	AddZktDelegateInput,
	AddZktOrganizerInput,
	CreateZktCompTabInput,
	UpdateZktCompTabInput,
	ReorderZktCompTabsInput,
	AddZktCompetitorManuallyInput,
} from '../schemas/ZktCompetition.schema';
import {getPrisma} from '../database';
import {
	assertCanModifyCompetition,
	getZktCompetitionById,
	publicUserInclude,
} from '../models/zkt_competition';
import {
	appendRegistrationHistory,
	enqueueWaitlist,
	promoteNextFromWaitlist,
	normalizeWaitlistPositions,
	notifyZktRegistrationStatus,
	isWithinEditWindow,
	HISTORY_ACTIONS,
} from '../models/zkt_registration';
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
					data: {
						status: 'PENDING',
						notes: input.notes ?? null,
						guests: input.guests ?? 0,
						waiting_list_position: null,
					},
			  })
			: await getPrisma().zktRegistration.create({
					data: {
						competition_id: input.competitionId,
						user_id: context.user.id,
						status: 'PENDING',
						notes: input.notes ?? null,
						guests: input.guests ?? 0,
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

		await appendRegistrationHistory(
			registration.id,
			context.user.id,
			existing ? HISTORY_ACTIONS.STATUS_CHANGED : HISTORY_ACTIONS.CREATED,
			{
				status: 'PENDING',
				eventIds: input.eventIds,
				guests: input.guests ?? 0,
			}
		);

		// "Registration received" confirmation (WCA parity).
		await notifyZktRegistrationStatus(context.user.id, input.competitionId, 'PENDING');

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

		const wasApproved = existing.status === 'APPROVED';
		const wasWaitlisted = existing.status === 'WAITLISTED';

		const updated = await getPrisma().zktRegistration.update({
			where: {id: existing.id},
			data: {status: 'WITHDRAWN', waiting_list_position: null},
			include: {user: publicUserInclude, events: true},
		});

		await appendRegistrationHistory(
			existing.id,
			context.user.id,
			HISTORY_ACTIONS.WITHDRAWN,
			{previous_status: existing.status}
		);

		emitZktRegistrationUpdated(competitionId, {
			registrationId: updated.id,
			status: updated.status,
		});

		if (wasWaitlisted) {
			await normalizeWaitlistPositions(competitionId);
		}
		if (wasApproved) {
			const promotedId = await promoteNextFromWaitlist(competitionId, context.user.id);
			if (promotedId) {
				emitZktRegistrationUpdated(competitionId, {
					registrationId: promotedId,
					status: 'APPROVED',
				});
				await normalizeWaitlistPositions(competitionId);
			}
		}

		return updated;
	}

	@Authorized([Role.LOGGED_IN])
	@Mutation(() => Boolean)
	async deleteZktRegistration(
		@Ctx() context: GraphQLContext,
		@Arg('registrationId') registrationId: string
	) {
		const reg = await getPrisma().zktRegistration.findUnique({
			where: {id: registrationId},
		});
		if (!reg) throw new GraphQLError(ErrorCode.NOT_FOUND);

		await assertCanModifyCompetition(context.user, reg.competition_id);

		const compId = reg.competition_id;
		const wasApproved = reg.status === 'APPROVED';
		const wasWaitlisted = reg.status === 'WAITLISTED';
		const personId = reg.person_id;

		// Hard delete: remove the registration and its child rows. For a ghost
		// (account-less) competitor the person row exists only for this comp, so
		// delete it too — its assignments/results cascade.
		await getPrisma().$transaction(async (tx) => {
			await tx.zktRegistrationEvent.deleteMany({where: {registration_id: reg.id}});
			await tx.zktRegistrationHistory.deleteMany({where: {registration_id: reg.id}});
			await tx.zktRegistration.delete({where: {id: reg.id}});
		});

		// Ghost person cleanup is best-effort and OUTSIDE the tx: in Postgres a FK
		// error inside a tx aborts the whole tx (would roll back the registration
		// delete). The person's assignments/results cascade on delete anyway.
		if (personId) {
			await getPrisma().zktPerson.delete({where: {id: personId}}).catch(() => undefined);
		}

		emitZktRegistrationUpdated(compId, {registrationId: reg.id, status: 'DELETED'});

		// Free an approved/waitlisted slot back to the queue.
		if (wasWaitlisted) {
			await normalizeWaitlistPositions(compId);
		}
		if (wasApproved) {
			const promotedId = await promoteNextFromWaitlist(compId, context.user.id);
			if (promotedId) {
				emitZktRegistrationUpdated(compId, {registrationId: promotedId, status: 'APPROVED'});
				await normalizeWaitlistPositions(compId);
			}
		}

		return true;
	}

	@Authorized([Role.LOGGED_IN])
	@Mutation(() => Int)
	async deleteAllZktRegistrations(
		@Ctx() context: GraphQLContext,
		@Arg('competitionId') competitionId: string
	) {
		await assertCanModifyCompetition(context.user, competitionId);

		// Collect every registration (and any ghost person ids) up front.
		const regs = await getPrisma().zktRegistration.findMany({
			where: {competition_id: competitionId},
			select: {id: true, person_id: true},
		});
		if (regs.length === 0) return 0;

		const regIds = regs.map((r) => r.id);
		const personIds = regs.map((r) => r.person_id).filter((p): p is string => !!p);

		// Hard delete all registrations + their child rows in one transaction.
		await getPrisma().$transaction(async (tx) => {
			await tx.zktRegistrationEvent.deleteMany({where: {registration_id: {in: regIds}}});
			await tx.zktRegistrationHistory.deleteMany({where: {registration_id: {in: regIds}}});
			await tx.zktRegistration.deleteMany({where: {competition_id: competitionId}});
		});

		// Ghost (account-less) persons exist only for this comp — remove them too.
		// Best-effort and OUTSIDE the tx: a FK error inside the tx would roll the
		// whole delete back. Assignments/results cascade on person delete.
		if (personIds.length > 0) {
			await getPrisma()
				.zktPerson.deleteMany({where: {id: {in: personIds}}})
				.catch(() => undefined);
		}

		emitZktRegistrationUpdated(competitionId, {registrationId: '', status: 'DELETED'});

		return regs.length;
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

		const previousStatus = reg.status;
		const dataUpdates: any = {status: input.status};

		// If admin is moving into WAITLISTED, assign next queue slot.
		if (input.status === 'WAITLISTED' && previousStatus !== 'WAITLISTED') {
			const last = await getPrisma().zktRegistration.findFirst({
				where: {competition_id: reg.competition_id, status: 'WAITLISTED'},
				orderBy: {waiting_list_position: 'desc'},
			});
			dataUpdates.waiting_list_position = (last?.waiting_list_position ?? 0) + 1;
		}
		// Leaving WAITLISTED clears the slot.
		if (previousStatus === 'WAITLISTED' && input.status !== 'WAITLISTED') {
			dataUpdates.waiting_list_position = null;
		}
		if (input.adminComment !== undefined) {
			dataUpdates.admin_comment = input.adminComment;
		}

		const updated = await getPrisma().zktRegistration.update({
			where: {id: input.registrationId},
			data: dataUpdates,
			include: {user: publicUserInclude, events: true},
		});

		if (previousStatus !== input.status) {
			await appendRegistrationHistory(
				updated.id,
				context.user.id,
				HISTORY_ACTIONS.STATUS_CHANGED,
				{previous: previousStatus, current: input.status}
			);
		}
		if (input.adminComment !== undefined) {
			await appendRegistrationHistory(
				updated.id,
				context.user.id,
				HISTORY_ACTIONS.ADMIN_COMMENT_CHANGED,
				{}
			);
		}

		emitZktRegistrationUpdated(reg.competition_id, {
			registrationId: updated.id,
			status: updated.status,
		});

		// Status-change notification to the competitor (approved/waitlisted/rejected).
		if (
			previousStatus !== input.status &&
			(input.status === 'APPROVED' || input.status === 'WAITLISTED' || input.status === 'REJECTED')
		) {
			await notifyZktRegistrationStatus(reg.user_id, reg.competition_id, input.status);
		}

		// Leaving APPROVED frees up a slot — promote the next waitlisted user.
		if (
			previousStatus === 'APPROVED' &&
			(input.status === 'WITHDRAWN' || input.status === 'REJECTED')
		) {
			const promotedId = await promoteNextFromWaitlist(reg.competition_id, context.user.id);
			if (promotedId) {
				emitZktRegistrationUpdated(reg.competition_id, {
					registrationId: promotedId,
					status: 'APPROVED',
				});
				await normalizeWaitlistPositions(reg.competition_id);
			}
		}
		// A waitlist re-seating might be needed if we moved INTO the waitlist
		// at a non-tail slot, or left one.
		if (input.status === 'WAITLISTED' || previousStatus === 'WAITLISTED') {
			await normalizeWaitlistPositions(reg.competition_id);
		}

		return updated;
	}

	@Authorized([Role.LOGGED_IN])
	@Mutation(() => ZktRegistration)
	async updateMyZktRegistration(
		@Ctx() context: GraphQLContext,
		@Arg('input') input: UpdateMyZktRegistrationInput
	) {
		const reg = await getPrisma().zktRegistration.findUnique({
			where: {
				competition_id_user_id: {
					competition_id: input.competitionId,
					user_id: context.user.id,
				},
			},
		});
		if (!reg) throw new GraphQLError(ErrorCode.NOT_FOUND);
		if (reg.status === 'REJECTED' || reg.status === 'WITHDRAWN') {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'Cannot edit this registration');
		}

		const canEdit = await isWithinEditWindow(input.competitionId);
		if (!canEdit) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'Registration edit window is closed');
		}

		const dataUpdates: any = {};
		if (input.notes !== undefined) dataUpdates.notes = input.notes;
		if (input.guests !== undefined) dataUpdates.guests = input.guests;

		if (Object.keys(dataUpdates).length > 0) {
			await getPrisma().zktRegistration.update({
				where: {id: reg.id},
				data: dataUpdates,
			});
		}

		if (input.eventIds) {
			const compEvents = await getPrisma().zktCompEvent.findMany({
				where: {competition_id: input.competitionId},
			});
			const validEventIds = new Set(compEvents.map((e) => e.id));
			for (const eid of input.eventIds) {
				if (!validEventIds.has(eid)) {
					throw new GraphQLError(ErrorCode.BAD_INPUT, `Invalid event: ${eid}`);
				}
			}
			await getPrisma().zktRegistrationEvent.deleteMany({
				where: {registration_id: reg.id},
			});
			await Promise.all(
				input.eventIds.map((eid) =>
					getPrisma().zktRegistrationEvent.create({
						data: {registration_id: reg.id, comp_event_id: eid},
					})
				)
			);
			await appendRegistrationHistory(
				reg.id,
				context.user.id,
				HISTORY_ACTIONS.EVENTS_CHANGED,
				{eventIds: input.eventIds}
			);
		}

		if (input.notes !== undefined) {
			await appendRegistrationHistory(
				reg.id,
				context.user.id,
				HISTORY_ACTIONS.NOTES_CHANGED,
				{}
			);
		}
		if (input.guests !== undefined) {
			await appendRegistrationHistory(
				reg.id,
				context.user.id,
				HISTORY_ACTIONS.GUESTS_CHANGED,
				{guests: input.guests}
			);
		}

		emitZktRegistrationUpdated(input.competitionId, {
			registrationId: reg.id,
			status: reg.status,
		});

		return getPrisma().zktRegistration.findUnique({
			where: {id: reg.id},
			include: {user: publicUserInclude, events: true},
		});
	}

	@Authorized([Role.LOGGED_IN])
	@Mutation(() => [ZktRegistration])
	async bulkUpdateZktRegistrations(
		@Ctx() context: GraphQLContext,
		@Arg('input') input: BulkUpdateZktRegistrationsInput
	) {
		await assertCanModifyCompetition(context.user, input.competitionId);

		const ids = input.updates.map((u) => u.registrationId);
		const regs = await getPrisma().zktRegistration.findMany({
			where: {id: {in: ids}, competition_id: input.competitionId},
		});
		if (regs.length !== ids.length) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'One or more registrations not in this competition');
		}

		// Transaction keeps the batch atomic — any failure rolls all back.
		const prevById = new Map(regs.map((r) => [r.id, r]));
		await getPrisma().$transaction(
			input.updates.map((u) =>
				getPrisma().zktRegistration.update({
					where: {id: u.registrationId},
					data: {
						status: u.status,
						waiting_list_position: u.status === 'WAITLISTED' ? undefined : null,
					},
				})
			)
		);

		// Append history + normalize waitlist positions + auto-promote post-batch.
		await Promise.all(
			input.updates.map((u) => {
				const prev = prevById.get(u.registrationId);
				if (!prev || prev.status === u.status) return Promise.resolve();
				return appendRegistrationHistory(
					u.registrationId,
					context.user.id,
					HISTORY_ACTIONS.STATUS_CHANGED,
					{previous: prev.status, current: u.status, bulk: true}
				);
			})
		);

		await normalizeWaitlistPositions(input.competitionId);

		// If any APPROVED freed up, try promoting — loop up to N once per freed slot.
		const freedSlots = input.updates.filter((u) => {
			const prev = prevById.get(u.registrationId);
			return prev?.status === 'APPROVED' && u.status !== 'APPROVED';
		}).length;
		for (let i = 0; i < freedSlots; i++) {
			const promotedId = await promoteNextFromWaitlist(input.competitionId, context.user.id);
			if (!promotedId) break;
		}
		if (freedSlots > 0) {
			await normalizeWaitlistPositions(input.competitionId);
		}

		for (const u of input.updates) {
			emitZktRegistrationUpdated(input.competitionId, {
				registrationId: u.registrationId,
				status: u.status,
			});
		}

		// Notify each competitor whose status actually changed.
		for (const u of input.updates) {
			const prev = prevById.get(u.registrationId);
			if (!prev || prev.status === u.status) continue;
			if (u.status === 'APPROVED' || u.status === 'WAITLISTED' || u.status === 'REJECTED') {
				await notifyZktRegistrationStatus(prev.user_id, input.competitionId, u.status);
			}
		}

		return getPrisma().zktRegistration.findMany({
			where: {id: {in: ids}},
			include: {user: publicUserInclude, events: true},
		});
	}

	@Authorized([Role.LOGGED_IN])
	@Query(() => [ZktRegistrationHistory])
	async zktRegistrationHistory(
		@Ctx() context: GraphQLContext,
		@Arg('registrationId') registrationId: string
	) {
		const reg = await getPrisma().zktRegistration.findUnique({
			where: {id: registrationId},
		});
		if (!reg) throw new GraphQLError(ErrorCode.NOT_FOUND);
		// History is admin-level: only moderators of the competition + the
		// user themselves can read.
		if (reg.user_id !== context.user.id) {
			await assertCanModifyCompetition(context.user, reg.competition_id);
		}
		const rows = await getPrisma().zktRegistrationHistory.findMany({
			where: {registration_id: registrationId},
			orderBy: {created_at: 'asc'},
			include: {actor: publicUserInclude},
		});
		return rows.map((r) => ({
			...r,
			changed_attributes: r.changed_attributes
				? JSON.stringify(r.changed_attributes)
				: null,
		}));
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
					data: {status: 'APPROVED', waiting_list_position: null},
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

		await appendRegistrationHistory(
			registration.id,
			context.user.id,
			existing ? HISTORY_ACTIONS.STATUS_CHANGED : HISTORY_ACTIONS.CREATED,
			{added_manually: true, eventIds: input.eventIds}
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
	@Mutation(() => ZktCompDelegate)
	async addZktDelegate(
		@Ctx() context: GraphQLContext,
		@Arg('input') input: AddZktDelegateInput
	) {
		await assertCanModifyCompetition(context.user, input.competitionId);

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

	@Authorized([Role.LOGGED_IN])
	@Mutation(() => Boolean)
	async removeZktDelegate(
		@Ctx() context: GraphQLContext,
		@Arg('competitionId') competitionId: string,
		@Arg('userId') userId: string
	) {
		await assertCanModifyCompetition(context.user, competitionId);

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

	@Authorized([Role.LOGGED_IN])
	@Mutation(() => ZktCompOrganizer)
	async addZktOrganizer(
		@Ctx() context: GraphQLContext,
		@Arg('input') input: AddZktOrganizerInput
	) {
		await assertCanModifyCompetition(context.user, input.competitionId);

		const existing = await getPrisma().zktCompOrganizer.findUnique({
			where: {
				competition_id_user_id: {
					competition_id: input.competitionId,
					user_id: input.userId,
				},
			},
		});
		if (existing) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'Already an organizer');
		}
		return getPrisma().zktCompOrganizer.create({
			data: {
				competition_id: input.competitionId,
				user_id: input.userId,
			},
			include: {user: publicUserInclude},
		});
	}

	@Authorized([Role.LOGGED_IN])
	@Mutation(() => Boolean)
	async removeZktOrganizer(
		@Ctx() context: GraphQLContext,
		@Arg('competitionId') competitionId: string,
		@Arg('userId') userId: string
	) {
		await assertCanModifyCompetition(context.user, competitionId);

		await getPrisma().zktCompOrganizer.delete({
			where: {
				competition_id_user_id: {
					competition_id: competitionId,
					user_id: userId,
				},
			},
		});
		return true;
	}

	@Authorized([Role.LOGGED_IN])
	@Mutation(() => ZktCompTab)
	async createZktCompTab(
		@Ctx() context: GraphQLContext,
		@Arg('input') input: CreateZktCompTabInput
	) {
		await assertCanModifyCompetition(context.user, input.competitionId);
		const count = await getPrisma().zktCompTab.count({
			where: {competition_id: input.competitionId},
		});
		return getPrisma().zktCompTab.create({
			data: {
				competition_id: input.competitionId,
				title: input.title,
				content: input.content,
				tab_order: count,
			},
		});
	}

	@Authorized([Role.LOGGED_IN])
	@Mutation(() => ZktCompTab)
	async updateZktCompTab(
		@Ctx() context: GraphQLContext,
		@Arg('input') input: UpdateZktCompTabInput
	) {
		const tab = await getPrisma().zktCompTab.findUnique({where: {id: input.tabId}});
		if (!tab) throw new GraphQLError(ErrorCode.NOT_FOUND);
		await assertCanModifyCompetition(context.user, tab.competition_id);
		return getPrisma().zktCompTab.update({
			where: {id: input.tabId},
			data: {
				...(input.title !== undefined ? {title: input.title} : {}),
				...(input.content !== undefined ? {content: input.content} : {}),
			},
		});
	}

	@Authorized([Role.LOGGED_IN])
	@Mutation(() => Boolean)
	async deleteZktCompTab(@Ctx() context: GraphQLContext, @Arg('tabId') tabId: string) {
		const tab = await getPrisma().zktCompTab.findUnique({where: {id: tabId}});
		if (!tab) throw new GraphQLError(ErrorCode.NOT_FOUND);
		await assertCanModifyCompetition(context.user, tab.competition_id);
		await getPrisma().zktCompTab.delete({where: {id: tabId}});
		return true;
	}

	@Authorized([Role.LOGGED_IN])
	@Mutation(() => Boolean)
	async reorderZktCompTabs(
		@Ctx() context: GraphQLContext,
		@Arg('input') input: ReorderZktCompTabsInput
	) {
		await assertCanModifyCompetition(context.user, input.competitionId);
		await getPrisma().$transaction(
			input.tabIds.map((id, idx) =>
				getPrisma().zktCompTab.update({where: {id}, data: {tab_order: idx}})
			)
		);
		return true;
	}
}
