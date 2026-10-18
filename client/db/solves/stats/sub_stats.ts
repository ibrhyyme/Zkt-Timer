import {fetchSolves, FilterSolvesOptions} from '../query';
import {Solve} from '../../../../server/schemas/Solve.schema';

interface SubStats {
	firstSolve: Solve;
	lastSolve: Solve;
	totalCount: number;
	dnfCount: number;
	dnfPercent: number;
	plusTwoCount: number;
	plusTwoPercent: number;
}

/**
 * Share of `count` in `total` on the 0-100 scale, one decimal, rounded (formatPercent drops a
 * trailing zero): 22 +2s out of 13K solves read "0.2%", not "0%", and 243 out of 12 452
 * (1.95%) read "2%". Flooring everything above 1% printed that last one as "1%".
 */
export function solveSharePercent(count: number, total: number): number {
	if (!total) return 0;
	return Math.round((count / total) * 1000) / 10;
}

export function getSubStats(filter: FilterSolvesOptions): SubStats {
	const solves = fetchSolves(
		{
			...filter,
		},
		{
			sortBy: 'started_at',
		}
	);

	if (!solves.length) {
		return {
			firstSolve: null,
			lastSolve: null,
			totalCount: 0,
			dnfCount: 0,
			dnfPercent: 0,
			plusTwoCount: 0,
			plusTwoPercent: 0,
		};
	}

	const dnfs = fetchSolves({
		...filter,
		dnf: true,
	});

	const plusTwos = fetchSolves({
		...filter,
		plus_two: true,
	});

	const dnfPercent = solveSharePercent(dnfs.length, solves.length);
	const plusTwoPercent = solveSharePercent(plusTwos.length, solves.length);

	return {
		firstSolve: solves[0],
		lastSolve: solves[solves.length - 1],
		totalCount: solves.length,
		dnfCount: dnfs.length,
		dnfPercent,
		plusTwoCount: plusTwos.length,
		plusTwoPercent,
	};
}
