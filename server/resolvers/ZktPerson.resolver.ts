import {Arg, Authorized, Ctx, Mutation, Query, Resolver} from 'type-graphql';
import {GraphQLContext} from '../@types/interfaces/server.interface';
import {Role} from '../middlewares/auth';
import GraphQLError from '../util/graphql_error';
import {ErrorCode} from '../constants/errors';
import {
	ZktPerson,
	ImportZktCompetitorsInput,
	AddZktPersonInput,
	UpdateZktPersonInput,
} from '../schemas/ZktCompetition.schema';
import {getPrisma} from '../database';
import {assertCanModifyCompetition} from '../models/zkt_competition';
import {
	importZktCompetitors,
	createZktPerson,
	updateZktPerson,
	deleteZktPerson,
} from '../models/zkt_person';

@Resolver()
export class ZktPersonResolver {
	@Authorized([Role.LOGGED_IN])
	@Query(() => [ZktPerson])
	async zktCompetitionPersons(@Arg('competitionId') competitionId: string) {
		return getPrisma().zktPerson.findMany({
			where: {competition_id: competitionId},
			orderBy: {created_at: 'asc'},
		});
	}

	@Authorized([Role.LOGGED_IN])
	@Mutation(() => [ZktPerson])
	async importZktCompetitors(
		@Ctx() context: GraphQLContext,
		@Arg('input') input: ImportZktCompetitorsInput
	) {
		await assertCanModifyCompetition(context.user, input.competitionId);
		return importZktCompetitors(input.competitionId, input.rows);
	}

	@Authorized([Role.LOGGED_IN])
	@Mutation(() => ZktPerson)
	async addZktPerson(@Ctx() context: GraphQLContext, @Arg('input') input: AddZktPersonInput) {
		await assertCanModifyCompetition(context.user, input.competitionId);
		return createZktPerson(input.competitionId, {
			firstName: input.firstName,
			lastName: input.lastName,
			country: input.country,
			wcaId: input.wcaId,
			externalId: input.externalId,
			gender: input.gender,
			eventIds: input.eventIds,
		});
	}

	@Authorized([Role.LOGGED_IN])
	@Mutation(() => ZktPerson)
	async updateZktPerson(
		@Ctx() context: GraphQLContext,
		@Arg('input') input: UpdateZktPersonInput
	) {
		const person = await getPrisma().zktPerson.findUnique({where: {id: input.personId}});
		if (!person) throw new GraphQLError(ErrorCode.NOT_FOUND);
		await assertCanModifyCompetition(context.user, person.competition_id);
		return updateZktPerson(input.personId, input);
	}

	@Authorized([Role.LOGGED_IN])
	@Mutation(() => Boolean)
	async deleteZktPerson(@Ctx() context: GraphQLContext, @Arg('personId') personId: string) {
		const person = await getPrisma().zktPerson.findUnique({where: {id: personId}});
		if (!person) throw new GraphQLError(ErrorCode.NOT_FOUND);
		await assertCanModifyCompetition(context.user, person.competition_id);
		await deleteZktPerson(personId);
		return true;
	}
}
