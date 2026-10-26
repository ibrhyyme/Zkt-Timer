import {fetchSolves, FilterSolvesOptions} from '../../../db/solves/query';
import {StatsModuleBlock} from '../../../../server/schemas/StatsModule.schema';
import {Solve} from '../../../../server/schemas/Solve.schema';
import {getStore} from '../../store';
import {getWorstTime} from '../../../db/solves/stats/solves/single/single_worst';
import {getSinglePB} from '../../../db/solves/stats/solves/single/single_pb';
import {getCurrentAverage} from '../../../db/solves/stats/solves/average/average';
import {getAveragePB} from '../../../db/solves/stats/solves/average/average_pb';
import {getAverageWorst} from '../../../db/solves/stats/solves/average/average_worst';
import {
	getCountingTimes,
	getNextSolveOutlook,
	getSampleStdDev,
} from '../../../db/solves/stats/solves/average/window_math';
import {getSolveSummary} from '../../../db/solves/stats/solves/summary';
import {getTimeString} from '../../../util/time';
import {gql} from '@apollo/client';
import {gqlMutate} from '../../api';
import i18n from '../../../i18n/i18n';
import {getBlockCount, getBlockKind, getBlockValue, isMeanKind} from './block_options';
import {getStatLabel} from './stat_label';

/** What a stats block shows, and the solves it opens when clicked. */
export interface StatsBlockResult {
	/** Seconds; -1 is a DNF. Not a time for a count (see `text`). */
	time: number;
	/** Shown instead of the time: a solve count, or a target that is never / always reached. */
	text?: string;
	solve?: Solve;
	solves?: Solve[];
}

export function formatStatsBlockValue(result: StatsBlockResult | null): string {
	if (!result) {
		return '-';
	}
	return result.text ?? getTimeString(result.time);
}

/** The block's caption as text, for places that need a string (the solves modal's title). */
export function getStatsBlockDescription(block: StatsModuleBlock): string {
	const {key, params} = getStatLabel(block);
	return i18n.t(key, params);
}

/**
 * The scope a block reads: the given filter, narrowed to the session or widened to every
 * session.
 *
 * A caller that already scoped its filter to a session wins. The Sessions page lets you
 * inspect a session you are not timing in, and pinning the settings' current session here
 * made every "session" block show the wrong session's numbers. The timer puts that same
 * current session in this field, so nothing changes there.
 */
function getBlockFilter(block: StatsModuleBlock, filterOptions: FilterSolvesOptions, currentSessionId?: string) {
	const solvesFilter = {...filterOptions};
	if (block.session) {
		solvesFilter.session_id = filterOptions.session_id ?? currentSessionId;
	} else {
		delete solvesFilter.session_id;
	}
	return solvesFilter;
}

/** BPA, WPA or target of the next aoN / moN; opens the count - 1 solves the next window keeps. */
function getNextSolveResult(
	solvesFilter: FilterSolvesOptions,
	count: number,
	mean: boolean,
	value: 'bpa' | 'wpa' | 'target'
): StatsBlockResult | null {
	const newest = fetchSolves(solvesFilter, {limit: count});
	if (newest.length < count - 1) {
		return null;
	}

	const previous = newest.slice(0, count - 1);
	// A best to beat exists only once there has been a full window. getAveragePB is null both
	// before that and when every window was a DNF; the second is a best of DNF (-1).
	let bestAverage: number | null = null;
	if (value === 'target' && newest.length === count) {
		bestAverage = getAveragePB(solvesFilter, count, mean)?.time ?? -1;
	}

	const outlook = getNextSolveOutlook(
		previous.map((s) => s.time),
		count,
		mean,
		bestAverage
	);
	if (!outlook) {
		return null;
	}

	if (value === 'bpa') {
		return {time: outlook.best, solves: previous};
	}
	if (value === 'wpa') {
		return {time: outlook.worst, solves: previous};
	}

	const target = outlook.target;
	if (target === null) {
		return null;
	}
	if (target === 'never') {
		return {time: -1, text: '-', solves: previous};
	}
	if (target === 'always') {
		return {time: -1, text: '∞', solves: previous};
	}
	return {time: target, solves: previous};
}

export function getStatsBlockValueFromFilter(
	block: StatsModuleBlock,
	filterOptions: FilterSolvesOptions = {},
	currentSessionId?: string
): StatsBlockResult | null {
	const solvesFilter = getBlockFilter(block, filterOptions, currentSessionId);
	const kind = getBlockKind(block);
	const value = getBlockValue(block);
	const count = getBlockCount(block);

	switch (kind) {
		case 'single':
			return value === 'worst' ? getWorstTime(solvesFilter) : getSinglePB(solvesFilter);

		case 'ao':
		case 'mo': {
			const mean = isMeanKind(kind);
			if (value === 'best') {
				return getAveragePB(solvesFilter, count, mean);
			}
			if (value === 'worst') {
				return getAverageWorst(solvesFilter, count, mean);
			}
			if (value === 'bpa' || value === 'wpa' || value === 'target') {
				return getNextSolveResult(solvesFilter, count, mean, value);
			}
			return getCurrentAverage(solvesFilter, count, mean);
		}

		case 'stdev': {
			if (!count) {
				const sd = getSolveSummary(solvesFilter).stdDev;
				return sd === null ? null : {time: sd};
			}
			// σ of the times the current average counts, as csTimer reports it.
			const current = getCurrentAverage(solvesFilter, count);
			const sd = current ? getSampleStdDev(getCountingTimes(current.solves.map((s) => s.time))) : null;
			return sd === null ? null : {time: sd, solves: current.solves};
		}

		case 'count': {
			const {total, dnf} = getSolveSummary(solvesFilter);
			return {time: total, text: dnf ? `${total - dnf}/${total}` : String(total)};
		}

		default: {
			const mean = getSolveSummary(solvesFilter).mean;
			return mean === null ? null : {time: mean};
		}
	}
}

export async function saveStatsModuleBlocks() {
	const store = getStore();
	const me = store.getState().account?.me;
	const blocks = store.getState().stats.blocks;

	if (!me) {
		return;
	}

	const query = gql`
		mutation updateStatsModuleBlocks($blocks: [StatsModuleBlockInput]) {
			updateStatsModuleBlocks(blocks: $blocks) {
				blocks {
					colorName
				}
			}
		}
	`;

	await gqlMutate(query, {
		blocks,
	});
}
