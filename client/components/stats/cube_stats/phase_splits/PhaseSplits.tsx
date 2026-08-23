import React, {useContext, useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import './PhaseSplits.scss';
import block from '../../../../styles/bem';
import {StatsContext} from '../../Stats';
import {useSolveDb} from '../../../../util/hooks/useSolveDb';
import {useMe} from '../../../../util/hooks/useMe';
import {isPro, isProEnabled} from '../../../../lib/pro';
import ProBlurOverlay from '../../../common/pro_blur_overlay/ProBlurOverlay';
import {getAveragePhaseSplits} from '../../../../db/solves/stats/phase_splits';
import {getTimeString} from '../../../../util/time';
import {useSettings} from '../../../../util/hooks/useSettings';
import {resolveAnalysisMethod} from '../../../../util/solve/live_analysis_core';

const b = block('phase-splits');

export default function PhaseSplits() {
	const {t} = useTranslation();
	const me = useMe();
	const {filterOptions, smartLastN} = useContext(StatsContext);
	const solveUpdate = useSolveDb();

	const showProOverlay = isProEnabled() && !isPro(me);

	// Splits are read through the method the user currently analyses with, so a
	// Roux solver sees FB/SB/CMLL/LSE rather than an empty CFOP ladder.
	const analysisMethod = resolveAnalysisMethod(
		useSettings('smart_cube_method'),
		useSettings('smart_cube_analysis_mode')
	);

	const result = useMemo(
		() => getAveragePhaseSplits(filterOptions, smartLastN, analysisMethod),
		[filterOptions, smartLastN, solveUpdate, analysisMethod]
	);

	if (showProOverlay) {
		return (
			<ProBlurOverlay
				title={t('pro.upsell.phase_splits.title')}
				description={t('pro.upsell.phase_splits.description')}
			/>
		);
	}

	if (!result.totalSampleCount) {
		return <div className={b('empty')}>{t('stats.splits.empty')}</div>;
	}

	const max = Math.max(...result.phases.map((p) => p.avg), 0.001);
	const total = result.phases.reduce((s, p) => s + p.avg, 0);
	const bottleneckKey = result.bottleneck;
	const bottleneckLabel = bottleneckKey ? t(`stats.splits.phase.${bottleneckKey}`) : '';

	return (
		<div className={b()}>
			<div className={b('header')}>
				<span className={b('eyebrow')}>
					{t('stats.splits.eyebrow', {value: result.totalSampleCount})}
				</span>
				{bottleneckKey && (
					<span className={b('insight')}>
						{t('stats.splits.bottleneck', {phase: bottleneckLabel})}
					</span>
				)}
			</div>
			<div className={b('list')}>
				{result.phases.map((phase) => {
					const key = phase.key;
					const widthPct = (phase.avg / max) * 100;
					const totalPct = total > 0 ? (phase.avg / total) * 100 : 0;
					const isBottleneck = bottleneckKey === key;

					return (
						<div key={key} className={b('row', {[key]: true, bottleneck: isBottleneck})}>
							<span className={b('label')}>{t(`stats.splits.phase.${key}`)}</span>
							<div className={b('track')}>
								<div className={b('fill')} style={{width: `${widthPct}%`}} />
							</div>
							<span className={b('value')}>
								{phase.sampleCount > 0 ? (
									<>
										{getTimeString(phase.avg)}
										<small> · {totalPct.toFixed(0)}%</small>
									</>
								) : (
									'—'
								)}
							</span>
						</div>
					);
				})}
			</div>
		</div>
	);
}
