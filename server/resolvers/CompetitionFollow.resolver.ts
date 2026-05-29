import {Arg, Authorized, Ctx, Mutation, Query, Resolver} from 'type-graphql';
import {GraphQLContext} from '../@types/interfaces/server.interface';
import {Role} from '../middlewares/auth';
import GraphQLError from '../util/graphql_error';
import {ErrorCode} from '../constants/errors';
import {CompetitionFollow, FollowCompetitorInput} from '../schemas/CompetitionFollow.schema';
import {getPrisma} from '../database';
import {getIntegration} from '../models/integration';
import {Consts} from '../../shared/consts';
import {getWcaLiveData, fetchLiveRoundResults} from '../services/WcaLiveService';
import {logger} from '../services/logger';

@Resolver()
export class CompetitionFollowResolver {
	@Authorized([Role.LOGGED_IN])
	@Query(() => [CompetitionFollow])
	async myCompetitionFollows(
		@Ctx() context: GraphQLContext,
		@Arg('competitionId') competitionId: string
	): Promise<CompetitionFollow[]> {
		return getPrisma().competitionFollow.findMany({
			where: {
				user_id: context.user.id,
				competition_id: competitionId,
			},
			orderBy: {created_at: 'asc'},
		}) as any;
	}

	@Authorized([Role.LOGGED_IN, Role.PRO])
	@Mutation(() => CompetitionFollow)
	async followCompetitor(
		@Ctx() context: GraphQLContext,
		@Arg('input') input: FollowCompetitorInput
	): Promise<CompetitionFollow> {
		const {user} = context;
		const competitionId = input.competition_id.trim();
		const name = input.name.trim();

		if (!competitionId || !name || !Number.isFinite(input.registrant_id)) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'Invalid follow input');
		}

		// Self-follow guard: reject if user matches their own WCA account
		if (input.wca_id) {
			const myWca = await getIntegration(user, 'wca');
			if (myWca?.wca_id && myWca.wca_id === input.wca_id) {
				throw new GraphQLError(ErrorCode.BAD_INPUT, 'Cannot follow yourself');
			}
		}

		// Limit check (max 5 per competition)
		const existingCount = await getPrisma().competitionFollow.count({
			where: {
				user_id: user.id,
				competition_id: competitionId,
			},
		});

		// Existing follow check (idempotent)
		const existing = await getPrisma().competitionFollow.findUnique({
			where: {
				user_id_competition_id_followed_registrant_id: {
					user_id: user.id,
					competition_id: competitionId,
					followed_registrant_id: input.registrant_id,
				},
			},
		});

		if (existing) {
			return existing as any;
		}

		if (existingCount >= Consts.MAX_COMPETITION_FOLLOWS) {
			throw new GraphQLError(
				ErrorCode.FORBIDDEN,
				`Max ${Consts.MAX_COMPETITION_FOLLOWS} follows per competition`
			);
		}

		const created = await getPrisma().competitionFollow.create({
			data: {
				user_id: user.id,
				competition_id: competitionId,
				followed_registrant_id: input.registrant_id,
				followed_wca_id: input.wca_id ?? null,
				followed_name: name,
			},
		});

		// Backfill: mark existing/finished rounds in competition as "notification sent"
		// Otherwise, the next cron tick would send push for all past rounds (50+ notification spam)
		try {
			const liveData = await getWcaLiveData(competitionId).catch(() => null);
			if (liveData?.roundMap?.length) {
				await Promise.allSettled(
					liveData.roundMap.map(async (rm: {activityCode: string; liveRoundId: string}) => {
						const round = await fetchLiveRoundResults(rm.liveRoundId).catch(() => null);
						if (!round) return;
						const hasResults = round.results?.some((r: {best: number}) => r.best && r.best > 0);
						// Round finished OR has existing results → mark notification as sent
						if (round.finished || hasResults) {
							await getPrisma()
								.competitionFollowNotifiedRound.create({
									data: {
										follow_id: created.id,
										activity_code: rm.activityCode,
										result_notified: true,
										finish_notified: !!round.finished,
									},
								})
								.catch(() => {/* unique constraint catch — idempotent */});
						}
					}),
				);
			}
		} catch (err: any) {
			logger.warn('[CompetitionFollow] backfill failed — user may receive old notifications', {
				followId: created.id,
				err: err?.message,
			});
		}

		return created as any;
	}

	@Authorized([Role.LOGGED_IN])
	@Mutation(() => Boolean)
	async unfollowCompetitor(
		@Ctx() context: GraphQLContext,
		@Arg('id') id: string
	): Promise<boolean> {
		const follow = await getPrisma().competitionFollow.findUnique({where: {id}});
		if (!follow) {
			return true;
		}
		if (follow.user_id !== context.user.id) {
			throw new GraphQLError(ErrorCode.FORBIDDEN, 'Not your follow');
		}
		await getPrisma().competitionFollow.delete({where: {id}});
		return true;
	}
}
