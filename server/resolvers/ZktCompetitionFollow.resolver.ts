import {Arg, Authorized, Ctx, Mutation, Query, Resolver} from 'type-graphql';
import {GraphQLContext} from '../@types/interfaces/server.interface';
import {Role} from '../middlewares/auth';
import GraphQLError from '../util/graphql_error';
import {ErrorCode} from '../constants/errors';
import {ZktCompetitionFollow, FollowZktCompetitorInput} from '../schemas/ZktCompetitionFollow.schema';
import {getPrisma} from '../database';
import {Consts} from '../../shared/consts';

// "Follow a competitor" for ZKT competitions — the WCA CompetitionFollow flow
// ported to the user/person XOR identity model. Pro-gated (the bell opens the
// Pro modal for free users client-side; the mutation enforces PRO server-side).
@Resolver()
export class ZktCompetitionFollowResolver {
	@Authorized([Role.LOGGED_IN])
	@Query(() => [ZktCompetitionFollow])
	async myZktCompetitionFollows(
		@Ctx() context: GraphQLContext,
		@Arg('competitionId') competitionId: string
	): Promise<ZktCompetitionFollow[]> {
		return getPrisma().zktCompetitionFollow.findMany({
			where: {user_id: context.user.id, competition_id: competitionId},
			orderBy: {created_at: 'asc'},
		}) as any;
	}

	@Authorized([Role.LOGGED_IN, Role.PRO])
	@Mutation(() => ZktCompetitionFollow)
	async followZktCompetitor(
		@Ctx() context: GraphQLContext,
		@Arg('input') input: FollowZktCompetitorInput
	): Promise<ZktCompetitionFollow> {
		const {user} = context;
		const competitionId = input.competition_id.trim();
		const name = (input.name || '').trim();
		const followedUserId = input.followed_user_id || null;
		const followedPersonId = input.followed_person_id || null;

		// XOR: exactly one of user/person must be set
		if (
			!competitionId ||
			!name ||
			(!followedUserId && !followedPersonId) ||
			(followedUserId && followedPersonId)
		) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'Invalid follow input');
		}

		// Self-follow guard (only meaningful for account users)
		if (followedUserId && followedUserId === user.id) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'Cannot follow yourself');
		}

		// Idempotent: already following this competitor?
		const where = followedUserId
			? {
					user_id_competition_id_followed_user_id: {
						user_id: user.id,
						competition_id: competitionId,
						followed_user_id: followedUserId,
					},
				}
			: {
					user_id_competition_id_followed_person_id: {
						user_id: user.id,
						competition_id: competitionId,
						followed_person_id: followedPersonId,
					},
				};
		const existing = await getPrisma().zktCompetitionFollow.findUnique({where: where as any});
		if (existing) return existing as any;

		const existingCount = await getPrisma().zktCompetitionFollow.count({
			where: {user_id: user.id, competition_id: competitionId},
		});
		if (existingCount >= Consts.MAX_COMPETITION_FOLLOWS) {
			throw new GraphQLError(
				ErrorCode.FORBIDDEN,
				`Max ${Consts.MAX_COMPETITION_FOLLOWS} follows per competition`
			);
		}

		return getPrisma().zktCompetitionFollow.create({
			data: {
				user_id: user.id,
				competition_id: competitionId,
				followed_user_id: followedUserId,
				followed_person_id: followedPersonId,
				followed_name: name,
			},
		}) as any;
	}

	@Authorized([Role.LOGGED_IN])
	@Mutation(() => Boolean)
	async unfollowZktCompetitor(
		@Ctx() context: GraphQLContext,
		@Arg('id') id: string
	): Promise<boolean> {
		const follow = await getPrisma().zktCompetitionFollow.findUnique({where: {id}});
		if (!follow) return true;
		if (follow.user_id !== context.user.id) {
			throw new GraphQLError(ErrorCode.FORBIDDEN, 'Not your follow');
		}
		await getPrisma().zktCompetitionFollow.delete({where: {id}});
		return true;
	}
}
