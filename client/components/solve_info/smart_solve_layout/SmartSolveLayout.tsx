import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import TabBar, { TabBarTab } from '../../common/tab_bar/TabBar';
import SolutionInfo from '../solution_info/SolutionInfo';
import SmartOverviewTab from '../stats_info/smart_overview_tab/SmartOverviewTab';
import StepsTable from '../stats_info/steps_table/StepsTable';
import { getRecognitionExecution, getSmartSolveTps } from '../util/solution';
import block from '../../../styles/bem';
import { getTimeString } from '../../../util/time';
import { SmartSolveTab, SolveLayoutProps } from '../SolveInfo';
import { useMe } from '../../../util/hooks/useMe';
import { canSeeSmartAnalysis, isPro, isProEnabled } from '../../../lib/pro';
import ProBlurOverlay from '../../common/pro_blur_overlay/ProBlurOverlay';
import SolveCardHeader from '../solve_card/SolveCardHeader';
import SolveScramble from '../solve_card/SolveScramble';
import './SmartSolveLayout.scss';

const b = block('solve-info');
const bs = block('solve-info-smart');

export default function SmartSolveLayout(props: SolveLayoutProps) {
	const { solve, user, mobileMode, handleDone, initialTab } = props;

	const { t } = useTranslation();
	const me = useMe();
	const [page, setPage] = useState<SmartSolveTab>(initialTab || 'overview');
	// The analysis opens on the viewer's Pro or on the owner's (a Pro member's shared solve);
	// sharing stays the viewer's own Pro feature.
	const showProOverlay = !canSeeSmartAnalysis(me, user);
	const canShare = !isProEnabled() || isPro(me);

	const tpsValue = getSmartSolveTps(solve);
	// Recognition and execution are part of the analysis, so behind the same lock as the tabs.
	const split = showProOverlay ? null : getRecognitionExecution(solve);

	// The time is the heading right above, so the summary says how it was spent: looking for
	// the next case against turning, then how much and how fast.
	const stats: { label: string; value: React.ReactNode }[] = [];
	if (split) {
		stats.push(
			{ label: t('solve_info.recognition'), value: getTimeString(split.recognition, 2) },
			{ label: t('solve_info.execution'), value: getTimeString(split.execution, 2) }
		);
	}
	stats.push(
		{ label: t('solve_info.turns'), value: solve.smart_turn_count ?? '-' },
		{ label: t('solve_info.tps'), value: tpsValue === null ? '-' : tpsValue.toFixed(2) }
	);

	const pageMap: Record<SmartSolveTab, React.ReactNode> = {
		overview: <SmartOverviewTab solve={solve} />,
		stats: <StepsTable solve={solve} />,
		solution: <SolutionInfo solve={solve} />,
	};

	const tabs: TabBarTab<SmartSolveTab>[] = [
		{ id: 'overview', label: t('solve_info.overview_tab') },
		{ id: 'stats', label: t('solve_info.stats_tab') },
		{ id: 'solution', label: t('solve_info.solve_tab') },
	];

	return (
		<div className={b({ mobile: mobileMode, smart: true })}>
			{/* Nothing on a smart solve is typed in: its scramble and moves came from the cube. The
			    Edit button it had toggled a mode no part of this card read. */}
			<SolveCardHeader layout={props} canShareLink={canShare} editable={false} />

			<div className={bs('strip')}>
				{stats.map((stat) => (
					<div key={stat.label} className={bs('stat')}>
						<div className={bs('stat-label')}>{stat.label}</div>
						<div className={bs('stat-value')}>{stat.value}</div>
					</div>
				))}
			</div>

			<SolveScramble scramble={solve.scramble} />

			{showProOverlay ? (
				<ProBlurOverlay
					title={t('pro.upsell.smart_solve.title')}
					description={t('pro.upsell.smart_solve.description')}
					onBeforeNavigate={handleDone}
				/>
			) : (
				<>
					<TabBar<SmartSolveTab> className={bs('tabs')} tabs={tabs} value={page} onChange={setPage} label={t('solve_info.solve_detail')} />
					<div className={bs('page')}>{pageMap[page]}</div>
				</>
			)}
		</div>
	);
}
