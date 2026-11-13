// Advancement colours (green = clinched, orange = questionable) for ZKT Live
// "Anlık durum", the judges' unchecked standings while a round runs.
//
// The official table gets these flags from the federation, which computes them
// in zekakuputurkiye-site `lib/zkt/advancement.ts` (a port of wca-live
// `advancing.ex`). The live standings exist only here, built from what the
// public may see (live-status-rows.ts), so the same math runs on them here.
// This file is that math, kept line-for-line with the site's version minus the
// Çift Şans branch (a Çift Şans round keeps the group view, which has no
// colours). Change one, change both; the site's test vectors are mirrored in
// __tests__/live_advancement.test.ts.

export type ZktFormat = 'BO1' | 'BO2' | 'BO3' | 'MO3' | 'AO5' | 'AO12';
export type ZktAdvancementType = 'RANKING' | 'PERCENT' | 'ATTEMPT_RESULT';

// -1 = DNF, -2 = DNS.
const DNF = -1;
const DNS = -2;
// Best possible attempt for the "everyone does their best" hypothetical.
const BEST_CASE_CS = 1;

export interface AdvancementState {
	advancing: boolean;
	questionable: boolean;
}

export interface AdvancementInput {
	id: string;
	/** Positional attempts; null/undefined = not done yet. */
	attempts: (number | null | undefined)[];
}

function isValidAttempt(value: number | null | undefined): boolean {
	return value !== null && value !== undefined && value > 0;
}

function isDnfOrDns(value: number | null | undefined): boolean {
	return value === DNF || value === DNS;
}

export function getAttemptCount(format: ZktFormat): number {
	switch (format) {
		case 'BO1':
			return 1;
		case 'BO2':
			return 2;
		case 'BO3':
		case 'MO3':
			return 3;
		case 'AO5':
			return 5;
		case 'AO12':
			return 12;
		default:
			return 5;
	}
}

function formatHasAverage(format: ZktFormat): boolean {
	return format === 'MO3' || format === 'AO5' || format === 'AO12';
}

function calculateBest(attempts: (number | null | undefined)[]): number | null {
	const valid = attempts.filter((a) => isValidAttempt(a)) as number[];
	if (valid.length === 0) {
		if (attempts.some((a) => a !== null && a !== undefined)) return DNF;
		return null;
	}
	return Math.min(...valid);
}

function calculateAverage(attempts: (number | null | undefined)[], format: ZktFormat): number | null {
	if (!formatHasAverage(format)) return null;

	const attemptCount = getAttemptCount(format);
	const relevant = attempts.slice(0, attemptCount);
	if (relevant.length < attemptCount || relevant.some((a) => a === null || a === undefined)) return null;

	const values = relevant as number[];

	if (format === 'MO3') {
		if (values.some((v) => isDnfOrDns(v))) return DNF;
		const sum = values.reduce((a, b) => a + b, 0);
		return Math.round(sum / 3);
	}

	// AO5 / AO12: drop best + worst, average the middle n-2.
	const dnfCount = values.filter((v) => isDnfOrDns(v)).length;
	if (dnfCount >= 2) return DNF;
	const sorted = [...values].sort((a, b) => {
		if (isDnfOrDns(a)) return 1;
		if (isDnfOrDns(b)) return -1;
		return a - b;
	});
	const middle = sorted.slice(1, attemptCount - 1);
	const sum = middle.reduce((a, b) => a + b, 0);
	return Math.round(sum / (attemptCount - 2));
}

function scored(id: string, attempts: (number | null | undefined)[], format: ZktFormat) {
	return {id, best: calculateBest(attempts), average: calculateAverage(attempts, format)};
}

function compareValue(a: number | null, b: number | null): number {
	const aBad = a === null || a === undefined || a <= 0;
	const bBad = b === null || b === undefined || b <= 0;
	if (aBad && bBad) return 0;
	if (aBad) return 1;
	if (bBad) return -1;
	return a - b;
}

function compareResults(
	a: {best: number | null; average: number | null},
	b: {best: number | null; average: number | null},
	sortByAverage: boolean
): number {
	const primaryA = sortByAverage ? a.average : a.best;
	const primaryB = sortByAverage ? b.average : b.best;
	const cmp = compareValue(primaryA, primaryB);
	if (cmp !== 0) return cmp;
	return compareValue(a.best, b.best);
}

interface Ranked {
	id: string;
	best: number | null;
	average: number | null;
	ranking: number;
}

function rankResults(results: {id: string; best: number | null; average: number | null}[], format: ZktFormat): Ranked[] {
	const sortByAverage = formatHasAverage(format);
	const sorted = [...results].sort((a, b) => compareResults(a, b, sortByAverage));

	const ranked: Ranked[] = [];
	let currentRank = 0;
	let lastKey = '';
	for (let i = 0; i < sorted.length; i++) {
		const r = sorted[i];
		const primary = sortByAverage ? r.average : r.best;
		const key = `${primary}|${r.best}`;
		if (key !== lastKey) {
			currentRank = i + 1;
			lastKey = key;
		}
		ranked.push({id: r.id, best: r.best, average: r.average, ranking: currentRank});
	}
	return ranked;
}

/** Does this result meet the round's advancement condition, on its own? */
function satisfiesAdvancementCondition(
	r: Ranked,
	advancementType: ZktAdvancementType,
	advancementLevel: number,
	totalResults: number,
	format: ZktFormat
): boolean {
	if (advancementType === 'RANKING') return r.ranking <= advancementLevel;
	if (advancementType === 'PERCENT') {
		return r.ranking <= Math.floor((totalResults * advancementLevel) / 100);
	}
	// ATTEMPT_RESULT: strictly better than the level (a DNF or nothing never is).
	const primary = formatHasAverage(format) ? r.average : r.best;
	return primary !== null && primary > 0 && primary < advancementLevel;
}

