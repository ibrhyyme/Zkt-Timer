import React from 'react';
import { useTranslation } from 'react-i18next';
import { getRecognitionExecution, getSolveStepsWithoutParents } from '../../util/solution';
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

	const split = getRecognitionExecution(solve);
	const totalRec = split?.recognition ?? 0;
	const totalExec = split?.execution ?? 0;

	// Turns and time come from the same rows. For a complete breakdown the engine's
	// boundary-aware HTM makes SUM(step.turn_count) === smart_turn_count, so this is the
	// same number as before. For one whose last phases are missing (a DNF), the whole
	// solve's turns over only the stored steps' time inflated the TPS.
	const totalStepTime = totalRec + totalExec;
	const stepTurns = steps.reduce((sum, step) => sum + (step.turn_count || 0), 0);
	const totalTurns = stepTurns || solve.smart_turn_count || 0;
	const totalTps = totalStepTime > 0 && totalTurns > 0
		? (totalTurns / totalStepTime).toFixed(2)
		: '-';

	// Kümülatif süre
	let cumulative = 0;
	const cumulativeTimes: number[] = [];
	for (const step of steps) {
		cumulative += step.total_time || 0;
		cumulativeTimes.push(cumulative);
	}

	// Step time is recognition plus execution, the running total is the sum of the rows
	// above: both can be read off the rest, so a phone leaves them out (StepsTable.scss).
	// Seven columns did not fit one and pushed the whole card sideways.
	const secondary = b('col', { secondary: true }).toString();

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
						<th className={secondary}>{t('solve_info.step_time')}</th>
						<th className={secondary}>{t('solve_info.total_time')}</th>
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
								<td className={secondary}>{fmt(stepTime)}</td>
								<td className={b('cumulative') + ' ' + secondary}>{fmt(cumulativeTimes[i])}</td>
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
						<td className={secondary}>{fmt(totalStepTime)}</td>
						<td className={secondary}></td>
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
