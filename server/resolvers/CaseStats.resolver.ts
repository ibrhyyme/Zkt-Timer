import { Arg, Authorized, Ctx, Query, Resolver } from 'type-graphql';
import { GraphQLContext } from '../@types/interfaces/server.interface';
import { Role } from '../middlewares/auth';
import { CaseStat } from '../schemas/CaseStat.schema';
import algorithms from '../../client/util/algorithms/algorithms';

const ALG_KEY: Record<'oll' | 'pll', string> = {
	oll: '3_oll',
	pll: '3_pll',
};

interface Aggregator {
	count: number;
	totalTime: number;
	bestTime: number;
	totalRecognition: number;
	totalExecution: number;
	totalTps: number;
	totalTurns: number;
	lastSeenAt: number;
}

function emptyAgg(): Aggregator {
	return {
		count: 0,
		totalTime: 0,
		bestTime: Infinity,
		totalRecognition: 0,
		totalExecution: 0,
		totalTps: 0,
		totalTurns: 0,
		lastSeenAt: 0,
	};
}

function lookupCaseName(type: 'oll' | 'pll', caseKey: string): string {
	const algKey = ALG_KEY[type];
	const entry = (algorithms as any)[algKey]?.[caseKey];
	if (!entry) return caseKey;
	const name = entry.name || caseKey;
	const category = entry.category;
	return category ? `${category} ${name}` : name;
}

@Resolver()
export class CaseStatsResolver {
	@Authorized([Role.LOGGED_IN, Role.PRO])
	@Query(() => [CaseStat])
	async caseStats(
		@Ctx() context: GraphQLContext,
		@Arg('type') type: string
	): Promise<CaseStat[]> {
		const { prisma, user } = context;
		if (type !== 'oll' && type !== 'pll') return [];
		const caseField: 'oll_case_key' | 'pll_case_key' =
			type === 'oll' ? 'oll_case_key' : 'pll_case_key';

		const steps = await prisma.solveMethodStep.findMany({
			where: {
				step_name: type,
				[caseField]: { not: null },
				solve: {
					user_id: user.id,
					is_smart_cube: true,
					// cube_type filtresi kaldirildi — smart cube zaten 3x3 (BLE 3x3-only).
				},
			},
			select: {
				oll_case_key: true,
				pll_case_key: true,
				total_time: true,
				recognition_time: true,
				tps: true,
				turn_count: true,
				solve: {
					select: { created_at: true },
				},
			},
		});

		const aggMap: Record<string, Aggregator> = {};
		for (const s of steps) {
			const key = (type === 'oll' ? s.oll_case_key : s.pll_case_key) || '';
			if (!key) continue;
			if (!aggMap[key]) aggMap[key] = emptyAgg();
			const agg = aggMap[key];
			const total = s.total_time ?? 0;
			const recog = s.recognition_time ?? 0;
			const exec = Math.max(0, total - recog);
			agg.count += 1;
			agg.totalTime += total;
			agg.bestTime = Math.min(agg.bestTime, total);
			agg.totalRecognition += recog;
			agg.totalExecution += exec;
			agg.totalTps += s.tps ?? 0;
			agg.totalTurns += s.turn_count ?? 0;
			const ts = s.solve?.created_at ? new Date(s.solve.created_at).getTime() : 0;
			if (ts > agg.lastSeenAt) agg.lastSeenAt = ts;
		}

		const result: CaseStat[] = [];
		for (const caseKey of Object.keys(aggMap)) {
			const a = aggMap[caseKey];
			result.push({
				caseKey,
				caseName: lookupCaseName(type, caseKey),
				caseType: type,
				count: a.count,
				averageTime: a.totalTime / a.count,
				bestTime: a.bestTime === Infinity ? 0 : a.bestTime,
				avgRecognition: a.totalRecognition / a.count,
				avgExecution: a.totalExecution / a.count,
				avgTps: a.totalTps / a.count,
				avgTurns: a.totalTurns / a.count,
				lastSeenAt: a.lastSeenAt > 0 ? a.lastSeenAt : null,
			});
		}

		// Default sort: lastSeenAt desc (en son yapilan ustte)
		return result.sort((a, b) => (b.lastSeenAt ?? 0) - (a.lastSeenAt ?? 0));
	}
}
