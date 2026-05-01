import React from 'react';
import { useTranslation } from 'react-i18next';
import { getSolveStepsWithoutParents } from '../../util/solution';
import { STEP_NAME_MAP } from '../../util/consts';
import block from '../../../../styles/bem';
import { Solve } from '../../../../../server/schemas/Solve.schema';
import { getTimeString } from '../../../../util/time';
import './StepsTable.scss';

const b = block('solve-info-steps-table');

interface Props {
	solve: Solve;
}

export default function StepsTable(props: Props) {
	const { solve } = props;
	const { t } = useTranslation();

	const steps = getSolveStepsWithoutParents(solve);
	const inspectionTime = solve.inspection_time || 0;
	const pickupTime = solve.smart_pick_up_time || 0;
	const putdownTime = solve.smart_put_down_time || 0;

	let totalRec = 0;
	let totalExec = 0;
	let totalTurns = 0;

	for (const step of steps) {
		const stepTotal = step.total_time || 0;
		const stepRec = step.recognition_time || 0;
		totalRec += stepRec;
		totalExec += Math.max(0, stepTotal - stepRec);
		totalTurns += step.turn_count || 0;
	}

	const totalStepTime = totalRec + totalExec;
	const totalTps = totalStepTime > 0 ? (totalTurns / totalStepTime).toFixed(2) : '-';

	// Kümülatif süre
	let cumulative = 0;
	const cumulativeTimes: number[] = [];
	for (const step of steps) {
		cumulative += step.total_time || 0;
		cumulativeTimes.push(cumulative);
	}

	function fmt(val: number | null | undefined, suffix = 's'): string {
		if (val == null || val === 0) return '-';
		return getTimeString(val, 2) + suffix;
	}

	return (
		<div className={b()}>
			{pickupTime > 0 && (
				<div className={b('meta-row')}>
					{t('solve_info.pickup_time')}: {fmt(pickupTime)}
				</div>
			)}

			<table className={b('table')}>
				<thead>
					<tr>
						<th>{t('solve_info.step')}</th>
						<th>{t('solve_info.recognition')}</th>
						<th>{t('solve_info.execution')}</th>
						<th>{t('solve_info.step_time')}</th>
						<th>{t('solve_info.total_time')}</th>
						<th>{t('solve_info.turns')}</th>
						<th>TPS</th>
					</tr>
				</thead>
				<tbody>
					{steps.map((step, i) => {
						const stepTime = step.total_time || 0;
						const rec = step.recognition_time || 0;
						const exec = Math.max(0, stepTime - rec);
						return (
							<tr key={step.step_name}>
								<td>{STEP_NAME_MAP[step.step_name] || step.step_name}</td>
								<td>{fmt(rec)}</td>
								<td>{fmt(exec)}</td>
								<td>{fmt(stepTime)}</td>
								<td className={b('cumulative')}>{fmt(cumulativeTimes[i])}</td>
								<td>{step.turn_count || '-'}</td>
								<td>{step.tps ? step.tps.toFixed(2) : '-'}</td>
							</tr>
						);
					})}
				</tbody>
				<tfoot>
					<tr className={b('total-row')}>
						<td>{t('solve_info.total')}</td>
						<td>{fmt(totalRec)}</td>
						<td>{fmt(totalExec)}</td>
						<td>{fmt(totalStepTime)}</td>
						<td></td>
						<td>{totalTurns}</td>
						<td>{totalTps}</td>
					</tr>
				</tfoot>
			</table>

			{putdownTime > 0 && (
				<div className={b('meta-row')}>
					{t('solve_info.putdown_time')}: {fmt(putdownTime)}
				</div>
			)}
		</div>
	);
}
