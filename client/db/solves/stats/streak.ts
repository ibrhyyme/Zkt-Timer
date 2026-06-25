import {mean} from 'lodash';
import dayjs from 'dayjs';
import {fetchSolves, FilterSolvesOptions} from '../query';

interface SolveStreak {
	currentStreak: number;
	currentStreakSolves: number;
	currentStartDate: Date; // No end date. End date would be today
	highestStreak: number;
	highestStreakSolves: number;
	highestStartDate: Date;
	highestEndDate: Date;
	avgSolvesPerSession: number;
}

export function getSolveStreak(
	filter: FilterSolvesOptions,
	extraDailyCounts?: Map<string, number>
): SolveStreak {
	const solves = fetchSolves(
		{
			...filter,
		},
		{
			sortBy: 'started_at',
		}
	);

	let firstSolveTime;
	if (solves.length) {
		firstSolveTime = solves[0].started_at;
	} else {
		firstSolveTime = new Date().getTime();
	}

	const start = new Date();
	start.setHours(0, 0, 0, 0);
	const end = new Date();
	end.setHours(23, 59, 59, 999);

	// Pre-bucket solve counts per day (full date key → year-safe). Order-independent:
	// a solve whose start/end straddle midnight can no longer jam a sequential cursor
	// and silently zero out every earlier day.
	const dayCounts = new Map<string, number>();
	for (const solve of solves) {
		const key = dayjs(solve.started_at).format('YYYY-M-D');
		dayCounts.set(key, (dayCounts.get(key) || 0) + 1);
	}

	// Optional extra per-day counts (e.g. Friendly Room solves) folded in by day key.
	if (extraDailyCounts) {
		for (const [key, val] of extraDailyCounts) {
			dayCounts.set(key, (dayCounts.get(key) || 0) + val);
		}
		// A user may have only room solves (no timer solves) — extend the scan window
		// back to the earliest active day so the streak isn't clipped to today.
		for (const key of dayCounts.keys()) {
			const [y, m, d] = key.split('-').map(Number);
			const t = new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
			if (!Number.isNaN(t) && t < firstSolveTime) firstSolveTime = t;
		}
	}

	let currentStreak = 0;
	let currentStreakSolves = 0;
	let currentEnded = false;
	let currentStartDate = new Date(start);

	let highestStreak = 0;
	let highestStreakSolves = 0;
	let highestStartDate = new Date(start);
	let highestEndDate = new Date(end);

	let tempStreak = 0;
	let tempStreakSolves = 0;
	let tempStreakStart = new Date(start);
	let tempStreakEnd = new Date(end);

	const solvesPerSession = [];

	while (end.getTime() > firstSolveTime) {
		const dayCount = dayCounts.get(dayjs(start).format('YYYY-M-D')) || 0;
		tempStreakSolves += dayCount;

		if (dayCount > 0) {
			tempStreakStart = new Date(start);
			if (!tempStreakEnd) {
				tempStreakEnd = new Date(end);
			}

			tempStreak++;
		}

		// No solves on this day
		const tempEnd = new Date(end);
		tempEnd.setDate(tempEnd.getDate() - 1);
		const lastLoop = tempEnd.getTime() < firstSolveTime;
		if (!dayCount || lastLoop) {
			if (!currentEnded) {
				currentStreak = tempStreak;
				currentEnded = true;
				currentStreakSolves = tempStreakSolves;
				currentStartDate = new Date(tempStreakStart);
			}

			if (tempStreak > highestStreak) {
				highestStreak = tempStreak;
				highestStreakSolves = tempStreakSolves;
				highestStartDate = new Date(tempStreakStart);
				highestEndDate = new Date(tempStreakEnd);
			}

			if (tempStreak > 0) {
				solvesPerSession.push(tempStreakSolves);
			}

			tempStreak = 0;
			tempStreakSolves = 0;
			tempStreakStart = null;
			tempStreakEnd = null;
		}

		start.setDate(start.getDate() - 1);
		end.setDate(end.getDate() - 1);
	}

	return {
		currentStreak,
		currentStreakSolves,
		currentStartDate,
		highestStreak,
		highestStreakSolves,
		highestStartDate,
		highestEndDate,
		avgSolvesPerSession: solvesPerSession.length ? Math.floor(mean(solvesPerSession)) : 0,
	};
}
