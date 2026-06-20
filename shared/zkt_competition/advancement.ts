// ZKT advancement state computation — WCA-live "forecast" parity.
//
// Mirrors thewca/wca-live `lib/wca_live/scoretaking/advancing.ex`. The goal is a
// THREE-state advancement signal for a live (in-progress) round, instead of the
// binary `proceeds` (= currently in the top N) the server persists:
//
//   - advancing & !questionable  -> GREEN  : advancement is mathematically clinched
//                                            (locked in even if everyone else does
//                                            their best-possible from here).
//   - advancing &  questionable  -> ORANGE : currently in the top N, but not yet
//                                            guaranteed — others can still overtake.
//   - !advancing                 -> (none) : currently outside the top N.
//
// This is computed client-side (like wca-live's client forecast) and intentionally
// does NOT touch the server `proceeds` field, which stays the source of truth for
// finalize/advancement-carry. All math here is a faithful port of the pure helpers
// in `server/models/zkt_result.ts` so the two never drift.

export type ZktFormat = 'BO1' | 'BO2' | 'BO3' | 'MO3' | 'AO5';
export type ZktAdvancementTypeLiteral = 'RANKING' | 'PERCENT';

// Convention: -1 = DNF, -2 = DNS (matches client formatWcaTime / server zkt_result).
export const DNF = -1;
export const DNS = -2;
// Best possible attempt for a "everyone does their best" hypothetical (1 centisecond).
export const BEST_CASE_CS = 1;

export interface AdvancementState {
	advancing: boolean;
	questionable: boolean;
}

// A result row as seen by the client — only the fields the math needs.
export interface AttemptResultLike {
	id: string;
	attempt_1?: number | null;
	attempt_2?: number | null;
	attempt_3?: number | null;
	attempt_4?: number | null;
	attempt_5?: number | null;
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
		default:
			return 5;
	}
}

export function formatHasAverage(format: ZktFormat): boolean {
	return format === 'MO3' || format === 'AO5';
}

function calculateBest(attempts: (number | null | undefined)[]): number | null {
	const valid = attempts.filter((a) => isValidAttempt(a)) as number[];
	if (valid.length === 0) {
		if (attempts.some((a) => a !== null && a !== undefined)) return DNF;
		return null;
	}
	return Math.min(...valid);
}

function calculateAverage(
	attempts: (number | null | undefined)[],
	format: ZktFormat
): number | null {
	if (!formatHasAverage(format)) return null;

	const attemptCount = getAttemptCount(format);
	const relevant = attempts.slice(0, attemptCount);
	if (relevant.some((a) => a === null || a === undefined)) return null;

	const values = relevant as number[];

	if (format === 'MO3') {
		if (values.some((v) => isDnfOrDns(v))) return DNF;
		const sum = values.reduce((a, b) => a + b, 0);
		return Math.round(sum / 3);
	}

	// AO5: drop best + worst, average the middle 3.
	const dnfCount = values.filter((v) => isDnfOrDns(v)).length;
	if (dnfCount >= 2) return DNF;
	const sorted = [...values].sort((a, b) => {
		if (isDnfOrDns(a)) return 1;
		if (isDnfOrDns(b)) return -1;
		return a - b;
	});
	const middle = sorted.slice(1, 4);
	const sum = middle.reduce((a, b) => a + b, 0);
	return Math.round(sum / 3);
}

