import {fetchSolves, FilterSolvesOptions} from '../query';

export interface HourlyStats {
	hours: number[];
	total: number;
	peakHour: number;
	peakCount: number;
	avgPerActiveHour: number;
}

export function getSolveCountByHour(filter: FilterSolvesOptions): HourlyStats {
	const solves = fetchSolves({
		...filter,
		dnf: false,
		time: {$gt: 0},
	});

	const hours = new Array(24).fill(0);
	for (const s of solves) {
		const d = new Date(s.started_at);
		hours[d.getHours()]++;
	}

	let peakHour = 0;
	let peakCount = 0;
	let activeHours = 0;
	for (let i = 0; i < 24; i++) {
		if (hours[i] > peakCount) {
			peakCount = hours[i];
			peakHour = i;
		}
		if (hours[i] > 0) activeHours++;
	}

	return {
		hours,
		total: solves.length,
		peakHour,
		peakCount,
		avgPerActiveHour: activeHours ? Math.round(solves.length / activeHours) : 0,
	};
}

export function getStandardDeviation(filter: FilterSolvesOptions, count: number = 100): number | null {
	const solves = fetchSolves(
		{...filter, dnf: false, time: {$gt: 0}},
		{sortBy: 'started_at', sortInverse: true, limit: count}
	);

	if (!solves || solves.length < 3) return null;

	const times = solves.map((s) => s.time);
	const mean = times.reduce((s, t) => s + t, 0) / times.length;
	const variance = times.reduce((s, t) => s + (t - mean) ** 2, 0) / times.length;
	return Math.sqrt(variance);
}
