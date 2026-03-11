import React from 'react';
import CombinedTimeline from '../combined_timeline/CombinedTimeline';
import StepPie from '../step_pie/StepPie';
import block from '../../../../styles/bem';
import { Solve } from '../../../../../server/schemas/Solve.schema';
import './SmartOverviewTab.scss';

const b = block('solve-info-smart-overview');

interface Props {
	solve: Solve;
}

export default function SmartOverviewTab(props: Props) {
	const { solve } = props;

	return (
		<div className={b()}>
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
