import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import jsonStr from 'json-stable-stringify';
import { FilterSolvesOptions } from '../../../db/solves/query';
import { useSolveDb } from '../../../util/hooks/useSolveDb';
import { useActiveSessionId } from '../../../util/hooks/useActiveSessionId';
import { useSettings } from '../../../util/hooks/useSettings';
import { useMe } from '../../../util/hooks/useMe';
import { getTimeString } from '../../../util/time';
import { openModal } from '../../../actions/general';
import { StatsModuleBlock, StatsBlockSortBy } from '../../../../server/schemas/StatsModule.schema';
import { Solve } from '../../../../server/schemas/Solve.schema';
import { defaultStatsModuleBlocks } from '../../../reducers/stats';
import { getNextSolveOutlook, NextSolveOutlook } from '../../../db/solves/stats/solves/average/window_math';
import SolveInfo from '../../solve_info/SolveInfo';
import HistoryModal from '../history/history_modal/HistoryModal';
import { getSessionFilter } from './util';
import { getStatLabel } from './stat_label';
import { computeStatsTable, TableRow } from './table_data';
import {
	extraColumnsUnlocked,
	isOutlookColumn,
	isTableRowVisible,
	resolveTableColumns,
	resolveTableRows,
	StatsTableColumn,
	tableRowLabel,
} from './stats_table';
import block from '../../../styles/bem';
import './QuickStats.scss';

const b = block('quick-stats');

// Work per frame when a large session needs a full pass (table_data.ts). A 12k session
// fits in one frame; 100k imported solves take a few, and the page never stalls.
const FRAME_BUDGET_MS = 8;

interface Props {
	filterOptions: FilterSolvesOptions;
}

/**
 * The stats module: cstimer's summary table, drawn as the same sheet as the solves grid and
 * the phase analysis (modules/history/_solve_grid.scss), with no footer: the owner removed
 * the count / mean / σ line (2026-11-23), the Stats page has those. One row per window size (a single,
 * mo3, ao5, ao12...), each with its current and best value, rows appearing as the session
 * reaches their size. It always reads the session on screen. Rows and the extra columns
 * (Pro) are chosen in "Customize stats" behind the module's gear.
 */
