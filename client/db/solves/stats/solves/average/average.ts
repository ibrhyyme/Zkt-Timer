// Not providing a count will result in getting the average for all solves for this cube type
import {cacheSolveStat, fetchSolveCache, SolveCacheKey, SolveStatInput} from '../caching';
import {fetchSolves, FilterSolvesOptions} from '../../../query';
import {Solve} from '../../../../../../server/schemas/Solve.schema';
import {getTrimCount} from './window_math';

/** `mean`: a mean of `count` (nothing trimmed, any DNF makes it a DNF) instead of an average. */
export function getCurrentAverage(filterOptions: FilterSolvesOptions, count: number = -1, mean = false) {
	const cacheKey: SolveCacheKey = {
		type: 'avg_current',
		averageCount: count,
		filterOptions,
		...(mean ? {mean: true as const} : {}),
	};

	const cachedValue = fetchSolveCache(cacheKey);
	if (cachedValue) {
		return cachedValue;
	}

	const limit = count <= 0 ? undefined : count;

	let solves: Solve[];
	if (limit) {
		solves = fetchSolves(filterOptions, {
			limit,
		});
	} else {
		solves = fetchSolves(filterOptions, {
			sortBy: 'time',
		});
	}

	// No solves, less than 3 solves, or fewer than `count` solves
	if (!solves.length || solves.length < 3 || (count > 0 && solves.length < count)) {
		return null;
	}

	const avg = getAverage(solves, !limit, mean);
	const result: SolveStatInput = {
		time: avg,
		solves,
	};

	return cacheSolveStat(cacheKey, result);
}

function getSolveTime(solve: Solve | number): number {
	if (typeof solve === 'number') {
		return solve;
	} else {
		return solve.time;
	}
}

/**
 * Generic average function for a list of solves
 * @param list - List of Solve objects
 * @param isSorted - If list is already sorted, skip sorting and save on compute
 * @param mean - A mean: nothing is trimmed, so any DNF makes it a DNF
 */
export function getAverage(list: Solve[] | number[], isSorted: boolean = false, mean: boolean = false): number {
	if (!list || !list.length) {
		return 0;
	}

	if (!isSorted) {
		list.sort((a, b) => getSolveTime(a) - getSolveTime(b));
	}

	const dropCount = getTrimCount(list.length, mean);

	let dnfCount = 0;
	for (let i = 0; i < list.length; i++) {
		const time = getSolveTime(list[i]);

		if (time < 0) {
			dnfCount++;
		} else {
			break;
		}
	}

	if (dnfCount > dropCount) {
		return -1;
	}

	let total = 0;
	let totalCount = 0;
	for (let i = dropCount; i < list.length - dropCount; i++) {
		const solve = list[i + dnfCount];
		const time = getSolveTime(solve);

		if (time <= 0) {
			return -1;
		} else {
			total += time;
		}

		totalCount += 1;
	}

	return total / totalCount;
}
