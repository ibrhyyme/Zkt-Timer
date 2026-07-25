// Read-only GraphQL queries for viewing ZKT (Zeka Kupu Turkiye federation)
// competitions inside Zkt-Timer. Each query proxies the federation public REST
// API via ZktFederationService (Redis-cached) and returns the payload verbatim
// — the ObjectTypes mirror the federation contract field-for-field, so there is
// no transformation here. Public read (no @Authorized): the federation data is
// itself public; nav visibility is gated at the UI level, not the query.

import {Resolver, Query, Arg, Int} from 'type-graphql';
import {ZktFederationService} from '../services/ZktFederationService';
import {
	ZktPublicCompetitionDetail,
	ZktPublicCompetitionList,
	ZktPublicRoundResults,
	ZktPublicGroupAssignments,
	ZktPublicCompetitorDetail,
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
