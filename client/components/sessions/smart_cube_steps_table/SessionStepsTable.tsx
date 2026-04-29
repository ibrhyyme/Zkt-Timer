import React from 'react';
import { useTranslation } from 'react-i18next';
import { fetchSolves } from '../../../db/solves/query';
import { useSolveDb } from '../../../util/hooks/useSolveDb';
import { getSolveStepsWithoutParents } from '../../solve_info/util/solution';
import { STEP_NAME_MAP } from '../../solve_info/util/consts';
import block from '../../../styles/bem';
import '../../solve_info/stats_info/steps_table/StepsTable.scss';
import './SessionStepsTable.scss';

const b = block('solve-info-steps-table');
const bSession = block('session-steps-table');

const PHASE_ORDER = ['cross', 'f2l_1', 'f2l_2', 'f2l_3', 'f2l_4', 'oll', 'pll'];

interface Props {
	sessionId: string;
}

interface PhaseAggregate {
	recognition: number[];
	execution: number[];
	stepTime: number[];
	cumulative: number[];
	turns: number[];
}

function emptyAgg(): PhaseAggregate {
	return { recognition: [], execution: [], stepTime: [], cumulative: [], turns: [] };
}

function avg(arr: number[]): number {
	if (!arr.length) return 0;
	return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function fmt(val: number | null | undefined, suffix = 's'): string {
	if (val == null || val === 0) return '-';
	return val.toFixed(2) + suffix;
}

export default function SessionStepsTable({ sessionId }: Props) {
	const { t } = useTranslation();
	useSolveDb();

	const solves = fetchSolves({
		session_id: sessionId,
		is_smart_cube: true,
		dnf: false,
	});

	if (!solves.length) return null;

	// Phase başına aggregate
	const aggregates: Record<string, PhaseAggregate> = {};
	for (const phase of PHASE_ORDER) {
		aggregates[phase] = emptyAgg();
	}

	for (const solve of solves) {
		const steps = getSolveStepsWithoutParents(solve);
		let cumulative = 0;

		// Önce phase'leri sırayla map'e koy ki cumulative tutarlı olsun
		const byPhase: Record<string, any> = {};
		for (const step of steps) {
			byPhase[step.step_name] = step;
		}

		for (const phase of PHASE_ORDER) {
			const step = byPhase[phase];
			if (!step) continue;
			const total = step.total_time || 0;
			const rec = step.recognition_time || 0;
			const exec = Math.max(0, total - rec);
			cumulative += total;

			aggregates[phase].recognition.push(rec);
			aggregates[phase].execution.push(exec);
			aggregates[phase].stepTime.push(total);
			aggregates[phase].cumulative.push(cumulative);
			aggregates[phase].turns.push(step.turn_count || 0);
		}
	}

	// Hangi phase'lerde data var?
	const visiblePhases = PHASE_ORDER.filter(p => aggregates[p].stepTime.length > 0);

	if (!visiblePhases.length) return null;

	// Footer toplamları (ortalamaların toplamı)
	let totalRec = 0;
	let totalExec = 0;
	let totalStepTime = 0;
	let totalTurns = 0;
	for (const phase of visiblePhases) {
		totalRec += avg(aggregates[phase].recognition);
		totalExec += avg(aggregates[phase].execution);
		totalStepTime += avg(aggregates[phase].stepTime);
		totalTurns += avg(aggregates[phase].turns);
	}
	const totalTps = totalStepTime > 0 ? (totalTurns / totalStepTime).toFixed(2) : '-';

	return (
		<div className={bSession()}>
			<h3 className={bSession('title')}>{t('sessions.session_steps_title')}</h3>
			<div className={b()}>
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
						{visiblePhases.map((phase) => {
							const agg = aggregates[phase];
							const avgRec = avg(agg.recognition);
							const avgExec = avg(agg.execution);
							const avgStep = avg(agg.stepTime);
							const avgCum = avg(agg.cumulative);
							const avgTurns = avg(agg.turns);
							const tps = avgStep > 0 ? (avgTurns / avgStep).toFixed(2) : '-';
							return (
								<tr key={phase}>
									<td>{STEP_NAME_MAP[phase] || phase}</td>
									<td>{fmt(avgRec)}</td>
									<td>{fmt(avgExec)}</td>
									<td>{fmt(avgStep)}</td>
									<td className={b('cumulative')}>{fmt(avgCum)}</td>
									<td>{avgTurns > 0 ? Math.round(avgTurns) : '-'}</td>
									<td>{tps}</td>
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
							<td>{Math.round(totalTurns)}</td>
							<td>{totalTps}</td>
						</tr>
					</tfoot>
				</table>
			</div>
		</div>
	);
}
