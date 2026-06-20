import {Arg, Authorized, Ctx, Int, Mutation, Query, Resolver} from 'type-graphql';
import {GraphQLContext} from '../@types/interfaces/server.interface';
import {Role} from '../middlewares/auth';
import GraphQLError from '../util/graphql_error';
import {ErrorCode} from '../constants/errors';
import {
	ZktPerson,
	ImportZktCompetitorsInput,
	AddZktPersonInput,
	AddZktStaffInput,
	UpdateZktPersonInput,
} from '../schemas/ZktCompetition.schema';
import {getPrisma} from '../database';
import {assertCanModifyCompetition} from '../models/zkt_competition';
import {
	importZktCompetitors,
	createZktPerson,
	updateZktPerson,
	deleteZktPerson,
	titleCaseName,
} from '../models/zkt_person';

@Resolver()
export class ZktPersonResolver {
	@Authorized([Role.LOGGED_IN])
	@Query(() => [ZktPerson])
	async zktCompetitionPersons(@Arg('competitionId') competitionId: string) {
		// Competitor ghost persons only — staff pool members are excluded.
		return getPrisma().zktPerson.findMany({
			where: {competition_id: competitionId, is_staff: false},
			orderBy: {created_at: 'asc'},
		});
	}

	// Account-less staff pool (judges/scramblers/runners) for this competition.
	@Authorized([Role.LOGGED_IN])
	@Query(() => [ZktPerson])
	async zktCompetitionStaff(@Arg('competitionId') competitionId: string) {
		return getPrisma().zktPerson.findMany({
			where: {competition_id: competitionId, is_staff: true},
			orderBy: {created_at: 'asc'},
		});
	}

	@Authorized([Role.LOGGED_IN])
	@Mutation(() => ZktPerson)
	async addZktStaff(@Ctx() context: GraphQLContext, @Arg('input') input: AddZktStaffInput) {
		await assertCanModifyCompetition(context.user, input.competitionId);
		return getPrisma().zktPerson.create({
			data: {
				competition_id: input.competitionId,
				first_name: input.firstName.trim(),
				last_name: input.lastName.trim(),
				country_code: input.country?.trim() || 'TR',
				is_staff: true,
			},
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

	// One-shot cleanup: re-title-case every account-less competitor name in a
	// competition (fixes ALL-CAPS / lowercase imports). Returns the count fixed.
	@Authorized([Role.LOGGED_IN])
	@Mutation(() => Int)
	async normalizeZktCompetitionNames(
		@Ctx() context: GraphQLContext,
		@Arg('competitionId') competitionId: string
	) {
		await assertCanModifyCompetition(context.user, competitionId);
		const persons = await getPrisma().zktPerson.findMany({
			where: {competition_id: competitionId},
		});
		let updated = 0;
		for (const p of persons) {
			const fn = titleCaseName(p.first_name);
			const ln = titleCaseName(p.last_name);
			if (fn !== p.first_name || ln !== p.last_name) {
				await getPrisma().zktPerson.update({
					where: {id: p.id},
					data: {first_name: fn, last_name: ln},
				});
				updated++;
			}
		}
		return updated;
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
