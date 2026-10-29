import React, { ReactNode } from 'react';
import { max } from 'd3-array';
import { Group } from '@visx/group';
import './BarGraph.scss';
import { ParentSize } from '@visx/responsive';
import { Bar } from '@visx/shape';
import { scaleLinear, scaleBand } from '@visx/scale';
import hexToRgba from 'hex-to-rgba';
import { AxisBottom } from '@visx/axis';
import block from '../../../styles/bem';
import { useTheme } from '../../../util/hooks/useTheme';
import { clampLabelCenter, labelStride, maxBarsForWidth } from '../../../util/chart_axis';

const b = block('bar-graph');

// Fixed room below the bars for the axis labels and above them for the counts. The
// layout used to be the y-domain stretched by 20% plus hard 17/22 px offsets, which only
// left the tallest bar's count room at 200px and up: on the phone's 147px slot it was
// drawn above the card.
const AXIS_HEIGHT = 20;
const COUNT_HEIGHT = 16;
const BAR_GAP = 6;

export interface BarGraphData {
	x: string;
	y: number;
}

const getX = (d: BarGraphData) => d.x;
const getY = (d: BarGraphData) => d.y;

interface Props {
	children?: ReactNode;
	dummy?: boolean;
	data: BarGraphData[];
	goalLine?: number | null;
}

export default function BarGraph(props: Props) {
	const { data, dummy, goalLine } = props;

	const secondaryColor = useTheme('secondary_color');
	const moduleColor = useTheme('module_color');

	let chartOpacity = 1;
	let chartColor = secondaryColor.hex;

	if (dummy) {
		chartColor = moduleColor.themeHexOpposite;
		chartOpacity = 0.1;
	}

	return (
		<div className={b()}>
			{props.children}
			<ParentSize>
				{(parent) => {
					// Keeps the most recent bars of a series (solves per day). The time
					// distribution never hands over more than fit (TimeDistro.tsx): dropping
					// its first buckets threw away the fastest solves.
					const maxBars = maxBarsForWidth(parent.width);
					const displayData = data.length > maxBars ? data.slice(-maxBars) : data;

					const maxY = max(displayData, getY);
					const yMax = Math.max(maxY, goalLine || 0);

					const xScale = scaleBand<string>({
						domain: displayData.map(getX),
						range: [0, parent.width],
					});

					const plotBottom = Math.max(COUNT_HEIGHT + 1, parent.height - AXIS_HEIGHT);
					const yScale = scaleLinear<number>({
						domain: [0, Math.max(1, yMax)],
						range: [plotBottom, COUNT_HEIGHT],
					});

					// Range labels such as "13.3-15.4" are wider than a narrow bar and ran into
					// each other (2.7-f): label every n-th bar so neighbours never touch.
					const xLabels = displayData.map(getX);
					const stride = labelStride(xLabels, xScale.bandwidth());
					const bandCenter = (x: string) => (xScale(x) ?? 0) + xScale.bandwidth() / 2;

					return (
						<svg width={parent.width} height={parent.height}>
							<filter id="distroShadow" height="130%">
								<feGaussianBlur in="SourceAlpha" stdDeviation="5" result="blur" />
								<feOffset in="blur" dx="0" dy="0" result="offsetBlur" />
								<feFlood
									floodColor={hexToRgba(chartColor, Math.max(chartOpacity * 0.6, 0.6))}
									floodOpacity="1"
									result="offsetColor"
								/>
								<feComposite in="offsetColor" in2="offsetBlur" operator="in" result="offsetBlur" />
								<feMerge>
									<feMergeNode />
									<feMergeNode in="SourceGraphic" />
								</feMerge>
							</filter>

							<AxisBottom
								scale={xScale}
								tickLabelProps={(value) => {
									const center = bandCenter(String(value));
									return {
										fill: 'rgb(var(--text-color))',
										opacity: 1,
										fontSize: 11,
										fontWeight: 400,
										textAnchor: 'middle',
										dx: clampLabelCenter(center, String(value), parent.width) - center,
									};
								}}
								strokeWidth={0}
								tickValues={xLabels}
								tickFormat={(value, index) => (index % stride === 0 ? String(value) : '')}
								top={plotBottom}
							/>

							<Group>
								{displayData.map((d) => {
									const date = getX(d);
									const count = getY(d);
									const barWidth = Math.max(0, xScale.bandwidth() - BAR_GAP);
									const barY = yScale(count) ?? plotBottom;
									const barHeight = Math.max(0, plotBottom - barY);
									const barX = (xScale(date) ?? 0) + BAR_GAP / 2;

									return (
										<g key={`bar-group-${date}`}>
											<Bar
												key={`bar-${date}`}
												x={barX}
												y={barY}
												rx={3}
												width={barWidth}
												height={barHeight}
												fill={hexToRgba(chartColor, chartOpacity)}
												strokeLinecap="round"
												strokeWidth={4}
											/>
											{count > 0 && !dummy && (
												<text
													x={clampLabelCenter(bandCenter(date), String(count), parent.width, 7)}
													y={barY - 4}
													textAnchor="middle"
													fill="rgb(var(--text-color))"
													fontSize={12}
													fontWeight={600}
													opacity={0.8}
												>
													{count}
												</text>
											)}
										</g>
									);
								})}
							</Group>

							{goalLine > 0 && !dummy && (
								<g>
									<line
										x1={0}
										x2={parent.width}
										y1={yScale(goalLine)}
										y2={yScale(goalLine)}
										stroke="#4a9eff"
										strokeWidth={1.5}
										strokeDasharray="6,4"
										opacity={0.7}
									/>
									<text
										x={parent.width - 4}
										y={yScale(goalLine) - 5}
										textAnchor="end"
										fill="#4a9eff"
										fontSize={10}
										fontWeight={600}
										opacity={0.8}
									>
										{goalLine}
									</text>
								</g>
							)}
						</svg>
					);
				}}
			</ParentSize>
		</div>
	);
}
