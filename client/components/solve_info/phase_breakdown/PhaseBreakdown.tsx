import React from 'react';
import { useTranslation } from 'react-i18next';
import { getPhaseDurations, getSlowestPhaseIndex } from '../../../../shared/util/solve/multiphase';
import { getStoredPhaseLabel } from '../../../util/solve/multiphase_labels';
import { getTimeString } from '../../../util/time';
import block from '../../../styles/bem';
import './PhaseBreakdown.scss';

const b = block('phase-breakdown');

interface Props {
	/** Raw Solve.phase_splits payload. */
	phaseSplits?: string | null;
	/** Solve time before penalties — the splits were recorded against the running timer. */
	rawTime?: number | null;
}

/**
 * Per-phase durations of a manually split solve. Renders nothing for solves that carry
 * no splits, which is every solve made with the setting switched off.
 */
export default function PhaseBreakdown({ phaseSplits, rawTime }: Props) {
	const { t } = useTranslation();

	const durations = getPhaseDurations(phaseSplits, rawTime);
	if (durations.length < 2) {
		return null;
	}

	const slowestIndex = getSlowestPhaseIndex(durations);

	return (
		<div className={b()}>
			<legend>{t('multi_phase.breakdown_title')}</legend>
			<div className={b('list')}>
				{durations.map((phase) => (
					<div
						key={phase.index}
						className={b('row', { slowest: phase.index === slowestIndex })}
					>
						<span className={b('name')}>{getStoredPhaseLabel(t, phase)}</span>
						<div className={b('bar')}>
							<div
								className={b('bar-fill')}
								style={{ width: `${Math.round(phase.share * 100)}%` }}
							/>
						</div>
						<span className={b('time')}>{getTimeString(phase.durationSec, 2)}</span>
						<span className={b('share')}>{Math.round(phase.share * 100)}%</span>
					</div>
				))}
			</div>
			<p className={b('note')}>{t('multi_phase.breakdown_note')}</p>
		</div>
	);
}
