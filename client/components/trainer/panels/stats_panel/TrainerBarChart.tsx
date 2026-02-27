import React from 'react';
import {ParentSize} from '@visx/responsive';
import {Group} from '@visx/group';
import {Bar} from '@visx/shape';
import {scaleLinear, scaleBand} from '@visx/scale';

interface Props {
	times: number[]; // Last N times in ms
	bestTime: number | null;
}

const MARGIN = {top: 4, right: 4, bottom: 4, left: 4};

function Chart({times, bestTime, width, height}: Props & {width: number; height: number}) {
	if (width < 10 || height < 10 || times.length === 0) return null;

	const innerWidth = width - MARGIN.left - MARGIN.right;
	const innerHeight = height - MARGIN.top - MARGIN.bottom;

	const data = times.map((t, i) => ({index: String(i + 1), value: t / 1000}));
	const maxVal = Math.max(...data.map((d) => d.value)) * 1.1;

	const xScale = scaleBand<string>({
		domain: data.map((d) => d.index),
		range: [0, innerWidth],
		padding: 0.3,
	});

	const yScale = scaleLinear<number>({
		domain: [0, maxVal],
		range: [innerHeight, 0],
	});

	return (
		<svg width={width} height={height}>
			<Group left={MARGIN.left} top={MARGIN.top}>
				{data.map((d, i) => {
					const barHeight = innerHeight - (yScale(d.value) ?? 0);
					const isBest = bestTime !== null && times[i] === bestTime;

					return (
						<Bar
							key={d.index}
							x={xScale(d.index)}
							y={yScale(d.value)}
							width={xScale.bandwidth()}
							height={barHeight}
							fill={isBest ? 'rgba(75, 192, 192, 0.8)' : 'rgba(var(--primary-color), 0.6)'}
							rx={3}
						/>
					);
				})}
			</Group>
		</svg>
	);
}

export default function TrainerBarChart({times, bestTime}: Props) {
	if (times.length === 0) return null;

	return (
		<ParentSize>
			{({width, height}) => (
				<Chart times={times} bestTime={bestTime} width={width} height={height} />
			)}
		</ParentSize>
	);
}
