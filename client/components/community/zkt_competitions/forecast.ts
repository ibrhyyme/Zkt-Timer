/**
 * Forecast math — 1:1 port of wca-live's client/src/lib/attempt-result.js and
 * result.js forecast sections (projectedAverage, BPA/WPA, timeNeededToOvertake,
 * resultsForView). Values are centiseconds; DNF=-1, DNS=-2, skipped=0 sentinel
 * (our null attempts are converted to the skipped convention before use).
 */

export const SKIPPED_VALUE = 0;
export const DNF_VALUE = -1;
export const NA_VALUE = -3;
export const SUCCESS_VALUE = -4;

export function isComplete(v: number): boolean {
	return v > 0;
}

export function isSkipped(v: number): boolean {
	return v === SKIPPED_VALUE;
}

export function toMonotonic(v: number): number {
	return isComplete(v) ? v : Infinity;
}

export function compareAttemptResults(a: number, b: number): number {
	if (!isComplete(a) && !isComplete(b)) return 0;
	if (!isComplete(a) && isComplete(b)) return 1;
	if (isComplete(a) && !isComplete(b)) return -1;
	return a - b;
}

function mean(values: number[]): number {
	const sum = values.reduce((x, y) => x + y, 0);
	return Math.round(sum / values.length);
}

function meanOfX(attemptResults: number[]): number {
	if (!attemptResults.every(isComplete)) return DNF_VALUE;
	return mean(attemptResults);
}

/* See: https://www.worldcubeassociation.org/regulations/#9f2 */
function roundOver10Mins(value: number): number {
	if (!isComplete(value)) return value;
	if (value <= 10 * 6000) return value;
	return Math.round(value / 100) * 100;
}

function averageOf5(attemptResults: number[]): number {
	const [, x, y, z] = attemptResults.slice().sort(compareAttemptResults);
	return meanOfX([x, y, z]);
}

/**
 * Projection: mo3 → mean of current solves; ao5 → mean (1-2 solves),
 * median (3 solves), mean of middle two (4 solves), real average (5).
 */
export function projectedAverage(attemptResults: number[], numberOfAttempts: number): number {
	if (attemptResults.length === 0) return SKIPPED_VALUE;

	if (numberOfAttempts === 3) {
		return meanOfX(attemptResults);
	}

	if (numberOfAttempts === 5) {
		if (attemptResults.length < 3) return meanOfX(attemptResults);
		if (attemptResults.length === 3) {
			const [, x] = attemptResults.slice().sort(compareAttemptResults);
			return x;
		}
		if (attemptResults.length === 4) {
			const [, x, y] = attemptResults.slice().sort(compareAttemptResults);
			return meanOfX([x, y]);
		}
		return averageOf5(attemptResults);
	}

	return SKIPPED_VALUE;
}

export function bestPossibleAverage(attemptResults: number[]): number {
	const [x, y, z] = attemptResults.slice().sort(compareAttemptResults);
	return roundOver10Mins(meanOfX([x, y, z]));
}

export function worstPossibleAverage(attemptResults: number[]): number {
	const [, x, y, z] = attemptResults.slice().sort(compareAttemptResults);
	return roundOver10Mins(meanOfX([x, y, z]));
}

export interface ForecastResult {
	id: string;
	attempts: number[]; // entered attempts only (skipped trimmed)
	best: number;
	average: number;
	ranking: number | null;
	projectedAverage: number;
	forFirst: number;
	forAdvance: number;
	bestPossibleAverage: number;
	worstPossibleAverage: number;
	advancing: boolean;
	original: any;
}

function sum(values: number[]): number {
	return values.reduce((x, y) => x + y, 0);
}

/**
 * timeNeededToOvertake — verbatim port from wca-live result.js.
 */
