import {getSolveDb} from '../../init';
import {cleanFilterOptions} from '../../../util';
import {FilterSolvesOptions} from '../../query';
import {getSampleStdDev} from './average/window_math';

export interface SolveSummary {
	/** Every solve in the filter, DNFs included. */
	total: number;
	dnf: number;
	/** Mean of the timed solves, DNFs left out (csTimer's session "mean"). Null without one. */
	mean: number | null;
	/** Sample standard deviation of the timed solves. Null with fewer than two. */
	stdDev: number | null;
}

/**
 * Count, mean and spread of every solve in a filter, in one pass and without sorting.
 *
 * Not cached: it is a single linear pass, which costs less than the sort an average's cache
 * miss starts with, and it runs once per stats block per solve DB change.
 */
export function getSolveSummary(filterOptions: FilterSolvesOptions): SolveSummary {
	const solves = getSolveDb().find(cleanFilterOptions(filterOptions));

	const times: number[] = [];
	let dnf = 0;
	for (const solve of solves) {
		if (solve.dnf || solve.time < 0) {
			dnf++;
		} else if (solve.time > 0) {
			times.push(solve.time);
		}
	}

	return {
		total: solves.length,
		dnf,
		mean: times.length ? times.reduce((sum, t) => sum + t, 0) / times.length : null,
		stdDev: getSampleStdDev(times),
	};
}
