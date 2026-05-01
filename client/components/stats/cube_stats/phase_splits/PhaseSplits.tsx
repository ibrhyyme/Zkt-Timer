import React, {useContext, useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {useHistory} from 'react-router-dom';
import './PhaseSplits.scss';
import block from '../../../../styles/bem';
import {StatsContext} from '../../Stats';
import {useSolveDb} from '../../../../util/hooks/useSolveDb';
import {useMe} from '../../../../util/hooks/useMe';
import {isPro, isProEnabled} from '../../../../lib/pro';
import {getAveragePhaseSplits, PhaseKey} from '../../../../db/solves/stats/phase_splits';
import {getTimeString} from '../../../../util/time';

const b = block('phase-splits');

const ORDER: PhaseKey[] = ['cross', 'f2l_1', 'f2l_2', 'f2l_3', 'f2l_4', 'oll', 'pll'];

export default function PhaseSplits() {
	const {t} = useTranslation();
	const history = useHistory();
	const me = useMe();
	const {filterOptions} = useContext(StatsContext);
	const solveUpdate = useSolveDb();

	const showProOverlay = isProEnabled() && !isPro(me);

	const result = useMemo(
		() => getAveragePhaseSplits(filterOptions),
		[filterOptions, solveUpdate]
	);

	function goPro() {
		history.push('/pro');
	}

	if (showProOverlay) {
		return (
			<div className={b({locked: true})}>
				<div className={b('locked-dummy')}>
					{ORDER.map((_, i) => (
						<div
							key={i}
							className={b('locked-dummy-bar')}
							style={{width: `${30 + Math.abs(((i * 17) % 60))}%`}}
						/>
					))}
				</div>
				<button type="button" className={b('locked-overlay')} onClick={goPro}>
					<span className={b('locked-star')}>★</span>
					<span>{t('stats.splits.pro_upsell')}</span>
				</button>
			</div>
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
				{ORDER.map((key) => {
					const phase = result.phases.find((p) => p.key === key)!;
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
