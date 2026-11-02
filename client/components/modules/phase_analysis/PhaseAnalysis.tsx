import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
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
import { formatSolveNumber, solveNumberColumnWidth, solveNumberGroupSeparator } from '../history/history_grid';
import { openModal } from '../../../actions/general';
import SessionStepsTable from '../../sessions/smart_cube_steps_table/SessionStepsTable';
import ProBlurOverlay from '../../common/pro_blur_overlay/ProBlurOverlay';

type StepType = NonNullable<Solve['solve_method_steps']>[number];

const PHASES = ['cross', 'f2l_1', 'f2l_2', 'f2l_3', 'f2l_4', 'oll', 'pll'];
// The table's columns. 'f2l' is the sum of the pairs: every row carries both, and
// PhaseAnalysis.scss shows one or the other by the module's width.
const COLUMNS = ['cross', 'f2l_1', 'f2l_2', 'f2l_3', 'f2l_4', 'f2l', 'oll', 'pll'];
const COLUMN_LABELS: Record<string, string> = {
	cross: 'Cross',
	f2l_1: 'F2L 1',
	f2l_2: 'F2L 2',
	f2l_3: 'F2L 3',
	f2l_4: 'F2L 4',
	f2l: 'F2L',
	oll: 'OLL',
	pll: 'PLL',
};
const MOBILE_PHASES = ['cross', 'f2l', 'oll', 'pll'];
const MOBILE_LABELS = ['Cross', 'F2L', 'OLL', 'PLL'];

function fmt(seconds: number | null | undefined): string {
	if (seconds == null || seconds < 0) return '-';
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

// Moves of one mobile phase (HTM, as the engine counts step.turn_count); F2L adds up its
// pairs. Null when the solve has no count for it (solves from before the reindex).
function phaseTurns(steps: StepType[], phase: string): number | null {
	if (phase !== 'f2l') return steps.find((s) => s.step_name === phase)?.turn_count ?? null;
	let sum = 0, found = false;
	for (const name of ['f2l_1', 'f2l_2', 'f2l_3', 'f2l_4']) {
		const s = steps.find((x) => x.step_name === name);
		if (s?.turn_count != null) { sum += s.turn_count; found = true; }
	}
	return found ? sum : null;
}

function phaseTime(steps: StepType[], phase: string): number | null {
	if (phase === 'f2l') return f2lTotal(steps);
	return totalTime(steps.find((s) => s.step_name === phase));
}

function columnClass(column: string): string {
	if (column === 'f2l') return ' zt-phase-analysis__cell--f2l';
	return column.startsWith('f2l_') ? ' zt-phase-analysis__cell--pair' : '';
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
		const v = phaseTime(solve.solve_method_steps || [], phase);
		if (v != null && v >= 0) vals.push(v);
	}
	if (!vals.length) return null;
	return vals.reduce((a, b) => a + b, 0) / vals.length;
}

// Solve total turns / TPS — solve.smart_turn_count is the single source of truth (countHTM,
// boundary-aware monolithic). All other turn representations in the project (SmartSolveLayout
// header, SmartStats badge) are fed from this field. After engine fix, per-phase step.turn_count
// sum equals smart_turn_count.
function solveTotalStepTime(steps: StepType[]): number {
	let time = 0;
	for (const phase of PHASES) {
		const s = steps.find((x) => x.step_name === phase);
		if (s?.total_time != null) time += s.total_time;
	}
	return time;
}

function solveTurns(solve: Solve): number | null {
	// Single source: solve.smart_turn_count. May be null in very old solves where reindex didn't run;
	// in that case fall back to step sum (after engine fix, both are equal).
	if (solve.smart_turn_count != null) return solve.smart_turn_count;
	let sum = 0, found = false;
	for (const phase of PHASES) {
		const s = (solve.solve_method_steps || []).find((x) => x.step_name === phase);
		if (s?.turn_count != null) { sum += s.turn_count; found = true; }
	}
	return found ? sum : null;
}

// TPS takes its turns from the same step rows as its time. Equal to smart_turn_count for a
// complete breakdown; for one missing its last phases, the whole solve's turns over only the
// stored steps' time inflated the TPS.
function solveStepTurns(solve: Solve): number | null {
	let sum = 0, found = false;
	for (const phase of PHASES) {
		const s = (solve.solve_method_steps || []).find((x) => x.step_name === phase);
		if (s?.turn_count != null) { sum += s.turn_count; found = true; }
	}
	return found ? sum : solveTurns(solve);
}

