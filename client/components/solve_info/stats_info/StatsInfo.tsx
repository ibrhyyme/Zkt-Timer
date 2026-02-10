import React from 'react';
import './StatsInfo.scss';
import { Timer, ArrowCounterClockwise, ArrowsClockwise, CaretUp, CaretDown } from 'phosphor-react';
import StepPie from './step_pie/StepPie';
import RecognitionChart from './recognition_chart/RecognitionChart';
import ExecutionTime from './execution_time/ExecutionTime';
import block from '../../../styles/bem';
import { Solve } from '../../../../server/schemas/Solve.schema';

const b = block('solve-info-stats-info');

interface Props {
	solve: Solve;
}

export default function StatsInfo(props: Props) {
	const { solve } = props;

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
			<div className={b('card').mix(b('section'))}>
				{getStatCard(<ArrowsClockwise />, 'Turns Per Second', tps)}
				{getStatCard(<Timer />, 'Inspection Time', smartInspectionTime ? smartInspectionTime + 's' : '-')}
				{getStatCard(<ArrowCounterClockwise />, 'Turns', smartTurnCount)}
				{solve.smart_pick_up_time ? getStatCard(<CaretUp />, 'Pick Up', solve.smart_pick_up_time.toFixed(2) + 's') : null}
				{solve.smart_put_down_time ? getStatCard(<CaretDown />, 'Pull Down', solve.smart_put_down_time.toFixed(2) + 's') : null}
			</div>
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
