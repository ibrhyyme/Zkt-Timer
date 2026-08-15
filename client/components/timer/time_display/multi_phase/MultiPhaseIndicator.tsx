import React, { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { TimerContext } from '../../Timer';
import { useSettings } from '../../../../util/hooks/useSettings';
import { smartCubeSelected } from '../../helpers/util';
import { isMultiPhaseActive } from '../../../../../shared/util/solve/multiphase';
import { getPhaseLabels } from '../../../../util/solve/multiphase_labels';
import { getTimeString } from '../../../../util/time';
import block from '../../../../styles/bem';
import './MultiPhaseIndicator.scss';

const b = block('multi-phase-indicator');

/**
 * Live phase strip shown while a multi-phase solve is running: which phase is being
 * timed right now, and how long each finished phase took.
 */
export default function MultiPhaseIndicator() {
	const { t } = useTranslation();
	const context = useContext(TimerContext);
	const { solving, timeStartedAt, phaseSplits } = context;

	const count = useSettings('multi_phase_count');
	const method = useSettings('multi_phase_method');
	const customLabels = useSettings('multi_phase_custom_labels');
	const hideTimeWhenSolving = useSettings('hide_time_when_solving');

	if (!isMultiPhaseActive(count) || !solving || !timeStartedAt || smartCubeSelected(context)) {
		return null;
	}

	const splits = phaseSplits || [];
	const labels = getPhaseLabels(t, count, method, customLabels);
	// Every split closes a phase, so the count of splits is the index of the live one.
	const activeIndex = Math.min(splits.length, count - 1);

	return (
		<div className={b()}>
			{labels.map((label, index) => {
				const done = index < splits.length;
				const durationSec = done ? (splits[index] - (index ? splits[index - 1] : 0)) / 1000 : 0;

				return (
					<div
						key={index}
						className={b('phase', {
							done,
							active: index === activeIndex,
						})}
					>
						<span className={b('name')}>{label}</span>
						{done && !hideTimeWhenSolving && (
							<span className={b('time')}>{getTimeString(durationSec, 2)}</span>
						)}
					</div>
				);
			})}
		</div>
	);
}