/**
 * Result ids that satisfy the advancement criteria, with WCA Regulation 9p1
 * (at most 75% of the field advances; a tie straddling the cap drops out as a
 * group). Competitors with no result yet are padded in up to `fieldSize`.
 */
function qualifyingIds(
	ranked: Ranked[],
	advancementType: ZktAdvancementType | null | undefined,
	advancementLevel: number | null | undefined,
	format: ZktFormat,
	fieldSize: number
): Set<string> {
	const ids = new Set<string>();
	if (!advancementType || !advancementLevel) return ids;

	const totalResults = Math.max(ranked.length, fieldSize);
	const maxQualifying = Math.floor(totalResults * 0.75);

	const rankings = ranked.map((r) => r.ranking).sort((a, b) => a - b);
	for (let i = ranked.length; i < totalResults; i++) rankings.push(ranked.length + 1);

	let firstNonQualifyingRanking: number;
	if (rankings.length > maxQualifying) {
		firstNonQualifyingRanking = rankings[maxQualifying];
	} else {
		firstNonQualifyingRanking = rankings.length === 0 ? 1 : rankings[rankings.length - 1] + 1;
	}

	for (const r of ranked) {
		if (r.ranking >= firstNonQualifyingRanking) continue;
		// One successful solve is required, whatever the average did.
		if (r.best === null || r.best <= 0) continue;
		if (!satisfiesAdvancementCondition(r, advancementType, advancementLevel, totalResults, format)) continue;
		ids.add(r.id);
	}
	return ids;
}

// How many attempts this competitor is expected to have: only the cutoff's
// attempts once those are in and none beat it, otherwise the whole format.
function expectedAttemptCount(
	attempts: (number | null | undefined)[],
	format: ZktFormat,
	cutoffCs: number | null | undefined,
	cutoffAttempts: number | null | undefined
): number {
	const full = getAttemptCount(format);
	if (!cutoffCs || cutoffCs <= 0 || !cutoffAttempts || cutoffAttempts <= 0) return full;
	if (cutoffAttempts >= full) return full;
	const firstN = attempts.slice(0, cutoffAttempts);
	const meets = firstN.some((a) => a !== null && a !== undefined && a > 0 && a < cutoffCs);
	return meets ? full : cutoffAttempts;
}

function hasExpectedAttempts(
	attempts: (number | null | undefined)[],
	format: ZktFormat,
	cutoffCs: number | null | undefined,
	cutoffAttempts: number | null | undefined
): boolean {
	const need = expectedAttemptCount(attempts, format, cutoffCs, cutoffAttempts);
	let count = 0;
	for (let i = 0; i < need; i++) {
		if (attempts[i] !== null && attempts[i] !== undefined) count++;
	}
	return count === need;
}

/**
 * Per-result advancement state for a round.
 *
 * @param roundFinished true once the round is finished: forces questionable off
 *                      and takes the field as exactly the results given.
 * @param totalExpected the round's field size while it runs; competitors not in
 *                      `results` yet count as best-case rivals.
 */
export function computeAdvancementStates(
	results: AdvancementInput[],
	advancementType: ZktAdvancementType | null | undefined,
	advancementLevel: number | null | undefined,
	format: ZktFormat,
	cutoffCs: number | null | undefined,
	cutoffAttempts: number | null | undefined,
	roundFinished: boolean,
	totalExpected?: number
): Map<string, AdvancementState> {
	const states = new Map<string, AdvancementState>();
	if (results.length === 0) return states;

	// 1) Current standings: who is in the top N right now.
	const current = results.map((r) => scored(r.id, r.attempts, format));
	const fieldSize = roundFinished ? results.length : Math.max(results.length, totalExpected ?? results.length);
	const currentAdvancing = qualifyingIds(rankResults(current, format), advancementType, advancementLevel, format, fieldSize);

	// 2) Best-case hypothetical: every open result does its best possible.
	//    Whoever still advances there AND has finished has clinched.
	const hypothetical = results.map((r) => {
		if (hasExpectedAttempts(r.attempts, format, cutoffCs, cutoffAttempts)) {
			return scored(r.id, r.attempts, format);
		}
		const filled = [...r.attempts];
		const full = getAttemptCount(format);
		for (let i = 0; i < full; i++) {
			if (filled[i] === null || filled[i] === undefined) filled[i] = BEST_CASE_CS;
		}
		return scored(r.id, filled, format);
	});
	// Competitors who have not gone yet are rivals too.
	const expectedAvg = formatHasAverage(format) ? BEST_CASE_CS : null;
	const extra = Math.max(0, fieldSize - results.length);
	for (let i = 0; i < extra; i++) {
		hypothetical.push({id: `__virtual_${i}`, best: BEST_CASE_CS, average: expectedAvg});
	}
	const hypotheticalAdvancing = qualifyingIds(
		rankResults(hypothetical, format),
		advancementType,
		advancementLevel,
		format,
		fieldSize
	);

	for (const r of results) {
		const advancing = currentAdvancing.has(r.id);
		const clinched =
			hasExpectedAttempts(r.attempts, format, cutoffCs, cutoffAttempts) && hypotheticalAdvancing.has(r.id);
		const questionable = !roundFinished && advancing && !clinched;
		states.set(r.id, {advancing, questionable});
	}
	return states;
}
