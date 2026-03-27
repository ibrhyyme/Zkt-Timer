import {Authorized, Ctx, Query, Resolver} from 'type-graphql';
import {GraphQLContext} from '../@types/interfaces/server.interface';
import {Role} from '../middlewares/auth';
import {Stats} from '../schemas/Stats.schema';


export async function getStatsByUserId(context: GraphQLContext, userId: string) {
	const {prisma, user} = context;

	const promises = await Promise.all([
		prisma.friendship.count({
			where: {
				user_id: userId,
			},
		}),
		prisma.profileView.count({
			where: {
				profile_user_id: user.id,
			},
		}),
		prisma.solveView.count({
			where: {
				user_id: userId,
			},
		}),
	]);

	const friendCount = promises[0];
	let profileViews = promises[1];
	let solveViews = promises[2];

	return {
		friend_count: friendCount,
		profile_views: profileViews,
		solve_views: solveViews,
	};
}

@Resolver()
export class StatsResolver {
	@Authorized([Role.LOGGED_IN])
	@Query(() => Stats)
	async stats(@Ctx() context: GraphQLContext) {
		return getStatsByUserId(context, context.user.id);
	}
}
