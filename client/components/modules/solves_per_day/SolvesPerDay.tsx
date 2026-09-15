import React, {useMemo, useState} from 'react';
import {useSolveDb} from '../../../util/hooks/useSolveDb';
import {useEventListener} from '../../../util/event_handler';
import {getSolveCountByDateData} from '../../../db/solves/stats/consistency';
import BarGraph from '../bar_graph/BarGraph';
import jsonStr from 'json-stable-stringify';
import {FilterSolvesOptions} from '../../../db/solves/query';
import {getGoalForCubeType} from '../../daily-goal/helpers/storage';

interface Props {
	days: number;
	filterOptions: FilterSolvesOptions;
}

export default function SolvesPerDay(props: Props) {
	const {days, filterOptions} = props;

	const solveUpdate = useSolveDb();
	const [, setGoalVersion] = useState(0);

	const endDate = new Date();
	const startDate = new Date();
	startDate.setDate(startDate.getDate() - days);

	const memoData = useMemo(() => {
		return getSolveCountByDateData({
			...filterOptions,
			started_at: startDate.getTime(),
			ended_at: endDate.getTime(),
		}).map((d) => {
			// Data keys are year-safe 'YYYY-M-D'; bars keep the short 'M/D' label.
			const [, month, day] = d.x.split('-');
			return {...d, x: `${month}/${day}`};
		});
	}, [jsonStr(filterOptions), filterOptions, solveUpdate]);

	// The goal line is read from goal storage during render, so a goal set, edited or
	// switched off elsewhere (quick settings, another module) has to trigger a render here.
	useEventListener('dailyGoalUpdatedEvent', () => setGoalVersion((v) => v + 1));

	const goal = getGoalForCubeType(filterOptions.cube_type as string, filterOptions.scramble_subset as string | null);
	const goalTarget = goal?.enabled ? goal.target : null;

	return <BarGraph data={memoData} goalLine={goalTarget} />;
}
