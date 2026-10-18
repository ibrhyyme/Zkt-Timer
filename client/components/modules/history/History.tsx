import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import ReactList from 'react-list';
import { GlobalHotKeys } from 'react-hotkeys';
import './History.scss';
import Empty from '../../common/empty/Empty';
import { HOTKEY_MAP } from '../../../util/timer/hotkeys';
import { FilterSolvesOptions, fetchSolves, fetchLastSolve } from '../../../db/solves/query';
import HistorySolveRow from './solve_row/HistorySolveRow';
import { toggleDnfSolveDb, togglePlusTwoSolveDb, setOkSolveDb } from '../../../db/solves/operations';
import { deleteSolveDb } from '../../../db/solves/update';
import { useSolveDb } from '../../../util/hooks/useSolveDb';
import { Solve } from '../../../../server/schemas/Solve.schema';
import { useGeneral } from '../../../util/hooks/useGeneral';
import { useSettings } from '../../../util/hooks/useSettings';
import { publishScroll, subscribeScroll, HISTORY_SCROLL_CHANNEL, PHASE_ANALYSIS_SCROLL_CHANNEL } from '../../../util/scroll_sync';
import { detectNewestArrival, NewestArrivalState } from './newest_arrival';
import { useDispatch } from 'react-redux';
import { openModal } from '../../../actions/general';
import HistoryModal from './history_modal/HistoryModal';
import { historyColumnLabel, sanitizeHistoryColumns } from './history_columns';
import { bestAverageIndex, NO_AVERAGE, RollingAverageColumn, toWindowTime } from './rolling_average';
import { historyGridTemplate } from './history_grid';

interface Props {
	solves?: Solve[];
	filterOptions?: FilterSolvesOptions;
	disabled?: boolean;
	reverseOrder?: boolean;
	hotKeysEnabled?: boolean;
}