function calculateBestAndAverage(
	attempts: (number | null | undefined)[],
	format: ZktFormat
): {best: number | null; average: number | null} {
	return {best: calculateBest(attempts), average: calculateAverage(attempts, format)};
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

function rankResults(
	results: {id: string; best: number | null; average: number | null}[],
	format: ZktFormat
): Ranked[] {
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

// Returns the set of result ids that currently advance (top N), mirroring the
// server `determineAdvancement` proceeds logic.
function advancingIds(
	ranked: Ranked[],
	advancementType: ZktAdvancementTypeLiteral | null | undefined,
	advancementLevel: number | null | undefined,
	format: ZktFormat
): Set<string> {
	const ids = new Set<string>();
	if (!advancementType || !advancementLevel) return ids;

	const sortByAverage = formatHasAverage(format);
	const totalCount = ranked.length;
	const cutoffRank =
		advancementType === 'RANKING'
			? advancementLevel
			: Math.floor((totalCount * advancementLevel) / 100);

	for (const r of ranked) {
		const primary = sortByAverage ? r.average : r.best;
		const hasValid = primary !== null && primary > 0;
		if (hasValid && r.ranking <= cutoffRank) ids.add(r.id);
	}
	return ids;
}

function readAttempts(r: AttemptResultLike): (number | null | undefined)[] {
	return [r.attempt_1, r.attempt_2, r.attempt_3, r.attempt_4, r.attempt_5];
}

// How many attempts this competitor is expected to have, respecting cutoff: if
// they failed the cutoff, only the first `cutoffAttempts` count; otherwise the
// full format attempt count.
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

// A result is "complete" (locked) when it has all the attempts it is expected to
// have — filling it with best-case can no longer change it.
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
 * Compute per-result advancement state (green/orange/none) for a live round.
 *
 * @param results        round results with raw attempts (attempt_1..5)
 * @param advancementType RANKING | PERCENT (null => nobody advances)
 * @param advancementLevel top-N (RANKING) or percent (PERCENT)
 * @param format         round format (decides best vs average + attempt count)
 * @param cutoffCs       cutoff time in cs (or null)
 * @param cutoffAttempts cutoff attempt count (or null)
 * @param roundFinished  true once the round is FINISHED — forces questionable off
 *                       (no incomplete attempts remain; everything is certain).
 */
export function computeAdvancementStates(
	results: AttemptResultLike[],
	advancementType: ZktAdvancementTypeLiteral | null | undefined,
	advancementLevel: number | null | undefined,
	format: ZktFormat,
	cutoffCs: number | null | undefined,
	cutoffAttempts: number | null | undefined,
	roundFinished: boolean,
	totalExpected?: number
): Map<string, AdvancementState> {
	const states = new Map<string, AdvancementState>();
	if (results.length === 0) return states;

	// 1) Current standings -> who is in the top N right now.
	const current = results.map((r) => {
		const {best, average} = calculateBestAndAverage(readAttempts(r), format);
		return {id: r.id, best, average};
	});
	const currentAdvancing = advancingIds(
		rankResults(current, format),
		advancementType,
		advancementLevel,
		format
	);

	// 2) Best-case hypothetical: every still-open result does its best possible.
	//    Whoever still advances in that maximally-competitive scenario AND has
	//    finished their own attempts has clinched (guaranteed) advancement.
	const hypothetical = results.map((r) => {
		const attempts = readAttempts(r);
		if (hasExpectedAttempts(attempts, format, cutoffCs, cutoffAttempts)) {
			const {best, average} = calculateBestAndAverage(attempts, format);
			return {id: r.id, best, average};
		}
		const filled = [...attempts];
		const full = getAttemptCount(format);
		for (let i = 0; i < full; i++) {
			if (filled[i] === null || filled[i] === undefined) filled[i] = BEST_CASE_CS;
		}
		const {best, average} = calculateBestAndAverage(filled, format);
		return {id: r.id, best, average};
	});
	// Competitors who haven't entered a result yet are absent from `results`
	// (ZKT creates result rows lazily). For the clinched scenario they are still
	// a threat — represent each missing one as a best-possible competitor so the
	// advancement cut-off can be "filled" by people who simply haven't gone yet.
	// Without this, in an early round everyone currently entered looks clinched.
	const expectedAvg = formatHasAverage(format) ? BEST_CASE_CS : null;
	const extra = Math.max(0, (totalExpected ?? results.length) - results.length);
	for (let i = 0; i < extra; i++) {
		hypothetical.push({id: `__virtual_${i}`, best: BEST_CASE_CS, average: expectedAvg});
	}
	const hypotheticalAdvancing = advancingIds(
		rankResults(hypothetical, format),
		advancementType,
		advancementLevel,
		format
	);

	for (const r of results) {
		const attempts = readAttempts(r);
		const advancing = currentAdvancing.has(r.id);
		const clinched =
			hasExpectedAttempts(attempts, format, cutoffCs, cutoffAttempts) &&
			hypotheticalAdvancing.has(r.id);
		const questionable = !roundFinished && advancing && !clinched;
		states.set(r.id, {advancing, questionable});
	}
	return states;
}
