import React, { useMemo } from 'react';
import './HistoryModal.scss';
import { AlignLeft } from 'phosphor-react';
import block from '../../../../styles/bem';
import Emblem from '../../../common/emblem/Emblem';
import History from '../History';
import { getTimeString } from '../../../../util/time';
import SolvesText from '../../solves_text/SolvesText';
import Button, { CommonType } from '../../../common/button/Button';
import { getCubeTypeInfoById } from '../../../../util/cubes/util';
import { useToggle } from '../../../../util/hooks/useToggle';
import Checkbox from '../../../common/checkbox/Checkbox';
import { Solve } from '../../../../../server/schemas/Solve.schema';

const b = block('history-modal');

import { FilterSolvesOptions } from '../../../../db/solves/query';
import { StatsModuleBlock } from '../../../../../server/schemas/StatsModule.schema';
import { getStatsBlockValueFromFilter } from '../../quick_stats/util';
import { useSolveDb } from '../../../../util/hooks/useSolveDb';
import { useSettings } from '../../../../util/hooks/useSettings';
import { useDispatch } from 'react-redux';
import { closeModal } from '../../../../actions/general';

interface Props {
	solves?: Solve[];
	description?: string;
	time?: number;
	disabled?: boolean;
	showAsText?: boolean;
	statOptions?: StatsModuleBlock;
	filterOptions?: FilterSolvesOptions;
}

export default function HistoryModal(props: Props) {
	const { description, disabled, showAsText, statOptions, filterOptions } = props;
	const [showText, toggleShowText] = useToggle(showAsText);
	const [reverseOrder, toggleReverseOrder] = useToggle(false);
	const dispatch = useDispatch();

	const sessionId = useSettings('session_id');
	useSolveDb(); // Trigger re-render on DB changes

	// Live data calculation
	const liveData = useMemo(() => {
		if (statOptions) {
			return getStatsBlockValueFromFilter(statOptions, filterOptions, sessionId);
		}
		return null;
	}, [statOptions, filterOptions, sessionId, useSolveDb()]); // useSolveDb returns version/trigger

	// Eğer canlı moddaysak ve veri gelmiyorsa (örn: AO12 için 11 süre kaldıysa), modalı kapat
	React.useEffect(() => {
		if (statOptions && liveData === null) {
			dispatch(closeModal());
		}
	}, [statOptions, liveData]);

	const effectiveSolves = liveData ? liveData.solves : props.solves;
	const effectiveTime = liveData ? liveData.time : props.time;

	const timeString = getTimeString(effectiveTime);

	const solves = useMemo(() => {
		if (!effectiveSolves) return [];
		return [...effectiveSolves].sort((a, b) => b.started_at - a.started_at);
	}, [effectiveSolves]);

	const cubeTypes = useMemo(() => {
		const types = new Set<string>();
		for (const solve of solves) {
			types.add(solve.cube_type);
		}

		const output = [];
		for (const type of types) {
			const cubeName = getCubeTypeInfoById(type).name;
			output.push(cubeName);
		}

		return output;
	}, [solves, solves?.length]);

	const lastSolve = solves[solves.length - 1];

	let body;
	if (showText) {
		body = <SolvesText reverseOrder={reverseOrder} description={description} time={effectiveTime} solves={solves} />;
	} else {
		body = <History reverseOrder={reverseOrder} disabled={disabled} solves={solves} />;
	}

	let timeBody;
	if (effectiveTime && timeString) {
		timeBody = (
			<>
				: <span>{timeString}</span>
			</>
		);
	}

	const isSingleSolve = solves.length === 1;

	return (
		<div className={b()}>
			{!isSingleSolve && (
				<div className={b('toggle-text')}>
					<Button
						primary
						icon={<AlignLeft />}
						text={showText ? 'Liste olarak görüntüle' : 'Metin olarak görüntüle'}
						onClick={() => toggleShowText()}
						theme={showText ? CommonType.WHITE : CommonType.GRAY}
					/>
				</div>
			)}
			<div className={b('header')}>
				<h2>
					{description}
					{timeBody}
				</h2>
				<p>{lastSolve ? new Date(lastSolve.started_at).toLocaleDateString() : '-'}</p>
				<div className={b('cube-types')}>
					{cubeTypes.map((ct) => (
						<Emblem key={ct} text={ct} />
					))}
				</div>
			</div>
			<div className={b('body')}>
				{!isSingleSolve && (
					<Checkbox
						text="Ters sıra"
						checked={reverseOrder}
						onChange={(e) => toggleReverseOrder(e.target.checked)}
					/>
				)}
				{body}
			</div>
		</div>
	);
}
