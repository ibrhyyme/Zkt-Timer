import {Arg, Authorized, Ctx, Mutation, Query, Resolver} from 'type-graphql';
import {GraphQLContext} from '../@types/interfaces/server.interface';
import {Role} from '../middlewares/auth';
import {Integration, IntegrationTypeSchema} from '../schemas/Integration.schema';
import GraphQLError from '../util/graphql_error';
import {ErrorCode} from '../constants/errors';
import {IntegrationType} from '../../shared/integration';
import {getIntegrationGetMe, linkOAuthAccount, revokeIntegration} from '../integrations/oauth';
import {WcaAccount} from '../schemas/WcaAccount.schema';
import {getIntegration} from '../models/integration';

function getIntegrationsByUserId(context: GraphQLContext, userId: string) {
	const {prisma} = context;

	return prisma.integration.findMany({
		where: {
			user_id: userId,
		},
	});
}

function getIntegrationMe(context: GraphQLContext, intType: IntegrationType) {
	const {user} = context;
	return getIntegrationGetMe(intType, user);
}

function deleteIntegrationById(context: GraphQLContext, id: string) {
	const {prisma} = context;

	return prisma.integration.delete({
		where: {
			id,
		},
	});
}

@Resolver()
export class IntegrationResolver {
	@Authorized([Role.LOGGED_IN])
	@Query(() => Integration)
	async integration(
		@Ctx() context: GraphQLContext,
		@Arg('integrationType', () => IntegrationTypeSchema) integrationType: IntegrationType
	) {
		return getIntegration(context.user, integrationType);
	}

	@Authorized([Role.LOGGED_IN])
	@Query(() => WcaAccount)
	async wcaMe(@Ctx() context: GraphQLContext) {
		return getIntegrationMe(context, 'wca');
	}



	@Authorized([Role.LOGGED_IN])
	@Query(() => [Integration])
	async integrations(@Ctx() context: GraphQLContext) {
		return getIntegrationsByUserId(context, context.user.id);
	}

	@Authorized([Role.LOGGED_IN])
	@Mutation(() => Integration)
	async createIntegration(
		@Ctx() context: GraphQLContext,
		@Arg('integrationType', () => IntegrationTypeSchema) integrationType: IntegrationType,
		@Arg('code') code: string
	) {
		const {user} = context;
		const integration = await getIntegration(user, integrationType);
		if (integration) {
			throw new GraphQLError(ErrorCode.FORBIDDEN, 'This account is already linked');
		}

		try {
			const result = await linkOAuthAccount(integrationType, user, code);
			console.log('Integration created successfully:', typeof result === 'object' ? result?.id : 'success');
			return result;
		} catch (e) {
			console.error('createIntegration error:', e);
			throw new GraphQLError(ErrorCode.BAD_INPUT, e?.message || 'Failed to create integration');
		}
	}

	@Authorized([Role.LOGGED_IN])
	@Mutation(() => Integration)
	async updateWcaVisibility(
		@Ctx() context: GraphQLContext,
		@Arg('showCompetitions', {nullable: true}) showCompetitions?: boolean,
		@Arg('showMedals', {nullable: true}) showMedals?: boolean,
		@Arg('showRecords', {nullable: true}) showRecords?: boolean,
		@Arg('showRank', {nullable: true}) showRank?: boolean,
		@Arg('showResults', {nullable: true}) showResults?: boolean
	) {
		const {user, prisma} = context;
		const integration = await getIntegration(user, 'wca');
		if (!integration) {
			throw new GraphQLError(ErrorCode.FORBIDDEN, 'WCA account is not linked');
		}

		const data: any = {};
		if (showCompetitions !== undefined) data.wca_show_competitions = showCompetitions;
		if (showMedals !== undefined) data.wca_show_medals = showMedals;
		if (showRecords !== undefined) data.wca_show_records = showRecords;
		if (showRank !== undefined) data.wca_show_rank = showRank;
		if (showResults !== undefined) data.wca_show_results = showResults;

		return prisma.integration.update({
			where: {id: integration.id},
			data,
		});
	}

	@Authorized([Role.LOGGED_IN])
	@Mutation(() => Integration)
	async deleteIntegration(
		@Ctx() context: GraphQLContext,
		@Arg('integrationType', () => IntegrationTypeSchema) integrationType: IntegrationType
	) {
		const {user} = context;
		const integration = await getIntegration(user, integrationType);
		if (!integration) {
			throw new GraphQLError(ErrorCode.FORBIDDEN, 'This account is not linked');
		}

		await revokeIntegration(integrationType, user);
		return deleteIntegrationById(context, integration.id);
	}
}
