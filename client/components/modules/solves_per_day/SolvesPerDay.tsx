import React, {useMemo, useState} from 'react';
import {useSolveDb} from '../../../util/hooks/useSolveDb';
import {useEventListener} from '../../../util/event_handler';
import {getSolveCountByDateData} from '../../../db/solves/stats/consistency';
import BarGraph from '../bar_graph/BarGraph';
import jsonStr from 'json-stable-stringify';
import {FilterSolvesOptions} from '../../../db/solves/query';
import {getGoalForCubeType} from '../../daily-goal/helpers/storage';
import {getExtraDailyCounts} from '../../daily-goal/helpers/extra-daily-counts';

interface Props {
	days: number;
	filterOptions: FilterSolvesOptions;
}

export default function SolvesPerDay(props: Props) {
	const {days, filterOptions} = props;

	const solveUpdate = useSolveDb();
	const [goalVersion, setGoalVersion] = useState(0);

	const endDate = new Date();
	const startDate = new Date();
	startDate.setDate(startDate.getDate() - days);

	// Room solves and deleted solves count toward the goal when their toggles are on, and
	// this chart draws that goal as a line across the bars. Bars that leave them out put
	// the line out of reach of its own data, so they count exactly what the goal counts.
	// The session in the filter is deliberately ignored, as the goal ignores it too.
	const extraDailyCounts = useMemo(
		() => getExtraDailyCounts(filterOptions),
		[jsonStr(filterOptions), filterOptions, solveUpdate, goalVersion]
	);

	const memoData = useMemo(() => {
		return getSolveCountByDateData({
			...filterOptions,
			started_at: startDate.getTime(),
			ended_at: endDate.getTime(),
		}, extraDailyCounts).map((d) => {
			// Data keys are year-safe 'YYYY-M-D'; bars keep the short 'M/D' label.
			const [, month, day] = d.x.split('-');
			return {...d, x: `${month}/${day}`};
		});
	}, [jsonStr(filterOptions), filterOptions, solveUpdate, extraDailyCounts]);

	// The goal line is read from goal storage during render, so a goal set, edited or
	// switched off elsewhere (quick settings, another module) has to trigger a render here.
	// The same event carries the counting toggles and the room-solve cache refresh.
	useEventListener('dailyGoalUpdatedEvent', () => setGoalVersion((v) => v + 1));

	const goal = getGoalForCubeType(filterOptions.cube_type as string, filterOptions.scramble_subset as string | null);
	const goalTarget = goal?.enabled ? goal.target : null;

	return <BarGraph data={memoData} goalLine={goalTarget} />;
}
