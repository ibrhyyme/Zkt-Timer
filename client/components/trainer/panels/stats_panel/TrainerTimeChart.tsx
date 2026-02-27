import React, {useMemo} from 'react';
import {ParentSize} from '@visx/responsive';
import {Group} from '@visx/group';
import {Area, LinePath} from '@visx/shape';
import {scaleLinear} from '@visx/scale';
import * as allCurves from '@visx/curve';

interface Props {
	times: number[]; // All times in ms
}

interface DataPoint {
	index: number;
	value: number;
}

const MARGIN = {top: 4, right: 4, bottom: 4, left: 4};

/**
 * Calculate trimmed average (remove best/worst, average the rest).
 * Returns null for indices where there aren't enough data points yet.
 */
function calculateTrimmedAverage(
	times: number[],
	windowSize: number,
	keepCount: number
): (number | null)[] {
	const result: (number | null)[] = [];
	const trimCount = Math.floor((windowSize - keepCount) / 2);

	for (let i = 0; i < times.length; i++) {
		if (i < windowSize - 1) {
			result.push(null);
			continue;
		}
		const window = times.slice(i - windowSize + 1, i + 1).sort((a, b) => a - b);
		const trimmed = window.slice(trimCount, windowSize - trimCount);
		result.push(trimmed.reduce((s, v) => s + v, 0) / keepCount);
	}
	return result;
}

function Chart({times, width, height}: Props & {width: number; height: number}) {
	if (width < 10 || height < 10 || times.length < 2) return null;

	const innerWidth = width - MARGIN.left - MARGIN.right;
	const innerHeight = height - MARGIN.top - MARGIN.bottom;

	const data: DataPoint[] = times.map((t, i) => ({index: i, value: t / 1000}));

	const ao5 = useMemo(() => calculateTrimmedAverage(times, 5, 3), [times]);
	const ao12 = useMemo(() => calculateTrimmedAverage(times, 12, 10), [times]);

	const allValues = data.map((d) => d.value);
	const maxVal = Math.max(...allValues) * 1.05;
	const minVal = Math.min(...allValues) * 0.95;

	const xScale = scaleLinear<number>({
		domain: [0, data.length - 1],
		range: [0, innerWidth],
	});

	const yScale = scaleLinear<number>({
		domain: [minVal, maxVal],
		range: [innerHeight, 0],
	});

	const getX = (d: DataPoint) => xScale(d.index) ?? 0;
	const getY = (d: DataPoint) => yScale(d.value) ?? 0;

	const ao5Data: DataPoint[] = ao5
		.map((v, i) => (v !== null ? {index: i, value: v / 1000} : null))
		.filter(Boolean) as DataPoint[];

	const ao12Data: DataPoint[] = ao12
		.map((v, i) => (v !== null ? {index: i, value: v / 1000} : null))
		.filter(Boolean) as DataPoint[];

	return (
		<svg width={width} height={height}>
			<defs>
				<linearGradient id="trainer-area-gradient" x1="0" y1="0" x2="0" y2="1">
					<stop offset="0%" stopColor="rgb(var(--primary-color))" stopOpacity={0.3} />
					<stop offset="100%" stopColor="rgb(var(--primary-color))" stopOpacity={0.02} />
				</linearGradient>
			</defs>
			<Group left={MARGIN.left} top={MARGIN.top}>
				{/* Single times area */}
				<Area
					data={data}
					x={getX}
					y0={innerHeight}
					y1={getY}
					curve={allCurves.curveNatural}
					fill="url(#trainer-area-gradient)"
					stroke="rgb(var(--primary-color))"
					strokeWidth={1.5}
					strokeOpacity={0.6}
				/>

				{/* Ao5 line */}
				{ao5Data.length >= 2 && (
					<LinePath
						data={ao5Data}
						x={getX}
						y={getY}
						curve={allCurves.curveNatural}
						stroke="rgba(75, 192, 192, 0.9)"
						strokeWidth={1.5}
					/>
				)}

				{/* Ao12 line */}
				{ao12Data.length >= 2 && (
					<LinePath
						data={ao12Data}
						x={getX}
						y={getY}
						curve={allCurves.curveNatural}
						stroke="rgba(255, 159, 64, 0.9)"
						strokeWidth={1.5}
					/>
				)}
			</Group>
		</svg>
	);
}

export default function TrainerTimeChart({times}: Props) {
	if (times.length < 2) return null;

	return (
		<ParentSize>
			{({width, height}) => <Chart times={times} width={width} height={height} />}
		</ParentSize>
	);
}
