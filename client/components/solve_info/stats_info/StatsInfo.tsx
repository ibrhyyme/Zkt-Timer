import React from 'react';
import { useTranslation } from 'react-i18next';
import './StatsInfo.scss';
import { Timer, ArrowCounterClockwise, ArrowsClockwise, CaretUp, CaretDown } from 'phosphor-react';
import StepPie from './step_pie/StepPie';
import RecognitionChart from './recognition_chart/RecognitionChart';
import ExecutionTime from './execution_time/ExecutionTime';
import block from '../../../styles/bem';
import { Solve } from '../../../../server/schemas/Solve.schema';
import { getTimeString } from '../../../util/time';

const b = block('solve-info-stats-info');

interface Props {
	solve: Solve;
	hideCards?: boolean;
}

export default function StatsInfo(props: Props) {
	const { solve, hideCards } = props;
	const { t } = useTranslation();

	const time = solve.raw_time;
	const smartTurnCount = solve.smart_turn_count;
	const smartInspectionTime = solve.inspection_time;
	const tps = Math.floor((smartTurnCount / time) * 10) / 10;

	function getStatCard(icon: React.ReactNode, title: string, val: number | string) {
		return (
			<div className={b('card')}>
				{icon}
				<p>{title}</p>
				<h4>{val}</h4>
			</div>
		);
	}

	return (
		<div className={b()}>
			{!hideCards && (
				<div className={b('card').mix(b('section'))}>
					{getStatCard(<ArrowsClockwise />, t('solve_info.tps'), tps)}
					{getStatCard(<Timer />, t('solve_info.inspection'), smartInspectionTime ? smartInspectionTime + 's' : '-')}
					{getStatCard(<ArrowCounterClockwise />, t('solve_info.turns'), smartTurnCount)}
					{solve.smart_pick_up_time ? getStatCard(<CaretUp />, t('solve_info.pick_up'), getTimeString(solve.smart_pick_up_time, 2) + 's') : null}
					{solve.smart_put_down_time ? getStatCard(<CaretDown />, t('solve_info.put_down'), getTimeString(solve.smart_put_down_time, 2) + 's') : null}
				</div>
			)}
			<hr />
			<div className={b('section')}>
				<StepPie solve={solve} />
			</div>
			<hr />
			<div className={b('section')}>
				<ExecutionTime solve={solve} />
			</div>
			<hr />
			<div className={b('section')}>
				<RecognitionChart solve={solve} />
			</div>
		</div>
	);
}
