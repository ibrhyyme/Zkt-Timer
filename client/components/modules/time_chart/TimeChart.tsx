import React, {useMemo} from 'react';
import {max, min} from 'd3-array';
import * as allCurves from '@visx/curve';
import {Group} from '@visx/group';
import hexToRgba from 'hex-to-rgba';
import {ParentSize} from '@visx/responsive';
import {AxisLeft} from '@visx/axis';
import {Area} from '@visx/shape';
import {scaleLinear, scaleTime} from '@visx/scale';
import './TimeChart.scss';
import {getTimeString} from '../../../util/time';
import dummyData from './dummy_data';
import {getChartData} from '../../../db/solves/stats/chart';
import {FilterSolvesOptions} from '../../../db/solves/query';
import jsonStr from 'json-stable-stringify';
import {useSolveDb} from '../../../util/hooks/useSolveDb';
import block from '../../../styles/bem';
import {useTheme} from '../../../util/hooks/useTheme';
import {pickTimeAxisTicks} from '../../../util/chart_axis';

const b = block('time-chart');

// Inset that keeps the 5px line and its round ends inside the card.
const EDGE = 4;
// Axis label font and the gap between the labels and the line.
const AXIS_FONT_SIZE = 11;
const AXIS_CHAR_WIDTH = 6.5;
const AXIS_GAP = 6;

interface Props {
	dummy?: boolean;
	filterOptions: FilterSolvesOptions;
}

export default function TimeChart(props: Props) {
	const {filterOptions, dummy} = props;
	const filterStr = jsonStr(filterOptions);

	const primaryColor = useTheme('primary_color');
	const moduleColor = useTheme('module_color');
	let chartColor = primaryColor.hex;
	let chartColorOpacity = 1;

	useSolveDb();

	const memoData = useMemo(() => {
		return getChartData(filterOptions);
	}, [filterStr, filterOptions]);

	let data = [...memoData];
	if (dummy || !data || !data.length) {
		data = dummyData;
		chartColor = moduleColor.themeHexOpposite;
		chartColorOpacity = 0.1;
	}

	// data accessors
	const getX = (d) => d.index;
	const getY = (d) => d.value;

	const minY = min(data, getY);
	const maxY = max(data, getY);

	// scales
	const xScale = scaleTime({
		domain: [0, max(data, getX)],
	});

	const yScale = scaleLinear<number>({
		domain: [Math.max(minY * 0.95, 0), maxY * 1.05],
	});

	return (
		<div className={b()}>
			<ParentSize>
				{(parent) => {
					// Rounding half-second ticks to whole seconds printed "13, 13, 12, 12" (2.7-f):
					// keep only ticks whose labels differ, with the decimals their step needs.
					const yAxis = pickTimeAxisTicks(yScale.ticks(Math.max(2, Math.floor(parent.height / 40))));

					// The labels get their own column, as wide as the longest one. They used to
					// be centred 3px from the card's left edge, so half of "14" was cut off on
					// the phone, and drawn 10px below the value they named.
					const longestLabel = Math.max(
						0,
						...yAxis.values.map((v) => getTimeString(v, yAxis.decimals).length)
					);
					const axisWidth = longestLabel ? longestLabel * AXIS_CHAR_WIDTH + AXIS_GAP : 0;

					xScale.range([axisWidth + EDGE, parent.width - EDGE]);
					yScale.range([parent.height - EDGE, EDGE]);

					return (
						<svg width={parent.width} height={parent.height}>
							<filter id="dropshadow" height="150%">
								<feGaussianBlur in="SourceAlpha" stdDeviation="5" result="blur" />
								<feOffset in="blur" dx="0" dy="0" result="offsetBlur" />
								<feFlood
									floodColor={hexToRgba(chartColor, Math.max(chartColorOpacity * 0.6, 0.6))}
									floodOpacity="1"
									result="offsetColor"
								/>
								<feComposite in="offsetColor" in2="offsetBlur" operator="in" result="offsetBlur" />
								<feMerge>
									<feMergeNode />
									<feMergeNode in="SourceGraphic" />
								</feMerge>
							</filter>

							<AxisLeft
								scale={yScale}
								tickLabelProps={() => ({
									fill: 'rgb(var(--text-color))',
									fontSize: AXIS_FONT_SIZE,
									fontWeight: 400,
									textAnchor: 'end',
									verticalAnchor: 'middle',
									dx: -AXIS_GAP,
								})}
								tickValues={yAxis.values}
								tickFormat={(d) => getTimeString(d as number, yAxis.decimals)}
								left={axisWidth}
								strokeWidth={0}
								tickLength={0}
								stroke={hexToRgba(chartColor, chartColorOpacity)}
							/>

							<Group>
								<Area
									height={parent.height}
									curve={allCurves.curveNatural}
									data={data}
									x={(d) => xScale(getX(d)) || (0 as any)}
									y={(d) => yScale(getY(d)) || (0 as any)}
									strokeLinecap="round"
									style={{filter: 'url(#dropshadow)'}}
									stroke={hexToRgba(chartColor, chartColorOpacity)}
									strokeWidth={5}
								/>
							</Group>
						</svg>
					);
				}}
			</ParentSize>
		</div>
	);
}