export default function QuickStats(props: Props) {
	const { filterOptions } = props;

	const { t } = useTranslation();
	const dispatch = useDispatch();
	const me = useMe();
	const sessionId = useActiveSessionId();
	const solveDb = useSolveDb();
	const storedRows = useSettings('stats_table_rows');
	const storedColumns = useSettings('stats_table_columns');
	const blocks = useSelector((state: any) => state?.stats?.blocks) as StatsModuleBlock[] | undefined;
	const [frame, setFrame] = useState(0);

	const unlocked = extraColumnsUnlocked(me);
	const rowsKey = jsonStr(storedRows ?? null);
	const columnsKey = jsonStr(storedColumns ?? null);
	const sizes = useMemo(() => resolveTableRows(storedRows, blocks, defaultStatsModuleBlocks), [rowsKey, blocks]);
	// The extra columns are Pro. The choice stays stored, so it comes back with Pro.
	const columns = useMemo(
		() => (unlocked ? resolveTableColumns(storedColumns, blocks) : []),
		[columnsKey, blocks, unlocked]
	);

	const filterKey = jsonStr(filterOptions);
	const filter = useMemo(() => getSessionFilter(filterOptions, sessionId), [filterKey, sessionId]);
	const data = useMemo(
		() => computeStatsTable(filter, sizes, solveDb, FRAME_BUDGET_MS),
		[filter, sizes, solveDb, frame]
	);

	// A pass that ran out of budget goes on in the next frame.
	useEffect(() => {
		if (!data.pending) return;
		const id = requestAnimationFrame(() => setFrame((f) => f + 1));
		return () => cancelAnimationFrame(id);
	}, [data]);

	const { solves, total } = data;
	const visibleRows = data.rows.filter((row) => isTableRowVisible(row.n, total, columns));

	const outlookOn = columns.some(isOutlookColumn);
	const outlooks = useMemo(() => {
		const out = new Map<number, NextSolveOutlook | null>();
		if (!outlookOn) return out;
		for (const row of visibleRows) {
			// The newest n - 1 solves stay in the next window.
			const previous = solves.slice(Math.max(0, solves.length - (row.n - 1))).map((s) => (s.dnf ? -1 : s.time));
			const bestAverage = row.best ? row.best.value : row.hasWindow ? -1 : null;
			out.set(row.n, getNextSolveOutlook(previous, row.n, false, bestAverage));
		}
		return out;
	}, [data, outlookOn, columns]);

	function openSolve(solve: Solve | undefined) {
		if (solve) dispatch(openModal(<SolveInfo solveId={solve.id} />));
	}

	function openWindow(n: number, sortBy: StatsBlockSortBy, time: number, windowSolves: Solve[]) {
		// A live block for the solves modal, so a penalty given there updates it. Below 5 it
		// is a mean (mo3): nothing is bracketed as trimmed.
		const statOptions: StatsModuleBlock = {
			statType: n < 5 ? 'mean' : 'average',
			sortBy,
			averageCount: n,
			session: true,
			colorName: 'text',
		};
		const { key, params } = getStatLabel({ ...statOptions, session: false });
		dispatch(
			openModal(
				<HistoryModal
					statOptions={statOptions}
					filterOptions={filterOptions}
					time={time}
					solves={windowSolves}
					description={t(key, params)}
				/>
			)
		);
	}

	function valueCell(key: string, value: number | null, onOpen?: () => void) {
		const text = value === null ? '-' : getTimeString(value);
		return (
			<div key={key} role="cell" className={b('cell')}>
				{onOpen && value !== null ? (
					<button type="button" className={b('open')} onClick={onOpen}>
						{text}
					</button>
				) : (
					text
				)}
			</div>
		);
	}

	function outlookCell(column: StatsTableColumn, outlook: NextSolveOutlook | null | undefined) {
		let text = '-';
		if (outlook) {
			if (column === 'bpa') text = getTimeString(outlook.best);
			if (column === 'wpa') text = getTimeString(outlook.worst);
			if (column === 'target' && outlook.target !== null) {
				const target = outlook.target;
				text = target === 'never' ? '-' : target === 'always' ? '∞' : getTimeString(target);
			}
		}
		return (
			<div key={column} role="cell" className={b('cell')}>
				{text}
			</div>
		);
	}

	function sizeCell(label: string) {
		return (
			<div role="rowheader" className={b('cell', { size: true })}>
				{label}
			</div>
		);
	}

	const { single } = data;
	const last = solves[solves.length - 1];
	const singleRow = (
		<div role="row" className={b('row')}>
			{sizeCell(t('timer_modules.stats_table.single'))}
			{valueCell('current', last ? (last.dnf ? -1 : last.time) : null, () => openSolve(last))}
			{valueCell('best', single.best?.value ?? null, () => openSolve(solves[single.best.start]))}
			{columns.map((column) =>
				column === 'worst'
					? valueCell('worst', single.worst?.value ?? null, () => openSolve(solves[single.worst.start]))
					: outlookCell(column, null)
			)}
		</div>
	);

	function averageRow(row: TableRow) {
		const { n } = row;
		const windowOf = (start: number) => solves.slice(start, start + n);
		return (
			<div key={n} role="row" className={b('row')}>
				{sizeCell(tableRowLabel(n))}
				{valueCell('current', row.current, () => openWindow(n, 'current', row.current, windowOf(solves.length - n)))}
				{valueCell('best', row.best?.value ?? null, () =>
					openWindow(n, 'best', row.best.value, windowOf(row.best.start))
				)}
				{columns.map((column) =>
					column === 'worst'
						? valueCell('worst', row.worst?.value ?? null, () =>
								openWindow(n, 'worst', row.worst.value, windowOf(row.worst.start))
						  )
						: outlookCell(column, outlooks.get(n))
				)}
			</div>
		);
	}

	const style = { '--zt-stats-values': 2 + columns.length } as React.CSSProperties;

	return (
		<div className={b()} style={style}>
			<div role="table" className={b('list')}>
				<div role="row" className={b('head')}>
					<div role="columnheader" className={b('cell', { head: true, size: true })}>
						<span className="sr-only">{t('timer_modules.stats_table.size')}</span>
					</div>
					<div role="columnheader" className={b('cell', { head: true })}>
						{t('timer_modules.stats_table.current')}
					</div>
					<div role="columnheader" className={b('cell', { head: true })}>
						{t('timer_modules.stats_table.best')}
					</div>
					{columns.map((column) => (
						<div key={column} role="columnheader" className={b('cell', { head: true })}>
							{t(`timer_modules.stats_table.${column}`)}
						</div>
					))}
				</div>
				{singleRow}
				{visibleRows.map(averageRow)}
			</div>
		</div>
	);
}
