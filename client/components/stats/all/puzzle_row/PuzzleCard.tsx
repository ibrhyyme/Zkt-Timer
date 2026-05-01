import React, {useMemo} from 'react';
import block from '../../../../styles/bem';
import {fetchSolves, FilterSolvesOptions} from '../../../../db/solves/query';
import {getSinglePB} from '../../../../db/solves/stats/solves/single/single_pb';
import {getCurrentAverage} from '../../../../db/solves/stats/solves/average/average';
import {getCubeTypeBucketLabel} from '../../../../util/cubes/util';
import {getTimeString} from '../../../../util/time';
import {useSolveDb} from '../../../../util/hooks/useSolveDb';

const b = block('puzzle-card');

const SPARK_LIMIT = 20;

interface Props {
	cubeType: string;
	scrambleSubset: string | null;
	count: number;
	color: string;
	onClick?: () => void;
}

export default function PuzzleCard(props: Props) {
	const {cubeType, scrambleSubset, count, color, onClick} = props;
	const solveUpdate = useSolveDb();

	const filter: FilterSolvesOptions = useMemo(
		() => ({
			from_timer: true,
			cube_type: cubeType,
			scramble_subset: scrambleSubset ?? null,
		}),
		[cubeType, scrambleSubset]
	);

	const pb = useMemo(() => getSinglePB(filter), [filter, solveUpdate]);
	const ao12 = useMemo(() => getCurrentAverage(filter, 12), [filter, solveUpdate]);

	const sparkPoints = useMemo(() => {
		const recent = fetchSolves(
			{...filter, dnf: false, time: {$gt: 0}},
			{sortBy: 'started_at', sortInverse: true, limit: SPARK_LIMIT}
		);
		if (!recent || recent.length < 4) return null;

		const times = recent.slice().reverse().map((s) => s.time);
		const min = Math.min(...times);
		const max = Math.max(...times);
		const range = max - min || 1;
		const W = 120;
		const H = 36;
		const stepX = times.length > 1 ? W / (times.length - 1) : 0;

		return times
			.map((t, i) => {
				const x = i * stepX;
				const y = H - 4 - ((t - min) / range) * (H - 8);
				return `${x.toFixed(1)},${y.toFixed(1)}`;
			})
			.join(' ');
	}, [filter, solveUpdate]);

	const label = getCubeTypeBucketLabel(cubeType, scrambleSubset);

	return (
		<button type="button" className={b()} onClick={onClick}>
			<div className={b('head')}>
				<span className={b('name')} style={{color}}>{label}</span>
				<span className={b('count')}>{count.toLocaleString()}</span>
			</div>
			{sparkPoints ? (
				<div className={b('spark')}>
					<svg viewBox="0 0 120 36" preserveAspectRatio="none">
						<polyline fill="none" stroke={color} strokeWidth={1.6} points={sparkPoints} />
					</svg>
				</div>
			) : (
				<div className={b('spark', {empty: true})} />
			)}
			<div className={b('stats')}>
				<div className={b('stat')}>
					<strong>{getTimeString(pb?.time)}</strong>
					<span>PB</span>
				</div>
				<div className={b('stat', {right: true})}>
					<strong>{getTimeString(ao12?.time)}</strong>
					<span>Ao12</span>
				</div>
			</div>
		</button>
	);
}
