import React, {useMemo} from 'react';
import {useSolveDb} from '../../../util/hooks/useSolveDb';
import {getSolveCountByDateData} from '../../../db/solves/stats/consistency';
import BarGraph from '../bar_graph/BarGraph';
import jsonStr from 'json-stable-stringify';
import {FilterSolvesOptions} from '../../../db/solves/query';

interface Props {
	days: number;
	filterOptions: FilterSolvesOptions;
}

export default function SolvesPerDay(props: Props) {
	const {days, filterOptions} = props;

	const solveUpdate = useSolveDb();

	const endDate = new Date();
	const startDate = new Date();
	startDate.setDate(startDate.getDate() - days);

	const memoData = useMemo(() => {
		return getSolveCountByDateData({
			...filterOptions,
			started_at: startDate.getTime(),
			ended_at: endDate.getTime(),
		});
	}, [jsonStr(filterOptions), filterOptions, solveUpdate]);


	return <BarGraph data={memoData} />;
}