export function timeNeededToOvertake(
	result: ForecastResult,
	numberOfAttempts: number,
	overtakeResult: ForecastResult
): number {
	if (isSkipped(overtakeResult.projectedAverage)) return DNF_VALUE;

	const attemptResults = result.attempts;
	const resultWorst = attemptResults.slice().sort(compareAttemptResults).pop() as number;
	const betterBest = compareAttemptResults(result.best, overtakeResult.best) < 0;

	// Projection changes from a mean to a median after a time is added.
	if (attemptResults.length === 2 && numberOfAttempts === 5) {
		const worstVsProjected = compareAttemptResults(resultWorst, overtakeResult.projectedAverage);
		if (worstVsProjected < 0 || (worstVsProjected === 0 && betterBest)) {
			return DNF_VALUE;
		}
		const bestVsProjected = compareAttemptResults(result.best, overtakeResult.projectedAverage);
		if (bestVsProjected < 0) {
			if (isComplete(overtakeResult.projectedAverage)) {
				return overtakeResult.projectedAverage - (betterBest ? 0 : 1);
			}
			return SUCCESS_VALUE;
		}
		if (bestVsProjected === 0) {
			return isComplete(overtakeResult.best) ? overtakeResult.best - 1 : SUCCESS_VALUE;
		}
		return NA_VALUE;
	}

	const isMean = numberOfAttempts === 3 || result.attempts.length < 2;

	if (!isComplete(overtakeResult.projectedAverage)) {
		if (betterBest) return DNF_VALUE;
		if (!isComplete(result.projectedAverage)) {
			return isComplete(overtakeResult.best) ? overtakeResult.best - 1 : SUCCESS_VALUE;
		}
		if (!isMean && isComplete(resultWorst)) return DNF_VALUE;
		return SUCCESS_VALUE;
	}

	if (!isComplete(result.projectedAverage)) {
		return NA_VALUE;
	}

	const nextCountingSolves = result.attempts.length + (isMean ? 1 : -1);
	const totalNeeded = overtakeResult.projectedAverage * nextCountingSolves;
	const roundingBuffer = nextCountingSolves === 3 ? 1 : 0;
	let countingSum = sum(attemptResults);
	if (!isMean) {
		countingSum = countingSum - result.best - resultWorst;
	}

	let needed = totalNeeded - countingSum + roundingBuffer;

	const newBest = Math.min(needed, result.best);
	if (newBest >= overtakeResult.best) {
		needed = Math.max(needed - nextCountingSolves, overtakeResult.best - 1);
	}

	const bestPossibleSolve = isMean ? 1 : result.best;
	const worstPossibleSolve = isMean || !isComplete(resultWorst) ? Infinity : resultWorst;
	if (needed < bestPossibleSolve) return NA_VALUE;
	if (needed >= worstPossibleSolve) return DNF_VALUE;
	return needed;
}

/**
 * Forecast pipeline (wca-live resultsForView): project averages, re-rank by
 * projection, mark advancing within the (ranking-based) advancement level, and
 * compute "for 1st" / "for advance" plus BPA/WPA after 4 of 5 solves.
 *
 * Input rows are our ZktResult shape (attempt_1..5, best, average); null/absent
 * attempts are treated as skipped.
 */
export function forecastResults(
	rows: any[],
	numberOfAttempts: number,
	advancementLevel: number | null
): ForecastResult[] {
	const list: ForecastResult[] = rows.map((r) => {
		const attempts: number[] = [];
		for (let i = 1; i <= numberOfAttempts; i++) {
			const v = r[`attempt_${i}`];
			if (v !== null && v !== undefined) attempts.push(v);
		}
		const average = r.average !== null && r.average !== undefined ? r.average : SKIPPED_VALUE;
		const best = r.best !== null && r.best !== undefined ? r.best : SKIPPED_VALUE;
		return {
			id: r.id,
			attempts,
			best,
			average,
			ranking: r.ranking ?? null,
			projectedAverage: !isSkipped(average)
				? average
				: projectedAverage(attempts, numberOfAttempts),
			forFirst: SKIPPED_VALUE,
			forAdvance: SKIPPED_VALUE,
			bestPossibleAverage:
				numberOfAttempts === 5 && attempts.length === 4
					? bestPossibleAverage(attempts)
					: SKIPPED_VALUE,
			worstPossibleAverage:
				numberOfAttempts === 5 && attempts.length === 4
					? worstPossibleAverage(attempts)
					: SKIPPED_VALUE,
			advancing: false,
			original: r,
		};
	});

	// Sort on projection, tiebreaker on best.
	list.sort((a, b) => {
		const pa = toMonotonic(a.projectedAverage) - toMonotonic(b.projectedAverage);
		if (pa !== 0) return pa < 0 ? -1 : 1;
		return toMonotonic(a.best) - toMonotonic(b.best);
	});

	if (list.length === 0 || list[0].attempts.length === 0) return list;

	const advancementRanking = advancementLevel ?? 3;

	list[0].ranking = 1;
	let prev = list[0];
	for (let i = 0; i < list.length; i++) {
		const current = list[i];
		if (current.attempts.length === 0) break;
		if (
			toMonotonic(current.projectedAverage) === toMonotonic(prev.projectedAverage) &&
			toMonotonic(current.best) === toMonotonic(prev.best)
		) {
			current.ranking = prev.ranking;
		} else {
			current.ranking = i + 1;
		}
		current.advancing = (current.ranking as number) <= advancementRanking;
		prev = current;
	}

	if (list.length > 1) {
		for (let i = 0; i < list.length; i++) {
			const result = list[i];
			if (result.attempts.length === 0) break;
			if (isSkipped(result.average)) {
				const firstIndex = i === 0 ? 1 : 0;
				result.forFirst = timeNeededToOvertake(result, numberOfAttempts, list[firstIndex]);
				const advancementIndex =
					i < advancementRanking ? advancementRanking : advancementRanking - 1;
				if (advancementIndex < list.length) {
					result.forAdvance = timeNeededToOvertake(
						result,
						numberOfAttempts,
						list[advancementIndex]
					);
				}
			}
		}
	}

	return list;
}
