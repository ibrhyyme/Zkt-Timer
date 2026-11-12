import {Arg, Authorized, Ctx, Int, Mutation, Query, Resolver} from 'type-graphql';
import {GraphQLContext} from '../@types/interfaces/server.interface';
import {Role} from '../middlewares/auth';
import GraphQLError from '../util/graphql_error';
import {ErrorCode} from '../constants/errors';
import {getPrisma} from '../database';
import {
	CompetitionProCampaignInfo,
	CompetitionProCampaignInput,
	CompetitionProGiftInfo,
	ProGiftCompetitionOption,
} from '../schemas/CompetitionProGift.schema';
import {fetchGiftCompetitions, FederationGiftCompetition} from '../services/competition_pro_gift';

// Admin side of the competition Pro gift (admin > Promo > Competition). The
// hand-out itself runs in the cron (services/competition_pro_gift.ts); here the
// admin only attaches a gift to a competition and reads what happened.

const MAX_DAYS = 365;

function isPublished(c: FederationGiftCompetition): boolean {
	return c.status === 'PUBLISHED' || c.results_published_at !== null;
}

function validDays(n: number): boolean {
	return Number.isInteger(n) && n >= 1 && n <= MAX_DAYS;
}

async function federationCompetitions(): Promise<FederationGiftCompetition[]> {
	try {
		return await fetchGiftCompetitions();
	} catch {
		throw new GraphQLError(ErrorCode.INTERNAL_SERVER_ERROR, 'federation_unreachable');
	}
}

@Resolver()
export class CompetitionProGiftResolver {
	/** Competitions from the federation, newest results last, each with its gift if it has one. */
	@Authorized([Role.ADMIN])
	@Query(() => [ProGiftCompetitionOption])
	async proGiftCompetitions(): Promise<ProGiftCompetitionOption[]> {
		const comps = await federationCompetitions();
		const campaigns = await getPrisma().competitionProCampaign.findMany({
			where: {zkt_competition_id: {in: comps.map((c) => c.id)}},
			select: {id: true, zkt_competition_id: true},
		});
		const byComp = new Map(campaigns.map((c) => [c.zkt_competition_id, c.id]));
		return comps.map((c) => ({
			zkt_competition_id: c.id,
			slug: c.slug ?? undefined,
			name: c.name,
			date_start: c.date_start,
			date_end: c.date_end,
			status: c.status,
			results_published: isPublished(c),
			campaign_id: byComp.get(c.id),
		}));
	}

	@Authorized([Role.ADMIN])
	@Query(() => [CompetitionProCampaignInfo])
	async competitionProCampaigns(): Promise<CompetitionProCampaignInfo[]> {
		const prisma = getPrisma();
		const campaigns = await prisma.competitionProCampaign.findMany({orderBy: {competition_date: 'desc'}});
		const counts = await prisma.competitionProGift.groupBy({
			by: ['campaign_id', 'status'],
			_count: {_all: true},
		});
		return campaigns.map((c) => {
			let granted = 0;
			let waiting = 0;
			let other = 0;
			for (const row of counts) {
				if (row.campaign_id !== c.id) continue;
				if (row.status === 'granted') granted += row._count._all;
				else if (row.status === 'pending_link' || row.status === 'deferred_store') waiting += row._count._all;
				else other += row._count._all;
			}
			return {
				...c,
				competition_slug: c.competition_slug ?? undefined,
				processed_at: c.processed_at ?? undefined,
				granted_count: granted,
				waiting_count: waiting,
				other_count: other,
			};
		});
	}

	@Authorized([Role.ADMIN])
	@Query(() => [CompetitionProGiftInfo])
	async competitionProGifts(@Arg('campaignId') campaignId: string): Promise<CompetitionProGiftInfo[]> {
		const gifts = await getPrisma().competitionProGift.findMany({
			where: {campaign_id: campaignId},
			orderBy: [{status: 'asc'}, {name: 'asc'}],
			include: {user: {select: {username: true}}},
		});
		return gifts.map((g) => ({
			id: g.id,
			name: g.name,
			username: g.user?.username ?? undefined,
			kind: g.kind,
			days: g.days,
			status: g.status,
			skip_reason: g.skip_reason ?? undefined,
			granted_at: g.granted_at ?? undefined,
			pro_until: g.pro_until ?? undefined,
		}));
	}

	/** Attach a gift. Only to a real competition whose results are not out yet. */
	@Authorized([Role.ADMIN])
	@Mutation(() => Boolean)
	async createCompetitionProCampaign(
		@Ctx() context: GraphQLContext,
		@Arg('input') input: CompetitionProCampaignInput
	): Promise<boolean> {
		if (!validDays(input.newcomer_days) || !validDays(input.returning_days)) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'invalid_days');
		}
		const comp = (await federationCompetitions()).find((c) => c.id === input.zkt_competition_id);
		if (!comp) throw new GraphQLError(ErrorCode.NOT_FOUND, 'competition_not_found');
		if (isPublished(comp)) throw new GraphQLError(ErrorCode.FORBIDDEN, 'results_already_published');

		const prisma = getPrisma();
		const existing = await prisma.competitionProCampaign.findUnique({where: {zkt_competition_id: comp.id}});
		if (existing) throw new GraphQLError(ErrorCode.BAD_INPUT, 'campaign_exists');

		await prisma.competitionProCampaign.create({
			data: {
				zkt_competition_id: comp.id,
				competition_slug: comp.slug,
				competition_name: comp.name,
				competition_date: new Date(`${comp.date_start}T00:00:00Z`),
				newcomer_days: input.newcomer_days,
				returning_days: input.returning_days,
				created_by_id: context.user.id,
			},
		});
		return true;
	}

	/** Change the days. Locked once the results have been seen: everyone gets what was announced. */
	@Authorized([Role.ADMIN])
	@Mutation(() => Boolean)
	async updateCompetitionProCampaign(
		@Arg('id') id: string,
		@Arg('newcomerDays', () => Int) newcomerDays: number,
		@Arg('returningDays', () => Int) returningDays: number
	): Promise<boolean> {
		if (!validDays(newcomerDays) || !validDays(returningDays)) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'invalid_days');
		}
		const res = await getPrisma().competitionProCampaign.updateMany({
			where: {id, status: 'armed'},
			data: {newcomer_days: newcomerDays, returning_days: returningDays},
		});
		if (res.count === 0) throw new GraphQLError(ErrorCode.FORBIDDEN, 'campaign_locked');
		return true;
	}

	/** Remove a gift that has not started handing out. A processed one stays as the record. */
	@Authorized([Role.ADMIN])
	@Mutation(() => Boolean)
	async deleteCompetitionProCampaign(@Arg('id') id: string): Promise<boolean> {
		const res = await getPrisma().competitionProCampaign.deleteMany({where: {id, status: 'armed'}});
		if (res.count === 0) throw new GraphQLError(ErrorCode.FORBIDDEN, 'campaign_locked');
		return true;
	}
}
