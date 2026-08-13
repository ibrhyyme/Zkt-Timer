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
import {getMyZktProfile, getPublicZktProfile} from '../models/zkt_profile';
import {PublicZktProfile} from '../schemas/PublicZktProfile.schema';
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
	 * queries here) because the answer depends on who is asking: the identity
	 * comes from the viewer's own linked integrations, never from an argument —
	 * otherwise anyone could enumerate another person's schedule.
	 *
	 * The ZKT link is the ONLY identity accepted here, mirroring how the WCA list
	 * needs a WCA link. There used to be a WCA-id fallback, and it made unlinking
	 * a no-op: the viewer disconnected ZKT and their registrations kept showing up
	 * under "My competitions" because the WCA id still matched federation-side.
	 * Linking is the switch that turns this list on, unlinking turns it off.
	 *
	 * Without the link there is nothing to match on, so the list is empty rather
	 * than an error.
	 */
	@Authorized()
	@Query(() => [ZktPublicMyListItem])
	async zktPublicMyCompetitions(@Ctx() ctx: GraphQLContext): Promise<ZktPublicMyListItem[]> {
		const zktIntegration = await getIntegration(ctx.user, 'zkt');
		const personKey = zktIntegration?.zkt_id || null;
		if (!personKey) return [];
		const payload = (await ZktFederationService.fetchPersonCompetitions(personKey).catch(
			() => null
		)) as {items?: ZktPublicMyListItem[]} | null;
		return payload?.items || [];
	}

	/**
	 * A user's public ZKT career summary for their profile — the federation
	 * counterpart of `publicWcaProfile`. Sections the owner switched off come
	 * back null, so hidden data never reaches another viewer's browser.
	 */
	@Query(() => PublicZktProfile, {nullable: true})
	async publicZktProfile(
		@Arg('userId', {nullable: true}) userId?: string
	): Promise<PublicZktProfile | null> {
		if (!userId) return null;
		return getPublicZktProfile(userId);
	}

	/**
	 * The viewer's OWN ZKT profile with every section present regardless of its
	 * switch — the manage panel has to show what a hidden section holds.
	 */
	@Authorized()
	@Query(() => PublicZktProfile, {nullable: true})
	async myZktProfile(@Ctx() ctx: GraphQLContext): Promise<PublicZktProfile | null> {
		return getMyZktProfile(ctx.user.id);
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
