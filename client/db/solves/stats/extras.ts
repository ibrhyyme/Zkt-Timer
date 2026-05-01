import {fetchSolves, FilterSolvesOptions} from '../query';

const DAY_MS = 24 * 60 * 60 * 1000;

function trimMean(times: number[]): number {
	if (times.length < 3) return NaN;
	const trimCount = times.length >= 100 ? Math.ceil(times.length * 0.05) : 1;
	const sorted = times.slice().sort((a, b) => a - b);
	const trimmed = sorted.slice(trimCount, times.length - trimCount);
	if (!trimmed.length) return NaN;
	return trimmed.reduce((s, t) => s + t, 0) / trimmed.length;
}

export interface ImprovementStat {
	currentAvg: number | null;
	previousAvg: number | null;
	deltaPct: number | null;
}

export function get30DayImprovement(filter: FilterSolvesOptions): ImprovementStat {
	const now = Date.now();
	const thirty = now - 30 * DAY_MS;
	const sixty = now - 60 * DAY_MS;

	const recent = fetchSolves(
		{
			...filter,
			dnf: false,
			time: {$gt: 0},
			started_at: {$gt: thirty},
		},
		{sortBy: 'started_at'}
	);

	const previous = fetchSolves(
		{
			...filter,
			dnf: false,
			time: {$gt: 0},
			started_at: {$gt: sixty, $lt: thirty},
		},
		{sortBy: 'started_at'}
	);

	const currentAvg = recent.length >= 12 ? trimMean(recent.slice(-12).map((s) => s.time)) : NaN;
	const previousAvg = previous.length >= 12 ? trimMean(previous.slice(-12).map((s) => s.time)) : NaN;

	let deltaPct: number | null = null;
	if (!isNaN(currentAvg) && !isNaN(previousAvg) && previousAvg > 0) {
		deltaPct = ((currentAvg - previousAvg) / previousAvg) * 100;
	}

	return {
		currentAvg: isNaN(currentAvg) ? null : currentAvg,
		previousAvg: isNaN(previousAvg) ? null : previousAvg,
		deltaPct,
	};
}

export function getSessionCount(filter: FilterSolvesOptions): number {
	const solves = fetchSolves(filter);
	const seen = new Set<string>();
	for (const s of solves) {
		if (s.session_id) seen.add(s.session_id);
	}
	return seen.size;
}

export interface DayOfWeekStat {
	bestDayIdx: number | null;
	bestAvg: number | null;
	counts: number[];
}

export function getBestDayOfWeek(filter: FilterSolvesOptions): DayOfWeekStat {
	const solves = fetchSolves({...filter, dnf: false, time: {$gt: 0}});
	const bucketTimes: number[][] = Array.from({length: 7}, () => []);

	for (const s of solves) {
		const d = new Date(s.started_at);
		const dow = d.getDay();
		bucketTimes[dow].push(s.time);
	}

	let bestAvg = Infinity;
	let bestDayIdx: number | null = null;
	const counts: number[] = bucketTimes.map((arr) => arr.length);

	for (let i = 0; i < 7; i++) {
		if (bucketTimes[i].length < 5) continue;
		const avg = trimMean(bucketTimes[i]);
		if (!isNaN(avg) && avg < bestAvg) {
			bestAvg = avg;
			bestDayIdx = i;
		}
	}

	return {
		bestDayIdx,
		bestAvg: bestDayIdx == null ? null : bestAvg,
		counts,
	};
}

export interface SparkData {
	values: number[];
	deltaPct: number | null;
}

export function getRecentSolveCountSpark(filter: FilterSolvesOptions, days: number = 30, buckets: number = 8): SparkData {
	const now = Date.now();
	const start = now - days * DAY_MS;

	const recent = fetchSolves(
		{
			...filter,
			dnf: false,
			started_at: {$gt: start},
		},
		{sortBy: 'started_at'}
	);

	const bucketSize = (days * DAY_MS) / buckets;
	const values = new Array(buckets).fill(0);
	for (const s of recent) {
		const idx = Math.min(buckets - 1, Math.floor((s.started_at - start) / bucketSize));
		values[idx]++;
	}

	const previousStart = now - 2 * days * DAY_MS;
	const previous = fetchSolves(
		{
			...filter,
			dnf: false,
			started_at: {$gt: previousStart, $lt: start},
		}
	);

	let deltaPct: number | null = null;
	if (previous.length > 0) {
		deltaPct = ((recent.length - previous.length) / previous.length) * 100;
	} else if (recent.length > 0) {
		deltaPct = 100;
	}

	return {values, deltaPct};
}

export interface PbProgressionPoint {
	time: number;
	at: number;
}

export function getRecentPbProgression(filter: FilterSolvesOptions, days: number = 60): PbProgressionPoint[] {
	const start = Date.now() - days * DAY_MS;
	const solves = fetchSolves(
		{
			...filter,
			dnf: false,
			time: {$gt: 0},
			started_at: {$gt: start},
		},
		{sortBy: 'started_at'}
	);

	const out: PbProgressionPoint[] = [];
	let pb = Infinity;
	for (const s of solves) {
		if (s.time < pb) {
			pb = s.time;
			out.push({time: s.time, at: s.started_at});
		}
	}
	return out;
}
