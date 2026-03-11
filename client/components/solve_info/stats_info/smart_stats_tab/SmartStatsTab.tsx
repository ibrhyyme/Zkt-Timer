import React from 'react';
import StepsTable from '../steps_table/StepsTable';
import CombinedTimeline from '../combined_timeline/CombinedTimeline';
import StepPie from '../step_pie/StepPie';
import block from '../../../../styles/bem';
import { Solve } from '../../../../../server/schemas/Solve.schema';
import './SmartStatsTab.scss';

const b = block('solve-info-smart-stats');

interface Props {
	solve: Solve;
}

export default function SmartStatsTab(props: Props) {
	const { solve } = props;

	return (
		<div className={b()}>
			<StepsTable solve={solve} />
			<div className={b('charts')}>
				<div className={b('timeline')}>
					<CombinedTimeline solve={solve} />
				</div>
				<div className={b('donut')}>
					<StepPie solve={solve} />
				</div>
			</div>
		</div>
	);
}
