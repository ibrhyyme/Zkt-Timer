import React from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import CSS from 'csstype';
import { FilterSolvesOptions } from '../../../db/solves/query';
import { StatsModuleBlock } from '../../../../server/schemas/StatsModule.schema';
import { StatsBlockResult } from './util';
import { getStatLabel } from './stat_label';
import { useColor } from '../../../util/hooks/useTheme';
import { useMe } from '../../../util/hooks/useMe';
import { isPro } from '../../../lib/pro';
import { openModal } from '../../../actions/general';
import SolveInfo from '../../solve_info/SolveInfo';
import HistoryModal from '../history/history_modal/HistoryModal';
import block from '../../../styles/bem';

const b = block('quick-stats');

interface Props {
	statOptions: StatsModuleBlock;
	result: StatsBlockResult | null;
	/** The result as shown ("12.34", "118/123", "∞"). */
	value: string;
	filterOptions?: FilterSolvesOptions;
	fontSize: number;
}

/**
 * One cell of the stats module: the caption and the value under it.
 *
 * A value that stands for solves opens them: one solve opens it, an average opens its window.
 * A count, a whole-scope mean or σ have no list of their own and are plain text, so a
 * session of thousands of solves never opens as one modal.
 */
export default function QuickStatsBlock(props: Props) {
	const { statOptions, result, value, filterOptions, fontSize } = props;

	const { t } = useTranslation();
	const dispatch = useDispatch();
	const me = useMe();
	const colorHex = useColor(statOptions.colorName, 'button_color');

	const { key, params } = getStatLabel(statOptions);
	const caption = t(key, params);

	const solves = result?.solves || [];
	const single = result?.solve || (solves.length === 1 ? solves[0] : null);
	const canOpen = solves.length > 1 || !!single;

	function open() {
		if (solves.length > 1) {
			dispatch(
				openModal(
					<HistoryModal
						// Live update için gerekli parametreler
						statOptions={statOptions}
						filterOptions={filterOptions}
						// Fallback değerler
						time={result.time}
						solves={solves}
						description={caption}
					/>
				)
			);
		} else if (single) {
			dispatch(openModal(<SolveInfo solveId={single.id} />));
		}
	}

	const valueStyle: CSS.Properties = { fontSize: `${fontSize}px` };
	// isPro, not me.is_pro: granting Premium clears is_pro, which hid a Premium member's colour.
	if (isPro(me) && colorHex) {
		valueStyle.color = colorHex.hex;
	}

	return (
		<div className={b('cell')}>
			{/* Full contrast: the caption names the number under it, and a faded caption reads
			    as disabled. A long one ends in an ellipsis, with the whole text on hover. */}
			<span className={b('caption')} title={caption}>
				{caption}
			</span>
			<div className={b('value-box')}>
				{canOpen ? (
					<button type="button" className={b('value', { action: true })} style={valueStyle} onClick={open}>
						{value}
					</button>
				) : (
					<span className={b('value')} style={valueStyle}>
						{value}
					</span>
				)}
			</div>
		</div>
	);
}