// TODO NOW hotkeys for History
export default function History(props: Props) {
	const { solves: parentSolves, reverseOrder, disabled, filterOptions, hotKeysEnabled } = props;

	const { t } = useTranslation();
	const solveDbVersion = useSolveDb();
	const modals = useGeneral('modals');
	const scrollRef = useRef<HTMLDivElement>(null);
	const isReceiving = useRef(false);

	useEffect(() => {
		const el = scrollRef.current;
		if (!el) return;

		const onScroll = () => {
			if (!isReceiving.current) {
				publishScroll(HISTORY_SCROLL_CHANNEL, el.scrollTop);
			}
		};

		el.addEventListener('scroll', onScroll, { passive: true });

		const unsub = subscribeScroll(PHASE_ANALYSIS_SCROLL_CHANNEL, (top) => {
			isReceiving.current = true;
			el.scrollTop = top;
			requestAnimationFrame(() => { isReceiving.current = false; });
		});

		return () => {
			el.removeEventListener('scroll', onScroll);
			unsub();
		};
	}, []);

	// The timer re-renders its modules on every step (press, start, stop, new scramble),
	// and this used to query and sort the whole history each time: on a 12 000 solve
	// account that was several ms per step before anything changed. The list only changes
	// with the solve db (every write emits solveDbUpdatedEvent, which moves the counter) or
	// the filter.
	const filterKey = JSON.stringify(filterOptions || {});
	const solves: Solve[] = useMemo(
		() => parentSolves || fetchSolves(filterOptions),
		[parentSolves, filterKey, solveDbVersion]
	);

	// PB highlight: mark only the all-time best (real PB) solve per (cube_type,
	// scramble_subset) bucket. Computed over the FULL history rather than the limited
	// on-screen window, so a non-record time is never flagged just because it happens
	// to be the fastest of the currently visible page.
	const highlightPbs = useSettings('highlight_pbs');
	const pbSolveIds = React.useMemo(() => {
		const ids = new Set<string>();
		if (highlightPbs === 'off') return ids;

		// Use the unbounded history when we own the query; fall back to provided solves.
		// No fetchOptions argument, so no limit is applied — that is what makes this
		// unbounded. `limit` was previously passed inside the FILTER object, where
		// fetchSolves never reads it and cleanFilterOptions dropped it anyway.
		const source = filterOptions ? fetchSolves(filterOptions) : (parentSolves || solves);

		const bestByBucket = new Map<string, { time: number; id: string }>();
		for (const s of source) {
			if (s.dnf) continue;
			// solve.time already includes a +2 (db/solves/update.tsx); adding it again
			// ranked a +2 solve two seconds slower than it is.
			const t = s.time;
			if (t <= 0) continue;
			const key = `${s.cube_type}::${s.scramble_subset || ''}`;
			const cur = bestByBucket.get(key);
			if (!cur || t < cur.time) {
				bestByBucket.set(key, { time: t, id: s.id });
			}
		}
		for (const { id } of bestByBucket.values()) {
			ids.add(id);
		}
		return ids;
	}, [solves, parentSolves, filterKey, highlightPbs]);

	// Newest-row entrance: only the solve that just landed on top gets the fade +
	// slide-up, and only once (not on filter changes, scroll recycling, or the
	// initial load — see newest_arrival.ts). Mutated during render, same "detect on
	// this pass" shape as ScrambleMoveList's baselineRef, so the row that mounts
	// because of the new solve already has the flag on its very first paint.
	const arrivalStateRef = useRef<NewestArrivalState | null>(null);
	const currentTopId = solves[0]?.id ?? null;
	const { arrivalId: newestArrivalId, next: nextArrivalState } = detectNewestArrival(
		arrivalStateRef.current,
		currentTopId,
		filterKey
	);
	arrivalStateRef.current = nextArrivalState;

	// The grid's average columns (desktop only; the phone shows number, time and delete).
	// One RollingAverageColumn per window size survives renders, so a new solve costs one
	// more slide of each window instead of a pass over the whole list (rolling_average.ts).
	const dispatch = useDispatch();
	const mobileMode = useGeneral('mobile_mode');
	const storedColumns = useSettings('history_columns');
	const columns = useMemo(
		() => (mobileMode ? [] : sanitizeHistoryColumns(storedColumns)),
		[mobileMode, storedColumns]
	);

	const columnCacheRef = useRef(new Map<number, RollingAverageColumn>());
	const bestCacheRef = useRef(new WeakMap<number[], number>());
	const { averages, bestRows } = useMemo(() => {
		if (!columns.length || !solves.length) return { averages: [] as number[][], bestRows: [] as number[] };

		// Oldest first, which is the order an average runs in. The list itself is newest first.
		const times = new Array<number>(solves.length);
		for (let i = 0; i < solves.length; i++) {
			const solve = solves[solves.length - 1 - i];
			times[i] = toWindowTime(solve.dnf ? -1 : solve.time);
		}

		const cache = columnCacheRef.current;
		for (const n of Array.from(cache.keys())) {
			if (!columns.includes(n)) cache.delete(n);
		}
		const columnResults = columns.map((n) => {
			let column = cache.get(n);
			if (!column) {
				column = new RollingAverageColumn(n);
				cache.set(n, column);
			}
			return column.update(times);
		});
		const best = columnResults.map((results) => {
			const known = bestCacheRef.current.get(results);
			if (known !== undefined) return known;
			const index = bestAverageIndex(results);
			bestCacheRef.current.set(results, index);
			return index;
		});
		return { averages: columnResults, bestRows: best };
		// A penalty edits a solve in place, so the time list is rebuilt whenever the db
		// moves, not only when the array changes; update() keeps the append-only fast path.
	}, [solves, columns, solveDbVersion]);

	// Rows are drawn through a memoized list (SolveList below): react-list measures its
	// rows and scroll parent on every update, so it must only update when a row changes.
	const renderSolveRow = useCallback(
		(index: number) => {
			let solveIndex = index;
			if (reverseOrder) {
				solveIndex = solves.length - index - 1;
			}

			let displayIndex = solves.length - index - 1;
			if (reverseOrder) {
				displayIndex = index;
			}

			const solve = solves[solveIndex];
			const oldestIndex = solves.length - 1 - solveIndex;
			return (
				<HistorySolveRow
					disabled={disabled}
					key={solve.id}
					index={displayIndex}
					solve={solve}
					isPb={pbSolveIds.has(solve.id)}
					highlightMode={highlightPbs}
					isNewestArrival={solve.id === newestArrivalId}
					averages={columns.length ? averages.map((results) => results[oldestIndex] ?? NO_AVERAGE) : undefined}
					bestAverages={columns.length ? bestRows.map((row) => row === oldestIndex) : undefined}
					onOpenAverage={columns.length ? (columnIndex) => openAverage(solveIndex, columnIndex) : undefined}
				/>
			);
		},
		// solveDbVersion: a penalty edits the solve object in place, and the row must redraw.
		[solves, solveDbVersion, reverseOrder, disabled, pbSolveIds, highlightPbs, newestArrivalId, columns, averages, bestRows, t]
	);

	function openAverage(solveIndex: number, columnIndex: number) {
		const n = columns[columnIndex];
		const oldestIndex = solves.length - 1 - solveIndex;
		const value = averages[columnIndex]?.[oldestIndex];
		if (value === undefined || Number.isNaN(value)) return;

		// The list is newest first, so the window ending at this solve runs from here on.
		const windowSolves = solves.slice(solveIndex, solveIndex + n);
		dispatch(
			openModal(
				<HistoryModal
					solves={windowSolves}
					time={value}
					description={t('timer_modules.average_at_solve', {
						label: historyColumnLabel(n),
						num: oldestIndex + 1,
					})}
				/>
			)
		);
	}

	// The list's own scroll box, handed to react-list so it does not search for it. It asks
	// on mount, before React has attached scrollRef (an ancestor's ref is set after its
	// children mount), so the box is found from react-list's element instead.
	const getScrollParent = useCallback(
		(list: { getEl(): HTMLElement }) => list.getEl().closest<HTMLElement>('.zt-history__list') || window,
		[]
	);

	function getLastSolve() {
		return fetchLastSolve(filterOptions);
	}

	// allow hotkey actions only when explicitly enabled and no any modal windows active
	function isHotKeysEnabled() {
		return hotKeysEnabled && (!modals || modals.length == 0);
	}

	function okLastSolve() {
		if (isHotKeysEnabled()) setOkSolveDb(getLastSolve());
	}

	function dnfLastSolve() {
		if (isHotKeysEnabled()) toggleDnfSolveDb(getLastSolve());
	}

	function plusTwoLastSolve() {
		if (isHotKeysEnabled()) togglePlusTwoSolveDb(getLastSolve());
	}

	function deleteLastSolve() {
		if (isHotKeysEnabled()) deleteSolveDb(getLastSolve());
	}

	if (!solves.length) {
		return (
			<div className="zt-history">
				<Empty text={t('timer_modules.no_solves_yet')} />
			</div>
		);
	}

	const HOTKEY_HANDLERS = {
		TOGGLE_OK: okLastSolve,
		TOGGLE_DNF: dnfLastSolve,
		DELETE_LAST_TIME: deleteLastSolve,
		TOGGLE_PLUS_TWO: plusTwoLastSolve,
	};

	// A cstimer style grid. Every row is a grid of its own (react-list only mounts the
	// visible ones), so the column template is set once here and the rows read it. The
	// number column is sized for the longest number in the list (history_grid.ts).
	const gridStyle = {
		'--zt-history-cols': historyGridTemplate(solves.length, columns.length, !!mobileMode),
	} as React.CSSProperties;

	return (
		<GlobalHotKeys handlers={HOTKEY_HANDLERS} keyMap={HOTKEY_MAP}>
			<div
				className={`zt-history zt-history--grid h-full${mobileMode ? ' zt-history--mobile' : ''}`}
				style={gridStyle}
			>
				<div className="zt-history__table h-full">
					<div ref={scrollRef} className="zt-history__list h-full">
						{!mobileMode && (
							<div className="zt-history__head" role="row">
								<span className="zt-history__head-cell zt-history__head-cell--index">#</span>
								<span className="zt-history__head-cell">{t('timer_modules.solves_col_time')}</span>
								{columns.map((n) => (
									<span key={n} className="zt-history__head-cell">
										{historyColumnLabel(n)}
									</span>
								))}
							</div>
						)}
						<SolveList renderRow={renderSolveRow} length={solves.length} getScrollParent={getScrollParent} />
					</div>
				</div>
			</div>
		</GlobalHotKeys>
	);
}

interface SolveListProps {
	renderRow: (index: number) => JSX.Element;
	length: number;
	getScrollParent: (list: { getEl(): HTMLElement }) => HTMLElement | Window;
}

/**
 * The virtualized rows, redrawn only when a row can have changed. Every update of
 * react-list re-measures the row size and walks up the DOM with getComputedStyle to find
 * its scroll parent; that forced a layout on each timer step (about 45 ms on a 6x slowed
 * phone, mobile timer test). The scroll parent is the list itself, so it is handed over.
 */
const SolveList = React.memo(function SolveList({ renderRow, length, getScrollParent }: SolveListProps) {
	return <ReactList itemRenderer={renderRow} length={length} type="uniform" scrollParentGetter={getScrollParent} />;
});
