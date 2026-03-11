import React, { useState } from 'react';
import './StepPie.scss';
import { useTranslation } from 'react-i18next';
import { ParentSize } from '@visx/responsive';
import { Group } from '@visx/group';
import { Pie } from '@visx/shape';
import { getSolveStepsWithoutParents } from '../../util/solution';
import { STEP_NAME_MAP } from '../../util/consts';
import { scaleOrdinal } from '@visx/scale';
import HorizontalNav from '../../../common/horizontal_nav/HorizontalNav';
import { getTimeString } from '../../../../util/time';
import block from '../../../../styles/bem';
import { Solve } from '../../../../../server/schemas/Solve.schema';

const b = block('solve-info-step-pie');

const STEP_ORDER = ['cross', 'f2l_1', 'f2l_2', 'f2l_3', 'f2l_4', 'oll', 'pll'];

const STEP_COLORS = scaleOrdinal({
	domain: ['Cross', 'F2L Slot 1', 'F2L Slot 2', 'F2L Slot 3', 'F2L Slot 4', 'OLL', 'PLL'],
	range: ['#f4d35e', '#457b9d', '#f4a261', '#66bb6a', '#6d597a', '#2ec4b6', '#8093f1'],
});

interface Props {
	solve: Solve;
}

export default function StepPie(props: Props) {
	const { solve } = props;
	const { t } = useTranslation();

	const [chartType, setChartType] = useState('time');

	const chartTypes = [
		{ id: 'time', value: t('solve_info.time_label') },
		{ id: 'tps', value: 'TPS' },
		{ id: 'turns', value: t('solve_info.turns') },
	];

	function changeChartType(chartType) {
		setChartType(chartType);
	}

	function toSinglePrecision(num: number) {
		return Math.floor(num * 10) / 10;
	}

	const steps = getSolveStepsWithoutParents(solve);
	const stepMap = new Map(steps.map((s) => [s.step_name, s]));

	const data = [];
	for (const stepName of STEP_ORDER) {
		const step = stepMap.get(stepName);
		if (!step) continue;

		let frequency;
		switch (chartType) {
			case 'time': {
				frequency = getTimeString(step.total_time, 1);
				break;
			}
			case 'tps': {
				frequency = toSinglePrecision(step.tps);
				break;
			}
			case 'turns': {
				frequency = step.turn_count;
				break;
			}
		}

		data.push({
			value: STEP_NAME_MAP[step.step_name],
			frequency,
		});
	}

	return (
		<div className={b()}>
			<HorizontalNav onChange={changeChartType} tabs={chartTypes} tabId={chartType} />

			<ParentSize
				className={b('pie').toString()}
				parentSizeStyles={{
					minHeight: '200px',
					height: 190,
					width: 190,
				}}
			>
				{(parent) => {
					const radius = Math.min(parent.height, parent.width) / 2;

					return (
						<svg width={parent.width} height={parent.height} style={{ overflow: 'visible' }}>
							<Group top={0} left={0}>
								<Pie
									data={data}
									cornerRadius={7}
									padAngle={0.05}
									pieValue={(d) => d.frequency}
									pieSort={null}
									pieSortValues={null}
									startAngle={-Math.PI / 2}
									endAngle={Math.PI * 1.5}
									outerRadius={radius}
									innerRadius={radius - 40}
								>
									{(pie) =>
										pie.arcs.map((arc, index) => {
											const { value } = arc.data;
											const [centroidX, centroidY] = pie.path.centroid(arc);
											const hasSpaceForLabel = arc.endAngle - arc.startAngle >= 0.1;
											const arcPath = pie.path(arc);
											const arcFill = STEP_COLORS(value);
											return (
												<g key={`arc-${value}-${index}`}>
													<path d={arcPath} fill={arcFill} />
													{hasSpaceForLabel && (
														<g>
															<text
																x={centroidX * 1.6}
																y={centroidY * 1.6}
																dy="0"
																fill="rgb(var(--text-color))"
																fontSize={13}
																textAnchor="middle"
																pointerEvents="none"
															>
																{arc.data.value}
															</text>
															<text
																x={centroidX * 1.6}
																y={centroidY * 1.6 + 17}
																dy="0"
																fill="rgb(var(--text-color))"
																fontSize={13}
																textAnchor="middle"
																pointerEvents="none"
															>
																({arc.data.frequency}
																{chartType === 'time' ? 's' : ''})
															</text>
														</g>
													)}
												</g>
											);
										})
									}
								</Pie>
							</Group>
						</svg>
					);
				}}
			</ParentSize>
		</div>
	);
}
