/**
 * The stats table's numbers for one solve filter, kept between renders.
 *
 * One source per filter (a session's bucket) holds the solves oldest first and an
 * AverageSeries per window size (table_engine.ts), so a new solve costs one more window
 * per size instead of a pass over the session. The last few filters stay cached, which
 * makes switching back to a session free.
 *
 * A full pass over a very large session (100k imported solves: about 15 ms per size) is
 * split across frames: `computeStatsTable` updates sizes until its time budget runs out
 * and reports the rest as pending; the table asks again on the next frame. A pending size
 * keeps showing its previous numbers until then.
 */

import jsonStr from 'json-stable-stringify';
import {fetchSolves, FilterSolvesOptions} from '../../../db/solves/query';
import {Solve} from '../../../../server/schemas/Solve.schema';
import {toWindowTime} from '../history/rolling_average';
import {AverageSeries, rankTimes, WindowPick} from './table_engine';

interface TableSource {
	key: string;
	/** The solve db revision the solves were read at; undefined reads them every time. */
	revision?: number;
	/** Oldest first. */
	solves: Solve[];
	/** toWindowTime of each solve, same order. */
	times: number[];
	ranks: Int32Array | null;
	series: Map<string, AverageSeries>;
}

export interface TableRow {
	n: number;
	/** Latest window: seconds, -1 for a DNF, null with fewer than n solves. */
	current: number | null;
	best: WindowPick | null;
	worst: WindowPick | null;
	/** A full window exists (with no best, every window was a DNF). */
	hasWindow: boolean;
}

export interface StatsTableData {
	/** Oldest first; a pick's `start` indexes into it. */
	solves: Solve[];
	single: TableRow;
	rows: TableRow[];
	/** Solves in the filter, DNFs included: decides which rows show. */
	total: number;
	/** Some sizes still hold numbers from before the last change; ask again next frame. */
	pending: boolean;
}

const MAX_SOURCES = 4;
const sources: TableSource[] = [];

function getSource(filter: FilterSolvesOptions): TableSource {
	const key = jsonStr(filter);
	const index = sources.findIndex((source) => source.key === key);
	let source: TableSource;
	if (index >= 0) {
		source = sources[index];
		sources.splice(index, 1);
	} else {
		source = {key, solves: [], times: [], ranks: null, series: new Map()};
	}
	sources.unshift(source);
	if (sources.length > MAX_SOURCES) sources.pop();
	return source;
}

function sameList(a: number[], b: number[]): boolean {
	if (a.length !== b.length) return false;
	for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
	return true;
}

function loadSolves(source: TableSource, filter: FilterSolvesOptions, revision?: number) {
	if (revision !== undefined && source.revision === revision) return;
	source.revision = revision;

	const newest = fetchSolves(filter) as Solve[];
	const len = newest.length;
	const solves = new Array<Solve>(len);
	const times = new Array<number>(len);
	for (let i = 0; i < len; i++) {
		const solve = newest[len - 1 - i];
		solves[i] = solve;
		// solve.time already includes a +2, as in the solves grid
		times[i] = toWindowTime(solve.dnf ? -1 : solve.time);
	}

	source.solves = solves;
	// Unchanged times keep the old list, and with it the ranks built on it.
	if (sameList(source.times, times)) return;
	source.times = times;
	source.ranks = null;
}

function getSeries(source: TableSource, n: number, mean: boolean): AverageSeries {
	// Below 5 nothing is trimmed, so a mean and an average of n are the same series.
	const key = mean && n >= 5 ? `${n}m` : `${n}`;
	let series = source.series.get(key);
	if (!series) {
		series = new AverageSeries(n, mean && n >= 5);
		source.series.set(key, series);
	}
	return series;
}

function refresh(source: TableSource, series: AverageSeries) {
	series.update(source.times, () => {
		if (!source.ranks) source.ranks = rankTimes(source.times);
		return source.ranks;
	});
}

function toRow(series: AverageSeries): TableRow {
	return {
		n: series.n,
		current: series.current,
		best: series.best,
		worst: series.worst,
		hasWindow: series.hasWindow,
	};
}

function now(): number {
	return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

/**
 * The table for `filter`: the single row and one row per size in `sizes`. Sizes are
 * updated smallest first, so the rows on top settle first; once `budgetMs` is spent the
 * rest wait for the next call (at least one size is always updated). `revision` is the
 * solve db change counter; the solves are read again only when it moves.
 */
export function computeStatsTable(
	filter: FilterSolvesOptions,
	sizes: number[],
	revision?: number,
	budgetMs = Infinity
): StatsTableData {
	const source = getSource(filter);
	loadSolves(source, filter, revision);

	const started = now();
	let pending = false;
	const all = [getSeries(source, 1, false), ...sizes.map((n) => getSeries(source, n, false))];
	all.forEach((series, i) => {
		if (i > 0 && now() - started > budgetMs) {
			pending = true;
			return;
		}
		refresh(source, series);
	});

	return {
		solves: source.solves,
		single: toRow(all[0]),
		rows: all.slice(1).map(toRow),
		total: source.times.length,
		pending,
	};
}

/**
 * The best or worst average of `n` in `filter` with its solves, for the stats blocks and
 * the solves modal. Shares the table's cache, so opening a cell costs nothing extra.
 */
export function getTableWindow(
	filter: FilterSolvesOptions,
	n: number,
	mean: boolean,
	which: 'best' | 'worst'
): {time: number; solves: Solve[]} | null {
	const source = getSource(filter);
	loadSolves(source, filter);
	const series = getSeries(source, n, mean);
	refresh(source, series);
	const pick = which === 'best' ? series.best : series.worst;
	if (!pick) return null;
	return {time: pick.value, solves: source.solves.slice(pick.start, pick.start + n)};
}
