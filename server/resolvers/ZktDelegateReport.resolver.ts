import {Arg, Authorized, Ctx, Mutation, Query, Resolver} from 'type-graphql';
import {GraphQLContext} from '../@types/interfaces/server.interface';
import {Role} from '../middlewares/auth';
import GraphQLError from '../util/graphql_error';
import {ErrorCode} from '../constants/errors';
import {
	ZktDelegateReport,
	ZktIncident,
	UpsertZktDelegateReportInput,
	CreateZktIncidentInput,
	UpdateZktIncidentInput,
} from '../schemas/ZktCompetition.schema';
import {getPrisma} from '../database';
import {
	assertCanModifyCompetition,
	publicUserInclude,
} from '../models/zkt_competition';

@Resolver()
export class ZktDelegateReportResolver {
	@Authorized([Role.LOGGED_IN])
	@Query(() => ZktDelegateReport, {nullable: true})
	async zktDelegateReport(
		@Ctx() context: GraphQLContext,
		@Arg('competitionId') competitionId: string
	) {
		await assertCanModifyCompetition(context.user, competitionId);
		return getPrisma().zktDelegateReport.findUnique({
			where: {competition_id: competitionId},
			include: {submitted_by: publicUserInclude},
		});
	}

	@Authorized([Role.LOGGED_IN])
	@Mutation(() => ZktDelegateReport)
	async upsertZktDelegateReport(
		@Ctx() context: GraphQLContext,
		@Arg('input') input: UpsertZktDelegateReportInput
	) {
		await assertCanModifyCompetition(context.user, input.competitionId);

		const data = {
			summary: input.summary ?? null,
			venue_notes: input.venueNotes ?? null,
			organization_notes: input.organizationNotes ?? null,
			incidents_summary: input.incidentsSummary ?? null,
			remarks: input.remarks ?? null,
		};

		return getPrisma().zktDelegateReport.upsert({
			where: {competition_id: input.competitionId},
			create: {competition_id: input.competitionId, ...data},
			update: data,
			include: {submitted_by: publicUserInclude},
		});
	}

	@Authorized([Role.LOGGED_IN])
	@Mutation(() => ZktDelegateReport)
	async submitZktDelegateReport(
		@Ctx() context: GraphQLContext,
		@Arg('competitionId') competitionId: string
	) {
		await assertCanModifyCompetition(context.user, competitionId);
		const report = await getPrisma().zktDelegateReport.findUnique({
			where: {competition_id: competitionId},
		});
		if (!report) {
			throw new GraphQLError(ErrorCode.NOT_FOUND, 'Report does not exist yet');
		}
		return getPrisma().zktDelegateReport.update({
			where: {competition_id: competitionId},
			data: {
				submitted_by_id: context.user.id,
				submitted_at: new Date(),
			},
			include: {submitted_by: publicUserInclude},
		});
	}

	@Authorized([Role.LOGGED_IN])
	@Query(() => [ZktIncident])
	async zktIncidents(
		@Ctx() context: GraphQLContext,
		@Arg('competitionId') competitionId: string
	) {
		await assertCanModifyCompetition(context.user, competitionId);
		return getPrisma().zktIncident.findMany({
			where: {competition_id: competitionId},
			orderBy: {created_at: 'desc'},
			include: {created_by: publicUserInclude},
		});
	}

	@Authorized([Role.LOGGED_IN])
	@Mutation(() => ZktIncident)
	async createZktIncident(
		@Ctx() context: GraphQLContext,
		@Arg('input') input: CreateZktIncidentInput
	) {
		await assertCanModifyCompetition(context.user, input.competitionId);
		return getPrisma().zktIncident.create({
			data: {
				competition_id: input.competitionId,
				title: input.title,
				description: input.description,
				tags: input.tags ?? [],
				result_id: input.resultId ?? null,
				created_by_id: context.user.id,
			},
			include: {created_by: publicUserInclude},
		});
	}

	@Authorized([Role.LOGGED_IN])
	@Mutation(() => ZktIncident)
	async updateZktIncident(
		@Ctx() context: GraphQLContext,
		@Arg('input') input: UpdateZktIncidentInput
	) {
		const existing = await getPrisma().zktIncident.findUnique({
			where: {id: input.id},
		});
		if (!existing) throw new GraphQLError(ErrorCode.NOT_FOUND);
		await assertCanModifyCompetition(context.user, existing.competition_id);

		const data: any = {};
		if (input.title !== undefined) data.title = input.title;
		if (input.description !== undefined) data.description = input.description;
		if (input.tags !== undefined) data.tags = input.tags;
		if (input.markResolved) data.resolved_at = new Date();

		return getPrisma().zktIncident.update({
			where: {id: input.id},
			data,
			include: {created_by: publicUserInclude},
		});
	}

	@Authorized([Role.LOGGED_IN])
	@Mutation(() => Boolean)
	async deleteZktIncident(
		@Ctx() context: GraphQLContext,
		@Arg('id') id: string
	) {
		const existing = await getPrisma().zktIncident.findUnique({
			where: {id},
		});
		if (!existing) throw new GraphQLError(ErrorCode.NOT_FOUND);
		await assertCanModifyCompetition(context.user, existing.competition_id);

		await getPrisma().zktIncident.delete({where: {id}});
		return true;
	}
}
