import {Solve} from '../../../../../../server/schemas/Solve.schema';
import {cacheSolveStat, clearSingleSolveStatCache, fetchAllSolveCaches, SolveCacheKey, SolveStat} from '../caching';
import {getAveragePB} from '../average/average_pb';
import {getCurrentAverage} from '../average/average';
import {getAverageWorst} from '../average/average_worst';

/**
 * Carries a best or worst average over a solve that landed on the newest end of its list,
 * instead of dropping it.
 *
 * fetchSolves lists newest first and the averages slide over that list, so such a solve
 * leaves every older window as it was and adds exactly one: the current average. The
 * extreme over the new list is the cached one or the current average, whichever wins; the
 * newest window wins a tie, as it does in the full pass (average_pb.ts, average_worst.ts).
 * Dropping the entry made the next read slide a window over the whole history: about
 * 120 ms per solve on a 12 000 solve account in the desktop stats module, several times
 * that on a slower machine.
 *
 * Returns false when the solve is not the newest of this list (an undone deletion, an
 * import, a solve outside the filter); the caller then drops the entry as before.
 */
function carryOverAppended(
	entry: SolveStat,
	solve: Solve,
	kept: SolveStat | null,
	current: SolveStat | null,
	wins: (candidate: number, kept: number) => boolean
): boolean {
	// The current average holds the newest `count` solves of the list, sorted by time
	// (getAverage sorts in place), so the newest is found by its end, not its position.
	const window = current?.solves || [];
	const newest = window.reduce<Solve | null>((a, s) => (!a || s.ended_at > a.ended_at ? s : a), null);
	if (!kept || !current || newest?.id !== solve.id) {
		return false;
	}

	const takeCurrent = current.time > 0 && wins(current.time, kept.time);
	const key: SolveCacheKey = {
		type: entry.type,
		filterOptions: entry.filterOptions,
		averageCount: entry.averageCount,
	};

	clearSingleSolveStatCache(entry.cacheKey);
	cacheSolveStat(key, {
		time: takeCurrent ? current.time : kept.time,
		// Newest first, the order the full pass stores a window in.
		solves: takeCurrent ? [...window].sort((a, b) => b.ended_at - a.ended_at) : kept.solves,
	});
	return true;
}

export function checkForAveragePBUpdate(solve: Solve, isNew: boolean) {
	const cached = fetchAllSolveCaches({
		type: 'avg_pb',
		filterOptions: {
			cube_type: solve.cube_type,
			scramble_subset: solve.scramble_subset ?? null,
		},
	});

	// Session-specific caches are missed by the query above because
	// LokiJS null != undefined — a session cache entry has no scramble_subset
	// field (undefined), so {scramble_subset: null} doesn't match it.
	const sessionCached = fetchAllSolveCaches({
		type: 'avg_pb',
		filterOptions: {
			cube_type: solve.cube_type,
			session_id: solve.session_id,
		},
	});

	const allCached = [
		...cached,
		...sessionCached.filter((sc) => !cached.some((c) => c.cacheKey === sc.cacheKey)),
	];

	const updatedPbs: typeof cached = [];
	for (const cach of allCached) {
		if (isNew) {
			// Still the entry from before this solve: it is dropped or replaced only below.
			const best = getAveragePB(cach.filterOptions, cach.averageCount);
			const avg = getCurrentAverage(cach.filterOptions, cach.averageCount);

			if (avg && best && avg.time < best.time && avg.time >= 0) {
				updatedPbs.push(cach);
			}

			if (carryOverAppended(cach, solve, best, avg, (candidate, kept) => candidate <= kept)) {
				continue;
			}
		}
		clearSingleSolveStatCache(cach.cacheKey);
	}

	return updatedPbs;
}

export function checkForCurrentAverageUpdate(solve: Solve, isNew: boolean) {
	const cached = fetchAllSolveCaches({
		type: 'avg_current',
	});

	for (const cach of cached) {
		if (isNew) {
			clearSingleSolveStatCache(cach.cacheKey);
		} else if (cach.solveIds.has(solve.id)) {
			clearSingleSolveStatCache(cach.cacheKey);
		}
	}
}

export function checkForAverageWorstUpdate(solve: Solve, isNew: boolean) {
	const cached = fetchAllSolveCaches({
		type: 'avg_worst',
		filterOptions: {
			cube_type: solve.cube_type,
			scramble_subset: solve.scramble_subset ?? null,
		},
	});

	const sessionCached = fetchAllSolveCaches({
		type: 'avg_worst',
		filterOptions: {
			cube_type: solve.cube_type,
			session_id: solve.session_id,
		},
	});

	const allCached = [
		...cached,
		...sessionCached.filter((sc) => !cached.some((c) => c.cacheKey === sc.cacheKey)),
	];

	const updatedWorsts: typeof cached = [];
	for (const cach of allCached) {
		if (isNew) {
			const worst = getAverageWorst(cach.filterOptions, cach.averageCount);
			const avg = getCurrentAverage(cach.filterOptions, cach.averageCount);

			if (avg && worst && avg.time > worst.time && avg.time >= 0) {
				updatedWorsts.push(cach);
			}

			if (carryOverAppended(cach, solve, worst, avg, (candidate, kept) => candidate >= kept)) {
				continue;
			}
		}
		clearSingleSolveStatCache(cach.cacheKey);
	}

	return updatedWorsts;
}
