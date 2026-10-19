import React from 'react';
import { useTranslation } from 'react-i18next';
import { X, Bluetooth } from 'phosphor-react';
import './HistorySolveRow.scss';
import block from '../../../../styles/bem';
import { getTimeString } from '../../../../util/time';
import { useDispatch } from 'react-redux';
import { openModal } from '../../../../actions/general';
import SolveInfo from '../../../solve_info/SolveInfo';
import { deleteSolveDb } from '../../../../db/solves/update';
import { Solve } from '../../../../../server/schemas/Solve.schema';
import { useGeneral } from '../../../../util/hooks/useGeneral';
import { formatSolveNumber, solveNumberGroupSeparator } from '../history_grid';

const b = block('history-solve-row');

interface Props {
	index: number;
	disabled?: boolean;
	solve: Solve;
	isPb?: boolean;
	highlightMode?: string;
	/** True for exactly the render(s) where this row is the solve that just landed
	 * on top of the list — see History.tsx / newest_arrival.ts. Drives a one-shot
	 * CSS entrance animation, never a re-trigger on later re-renders of the same row. */
	isNewestArrival?: boolean;
	/** The aoN ending at this solve, one per grid column (rolling_average.ts conventions:
	 * NaN = not enough solves yet, -1 = DNF). Desktop only. */
	averages?: number[];
	/** Per column: this row holds the column's best average. */
	bestAverages?: boolean[];
	onOpenAverage?: (columnIndex: number) => void;
}

/**
 * One row of the solves grid (cstimer style): number, time, then the rolling averages
 * on the desktop, or number, time and delete on a phone.
 *
 * The whole row opens the solve card. Penalties are changed from there or from the
 * timer's own +2 / DNF buttons; the per-row +2 / DNF toggles are gone (feedback 1.9-f),
 * and so is the desktop delete, which the solve card has (decision K-5).
 */
function HistorySolveRow(props: Props) {
	const { index, solve, disabled, isPb, highlightMode, isNewestArrival, averages, bestAverages, onOpenAverage } = props;
	const { t, i18n } = useTranslation();
	const mobileMode = useGeneral('mobile_mode');

	const dispatch = useDispatch();

	function deleteSolve(event: React.MouseEvent) {
		// The row behind the button opens the solve card.
		event.stopPropagation();
		deleteSolveDb(solve);
	}

	function openSolve() {
		dispatch(openModal(<SolveInfo solve={solve} solveId={solve.id} disabled={disabled} />, { width: 1000 }));
	}

	function onRowKeyDown(event: React.KeyboardEvent) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			openSolve();
		}
	}

	const dnf = solve.dnf;
	const plusTwo = solve.plus_two && !dnf;
	const pbColor = isPb && highlightMode === 'color';
	const pbBold = isPb && highlightMode === 'bold';

	// solve.time already carries the +2 and is -1 for a DNF (db/solves/update.tsx).
	const time = dnf ? 'DNF' : getTimeString(solve.time);
	const timeTitle = dnf && solve.raw_time > 0 ? `DNF (${getTimeString(solve.raw_time)})` : undefined;

	return (
		<div
			className={b({ mobile: mobileMode, new: isNewestArrival })}
			role="button"
			// A click target, not a gesture owner: a desktop module can still be picked
			// up by one of its rows (timer/tiles/drag_target.ts).
			data-tile-drag=""
			tabIndex={0}
			onClick={openSolve}
			onKeyDown={onRowKeyDown}
		>
			<span className={b('cell', { index: true })}>{formatSolveNumber(index + 1, solveNumberGroupSeparator(i18n.language))}</span>

			<span className={b('cell', { time: true })} title={timeTitle}>
				<span className={b('time', { plusTwo, dnf, pbColor, pbBold })}>
					{time}
					{plusTwo && <span className={b('penalty')}>+</span>}
				</span>
				{solve.is_smart_cube && <Bluetooth className={b('smart')} aria-hidden="true" />}
			</span>

			{averages?.map((value, column) => {
				const empty = value === undefined || Number.isNaN(value);
				const best = !empty && value > 0 && bestAverages?.[column] && highlightMode !== 'off';
				return (
					<button
						type="button"
						key={column}
						className={b('cell', { average: true, best, empty })}
						disabled={empty}
						onClick={(event) => {
							event.stopPropagation();
							onOpenAverage?.(column);
						}}
					>
						{empty ? '-' : getTimeString(value)}
					</button>
				);
			})}

			{mobileMode && !disabled && (
				<button
					type="button"
					title={t('timer_modules.delete_solve')}
					aria-label={t('timer_modules.delete_solve')}
					className={b('cell', { remove: true })}
					onClick={deleteSolve}
				>
					<X weight="bold" />
				</button>
			)}
		</div>
	);
}

// Memoized to prevent re-renders when solve data hasn't changed
export default React.memo(HistorySolveRow);
