import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { useHistory } from 'react-router-dom';
import ReactList from 'react-list';
import './PhaseAnalysis.scss';
import Empty from '../../common/empty/Empty';
import { FilterSolvesOptions, fetchSolves } from '../../../db/solves/query';
import { useSolveDb } from '../../../util/hooks/useSolveDb';
import { useGeneral } from '../../../util/hooks/useGeneral';
import { useMe } from '../../../util/hooks/useMe';
import { isPro, isProEnabled } from '../../../lib/pro';
import { Solve } from '../../../../server/schemas/Solve.schema';
import { getTimeString } from '../../../util/time';
import { publishScroll, subscribeScroll, HISTORY_SCROLL_CHANNEL, PHASE_ANALYSIS_SCROLL_CHANNEL } from '../../../util/scroll_sync';
import { openModal } from '../../../actions/general';
import SessionStepsTable from '../../sessions/smart_cube_steps_table/SessionStepsTable';

type StepType = NonNullable<Solve['solve_method_steps']>[number];

const PHASES = ['cross', 'f2l_1', 'f2l_2', 'f2l_3', 'f2l_4', 'oll', 'pll'];
const LABELS = ['Cross', 'F2L 1', 'F2L 2', 'F2L 3', 'F2L 4', 'OLL', 'PLL'];
const MOBILE_PHASES = ['cross', 'f2l', 'oll', 'pll'];
const MOBILE_LABELS = ['Cross', 'F2L', 'OLL', 'PLL'];

function fmt(seconds: number | null | undefined): string {
	if (seconds == null || seconds < 0) return '–';
	return getTimeString(seconds, 2);
}

function totalTime(step: StepType | undefined): number | null {
	return step?.total_time ?? null;
}

function f2lTotal(steps: StepType[]): number | null {
	let sum = 0, count = 0;
	for (const name of ['f2l_1', 'f2l_2', 'f2l_3', 'f2l_4']) {
		const s = steps.find((x) => x.step_name === name);
		if (s?.total_time != null) { sum += s.total_time; count++; }
	}
	return count > 0 ? sum : null;
}

function f2lPairCount(steps: StepType[]): number {
	let count = 0;
	for (const name of ['f2l_1', 'f2l_2', 'f2l_3', 'f2l_4']) {
		const s = steps.find((x) => x.step_name === name);
		if (s?.total_time != null) count++;
	}
	return count;
}

