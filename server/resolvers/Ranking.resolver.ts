import {Arg, Authorized, Int, Mutation, Query, Resolver} from 'type-graphql';
import {RankingsPage} from '../schemas/Ranking.schema';
import {getRankedUsers, searchRankedUsers, recalculateAllRankings, RankingMode} from '../models/ranking';
import {Role} from '../middlewares/auth';

@Resolver()
export class RankingResolver {
	// PUBLIC — no @Authorized, accessible without login
	@Query(() => RankingsPage)
	async rankings(
		@Arg('mode') mode: string,
		@Arg('page', () => Int) page: number,
		@Arg('search', {nullable: true}) search?: string
	): Promise<RankingsPage> {
		const validModes: RankingMode[] = ['kinch', 'sor_single', 'sor_average'];
		const rankingMode: RankingMode = validModes.includes(mode as RankingMode)
			? (mode as RankingMode)
			: 'kinch';

		if (search && search.trim().length > 0) {
			const rows = await searchRankedUsers(search.trim(), rankingMode);
			return {
				rows,
				total_count: rows.length,
				page: 0,
			};
		}

		const {rows, totalCount} = await getRankedUsers(rankingMode, page);
		return {
			rows,
			total_count: totalCount,
			page,
		};
	}

	@Authorized([Role.ADMIN])
	@Mutation(() => Boolean)
	async recalculateAllRankings(): Promise<boolean> {
		await recalculateAllRankings();
		return true;
	}
}
