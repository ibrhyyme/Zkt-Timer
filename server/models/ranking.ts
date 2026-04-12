import {PrismaClient} from '@prisma/client';
import {RankingService} from '../services/RankingService';
import {WcaApiService} from '../services/WcaApiService';
import {RedisNamespace, createRedisKey, fetchDataFromCache, deleteKeyInRedis} from '../services/redis';
import {logger} from '../services/logger';

const prisma = new PrismaClient();

const PAGE_SIZE = 50;

const notBannedUserWhere = {
	banned_forever: false,
	OR: [
		{banned_until: null},
		{banned_until: {lt: new Date()}},
	],
};

/**
 * Recalculate Kinch + SoR scores for a single user and persist to Integration.
 */
export async function recalculateUserRanking(userId: string): Promise<void> {
	const integration = await prisma.integration.findFirst({
		where: {user_id: userId, wca_id: {not: null}},
	});

	if (!integration) return;

	const wcaRecords = await prisma.wcaRecord.findMany({
		where: {user_id: userId},
	});

	if (!wcaRecords.length) return;

	const {worldRecords, maxRanks} = await WcaApiService.fetchRankingData();

	const kinch = RankingService.calculateKinchScore(wcaRecords, worldRecords);
	const sor = RankingService.calculateSumOfRanks(wcaRecords, maxRanks);

	await prisma.integration.update({
		where: {id: integration.id},
		data: {
			kinch_score: kinch.overall,
			sor_single: sor.single,
			sor_average: sor.average,
			ranks_updated_at: new Date(),
		},
	});

	// Invalidate leaderboard cache
	await invalidateRankingsCache();
}

/**
 * Recalculate rankings for ALL users with WCA accounts.
 */
export async function recalculateAllRankings(): Promise<void> {
	const {worldRecords, maxRanks} = await WcaApiService.fetchRankingData();

	const integrations = await prisma.integration.findMany({
		where: {wca_id: {not: null}},
		select: {id: true, user_id: true},
	});

	logger.info(`[Rankings] Recalculating rankings for ${integrations.length} users`);

	for (const integration of integrations) {
		try {
			const wcaRecords = await prisma.wcaRecord.findMany({
				where: {user_id: integration.user_id},
			});

			if (!wcaRecords.length) continue;

			const kinch = RankingService.calculateKinchScore(wcaRecords, worldRecords);
			const sor = RankingService.calculateSumOfRanks(wcaRecords, maxRanks);

			await prisma.integration.update({
				where: {id: integration.id},
				data: {
					kinch_score: kinch.overall,
					sor_single: sor.single,
					sor_average: sor.average,
					ranks_updated_at: new Date(),
				},
			});
		} catch (err) {
			logger.error(`[Rankings] Failed to recalculate for user ${integration.user_id}:`, err);
		}
	}

	await invalidateRankingsCache();
	logger.info('[Rankings] All rankings recalculated');
}

export type RankingMode = 'kinch' | 'sor_single' | 'sor_average';

export interface RankedUserRow {
	rank: number;
	user_id: string;
	username: string;
	is_pro: boolean;
	wca_id: string;
	country_iso2: string;
	score: number;
	wca_competition_count: number | null;
	wca_medal_gold: number | null;
	wca_medal_silver: number | null;
	wca_medal_bronze: number | null;
	pfp_image_url: string | null;
}

/**
 * Get ranked users for leaderboard display.
 * Cached in Redis for 10 minutes.
 */
export async function getRankedUsers(
	mode: RankingMode,
	page: number
): Promise<{rows: RankedUserRow[]; totalCount: number}> {
	const cacheKey = createRedisKey(RedisNamespace.WCA_RANKINGS, `${mode}:${page}`);

	return fetchDataFromCache(cacheKey, async () => {
		const scoreField = mode === 'kinch' ? 'kinch_score' : mode === 'sor_single' ? 'sor_single' : 'sor_average';
		const orderDir = mode === 'kinch' ? 'desc' : 'asc'; // Kinch: high=good, SoR: low=good

		const where = {
			wca_id: {not: null},
			[scoreField]: {not: null},
			user: notBannedUserWhere,
		};

		const [integrations, totalCount] = await Promise.all([
			prisma.integration.findMany({
				where,
				orderBy: {[scoreField]: orderDir},
				skip: page * PAGE_SIZE,
				take: PAGE_SIZE,
				include: {
					user: {
						include: {
							profile: {
								select: {
									pfp_image: {select: {storage_path: true}},
								},
							},
						},
					},
				},
			}),
			prisma.integration.count({where}),
		]);

		const rows: RankedUserRow[] = integrations.map((int, i) => ({
			rank: page * PAGE_SIZE + i + 1,
			user_id: int.user.id,
			username: int.user.username,
			is_pro: int.user.is_pro,
			wca_id: int.wca_id,
			country_iso2: int.wca_country_iso2 || '',
			score: int[scoreField] as number,
			wca_competition_count: int.wca_competition_count,
			wca_medal_gold: int.wca_medal_gold,
			wca_medal_silver: int.wca_medal_silver,
			wca_medal_bronze: int.wca_medal_bronze,
			pfp_image_url: (int.user as any).profile?.pfp_image?.storage_path || null,
		}));

		return {rows, totalCount};
	}, 600); // 10 minutes
}

/**
 * Search users by username (all Zkt-Timer users, not just WCA-linked).
 * Not cached — user-specific.
 */
export async function searchRankedUsers(
	query: string,
	mode: RankingMode,
	limit = 20
): Promise<RankedUserRow[]> {
	const scoreField = mode === 'kinch' ? 'kinch_score' : mode === 'sor_single' ? 'sor_single' : 'sor_average';

	const integrations = await prisma.integration.findMany({
		where: {
			wca_id: {not: null},
			[scoreField]: {not: null},
			user: {
				...notBannedUserWhere,
				username: {contains: query, mode: 'insensitive'},
			},
		},
		orderBy: {[scoreField]: mode === 'kinch' ? 'desc' : 'asc'},
		take: limit,
		include: {
			user: {
				include: {
					profile: {
						select: {
							pfp_image: {select: {storage_path: true}},
						},
					},
				},
			},
		},
	});

	return integrations.map((int, i) => ({
		rank: i + 1,
		user_id: int.user.id,
		username: int.user.username,
		is_pro: int.user.is_pro,
		wca_id: int.wca_id,
		country_iso2: int.wca_country_iso2 || '',
		score: int[scoreField] as number,
		wca_competition_count: int.wca_competition_count,
		wca_medal_gold: int.wca_medal_gold,
		wca_medal_silver: int.wca_medal_silver,
		wca_medal_bronze: int.wca_medal_bronze,
		pfp_image_url: (int.user as any).profile?.pfp_image?.storage_path || null,
	}));
}

async function invalidateRankingsCache(): Promise<void> {
	// Delete known cache keys for all modes and first few pages
	const modes: RankingMode[] = ['kinch', 'sor_single', 'sor_average'];
	for (const mode of modes) {
		for (let page = 0; page < 10; page++) {
			const key = createRedisKey(RedisNamespace.WCA_RANKINGS, `${mode}:${page}`);
			await deleteKeyInRedis(key);
		}
	}
}
