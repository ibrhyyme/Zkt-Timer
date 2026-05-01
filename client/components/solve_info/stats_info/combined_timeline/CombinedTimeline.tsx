import React from 'react';
import { getSolveStepsWithoutParents } from '../../util/solution';
import { STEP_NAME_MAP } from '../../util/consts';
import block from '../../../../styles/bem';
import { Solve } from '../../../../../server/schemas/Solve.schema';
import { getTimeString } from '../../../../util/time';
import './CombinedTimeline.scss';

const b = block('solve-info-combined-timeline');

interface Props {
	solve: Solve;
}

export default function CombinedTimeline(props: Props) {
	const { solve } = props;

	const steps = getSolveStepsWithoutParents(solve);

	// En uzun toplam süreyi bul (bar genişlikleri için referans)
	let maxStepTime = 0;
	for (const step of steps) {
		const stepTotal = step.total_time || 0;
		if (stepTotal > maxStepTime) {
			maxStepTime = stepTotal;
		}
	}

	if (maxStepTime === 0) maxStepTime = 1;

	function fmt(val: number): string {
		return getTimeString(val, 2) + 's';
	}

	return (
		<div className={b()}>
			{steps.map((step) => {
				const total = step.total_time || 0;
				const rec = step.recognition_time || 0;
				const exec = Math.max(0, total - rec);

				if (total === 0) return null;

				const recPercent = (rec / maxStepTime) * 100;
				const execPercent = (exec / maxStepTime) * 100;

				return (
					<div key={step.step_name} className={b('step')}>
						<div className={b('label')}>
							{STEP_NAME_MAP[step.step_name] || step.step_name}
						</div>
						<div className={b('bar-row')}>
							{rec > 0 && (
								<div
									className={b('segment', { rec: true })}
									style={{ width: `${recPercent}%` }}
								/>
							)}
							{exec > 0 && (
								<div
									className={b('segment', { exec: true })}
									style={{ width: `${execPercent}%` }}
								/>
							)}
						</div>
						<div className={b('values')}>
							{rec > 0 && <span className={b('val-rec')}>{fmt(rec)}</span>}
							{exec > 0 && <span className={b('val-exec')}>{fmt(exec)}</span>}
						</div>
					</div>
				);
			})}
		</div>
	);
}
