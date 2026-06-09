import {fetchSolves, FilterSolvesOptions} from '../query';

export function getTotalSolveTime(filterOption: FilterSolvesOptions): number {
	// Same population as hourly/PB stats: DNF's sentinel -1 must not reduce the
	// sum, and the count shown next to this total uses the same filtered set.
	const solves = fetchSolves({...filterOption, dnf: false, time: {$gt: 0}});
	let total = 0;

	for (const solve of solves) {
		total += solve.time;
	}

	return total;
}

export function getTotalSolveCount(filterOption: FilterSolvesOptions) {
	const solves = fetchSolves(filterOption);
	return solves.length;
}
