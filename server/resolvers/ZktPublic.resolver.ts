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
import {PublicZktProfile, ZktEventPb} from '../schemas/PublicZktProfile.schema';
import {getPrisma} from '../database';
import {
	ZktPublicCompetitionDetail,
	ZktPublicCompetitionList,
	ZktPublicRoundResults,
	ZktPublicGroupAssignments,
	ZktPublicCompetitorDetail,
	ZktPublicMyListItem,
} from '../schemas/ZktPublic.schema';
import {federationUnavailableError} from '../util/federation_error';

// Every read below goes through the federation cache, which serves the last
// good value while the federation is slow or refusing. What still fails had
// never been fetched; it reaches the client as UPSTREAM_UNAVAILABLE so the page
// retries instead of showing a server error.
async function federationRead<T>(surface: string, read: () => Promise<T>): Promise<T> {
	try {
		return await read();
	} catch (err) {
		throw federationUnavailableError(err, {surface});
	}
}

@Resolver()
export class ZktPublicResolver {
	@Query(() => ZktPublicCompetitionList)
	async zktPublicCompetitions(
		@Arg('page', () => Int, {nullable: true}) page?: number,
		@Arg('pageSize', () => Int, {nullable: true}) pageSize?: number,
		@Arg('q', () => String, {nullable: true}) q?: string
	): Promise<ZktPublicCompetitionList> {
		return (await federationRead('list', () =>
			ZktFederationService.fetchCompetitions({page, pageSize, q})
		)) as ZktPublicCompetitionList;
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
		// A failure is an error, not an empty list: answering [] made the viewer's
		// own registered competition vanish from "My competitions" while the
		// federation was refusing us, and the client replaced what it showed.
		const payload = (await federationRead('my_competitions', () =>
			ZktFederationService.fetchPersonCompetitions(personKey)
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
		return (await federationRead('detail', () =>
			ZktFederationService.fetchCompetitionDetail(id)
		)) as ZktPublicCompetitionDetail | null;
	}

	@Query(() => ZktPublicRoundResults, {nullable: true})
	async zktPublicRoundResults(
		@Arg('competitionId') competitionId: string,
		@Arg('roundId') roundId: string
	): Promise<ZktPublicRoundResults | null> {
		return (await federationRead('round_results', () =>
			ZktFederationService.fetchRoundResults(competitionId, roundId)
		)) as ZktPublicRoundResults | null;
	}

	@Query(() => ZktPublicGroupAssignments, {nullable: true})
	async zktPublicGroupAssignments(
		@Arg('competitionId') competitionId: string,
		@Arg('groupId') groupId: string
	): Promise<ZktPublicGroupAssignments | null> {
		return (await federationRead('group', () =>
			ZktFederationService.fetchGroupAssignments(competitionId, groupId)
		)) as ZktPublicGroupAssignments | null;
	}

	@Query(() => ZktPublicCompetitorDetail, {nullable: true})
	async zktPublicCompetitor(
		@Arg('competitionId') competitionId: string,
		@Arg('key') key: string
	): Promise<ZktPublicCompetitorDetail | null> {
		return (await federationRead('competitor', () =>
			ZktFederationService.fetchCompetitorDetail(competitionId, key)
		)) as ZktPublicCompetitorDetail | null;
	}

	/**
	 * A competitor's ZKT personal records (best single and average per event),
	 * behind the "personal records" button on a ZKT competition page. The
	 * competition's own WCIF only carries the bests set at that competition, which
	 * read as records and were not. Same login requirement as the competition
	 * pages it serves. A member who switched their records off in Zkt-Timer gets
	 * null here too, though the federation itself publishes them.
	 */
	@Authorized()
	@Query(() => [ZktEventPb], {nullable: true})
	async zktPersonBests(@Arg('zktId') zktId: string): Promise<ZktEventPb[] | null> {
		const id = (zktId || '').trim().toUpperCase();
		if (!/^\d{4}[A-Z]{4}\d{2}$/.test(id)) return null;
		const hidden = await getPrisma().integration.findFirst({
			where: {service_name: 'zkt', zkt_id: id, zkt_show_pbs: false},
			select: {id: true},
		});
		if (hidden) return null;
		const summary = (await federationRead('person_bests', () =>
			ZktFederationService.fetchPersonSummary(id)
		)) as {personalBests?: {eventId: string; single?: string | null; average?: string | null}[]} | null;
		if (!summary) return null;
		return (summary.personalBests || []).map((pb) => ({
			event_id: pb.eventId,
			single: pb.single ?? undefined,
			average: pb.average ?? undefined,
		}));
	}
}
