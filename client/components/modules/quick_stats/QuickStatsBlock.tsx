import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FilterSolvesOptions } from '../../../db/solves/query';
import { StatsModuleBlock } from '../../../../server/schemas/StatsModule.schema';
import { getStatsBlockDescription, getStatsBlockValueFromFilter } from './util';
import { getStatLabel } from './stat_label';
import { useColor } from '../../../util/hooks/useTheme';
import { useMe } from '../../../util/hooks/useMe';
import jsonStr from 'json-stable-stringify';
import { useActiveSessionId } from '../../../util/hooks/useActiveSessionId';
import { getTimeString } from '../../../util/time';
import { useDispatch } from 'react-redux';
import { openModal } from '../../../actions/general';
import SolveInfo from '../../solve_info/SolveInfo';
import HistoryModal from '../history/history_modal/HistoryModal';
import CSS from 'csstype';
import { useSolveDb } from '../../../util/hooks/useSolveDb';

interface Props {
	filterOptions?: FilterSolvesOptions;
	statOptions: StatsModuleBlock;
	rowSpan: number;
	colSpan: number;
	/**
	 * Drawn inside another control (the Customize Stats grid wraps each block in its own
	 * button): the value is not a button of its own, since a button inside a button is
	 * invalid HTML and React warns about it.
	 */
	preview?: boolean;
}

export default function QuickStatsBlock(props: Props) {
	const { rowSpan, filterOptions, colSpan, statOptions, preview } = props;

	const dispatch = useDispatch();
	const sessionId = useActiveSessionId();
	const [fontSize, setFontSize] = useState(25);
	const me = useMe();
	const statsBlockDiv = useRef<HTMLDivElement>(null);
	const solveDb = useSolveDb();

	const [statsBlockSolvesFilter, statsBlockDescription] = useMemo(() => {
		return [
			getStatsBlockValueFromFilter(statOptions, filterOptions, sessionId),
			getStatsBlockDescription(statOptions, filterOptions),
		];
	}, [jsonStr(filterOptions), statOptions, sessionId, solveDb]);

	const solveCount = statsBlockSolvesFilter?.solves?.length;

	const blockClasses = [
		'grid',
		'grid-rows-[max-content_1fr]',
		'bg-tmo-module/5',
		'rounded-md',
		'w-full',
		'h-full',
		'p-1.5',
	];

	// "Session Mean" identify -> session: true AND (no averageCount OR averageCount 0)
	const isSessionMean = statOptions.session && statOptions.statType === 'average' && !statOptions.averageCount;

	const buttonClasses = [
		'relative',
		'border-b-2',
		'border-solid',
		'border-transparent',
		'-translate-y-1/2',
		'top-[45%]',
		'p-0',
		'p-y-1',
		'font-bold',
		'table',
		'text-left',
		'text-text',
	];

	if (isSessionMean) {
		buttonClasses.push('pointer-events-none');
	}

	const buttonStyle: CSS.Properties = {
		fontSize: `${fontSize}px`,
		lineHeight: 0.9,
	};
	const colorHex = useColor(statOptions.colorName, 'button_color');
	if (me?.is_pro && colorHex) {
		buttonStyle.color = colorHex.hex;
	}

	if (statsBlockSolvesFilter?.solve || solveCount) {
		buttonClasses.push('hover:border-current');
	}

	const statValue = getTimeString(statsBlockSolvesFilter?.time);

	useEffect(() => {
		const width = statsBlockDiv.current.clientWidth;
		const height = statsBlockDiv.current.clientHeight;

		const newFontSizeBasedOnHeight = height / 3;
		const newFontSizeBasedOnWidth = width / 4.5;
		const newFontSize = Math.min(newFontSizeBasedOnHeight, newFontSizeBasedOnWidth);

		const absoluteMaxFontSize = 70;
		const absoluteMinFontSize = 12;

		setFontSize(Math.min(absoluteMaxFontSize, Math.max(newFontSize, absoluteMinFontSize)));
	}, [rowSpan, colSpan]);

	function openSolve(e) {
		// En iyi/kötü süre veya AO5/12 gibi istatistikler açılabilir.
		// ANCAK: Kullanıcı isteği üzerine "Session Mean" (tüm oturum ortalaması) açılmamalıdır.
		// Çünkü çok fazla veri olduğunda modal açılması performans sorunu yaratabilir veya istenmiyor.
		// "Session Mean" -> session: true ve averageCount yok (veya 0)
		const isSessionMean = statOptions.session && statOptions.statType === 'average' && !statOptions.averageCount;

		if (isSessionMean) {
			e.preventDefault();
			return;
		}

		if (solveCount > 1) {
			dispatch(
				openModal(
					<HistoryModal
						// Live update için gerekli parametreler
						statOptions={statOptions}
						filterOptions={filterOptions}
						// Fallback değerler
						time={statsBlockSolvesFilter?.time}
						solves={statsBlockSolvesFilter.solves}
						description={statsBlockDescription}
					/>
				)
			);
		} else if (solveCount || statsBlockSolvesFilter?.solve) {
			dispatch(openModal(<SolveInfo solveId={statsBlockSolvesFilter.solve.id} />));
		} else {
			e.preventDefault();
		}
	}

	return (
		<div className={blockClasses.join(' ')} ref={statsBlockDiv}>
			<div className="flex flex-row min-w-0">
				<StatDescription statOptions={statOptions} />
			</div>
			<div className="relative w-full h-full flex items-start justify-center">
				{isSessionMean || preview ? (
					<div className={buttonClasses.join(' ')} style={buttonStyle}>
						{statValue}
					</div>
				) : (
					<button onClick={openSolve} className={buttonClasses.join(' ')} style={buttonStyle}>
						{statValue}
					</button>
				)}
			</div>
		</div>
	);
}

interface DescProps {
	statOptions: StatsModuleBlock;
}

function StatDescription(props: DescProps) {
	const { statOptions } = props;
	const { t } = useTranslation();

	if (!statOptions) {
		return null;
	}

	const { key, params } = getStatLabel(statOptions);
	const text = t(key, params);

	// Full contrast: the caption names the number under it, and a faded caption reads
	// as disabled. Long captions ("Session best ao100") end in an ellipsis in a narrow
	// block, with the whole text on hover.
	return (
		<span className="text-[0.8rem] font-medium px-0.5 text-text truncate" title={text}>
			{text}
		</span>
	);
}
