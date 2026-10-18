import {Arg, Authorized, Ctx, Int, Mutation, Query, Resolver} from 'type-graphql';
import {GraphQLContext} from '../@types/interfaces/server.interface';
import {Role} from '../middlewares/auth';
import {PaginatedTrainerAlternatives, TrainerAlternative} from '../schemas/TrainerAlternative.schema';

// The shared pool of user-added alternatives. Adding was closed when the served library grew to
// thousands of alternatives; the rows already added are still listed and admins can delete them.
@Resolver()
export class TrainerAlternativeResolver {
	@Authorized([Role.LOGGED_IN])
	@Query(() => [TrainerAlternative])
	async trainerAlternatives(
		@Ctx() context: GraphQLContext,
		@Arg('category') category: string,
		@Arg('caseName') caseName: string
	) {
		const {prisma} = context;

		return prisma.trainerAlternative.findMany({
			where: {
				category,
				case_name: caseName,
			},
			orderBy: {
				created_at: 'asc',
			},
		});
	}

	@Authorized([Role.ADMIN])
	@Query(() => PaginatedTrainerAlternatives)
	async adminTrainerAlternatives(
		@Ctx() context: GraphQLContext,
		@Arg('category', {nullable: true}) category?: string,
		@Arg('page', () => Int, {nullable: true, defaultValue: 0}) page?: number,
		@Arg('pageSize', () => Int, {nullable: true, defaultValue: 25}) pageSize?: number
	) {
		const {prisma} = context;

		const where = category ? {category} : {};

		const [items, total] = await Promise.all([
			prisma.trainerAlternative.findMany({
				where,
				skip: page * pageSize,
				take: pageSize,
				orderBy: {created_at: 'desc'},
			}),
			prisma.trainerAlternative.count({where}),
		]);

		return {
			items,
			total,
			hasMore: (page + 1) * pageSize < total,
		};
	}

	@Authorized([Role.ADMIN])
	@Mutation(() => TrainerAlternative)
	async adminDeleteTrainerAlternative(@Ctx() context: GraphQLContext, @Arg('id') id: string) {
		const {prisma} = context;

		return prisma.trainerAlternative.delete({
			where: {id},
		});
	}
}
