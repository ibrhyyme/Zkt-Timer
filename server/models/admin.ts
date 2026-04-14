import {
	UserAccountForAdmin,
	UserAccountSolvesSummary,
	UserAccountSummary,
} from '../schemas/UserAccount.schema';
import {getPrisma} from '../database';


export async function getUserAccountForAdmin(userId: string): Promise<UserAccountForAdmin> {
	const summary = await getUserForAdminSummary(userId);
	if (!summary) {
		return null;
	}

	const userRelations = await getPrisma().userAccount.findUnique({
		where: {
			id: userId,
		},
		include: {
			integrations: true,
			badges: {
				include: {
					badge_type: true,
				},
			},
			profile: {
				include: {
					pfp_image: true,
				},
			},
			reports_for: {
				orderBy: {
					created_at: 'desc',
				},
			},
			bans: {
				orderBy: {
					created_at: 'desc',
				},
			},
			settings: true,
		},
	});

	if (!userRelations) {
		return null;
	}

	return {
		...userRelations,
		summary,
	};
}

async function getUserForAdminSummary(userId: string): Promise<UserAccountSummary> {
	const agg = await getPrisma().userAccount.findUnique({
		where: {
			id: userId,
		},
		include: {
			_count: {
				select: {
					solves: true,
					reports_created: true,
					reports_for: true,
					profile_views: true,
					bans: true,
				},
			},
		},
	});

	const timerSolves = await getUserForAdminSolvesSummary(userId, {
		OR: [{trainer_name: null}, {trainer_name: ''}],
	});

	if (!agg || !agg._count) {
		return null;
	}

	return {
		...agg._count,
		timer_solves: timerSolves,
	};
}

async function getUserForAdminSolvesSummary(userId: string, where: any = {}): Promise<UserAccountSolvesSummary[]> {
	const sum = await getPrisma().solve.groupBy({
		by: ['cube_type', 'scramble_subset'],
		_avg: {
			time: true,
		},
		_sum: {
			time: true,
		},
		_min: {
			time: true,
		},
		_count: {
			time: true,
		},
		_max: {
			time: true,
		},
		where: {
			user_id: userId,
			dnf: false,
			...where,
		},
	});

	return sum.map((row) => ({
		sum: row._sum.time,
		count: row._count.time,
		average: row._avg.time,
		min_time: row._min.time,
		max_time: row._max.time,
		cube_type: row.cube_type,
		scramble_subset: row.scramble_subset,
	}));
}
