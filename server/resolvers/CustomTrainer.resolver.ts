import {Arg, Authorized, Ctx, Mutation, Query, Resolver} from 'type-graphql';
import {GraphQLContext} from '../@types/interfaces/server.interface';
import {Role} from '../middlewares/auth';
import {CustomTrainer, CustomTrainerCreateInput, PaginatedCustomTrainers} from '../schemas/CustomTrainer.schema';
import {PaginationArgsInput} from '../schemas/Pagination.schema';

@Resolver()
export class CustomTrainerResolver {
	@Authorized([Role.LOGGED_IN])
	@Query(() => [CustomTrainer])
	async customTrainers(
		@Ctx() context: GraphQLContext,
		@Arg('pageArgs', {nullable: true}) pageArgs?: PaginationArgsInput
	) {
		const {prisma, user} = context;
		const page = pageArgs?.page || 0;
		const pageSize = pageArgs?.pageSize || 25;

		return prisma.customTrainer.findMany({
			where: {
				user_id: user.id,
			},
			skip: page * pageSize,
			take: pageSize,
			orderBy: {
				created_at: 'desc',
			},
		});
	}

	@Authorized([Role.LOGGED_IN])
	@Query(() => CustomTrainer, {nullable: true})
	async customTrainer(@Ctx() context: GraphQLContext, @Arg('id') id: string) {
		const {prisma, user} = context;

		return prisma.customTrainer.findFirst({
			where: {
				id,
				user_id: user.id,
			},
		});
	}

	@Authorized([Role.LOGGED_IN])
	@Mutation(() => CustomTrainer)
	async createCustomTrainer(@Ctx() context: GraphQLContext, @Arg('input') input: CustomTrainerCreateInput) {
		const {prisma, user} = context;

		return prisma.customTrainer.create({
			data: {
				...input,
				user_id: user.id,
			},
		});
	}

	@Authorized([Role.LOGGED_IN])
	@Mutation(() => CustomTrainer)
	async updateCustomTrainer(
		@Ctx() context: GraphQLContext,
		@Arg('id') id: string,
		@Arg('input') input: CustomTrainerCreateInput
	) {
		const {prisma, user} = context;

		return prisma.customTrainer.update({
			where: {
				id,
				user_id: user.id,
			},
			data: {
				...input,
			},
		});
	}

	@Authorized([Role.LOGGED_IN])
	@Mutation(() => CustomTrainer)
	async deleteCustomTrainer(@Ctx() context: GraphQLContext, @Arg('id') id: string) {
		const {prisma, user} = context;

		return prisma.customTrainer.delete({
			where: {
				id,
				user_id: user.id,
			},
		});
	}
}
