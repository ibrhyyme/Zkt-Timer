import {Arg, Authorized, Ctx, Mutation, Query, Resolver} from 'type-graphql';
import {GraphQLContext} from '../@types/interfaces/server.interface';
import {Role} from '../middlewares/auth';
import {CustomTrainer, CustomTrainerCreateInput, PaginatedCustomTrainers} from '../schemas/CustomTrainer.schema';
import {PaginationArgsInput} from '../schemas/Pagination.schema';
import GraphQLError from '../util/graphql_error';
import {ErrorCode} from '../constants/errors';

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

		// updateMany, not update: Prisma's `update` takes a UNIQUE selector, and
		// `CustomTrainerWhereUniqueInput` only accepts `id`. Passing `user_id` there
		// threw a validation error on every call, so this mutation never once
		// succeeded. The ownership filter has to stay on the write itself — dropping
		// it to satisfy the type would let anyone edit any trainer by id — and
		// updateMany is the form that accepts a non-unique filter.
		const {count} = await prisma.customTrainer.updateMany({
			where: {
				id,
				user_id: user.id,
			},
			data: {
				...input,
			},
		});

		// Missing and not-yours are answered identically, so the error cannot be used
		// to probe which ids exist.
		if (!count) {
			throw new GraphQLError(ErrorCode.NOT_FOUND, 'Custom trainer not found');
		}

		return prisma.customTrainer.findUnique({where: {id}});
	}

	@Authorized([Role.LOGGED_IN])
	@Mutation(() => CustomTrainer)
	async deleteCustomTrainer(@Ctx() context: GraphQLContext, @Arg('id') id: string) {
		const {prisma, user} = context;

		// Same constraint as the update above. Read the row first because the
		// mutation returns it, then delete through an owner-scoped filter so the
		// write itself is still guarded.
		const existing = await prisma.customTrainer.findFirst({
			where: {
				id,
				user_id: user.id,
			},
		});

		if (!existing) {
			throw new GraphQLError(ErrorCode.NOT_FOUND, 'Custom trainer not found');
		}

		await prisma.customTrainer.deleteMany({
			where: {
				id,
				user_id: user.id,
			},
		});

		return existing;
	}
}
