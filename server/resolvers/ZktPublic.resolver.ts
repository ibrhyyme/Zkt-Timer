// Read-only GraphQL queries for viewing ZKT (Zeka Kupu Turkiye federation)
// competitions inside Zkt-Timer. Each query proxies the federation public REST
// API via ZktFederationService (Redis-cached) and returns the payload verbatim
// — the ObjectTypes mirror the federation contract field-for-field, so there is
// no transformation here. Public read (no @Authorized): the federation data is
// itself public; nav visibility is gated at the UI level, not the query.

import {Resolver, Query, Arg, Int, Ctx, Authorized} from 'type-graphql';
import {ZktFederationService} from '../services/ZktFederationService';
import {GraphQLContext} from '../@types/interfaces/server.interface';
import {getIntegration} from '../models/integration';
import {
	ZktPublicCompetitionDetail,
	ZktPublicCompetitionList,
	ZktPublicRoundResults,
	ZktPublicGroupAssignments,
	ZktPublicCompetitorDetail,
	ZktPublicMyListItem,
} from '../schemas/ZktPublic.schema';

@Resolver()
export class ZktPublicResolver {
	@Query(() => ZktPublicCompetitionList)
	async zktPublicCompetitions(
		@Arg('page', () => Int, {nullable: true}) page?: number,
		@Arg('pageSize', () => Int, {nullable: true}) pageSize?: number,
		@Arg('q', () => String, {nullable: true}) q?: string
	): Promise<ZktPublicCompetitionList> {
		return (await ZktFederationService.fetchCompetitions({page, pageSize, q})) as ZktPublicCompetitionList;
	}

	/**
	 * The viewer's own ZKT registrations. Requires login (unlike the other
	 * queries here) because the answer depends on who is asking: the WCA id
	 * comes from the viewer's own linked WCA integration, never from an
	 * argument — otherwise anyone could enumerate another person's schedule.
	 * Without a linked WCA account there is no identity to match on yet, so the
	 * list is empty rather than an error.
	 */
	@Authorized()
	@Query(() => [ZktPublicMyListItem])
	async zktPublicMyCompetitions(@Ctx() ctx: GraphQLContext): Promise<ZktPublicMyListItem[]> {
		const integration = await getIntegration(ctx.user, 'wca');
		const wcaId = integration?.wca_id;
		if (!wcaId) return [];
		const payload = (await ZktFederationService.fetchPersonCompetitions(wcaId).catch(
			() => null
		)) as {items?: ZktPublicMyListItem[]} | null;
		return payload?.items || [];
	}

	@Query(() => ZktPublicCompetitionDetail, {nullable: true})
	async zktPublicCompetition(
		@Arg('id') id: string
	): Promise<ZktPublicCompetitionDetail | null> {
		return (await ZktFederationService.fetchCompetitionDetail(id)) as ZktPublicCompetitionDetail | null;
	}

	@Query(() => ZktPublicRoundResults, {nullable: true})
	async zktPublicRoundResults(
		@Arg('competitionId') competitionId: string,
		@Arg('roundId') roundId: string
	): Promise<ZktPublicRoundResults | null> {
		return (await ZktFederationService.fetchRoundResults(
			competitionId,
			roundId
		)) as ZktPublicRoundResults | null;
	}

	@Query(() => ZktPublicGroupAssignments, {nullable: true})
	async zktPublicGroupAssignments(
		@Arg('competitionId') competitionId: string,
		@Arg('groupId') groupId: string
	): Promise<ZktPublicGroupAssignments | null> {
		return (await ZktFederationService.fetchGroupAssignments(
			competitionId,
			groupId
		)) as ZktPublicGroupAssignments | null;
	}

	@Query(() => ZktPublicCompetitorDetail, {nullable: true})
	async zktPublicCompetitor(
		@Arg('competitionId') competitionId: string,
		@Arg('key') key: string
	): Promise<ZktPublicCompetitorDetail | null> {
		return (await ZktFederationService.fetchCompetitorDetail(
			competitionId,
			key
		)) as ZktPublicCompetitorDetail | null;
	}
}
