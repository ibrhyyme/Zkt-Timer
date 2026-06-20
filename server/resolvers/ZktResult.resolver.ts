import {Arg, Authorized, Ctx, Mutation, Query, Resolver} from 'type-graphql';
import {GraphQLContext} from '../@types/interfaces/server.interface';
import {Role} from '../middlewares/auth';
import GraphQLError from '../util/graphql_error';
import {ErrorCode} from '../constants/errors';
import {
	ZktResult,
	ZktRound,
	ZktScramble,
	ZktCompetitorUser,
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
import {upsertZktResult, finalizeRound, markResultNoShow, recomputeRoundRankings} from '../models/zkt_result';
import {assertRoundTransition, revokeAdvancementCarry, syncRoundGroups} from '../models/zkt_round';
import {ensureScramblesForRound, regenerateScramblesForRound} from '../models/zkt_scramble';
import {checkAndApplyRecords, rebuildRecordsForEvent} from '../models/zkt_record';
import ZktRoundFinishedNotification from '../resources/notification_types/zkt_round_finished';
import ZktFollowRoundFinishedNotification from '../resources/notification_types/zkt_follow_round_finished';
import {sendPushToUser} from '../services/push';
import {emitZktResultUpdated, emitZktResultDeleted, emitZktRoundStatusChanged} from '../zkt_competition';

// Human-readable event names for notification texts (server side has no access
// to the client's ZKT_WCA_EVENTS list; keep these locale-neutral).
const ZKT_EVENT_NAMES: Record<string, string> = {
	'222': '2x2x2',
	'333': '3x3x3',
	'444': '4x4x4',
	'555': '5x5x5',
	'666': '6x6x6',
	'777': '7x7x7',
	'333oh': '3x3x3 OH',
	'333bf': '3x3x3 BLD',
	pyram: 'Pyraminx',
	skewb: 'Skewb',
	sq1: 'Square-1',
	minx: 'Megaminx',
	clock: 'Clock',
};

/**
 * "Round finished" notifications to every ranked competitor (in-app + push) —
 * fired after a delegate finalizes a round. Failures never break finalize.
 */
async function notifyZktRoundFinished(roundId: string): Promise<void> {
	try {
		const prisma = getPrisma();
		const round = await prisma.zktRound.findUnique({
			where: {id: roundId},
			include: {
				comp_event: {
					include: {
						competition: {select: {id: true, name: true}},
						rounds: {select: {round_number: true}},
					},
				},
			},
		});
		if (!round) return;
		const maxRound = Math.max(...round.comp_event.rounds.map((r) => r.round_number));
		const isFinal = round.round_number === maxRound;
		const eventId = round.comp_event.event_id;

		const results = await prisma.zktResult.findMany({
			// Only account-holding competitors get notified — ghosts have no account.
			where: {round_id: roundId, ranking: {not: null}, user_id: {not: null}},
			include: {user: {include: {settings: true}}},
		});

		for (const r of results) {
			const notif = new ZktRoundFinishedNotification(
				{user: r.user as any, triggeringUser: r.user as any, sendEmail: false},
				{
					competitionId: round.comp_event.competition.id,
					competitionName: round.comp_event.competition.name,
					eventId,
					eventName: ZKT_EVENT_NAMES[eventId] || eventId,
					roundNumber: round.round_number,
					ranking: r.ranking as number,
					advancing: r.proceeds,
					isFinal,
					locale: (r.user as any)?.settings?.locale,
				}
			);
			await notif.send().catch(() => {});
			await sendPushToUser(r.user_id, notif.subject(), notif.inAppMessage()).catch(() => {});
		}

		// Notify Pro followers of each ranked competitor (account user OR ghost
		// person). followed_name is denormalized on the follow row, so the
		// competitor's display name is not re-derived here.
		const rankedForFollows = await prisma.zktResult.findMany({
			where: {round_id: roundId, ranking: {not: null}},
			select: {user_id: true, person_id: true, ranking: true, proceeds: true},
		});
		for (const r of rankedForFollows) {
			const followWhere = r.user_id
				? {competition_id: round.comp_event.competition.id, followed_user_id: r.user_id}
				: {competition_id: round.comp_event.competition.id, followed_person_id: r.person_id};
			const follows = await prisma.zktCompetitionFollow.findMany({
				where: followWhere,
				include: {user: {include: {settings: true}}},
			});
			for (const f of follows) {
				const fnotif = new ZktFollowRoundFinishedNotification(
					{user: f.user as any, triggeringUser: f.user as any, sendEmail: false},
					{
						competitionId: round.comp_event.competition.id,
						competitionName: round.comp_event.competition.name,
						eventId,
						eventName: ZKT_EVENT_NAMES[eventId] || eventId,
						roundNumber: round.round_number,
						ranking: r.ranking as number,
						advancing: r.proceeds,
						isFinal,
						followedName: f.followed_name,
						locale: (f.user as any)?.settings?.locale,
					}
				);
				await fnotif.send().catch(() => {});
				await sendPushToUser(f.user_id, fnotif.subject(), fnotif.inAppMessage()).catch(() => {});
			}
		}
	} catch {
		// Notifications are best-effort.
	}
}

@Resolver()
export class ZktResultResolver {
	@Authorized([Role.LOGGED_IN])
	@Query(() => [ZktResult])
	async zktRoundResults(@Arg('roundId') roundId: string) {
		return getPrisma().zktResult.findMany({
			where: {round_id: roundId},
			orderBy: [{ranking: {sort: 'asc', nulls: 'last'}}, {created_at: 'asc'}],
			// entered_by powers the double-check view's scoretaker filter.
			include: {user: publicUserInclude, person: true, entered_by: publicUserInclude},
		});
	}

	@Authorized([Role.LOGGED_IN])
	@Query(() => [ZktResult])
	async zktCompetitorResults(
		@Arg('competitionId') competitionId: string,
		@Arg('userId', {nullable: true}) userId?: string,
		@Arg('personId', {nullable: true}) personId?: string
	) {
		// The route passes one competitorId that may be either a user id or a
		// ghost-person id (both globally unique), so match on either column.
		const competitorId = personId || userId;
		if (!competitorId) return [];
		return getPrisma().zktResult.findMany({
			where: {
				OR: [{user_id: competitorId}, {person_id: competitorId}],
				round: {
					comp_event: {
						competition_id: competitionId,
					},
				},
			},
			orderBy: {created_at: 'asc'},
			include: {
				user: publicUserInclude,
				person: true,
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
			user_id: input.userId ?? null,
			person_id: input.personId ?? null,
			attempt_1: input.attempt1 ?? null,
			attempt_2: input.attempt2 ?? null,
			attempt_3: input.attempt3 ?? null,
			attempt_4: input.attempt4 ?? null,
			attempt_5: input.attempt5 ?? null,
			entered_by_id: context.user.id,
		});

		// Editing a result of an already-finalized round can invalidate or move
		// records that were applied at finalize time.
		if (round.status === 'FINISHED') {
			await rebuildRecordsForEvent(round.comp_event.event_id);
		}

		// Live ranking: refresh placements + provisional advancement so the
		// scoretaker leaderboard, ZKT Live and projector update the moment this
		// attempt is entered (instead of staying blank until finalize).
		await recomputeRoundRankings(input.roundId);

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
				user_id: item.userId ?? null,
				person_id: item.personId ?? null,
				attempt_1: item.attempt1 ?? null,
				attempt_2: item.attempt2 ?? null,
				attempt_3: item.attempt3 ?? null,
				attempt_4: item.attempt4 ?? null,
				attempt_5: item.attempt5 ?? null,
				entered_by_id: context.user.id,
			});
			saved.push(r);
		}

		// Same as single submit: batch edits on a finalized round invalidate records.
		if (round.status === 'FINISHED' && saved.length > 0) {
			await rebuildRecordsForEvent(round.comp_event.event_id);
		}

		// Live ranking after the whole batch (one recompute, not per-row).
		if (saved.length > 0) {
			await recomputeRoundRankings(input.roundId);
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

		// The deleted result may have held an NR (or shifted PR history) — the
		// record table only ever grows, so rebuild this event from scratch.
		await rebuildRecordsForEvent(result.round.comp_event.event_id);

		// Live ranking: a removed result shifts everyone below it up.
		await recomputeRoundRankings(result.round_id);

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

		await this.finalizeRoundWithRecords(
			roundId,
			context.user.id,
			competitionId,
			round.comp_event.event_id
		);

		return getPrisma().zktRound.findUnique({
			where: {id: roundId},
			include: {results: {include: {user: publicUserInclude, person: true}}, groups: true},
		});
	}

	// Shared finalize path: flip to FINISHED (atomic claim inside finalizeRound),
	// then apply records + broadcast + notify ONLY for the call that actually
	// finalized (a concurrent second finalize loses the claim → skip, so no
	// duplicate "round finished" notifications). Reused by finalizeZktRound and
	// by the single-active-round rule in updateZktRoundStatus.
	private async finalizeRoundWithRecords(
		roundId: string,
		userId: string,
		competitionId: string,
		eventId: string
	): Promise<void> {
		const {alreadyFinalized} = await finalizeRound(roundId, userId);
		if (alreadyFinalized) return;

		const results = await getPrisma().zktResult.findMany({where: {round_id: roundId}});
		for (const r of results) {
			// Ghost competitors (person, no account) don't hold global records — skip.
			if (!r.user_id) continue;
			const tags = await checkAndApplyRecords({
				resultId: r.id,
				userId: r.user_id,
				eventId,
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

		// Fire-and-forget: "you placed Nth / you advance / podium" to every
		// ranked competitor. Must never delay or break the finalize response.
		void notifyZktRoundFinished(roundId);
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

		// Single active round per EVENT: starting a round auto-finalizes any other
		// ACTIVE round of the same event (e.g. 333 R2 start → 333 R1 finalizes,
		// with ranking + advancement carry). Other events are independent and may
		// run in parallel. The admin can still reopen R1 afterwards to edit.
		if (input.status === 'ACTIVE' && round.status !== 'ACTIVE') {
			const otherActive = await getPrisma().zktRound.findMany({
				where: {
					comp_event_id: round.comp_event_id,
					status: 'ACTIVE',
					id: {not: input.roundId},
				},
				select: {id: true},
			});
			for (const other of otherActive) {
				await this.finalizeRoundWithRecords(
					other.id,
					context.user.id,
					competitionId,
					round.comp_event.event_id
				);
			}
		}

		const updated = await getPrisma().zktRound.update({
			where: {id: input.roundId},
			data: {status: input.status},
			include: {results: true, groups: true},
		});

		// Auto-generate scrambles the first time a round becomes ACTIVE (the WCA
		// "start round" step). Idempotent — already-existing scrambles aren't
		// touched, so re-activating after a reopen is safe.
		if (input.status === 'ACTIVE' && round.status !== 'ACTIVE') {
			try {
				await ensureScramblesForRound(input.roundId);
			} catch (err) {
				console.error('[zkt-scramble] auto-gen on activate failed:', err);
			}
		}

		emitZktRoundStatusChanged(competitionId, {roundId: input.roundId, status: input.status});

		return updated;
	}

	@Authorized([Role.LOGGED_IN])
	@Query(() => [ZktScramble])
	async zktRoundScrambles(@Arg('roundId') roundId: string) {
		return getPrisma().zktScramble.findMany({
			where: {round_id: roundId},
			orderBy: [{group_id: 'asc'}, {attempt_number: 'asc'}],
		});
	}

	@Authorized([Role.LOGGED_IN])
	@Mutation(() => [ZktScramble])
	async regenerateZktScrambles(
		@Ctx() context: GraphQLContext,
		@Arg('roundId') roundId: string
	) {
		const round = await getRoundWithCompetition(roundId);
		if (!round) throw new GraphQLError(ErrorCode.NOT_FOUND);
		await assertCanModifyCompetition(context.user, round.comp_event.competition_id);

		// Refuse if any result has already been entered — regenerating mid-round
		// would invalidate everyone's scrambles. Admin must clear results first.
		const enteredCount = await getPrisma().zktResult.count({
			where: {round_id: roundId, best: {not: null}},
		});
		if (enteredCount > 0) {
			throw new GraphQLError(
				ErrorCode.BAD_INPUT,
				'Sonuçlar girilmiş, scramble yeniden üretilemez. Önce sonuçları silin.'
			);
		}

		await regenerateScramblesForRound(roundId);
		return getPrisma().zktScramble.findMany({
			where: {round_id: roundId},
			orderBy: [{group_id: 'asc'}, {attempt_number: 'asc'}],
		});
	}

	@Authorized([Role.LOGGED_IN])
	@Mutation(() => [ZktScramble])
	async ensureZktScrambles(
		@Ctx() context: GraphQLContext,
		@Arg('roundId') roundId: string
	) {
		const round = await getRoundWithCompetition(roundId);
		if (!round) throw new GraphQLError(ErrorCode.NOT_FOUND);
		await assertCanModifyCompetition(context.user, round.comp_event.competition_id);
		await ensureScramblesForRound(roundId);
		return getPrisma().zktScramble.findMany({
			where: {round_id: roundId},
			orderBy: [{group_id: 'asc'}, {attempt_number: 'asc'}],
		});
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

		// Single active round per EVENT: reopening this round must close any other
		// round of the same event that is still ACTIVE (e.g. reopen R1 → R2 closes),
		// so the admin never sees two active rounds at once. Same rule as starting
		// a round in updateZktRoundStatus.
		const otherActive = await getPrisma().zktRound.findMany({
			where: {
				comp_event_id: round.comp_event_id,
				status: 'ACTIVE',
				id: {not: roundId},
			},
			select: {id: true},
		});
		for (const other of otherActive) {
			await this.finalizeRoundWithRecords(
				other.id,
				context.user.id,
				competitionId,
				round.comp_event.event_id
			);
		}

		// Remove untouched carry rows from the next round so rankings can be
		// recomputed without phantom competitors once the admin re-finalizes.
		await revokeAdvancementCarry(roundId);

		const updated = await getPrisma().zktRound.update({
			where: {id: roundId},
			data: {status: 'ACTIVE'},
			include: {results: true, groups: true},
		});

		// Reopening drops this round out of the FINISHED set — records that were
		// applied at finalize must be recomputed without it.
		await rebuildRecordsForEvent(round.comp_event.event_id);

		emitZktRoundStatusChanged(competitionId, {roundId, status: 'ACTIVE'});
		return updated;
	}

	// Candidates that can be added to a round (wca-live AddCompetitorDialog):
	// round 1 → approved registrants of the event not yet in the round;
	// round 2+ → previous round's ranked competitors not yet in this round,
	// in ranking order (so the first entry is the next person in line).
	@Authorized([Role.LOGGED_IN])
	@Query(() => [ZktCompetitorUser])
	async zktRoundAdvancementCandidates(
		@Ctx() context: GraphQLContext,
		@Arg('roundId') roundId: string
	) {
		const round = await getRoundWithCompetition(roundId);
		if (!round) throw new GraphQLError(ErrorCode.NOT_FOUND);
		const competitionId = round.comp_event.competition_id;
		await assertCanModifyCompetition(context.user, competitionId);

		const prisma = getPrisma();
		const existing = await prisma.zktResult.findMany({
			where: {round_id: roundId},
			select: {user_id: true},
		});
		const existingIds = new Set(existing.map((e) => e.user_id));

		if (round.round_number === 1) {
			const regs = await prisma.zktRegistration.findMany({
				where: {
					competition_id: competitionId,
					status: 'APPROVED',
					events: {some: {comp_event_id: round.comp_event_id}},
				},
				include: {user: publicUserInclude},
			});
			return regs.filter((r) => !existingIds.has(r.user_id)).map((r) => r.user);
		}

		const prev = await prisma.zktRound.findFirst({
			where: {
				comp_event_id: round.comp_event_id,
				round_number: round.round_number - 1,
			},
			include: {
				results: {
					where: {ranking: {not: null}},
					orderBy: {ranking: 'asc'},
					include: {user: publicUserInclude},
				},
			},
		});
		if (!prev) return [];
		return prev.results.filter((r) => !existingIds.has(r.user_id)).map((r) => r.user);
	}

	// Late addition: create an empty result row so the competitor appears in
	// the round (same shape as the advancement carry rows).
	@Authorized([Role.LOGGED_IN])
	@Mutation(() => ZktResult)
	async addZktCompetitorToRound(
		@Ctx() context: GraphQLContext,
		@Arg('roundId') roundId: string,
		@Arg('userId') userId: string
	) {
		const round = await getRoundWithCompetition(roundId);
		if (!round) throw new GraphQLError(ErrorCode.NOT_FOUND);
		const competitionId = round.comp_event.competition_id;
		await assertCanModifyCompetition(context.user, competitionId);

		const prisma = getPrisma();
		const result = await prisma.zktResult.upsert({
			where: {round_id_user_id: {round_id: roundId, user_id: userId}},
			create: {round_id: roundId, user_id: userId, entered_by_id: context.user.id},
			update: {},
		});

		// Keep the previous round's bookkeeping consistent for round 2+.
		if (round.round_number > 1) {
			await prisma.zktResult.updateMany({
				where: {
					user_id: userId,
					round: {
						comp_event_id: round.comp_event_id,
						round_number: round.round_number - 1,
					},
				},
				data: {proceeds: true},
			});
		}

		// Keep live ranks consistent after a late addition.
		await recomputeRoundRankings(roundId);

		emitZktResultUpdated(competitionId, {roundId, resultId: result.id, userId});

		return prisma.zktResult.findUnique({
			where: {id: result.id},
			include: {user: publicUserInclude},
		});
	}

	// Quit a competitor from a round (wca-live QuitCompetitorDialog). With
	// `replaceWithNext`, the next ranked candidate from the previous round is
	// pulled in automatically so the advancement count stays full.
	@Authorized([Role.LOGGED_IN])
	@Mutation(() => Boolean)
	async quitZktCompetitorFromRound(
		@Ctx() context: GraphQLContext,
		@Arg('roundId') roundId: string,
		@Arg('userId') userId: string,
		@Arg('replaceWithNext') replaceWithNext: boolean
	) {
		const round = await getRoundWithCompetition(roundId);
		if (!round) throw new GraphQLError(ErrorCode.NOT_FOUND);
		const competitionId = round.comp_event.competition_id;
		await assertCanModifyCompetition(context.user, competitionId);

		const prisma = getPrisma();
		const result = await prisma.zktResult.findUnique({
			where: {round_id_user_id: {round_id: roundId, user_id: userId}},
		});
		if (!result) throw new GraphQLError(ErrorCode.NOT_FOUND);

		await prisma.zktResult.delete({where: {id: result.id}});

		if (round.round_number > 1) {
			await prisma.zktResult.updateMany({
				where: {
					user_id: userId,
					round: {
						comp_event_id: round.comp_event_id,
						round_number: round.round_number - 1,
					},
				},
				data: {proceeds: false},
			});
		}

		if (round.status === 'FINISHED') {
			await rebuildRecordsForEvent(round.comp_event.event_id);
		}

		// Removing a competitor shifts everyone below up — refresh live ranks.
		await recomputeRoundRankings(roundId);

		emitZktResultDeleted(competitionId, {
			roundId,
			resultId: result.id,
			userId,
		});

		// Pull in the next person in line from the previous round.
		if (replaceWithNext && round.round_number > 1) {
			const existing = await prisma.zktResult.findMany({
				where: {round_id: roundId},
				select: {user_id: true},
			});
			const existingIds = new Set(existing.map((e) => e.user_id));
			const prev = await prisma.zktRound.findFirst({
				where: {
					comp_event_id: round.comp_event_id,
					round_number: round.round_number - 1,
				},
				include: {
					results: {
						where: {ranking: {not: null}},
						orderBy: {ranking: 'asc'},
					},
				},
			});
			const candidate = prev?.results.find((r) => !existingIds.has(r.user_id));
			if (candidate) {
				const created = await prisma.zktResult.upsert({
					where: {
						round_id_user_id: {round_id: roundId, user_id: candidate.user_id},
					},
					create: {
						round_id: roundId,
						user_id: candidate.user_id,
						entered_by_id: context.user.id,
					},
					update: {},
				});
				await prisma.zktResult.update({
					where: {id: candidate.id},
					data: {proceeds: true},
				});
				emitZktResultUpdated(competitionId, {
					roundId,
					resultId: created.id,
					userId: candidate.user_id,
				});
			}
		}

		return true;
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
			user_id: input.userId ?? null,
			person_id: input.personId ?? null,
			entered_by_id: context.user.id,
		});

		// A no-show (DNF/DNS) drops the competitor to the bottom — refresh ranks.
		await recomputeRoundRankings(input.roundId);

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
		const round = await getPrisma().zktRound.create({
			data: {
				comp_event_id: input.compEventId,
				round_number: input.roundNumber,
				format: input.format,
				time_limit_cs: input.timeLimitCs ?? null,
				cutoff_cs: input.cutoffCs ?? null,
				cutoff_attempts: input.cutoffAttempts ?? null,
				advancement_type: input.advancementType ?? null,
				advancement_level: input.advancementLevel ?? null,
				group_count: input.groupCount ?? null,
			},
		});
		if (input.groupCount && input.groupCount > 0) {
			await syncRoundGroups(round.id, input.groupCount);
		}
		return round;
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
		if (input.groupCount !== undefined) data.group_count = input.groupCount;
		const round = await getPrisma().zktRound.update({
			where: {id: input.roundId},
			data,
		});
		// Materialise the group rows so the Assignments tab + auto-distribute see them.
		if (input.groupCount !== undefined && input.groupCount !== null) {
			await syncRoundGroups(input.roundId, input.groupCount);
		}
		return round;
	}

	@Authorized([Role.MOD])
	@Mutation(() => Boolean)
	async deleteZktRound(@Arg('roundId') roundId: string) {
		await getPrisma().zktRound.delete({where: {id: roundId}});
		return true;
	}
}
