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

const b = block('bar-graph');

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
}

export default function BarGraph(props: Props) {
	const { data, dummy } = props;

	const secondaryColor = useTheme('secondary_color');
	const moduleColor = useTheme('module_color');

	let chartOpacity = 1;
	let chartColor = secondaryColor.hex;

	if (dummy) {
		chartColor = moduleColor.themeHexOpposite;
		chartOpacity = 0.1;
	}

	const maxY = max(data, getY);

	const xScale = scaleBand<string>({
		domain: data.map(getX),
	});

	const yScale = scaleLinear<number>({
		domain: [0, Math.max(1, maxY * 1.2)],
	});

	return (
		<div className={b()}>
			{props.children}
			<ParentSize>
				{(parent) => {
					// update scale output ranges
					xScale.range([0, parent.width]);
					yScale.range([parent.height, 0]);

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
								tickLabelProps={() => ({
									fill: 'rgb(var(--text-color))',
									opacity: 1,
									fontSize: 11,
									fontWeight: 400,
									textAnchor: 'middle',
								})}
								left={-2}
								strokeWidth={0}
								numTicks={20}
								top={parent.height - 20}
							/>

							<Group>
								{data.map((d) => {
									const date = getX(d);
									const yVal = yScale(getY(d)) ?? 0;
									const count = getY(d);
									const barWidth = Math.max(0, xScale.bandwidth() - 6);
									const barHeight = Math.max(0, parent.height - yVal);

									const barX = xScale(date);
									const barY = yScale(getY(d));

									return (
										<g key={`bar-group-${date}`}>
											<Bar
												key={`bar-${date}`}
												x={barX}
												y={barY - 17}
												rx={3}
												width={barWidth}
												height={barHeight}
												fill={hexToRgba(chartColor, chartOpacity)}
												strokeLinecap="round"
												strokeWidth={4}
											/>
											{count > 0 && !dummy && (
												<text
													x={barX + barWidth / 2}
													y={barY - 22}
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
						</svg>
					);
				}}
			</ParentSize>
		</div>
	);
}