function phaseAvg(solves: Solve[], phase: string): number | null {
	const vals: number[] = [];
	for (const solve of solves) {
		const step = solve.solve_method_steps?.find((s) => s.step_name === phase);
		const v = totalTime(step);
		if (v != null && v >= 0) vals.push(v);
	}
	if (!vals.length) return null;
	return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function solveTurns(steps: StepType[]): number | null {
	let total = 0, found = false;
	for (const phase of PHASES) {
		const s = steps.find((x) => x.step_name === phase);
		if (s?.turn_count != null) { total += s.turn_count; found = true; }
	}
	return found ? total : null;
}

function solveTps(steps: StepType[]): string {
	let time = 0, turns = 0, found = false;
	for (const phase of PHASES) {
		const s = steps.find((x) => x.step_name === phase);
		if (s?.total_time != null && s?.turn_count != null) {
			time += s.total_time;
			turns += s.turn_count;
			found = true;
		}
	}
	if (!found || time === 0) return '–';
	return (turns / time).toFixed(2);
}

function avgTurns(solves: Solve[]): number | null {
	const vals: number[] = [];
	for (const solve of solves) {
		const t = solveTurns(solve.solve_method_steps || []);
		if (t != null) vals.push(t);
	}
	if (!vals.length) return null;
	return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function avgTps(solves: Solve[]): string {
	let time = 0, turns = 0, found = false;
	for (const solve of solves) {
		for (const phase of PHASES) {
			const s = (solve.solve_method_steps || []).find((x) => x.step_name === phase);
			if (s?.total_time != null && s?.turn_count != null) {
				time += s.total_time;
				turns += s.turn_count;
				found = true;
			}
		}
	}
	if (!found || time === 0) return '–';
	return (turns / time).toFixed(2);
}

interface Props {
	filterOptions?: FilterSolvesOptions;
}

export default function PhaseAnalysis(props: Props) {
	const { filterOptions } = props;
	const { t } = useTranslation();
	const dispatch = useDispatch();
	const history = useHistory();
	const me = useMe();
	useSolveDb();
	const mobileMode = useGeneral('mobile_mode');

	// Non-Pro user solve'lari server'a sync edemedigi icin method_steps olusmuyor —
	// Phase Analysis hem desktop hem mobile'da Pro-gate'li
	const showProOverlay = isProEnabled() && !isPro(me);

	function goPro() {
		history.push('/pro');
	}

	if (showProOverlay) {
		return (
			<div className="cd-phase-analysis cd-phase-analysis--pro-locked">
				<div className="cd-phase-analysis__pro-locked-dummy">
					<div className="cd-phase-analysis__pro-locked-dummy-bar" style={{ width: '85%' }} />
					<div className="cd-phase-analysis__pro-locked-dummy-bar" style={{ width: '70%' }} />
					<div className="cd-phase-analysis__pro-locked-dummy-bar" style={{ width: '90%' }} />
					<div className="cd-phase-analysis__pro-locked-dummy-bar" style={{ width: '55%' }} />
					<div className="cd-phase-analysis__pro-locked-dummy-bar" style={{ width: '75%' }} />
				</div>
				<div className="cd-phase-analysis__pro-locked-overlay" onClick={goPro}>
					<span className="cd-phase-analysis__pro-locked-star">★</span>
					<span>{t('solve_info.pro_stats_upsell')}</span>
				</div>
			</div>
		);
	}

	const scrollRef = useRef<HTMLDivElement>(null);
	const isReceiving = useRef(false);

	useEffect(() => {
		const el = scrollRef.current;
		if (!el) return;

		const onScroll = () => {
			if (!isReceiving.current) publishScroll(PHASE_ANALYSIS_SCROLL_CHANNEL, el.scrollTop);
		};
		el.addEventListener('scroll', onScroll, { passive: true });

		const unsub = subscribeScroll(HISTORY_SCROLL_CHANNEL, (top) => {
			isReceiving.current = true;
			el.scrollTop = top;
			requestAnimationFrame(() => { isReceiving.current = false; });
		});

		return () => { el.removeEventListener('scroll', onScroll); unsub(); };
	}, []);

	const solves = fetchSolves(filterOptions);

	if (mobileMode) return <MobileView solves={solves} />;

	const smartSolves = solves.filter((s) => s.is_smart_cube);

	if (!smartSolves.length) {
		return (
			<div className="cd-phase-analysis">
				<Empty text={t('phase_analysis.no_smart_solves')} />
			</div>
		);
	}

	function openSessionStats(sessionId: string) {
		dispatch(openModal(<SessionStepsTable sessionId={sessionId} />, { width: 900 }));
	}

	function renderRow(index: number) {
		const solve = solves[index];
		const displayIndex = solves.length - index - 1;
		const steps = solve.solve_method_steps || [];
		const isEven = index % 2 === 0;

		return (
			<div
				className={[
					'cd-phase-analysis__row',
					isEven ? 'cd-phase-analysis__row--even' : '',
					!solve.is_smart_cube ? 'cd-phase-analysis__row--empty' : '',
					'cd-phase-analysis__row--clickable',
				].filter(Boolean).join(' ')}
				key={solve.id}
				onClick={() => openSessionStats(solve.session_id)}
			>
				<div className="cd-phase-analysis__cell cd-phase-analysis__cell--index">
					{(displayIndex + 1).toLocaleString()}.
				</div>
				{PHASES.map((phase) => {
					const step = steps.find((s) => s.step_name === phase);
					return (
						<div key={phase} className="cd-phase-analysis__cell">
							{fmt(totalTime(step))}
						</div>
					);
				})}
				<div className="cd-phase-analysis__cell cd-phase-analysis__cell--stat">
					{solve.is_smart_cube ? (solveTurns(steps) ?? '–') : '–'}
				</div>
				<div className="cd-phase-analysis__cell cd-phase-analysis__cell--stat">
					{solve.is_smart_cube ? solveTps(steps) : '–'}
				</div>
			</div>
		);
	}

	const turns = avgTurns(smartSolves);

	return (
		<div className="cd-phase-analysis h-full">
			<div className="cd-phase-analysis__header">
				<div className="cd-phase-analysis__cell cd-phase-analysis__cell--index cd-phase-analysis__cell--head" />
				{LABELS.map((label) => (
					<div key={label} className="cd-phase-analysis__cell cd-phase-analysis__cell--head">
						{label}
					</div>
				))}
				<div className="cd-phase-analysis__cell cd-phase-analysis__cell--head cd-phase-analysis__cell--stat">
					{t('phase_analysis.turns_label')}
				</div>
				<div className="cd-phase-analysis__cell cd-phase-analysis__cell--head cd-phase-analysis__cell--stat">
					TPS
				</div>
			</div>

			<div ref={scrollRef} className="cd-phase-analysis__list overflow-y-auto">
				<ReactList itemRenderer={renderRow} length={solves.length} type="uniform" />
			</div>

			<div className="cd-phase-analysis__avg-row">
				<div className="cd-phase-analysis__cell cd-phase-analysis__cell--index cd-phase-analysis__cell--avg">
					{t('phase_analysis.avg_short')}
				</div>
				{PHASES.map((phase) => (
					<div key={phase} className="cd-phase-analysis__cell cd-phase-analysis__cell--avg">
						{fmt(phaseAvg(smartSolves, phase))}
					</div>
				))}
				<div className="cd-phase-analysis__cell cd-phase-analysis__cell--avg cd-phase-analysis__cell--stat">
					{turns != null ? Math.round(turns) : '–'}
				</div>
				<div className="cd-phase-analysis__cell cd-phase-analysis__cell--avg cd-phase-analysis__cell--stat">
					{avgTps(smartSolves)}
				</div>
			</div>
		</div>
	);
}

function MobileView({ solves }: { solves: Solve[] }) {
	const { t } = useTranslation();

	const smartSolves: Solve[] = [];
	for (let i = 0; i < solves.length && smartSolves.length < 2; i++) {
		if (solves[i].is_smart_cube) smartSolves.push(solves[i]);
	}

	const current = smartSolves[0] ?? null;
	const previous = smartSolves[1] ?? null;

	if (!current) {
		return (
			<div className="cd-phase-analysis cd-phase-analysis--mobile">
				<Empty text={t('phase_analysis.no_smart_solves')} />
			</div>
		);
	}

	const currentSteps = current.solve_method_steps || [];
	const prevSteps = previous?.solve_method_steps || [];

	const rows = MOBILE_PHASES.map((phase, i) => {
		const val = phase === 'f2l'
			? f2lTotal(currentSteps)
			: totalTime(currentSteps.find((s) => s.step_name === phase));

		const prevVal = phase === 'f2l'
			? f2lTotal(prevSteps)
			: totalTime(prevSteps.find((s) => s.step_name === phase));

		let comparison: 'better' | 'worse' | null = null;
		if (val != null && prevVal != null) {
			// F2L için pair sayisi farkliysa karsilastirma fair degil
			const fairCompare = phase !== 'f2l' || f2lPairCount(currentSteps) === f2lPairCount(prevSteps);
			if (fairCompare) {
				comparison = val < prevVal ? 'better' : val > prevVal ? 'worse' : null;
			}
		}

		return { label: MOBILE_LABELS[i], val, comparison };
	});

	// Herhangi bir phase eksikse total da '–' gostermeli (yarim toplam yaniltici)
	const hasNullPhase = rows.some(r => r.val == null);
	const total = hasNullPhase ? null : rows.reduce((sum, r) => sum + (r.val ?? 0), 0);

	return (
		<div className="cd-phase-analysis cd-phase-analysis--mobile">
			<table className="cd-phase-analysis__mobile-table">
				<tbody>
					{rows.map(({ label, val, comparison }) => (
						<tr key={label} className="cd-phase-analysis__mobile-row">
							<td className="cd-phase-analysis__mobile-cell cd-phase-analysis__mobile-cell--phase">{label}</td>
							<td className={`cd-phase-analysis__mobile-cell${comparison ? ` cd-phase-analysis__mobile-cell--${comparison}` : ''}`}>
								{fmt(val)}
							</td>
						</tr>
					))}
					<tr className="cd-phase-analysis__mobile-row cd-phase-analysis__mobile-row--total">
						<td className="cd-phase-analysis__mobile-cell cd-phase-analysis__mobile-cell--phase">
							{t('phase_analysis.total_label')}
						</td>
						<td className="cd-phase-analysis__mobile-cell">{total == null ? '–' : fmt(total)}</td>
					</tr>
				</tbody>
			</table>
		</div>
	);
}
