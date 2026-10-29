import {Arg, Authorized, Ctx, Query, Resolver} from 'type-graphql';
import {GraphQLContext} from '../@types/interfaces/server.interface';
import {Role} from '../middlewares/auth';
import GraphQLError from '../util/graphql_error';
import {ErrorCode} from '../constants/errors';
import {canViewRegistrationWatch} from '../util/registration_watch_access';
import {unstaffedRegistrationIds} from '../services/RegistrationWatch';
import {
	RegistrationWatchCompetitionRow,
	RegistrationWatchDetail,
} from '../schemas/RegistrationWatch.schema';

/** NOT_FOUND rather than FORBIDDEN, so an admin outside the allowlist learns nothing. */
function checkViewer(ctx: GraphQLContext) {
	if (!canViewRegistrationWatch(ctx.user)) {
		throw new GraphQLError(ErrorCode.NOT_FOUND);
	}
}

function day(d: Date): string {
	return d.toISOString().slice(0, 10);
}

@Resolver()
export class RegistrationWatchResolver {
	/** Lets the admin shell decide whether to show the tab. */
	@Authorized([Role.ADMIN])
	@Query(() => Boolean)
	registrationWatchAccess(@Ctx() ctx: GraphQLContext): boolean {
		return canViewRegistrationWatch(ctx.user);
	}

	@Authorized([Role.ADMIN])
	@Query(() => [RegistrationWatchCompetitionRow])
	async registrationWatchCompetitions(@Ctx() ctx: GraphQLContext): Promise<RegistrationWatchCompetitionRow[]> {
		checkViewer(ctx);
		const prisma = ctx.prisma;
		const [comps, accepted, events, flagged] = await Promise.all([
			prisma.registrationWatchCompetition.findMany({orderBy: {start_date: 'desc'}}),
			prisma.registrationWatchRegistrant.groupBy({by: ['competition_id'], _count: {_all: true}}),
			prisma.registrationWatchEvent.groupBy({
				by: ['competition_id'],
				_count: {_all: true},
				_max: {observed_at: true},
			}),
			prisma.registrationWatchEvent.groupBy({
				by: ['competition_id'],
				where: {OR: [{after_close: true}, {after_groups: true}]},
				_count: {_all: true},
			}),
		]);
		const acceptedBy = new Map(accepted.map((r) => [r.competition_id, r._count._all]));
		const eventsBy = new Map(events.map((r) => [r.competition_id, r]));
		const flaggedBy = new Map(flagged.map((r) => [r.competition_id, r._count._all]));

		return comps.map((c) => ({
			competition_id: c.competition_id,
			name: c.name,
			start_date: day(c.start_date),
			end_date: day(c.end_date),
			registration_close: c.registration_close ?? undefined,
			competitor_limit: c.competitor_limit ?? undefined,
			accepted_count: acceptedBy.get(c.competition_id) ?? 0,
			event_count: eventsBy.get(c.competition_id)?._count._all ?? 0,
			flagged_count: flaggedBy.get(c.competition_id) ?? 0,
			last_event_at: eventsBy.get(c.competition_id)?._max.observed_at ?? undefined,
			baseline_at: c.baseline_at ?? undefined,
			confirmed_at: c.confirmed_at ?? undefined,
			groups_seen_at: c.groups_seen_at ?? undefined,
		}));
	}

	@Authorized([Role.ADMIN])
	@Query(() => RegistrationWatchDetail, {nullable: true})
	async registrationWatchCompetition(
		@Arg('competitionId') competitionId: string,
		@Ctx() ctx: GraphQLContext
	): Promise<RegistrationWatchDetail | null> {
		checkViewer(ctx);
		const prisma = ctx.prisma;
		const comp = await prisma.registrationWatchCompetition.findUnique({where: {competition_id: competitionId}});
		if (!comp) return null;

		const [events, registrants] = await Promise.all([
			prisma.registrationWatchEvent.findMany({
				where: {competition_id: competitionId},
				orderBy: [{observed_at: 'desc'}, {registrant_id: 'asc'}],
			}),
			prisma.registrationWatchRegistrant.findMany({
				where: {competition_id: competitionId},
				orderBy: {registrant_id: 'asc'},
			}),
		]);

		const unstaffed = unstaffedRegistrationIds(
			registrants.map((r) => ({
				wcaRegistrationId: r.wca_registration_id,
				roles: r.roles,
				competitorGroups: r.competitor_groups,
				staffTasks: r.staff_tasks,
			}))
		);
		const lastEvent = events[0];

		return {
			competition: {
				competition_id: comp.competition_id,
				name: comp.name,
				start_date: day(comp.start_date),
				end_date: day(comp.end_date),
				registration_close: comp.registration_close ?? undefined,
				competitor_limit: comp.competitor_limit ?? undefined,
				accepted_count: registrants.length,
				event_count: events.length,
				flagged_count: events.filter((e) => e.after_close || e.after_groups).length,
				last_event_at: lastEvent?.observed_at ?? undefined,
				baseline_at: comp.baseline_at ?? undefined,
				confirmed_at: comp.confirmed_at ?? undefined,
				groups_seen_at: comp.groups_seen_at ?? undefined,
			},
			events: events.map((e) => ({
				id: e.id,
				kind: e.kind,
				wca_registration_id: e.wca_registration_id,
				registrant_id: e.registrant_id ?? undefined,
				wca_id: e.wca_id ?? undefined,
				name: e.name,
				events_before: e.events_before,
				events_after: e.events_after,
				after_close: e.after_close,
				after_groups: e.after_groups,
				window_start: e.window_start ?? undefined,
				observed_at: e.observed_at,
			})),
			registrants: registrants.map((r) => ({
				wca_registration_id: r.wca_registration_id,
				registrant_id: r.registrant_id ?? undefined,
				wca_id: r.wca_id ?? undefined,
				name: r.name,
				event_ids: r.event_ids,
				competitor_groups: r.competitor_groups,
				staff_tasks: r.staff_tasks,
				unstaffed: unstaffed.has(r.wca_registration_id),
				first_seen_at: r.first_seen_at,
			})),
		};
	}
}
