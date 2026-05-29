import {allPllKeys, keyToCase, keysToCases, D_TURN_OPTIONS, COLOR_SHIFTS} from './pll_cases';
import {shuffle} from './helpers';
import {randomCrossColor} from './colors';
import type {PllCase} from './scramble';

const includeNoAufInInitialQueue = false; // cases with no AUF might be easier to guess

export function generateEvaluationQueue(allowedCrossColors: string[], pool: string[] | null = null): PllCase[] {
	return shuffle(keysToCases(pool || allPllKeys(), allowedCrossColors, includeNoAufInInitialQueue));
}

export interface ResultRecord {
	pllCase: PllCase;
	started: Date | string | number;
	finished: Date | string | number;
	mistake: string; // "" = correct, "-" = give up, else literal wrong answer
}

export function resultTimeMs(r: ResultRecord): number {
	return new Date(r.finished).getTime() - new Date(r.started).getTime();
}

// returns true if r1 is better than r2
function isBetter(r1: ResultRecord, r2: ResultRecord): boolean {
	if (!r1.mistake && r2.mistake) return true;
	if (r1.mistake && !r2.mistake) return false;
	return resultTimeMs(r1) < resultTimeMs(r2);
}

export function resultsToEvalResults(results: ResultRecord[]): ResultRecord[] {
	const keyToWorstResult: Record<string, ResultRecord> = {};
	for (const r of results) {
		const key = r.pllCase.name + '/' + r.pllCase.rotation;
		if (!keyToWorstResult[key] || isBetter(keyToWorstResult[key], r)) {
			keyToWorstResult[key] = r;
		}
	}
	// return array of results sorted worst to best
	return Object.values(keyToWorstResult).sort((a, b) => (isBetter(b, a) ? -1 : 1));
}

/// @param resultsSorted - results sorted worst to best with no duplicate keys
export function evalResultsToNewQueue(
	resultsSorted: ResultRecord[],
	allowedCrossColors: string[],
	pool: string[] | null = null
): PllCase[] {
	const queue: PllCase[] = [];
	const addCases = (key: string, numResults: number) => {
		// avoid including no-auf whenever possible
		const dTurns = shuffle(numResults === 4 ? [...D_TURN_OPTIONS] : [...D_TURN_OPTIONS.slice(1)]).slice(0, numResults);
		const colorShifts = shuffle([...COLOR_SHIFTS]).slice(0, numResults);
		for (let i = 0; i < numResults; i++) {
			queue.push(keyToCase(key, dTurns[i], colorShifts[i], randomCrossColor(allowedCrossColors)));
		}
	};

	const resultKey = (r: ResultRecord) => `${r.pllCase.name}/${r.pllCase.rotation}`;

	// in case resultsSorted missing some keys, add them to queue (single instance each)
	const remainingKeysSet = new Set<string>(pool || allPllKeys());
	resultsSorted.forEach((r) => remainingKeysSet.delete(resultKey(r)));

	const top15 = Math.ceil(resultsSorted.length * 0.15);
	const top30 = Math.ceil(resultsSorted.length * 0.3);
	const top50 = Math.ceil(resultsSorted.length * 0.5);
	const top100 = Math.ceil(resultsSorted.length * 1.0);
	resultsSorted.slice(0, top15).forEach((r) => addCases(resultKey(r), 4));
	resultsSorted.slice(top15, top30).forEach((r) => addCases(resultKey(r), 3));
	resultsSorted.slice(top30, top50).forEach((r) => addCases(resultKey(r), 2));
	resultsSorted.slice(top50, top100).forEach((r) => addCases(resultKey(r), 1));
	[...remainingKeysSet].forEach((k) => addCases(k, 1));

	return shuffle(queue);
}

export function evalQueueSize(resultsSorted: ResultRecord[], pool: string[] | null = null): number {
	const remainingKeys = new Set<string>(pool || allPllKeys());
	resultsSorted.forEach((r) => remainingKeys.delete(`${r.pllCase.name}/${r.pllCase.rotation}`));
	const n = resultsSorted.length;
	const top15 = Math.ceil(n * 0.15);
	const top30 = Math.ceil(n * 0.3);
	const top50 = Math.ceil(n * 0.5);
	return top15 * 4 + (top30 - top15) * 3 + (top50 - top30) * 2 + (n - top50) * 1 + remainingKeys.size;
}
