import {fetchSolves, FilterSolvesOptions} from '../query';
import {BarGraphData} from '../../../components/modules/bar_graph/BarGraph';
import dayjs from 'dayjs';

export function getSolveCountByDateData(
	filter: FilterSolvesOptions,
	extraDailyCounts?: Map<string, number>
): BarGraphData[] {
	const start = new Date(filter.started_at as number);
	const end = new Date(filter.ended_at as number);

	start.setHours(0, 0, 0, 0);
	end.setHours(23, 59, 59, 999);

	const solves = fetchSolves(
		{
			...filter,
			started_at: {
				$gt: start.getTime(),
			},
			ended_at: {
				$lt: end.getTime(),
			},
		},
		{
			sortBy: 'started_at',
		}
	);

	// Bucket each solve by its own day key. Order-independent: a single solve
	// whose started/ended straddle midnight (e.g. a timer left running) can no
	// longer jam a sequential cursor and zero out every following day.
	const counts = new Map<string, number>();
	for (const solve of solves) {
		const key = dayjs(solve.started_at).format('YYYY-M-D');
		counts.set(key, (counts.get(key) || 0) + 1);
	}

	// Optional extra per-day counts (e.g. Friendly Room solves) folded in by day key.
	if (extraDailyCounts) {
		for (const [key, val] of extraDailyCounts) {
			counts.set(key, (counts.get(key) || 0) + val);
		}
	}

	const data: BarGraphData[] = [];
	const tempStart = new Date(start);

	while (tempStart.getTime() < end.getTime()) {
		const key = dayjs(tempStart).format('YYYY-M-D');
		data.push({
			x: key,
			y: counts.get(key) || 0,
		});
		tempStart.setDate(tempStart.getDate() + 1);
	}

	return data;
}
