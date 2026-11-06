import React from 'react';
import { useTranslation } from 'react-i18next';
import block from '../../../../styles/bem';
import { Solve } from '../../../../../server/schemas/Solve.schema';
import { getTimeString } from '../../../../util/time';
import { getStepTimeBars, getTimeAxis } from '../../util/solution';
import './SmartOverviewTab.scss';

const b = block('solve-info-smart-overview');

// Every segment prints its time inside, so none may be shorter than one line of it.
// Keep in step with $segment-min-h in the stylesheet.
const SEGMENT_MIN_H = 16;
const SEGMENT_GAP = 2;
// How much of the plot a tooltip needs, so one on a tall bar stays inside the chart.
const TOOLTIP_H = 148;
// The axis gutter follows its longest label: a character of the mono face at 0.75rem,
// plus the gap to the line. "1:20" needs more room than "8", and a phone needs that room.
const AXIS_CHAR_W = 7;
const AXIS_GAP = 4;

interface Props {
	solve: Solve;
}

export default function SmartOverviewTab(props: Props) {
	const { solve } = props;
	const { t } = useTranslation();

	const bars = getStepTimeBars(solve);
	if (!bars.length) return null;

	const axis = getTimeAxis(Math.max(...bars.map((bar) => bar.total)));
	const axisWidth = Math.max(...axis.ticks.map((tick) => tick.label.length)) * AXIS_CHAR_W + AXIS_GAP;

	return (
		<div className={b()}>
			<div className={b('legend')}>
				<span className={b('legend-item', { rec: true })}>{t('solve_info.recognition')}</span>
				<span className={b('legend-item', { exec: true })}>{t('solve_info.execution')}</span>
			</div>
			<div className={b('chart')} style={{ paddingLeft: axisWidth }}>
				<div className={b('axis')} aria-hidden="true">
					{axis.ticks.map((tick) => (
						<div
							key={tick.value}
							className={b('tick', { base: tick.value === 0 })}
							style={{ bottom: `${(tick.value / axis.max) * 100}%`, left: axisWidth }}
						>
							<span className={b('tick-label')}>{tick.label}</span>
						</div>
					))}
				</div>
				<div className={b('plot')} style={{ gridTemplateColumns: `repeat(${bars.length}, minmax(0, 1fr))` }}>
					{bars.map((bar, index) => {
						const heightPercent = (bar.total / axis.max) * 100;
						const segments = (bar.recognition > 0 ? 1 : 0) + (bar.execution > 0 ? 1 : 0);
						const tps = bar.tps ? bar.tps.toFixed(2) : '-';
						const recognition = getTimeString(bar.recognition, 2);
						const execution = getTimeString(bar.execution, 2);

						return (
							<div
								key={bar.key}
								className={b('column')}
								role="img"
								tabIndex={0}
								aria-label={`${bar.name}: ${t('solve_info.recognition')} ${recognition}, ${t('solve_info.execution')} ${execution}, ${t('solve_info.turns')} ${bar.turns}, ${t('solve_info.tps')} ${tps}`}
							>
								<div className={b('track')}>
									<div className={b('stack')}>
										<div
											className={b('bar')}
											style={{
												height: `${heightPercent}%`,
												minHeight: segments * SEGMENT_MIN_H + (segments - 1) * SEGMENT_GAP,
											}}
										>
											{bar.execution > 0 && (
												<div className={b('segment', { exec: true })} style={{ flexGrow: bar.execution }}>
													{bar.executionLabel}
												</div>
											)}
											{bar.recognition > 0 && (
												<div className={b('segment', { rec: true })} style={{ flexGrow: bar.recognition }}>
													{bar.recognitionLabel}
												</div>
											)}
										</div>
										{/* Beside the bar, not above it: a tall one leaves no room over its top. */}
										<div
											className={b('tooltip', { before: index >= bars.length / 2 })}
											style={{ bottom: `min(${heightPercent}%, calc(100% - ${TOOLTIP_H}px))` }}
										>
											<div className={b('tooltip-title')}>{bar.name}</div>
											<div className={b('tooltip-row')}>
												<span>{t('solve_info.time_label')}</span>
												<strong>{getTimeString(bar.total, 2)}</strong>
											</div>
											<div className={b('tooltip-row', { rec: true })}>
												<span>{t('solve_info.recognition')}</span>
												<strong>{recognition}</strong>
											</div>
											<div className={b('tooltip-row', { exec: true })}>
												<span>{t('solve_info.execution')}</span>
												<strong>{execution}</strong>
											</div>
											<div className={b('tooltip-row')}>
												<span>{t('solve_info.turns')}</span>
												<strong>{bar.turns}</strong>
											</div>
											<div className={b('tooltip-row')}>
												<span>{t('solve_info.tps')}</span>
												<strong>{tps}</strong>
											</div>
										</div>
									</div>
								</div>
								<div className={b('label')}>{bar.axisName}</div>
							</div>
						);
					})}
				</div>
			</div>
		</div>
	);
}
