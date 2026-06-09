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

	// Sub-1% values keep one decimal instead of flooring to a misleading "0%"
	// (e.g. 22 +2s out of 13K solves should read "0.2%", not "0%").
	function toPercent(count: number): number {
		const pct = (count / solves.length) * 100;
		return pct > 0 && pct < 1 ? Math.round(pct * 10) / 10 : Math.floor(pct);
	}

	const dnfPercent = toPercent(dnfs.length);
	const plusTwoPercent = toPercent(plusTwos.length);

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