function solveTps(solve: Solve): string {
	const turns = solveStepTurns(solve);
	const time = solveTotalStepTime(solve.solve_method_steps || []);
	if (!turns || time === 0) return '-';
	return (turns / time).toFixed(2);
}

function avgTurns(solves: Solve[]): number | null {
	const vals: number[] = [];
	for (const solve of solves) {
		const t = solveTurns(solve);
		if (t != null) vals.push(t);
	}
	if (!vals.length) return null;
	return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function avgTps(solves: Solve[]): string {
	let time = 0, turns = 0, found = false;
	for (const solve of solves) {
		const t = solveStepTurns(solve);
		const stepTime = solveTotalStepTime(solve.solve_method_steps || []);
		if (t != null && stepTime > 0) {
			time += stepTime;
			turns += t;
			found = true;
		}
	}
	if (!found || time === 0) return '-';
	return (turns / time).toFixed(2);
}

interface Props {
	filterOptions?: FilterSolvesOptions;
}

export default function PhaseAnalysis(props: Props) {
	const { filterOptions } = props;
	const { t, i18n } = useTranslation();
	const dispatch = useDispatch();
	const me = useMe();
	useSolveDb();
	const mobileMode = useGeneral('mobile_mode');

	// Non-Pro user solves don't sync to server, so method_steps don't exist —
	// Phase Analysis is Pro-gated on both desktop and mobile
	const showProOverlay = isProEnabled() && !isPro(me);

	// Hooks stay above the Pro return: the plan can change while the module is mounted
	// (a purchase, an expiry, `me` arriving late), and a hook count that changes with it
	// throws "Rendered more hooks than during the previous render".
	const scrollRef = useRef<HTMLDivElement>(null);
	const isReceiving = useRef(false);

	const solves = showProOverlay ? [] : fetchSolves(filterOptions);
	// The list (and its scroll element) is drawn only on desktop once there is a smart solve.
	const listShown = !showProOverlay && !mobileMode && solves.some((s) => s.is_smart_cube);

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
	}, [listShown]);

	if (showProOverlay) {
		return (
			<ProBlurOverlay
				title={t('pro.upsell.phase_analysis.title')}
				description={t('pro.upsell.phase_analysis.description')}
			/>
		);
	}

	if (mobileMode) return <MobileView solves={solves} />;

	// Rows list every solve; the averages leave DNFs out, since an aborted solve's phases
	// stop wherever it was abandoned.
	const smartSolves = solves.filter((s) => s.is_smart_cube && !s.dnf);

	if (!solves.some((s) => s.is_smart_cube)) {
		return (
			<div className="zt-phase-analysis">
				<Empty text={t('phase_analysis.no_smart_solves')} />
			</div>
		);
	}

	function openSessionStats(sessionId: string) {
		dispatch(openModal(<SessionStepsTable sessionId={sessionId} />, { width: 900, title: t('sessions.session_steps_title') }));
	}

	function renderRow(index: number) {
		const solve = solves[index];
		const displayIndex = solves.length - index - 1;
		const steps = solve.solve_method_steps || [];

		return (
			<div className="zt-phase-analysis__row" key={solve.id} onClick={() => openSessionStats(solve.session_id)}>
				<div className="zt-phase-analysis__cell zt-phase-analysis__cell--index">
					{formatSolveNumber(displayIndex + 1, solveNumberGroupSeparator(i18n.language))}
				</div>
				{COLUMNS.map((column) => (
					<div key={column} className={`zt-phase-analysis__cell${columnClass(column)}`}>
						{fmt(phaseTime(steps, column))}
					</div>
				))}
				<div className="zt-phase-analysis__cell zt-phase-analysis__cell--turns">
					{solve.is_smart_cube ? (solveTurns(solve) ?? '-') : '-'}
				</div>
				<div className="zt-phase-analysis__cell zt-phase-analysis__cell--tps">
					{solve.is_smart_cube ? solveTps(solve) : '-'}
				</div>
			</div>
		);
	}

	const turns = avgTurns(smartSolves);
	// Same column as the solves grid beside it, sized for the longest number in the list.
	const gridStyle = { '--zt-phase-index': solveNumberColumnWidth(solves.length) } as React.CSSProperties;

	return (
		<div className="zt-phase-analysis h-full" style={gridStyle}>
			<div className="zt-phase-analysis__header">
				<div className="zt-phase-analysis__cell zt-phase-analysis__cell--head zt-phase-analysis__cell--head-index">#</div>
				{COLUMNS.map((column) => (
					<div key={column} className={`zt-phase-analysis__cell zt-phase-analysis__cell--head${columnClass(column)}`}>
						{COLUMN_LABELS[column]}
					</div>
				))}
				<div className="zt-phase-analysis__cell zt-phase-analysis__cell--head zt-phase-analysis__cell--turns">
					{t('phase_analysis.turns_label')}
				</div>
				<div className="zt-phase-analysis__cell zt-phase-analysis__cell--head zt-phase-analysis__cell--tps">
					TPS
				</div>
			</div>

			<div ref={scrollRef} className="zt-phase-analysis__list overflow-y-auto">
				<ReactList itemRenderer={renderRow} length={solves.length} type="uniform" />
			</div>

			<div className="zt-phase-analysis__avg-row">
				<div className="zt-phase-analysis__cell zt-phase-analysis__cell--index zt-phase-analysis__cell--avg">
					{t('phase_analysis.avg_short')}
				</div>
				{COLUMNS.map((column) => (
					<div key={column} className={`zt-phase-analysis__cell zt-phase-analysis__cell--avg${columnClass(column)}`}>
						{fmt(phaseAvg(smartSolves, column))}
					</div>
				))}
				<div className="zt-phase-analysis__cell zt-phase-analysis__cell--avg zt-phase-analysis__cell--turns">
					{turns != null ? Math.round(turns) : '-'}
				</div>
				<div className="zt-phase-analysis__cell zt-phase-analysis__cell--avg zt-phase-analysis__cell--tps">
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
			<div className="zt-phase-analysis zt-phase-analysis--mobile">
				<Empty text={t('phase_analysis.no_smart_solves')} />
			</div>
		);
	}

	const currentSteps = current.solve_method_steps || [];
	const prevSteps = previous?.solve_method_steps || [];

	const rows = MOBILE_PHASES.map((phase, i) => {
		const val = phaseTime(currentSteps, phase);
		const prevVal = phaseTime(prevSteps, phase);

		let comparison: 'better' | 'worse' | null = null;
		if (val != null && prevVal != null) {
			// For F2L, if pair count differs, comparison is unfair
			const fairCompare = phase !== 'f2l' || f2lPairCount(currentSteps) === f2lPairCount(prevSteps);
			if (fairCompare) {
				comparison = val < prevVal ? 'better' : val > prevVal ? 'worse' : null;
			}
		}

		return { label: MOBILE_LABELS[i], val, moves: phaseTurns(currentSteps, phase), comparison };
	});

	// If any phase is missing, total should show '-' (partial sum is misleading)
	const hasNullPhase = rows.some(r => r.val == null);
	const total = hasNullPhase ? null : rows.reduce((sum, r) => sum + (r.val ?? 0), 0);
	// The same rule for the moves.
	const totalMoves = rows.some((r) => r.moves == null) ? null : rows.reduce((sum, r) => sum + (r.moves ?? 0), 0);
	const movesLabel = t('phase_analysis.turns_label');

	// Moves sit in the gap between the phase and its time (owner, 2026-10-29): what the
	// solver can work on (a 10-move cross, an 18-move PLL). Per-phase TPS was the other
	// candidate and was left out: a phase's time includes its recognition, so a slow look
	// read as slow hands. The time keeps the colour of the comparison.
	const movesCell = (moves: number | null) => (
		<td
			className="zt-phase-analysis__mobile-cell zt-phase-analysis__mobile-cell--moves"
			title={moves == null ? undefined : `${movesLabel}: ${moves}`}
		>
			{moves ?? '-'}
		</td>
	);

	return (
		<div className="zt-phase-analysis zt-phase-analysis--mobile">
			<table className="zt-phase-analysis__mobile-table">
				<tbody>
					{rows.map(({ label, val, moves, comparison }) => (
						<tr key={label} className="zt-phase-analysis__mobile-row">
							<td className="zt-phase-analysis__mobile-cell zt-phase-analysis__mobile-cell--phase">{label}</td>
							{movesCell(moves)}
							<td className={`zt-phase-analysis__mobile-cell${comparison ? ` zt-phase-analysis__mobile-cell--${comparison}` : ''}`}>
								{fmt(val)}
							</td>
						</tr>
					))}
					<tr className="zt-phase-analysis__mobile-row zt-phase-analysis__mobile-row--total">
						<td className="zt-phase-analysis__mobile-cell zt-phase-analysis__mobile-cell--phase">
							{t('phase_analysis.total_label')}
						</td>
						{movesCell(totalMoves)}
						<td className="zt-phase-analysis__mobile-cell">{total == null ? '-' : fmt(total)}</td>
					</tr>
				</tbody>
			</table>
		</div>
	);
}
