import {getPrisma} from '../database';
import {ZktRoundFormat, ZktAdvancementType} from '@prisma/client';

// Convention: -1 = DNF, -2 = DNS (matches client formatWcaTime)
export const DNF = -1;
export const DNS = -2;

export function isValidAttempt(value: number | null | undefined): boolean {
	return value !== null && value !== undefined && value > 0;
}

export function isDnfOrDns(value: number | null | undefined): boolean {
	return value === DNF || value === DNS;
}

/**
 * Returns the number of attempts for a given format.
 */
export function getAttemptCount(format: ZktRoundFormat): number {
	switch (format) {
		case 'BO1':
			return 1;
		case 'BO2':
			return 2;
		case 'BO3':
			return 3;
		case 'MO3':
			return 3;
		case 'AO5':
			return 5;
		default:
			return 5;
	}
}

/**
 * Returns whether the format computes an average.
 */
export function formatHasAverage(format: ZktRoundFormat): boolean {
	return format === 'MO3' || format === 'AO5';
}

/**
 * Calculate best single from attempts.
 * Returns DNF if all attempts are DNF/DNS, else minimum valid time.
 */
export function calculateBest(attempts: (number | null | undefined)[]): number | null {
	const validAttempts = attempts.filter((a) => isValidAttempt(a)) as number[];
	if (validAttempts.length === 0) {
		// If any attempt was recorded (even DNF), best is DNF
		if (attempts.some((a) => a !== null && a !== undefined)) {
			return DNF;
		}
		return null;
	}
	return Math.min(...validAttempts);
}

/**
 * Calculate average based on format.
 * MO3: mean of 3 (any DNF => average = DNF)
 * AO5: drop best+worst, average middle 3 (2+ DNF => average = DNF)
 * Returns null if format has no average or not enough attempts.
 */
export function calculateAverage(
	attempts: (number | null | undefined)[],
	format: ZktRoundFormat
): number | null {
	if (!formatHasAverage(format)) {
		return null;
	}

	const attemptCount = getAttemptCount(format);
	const relevantAttempts = attempts.slice(0, attemptCount);

	// All attempts must be present
	if (relevantAttempts.some((a) => a === null || a === undefined)) {
		return null;
	}

	const values = relevantAttempts as number[];

	if (format === 'MO3') {
		// Any DNF/DNS => DNF
		if (values.some((v) => isDnfOrDns(v))) {
			return DNF;
		}
		const sum = values.reduce((a, b) => a + b, 0);
		return Math.round(sum / 3);
	}

	if (format === 'AO5') {
		// Count DNFs
		const dnfCount = values.filter((v) => isDnfOrDns(v)).length;
		if (dnfCount >= 2) {
			return DNF;
		}
		// If 1 DNF: it counts as the worst, drop it and the actual best
		// If 0 DNF: drop min and max
		const sorted = [...values].sort((a, b) => {
			// DNFs go to the end (worst)
			if (isDnfOrDns(a)) return 1;
			if (isDnfOrDns(b)) return -1;
			return a - b;
		});
		// Drop first (best) and last (worst/DNF)
		const middle = sorted.slice(1, 4);
		const sum = middle.reduce((a, b) => a + b, 0);
		return Math.round(sum / 3);
	}

	return null;
}

export function calculateBestAndAverage(
	attempts: (number | null | undefined)[],
	format: ZktRoundFormat
): {best: number | null; average: number | null} {
	return {
		best: calculateBest(attempts),
		average: calculateAverage(attempts, format),
	};
}

/**
 * Attempts >= time_limit_cs are converted to DNF.
 * DNF/DNS/null attempts untouched. Mirrors wca-live non-cumulative time limit.
 */
export function applyTimeLimit(
	attempts: (number | null | undefined)[],
	timeLimitCs: number | null | undefined
): (number | null | undefined)[] {
	if (!timeLimitCs || timeLimitCs <= 0) return attempts;
	return attempts.map((a) => {
		if (a === null || a === undefined) return a;
		if (isDnfOrDns(a)) return a;
		if (a >= timeLimitCs) return DNF;
		return a;
	});
}

/**
 * If none of the first `cutoffAttempts` attempts beats `cutoffCs`,
 * remaining attempts are wiped (set to null). Mirrors wca-live cutoff logic.
 */
export function applyCutoff(
	attempts: (number | null | undefined)[],
	cutoffCs: number | null | undefined,
	cutoffAttempts: number | null | undefined,
	format?: ZktRoundFormat
): (number | null | undefined)[] {
	if (!cutoffCs || cutoffCs <= 0 || !cutoffAttempts || cutoffAttempts <= 0) {
		return attempts;
	}
	// Guard: cutoff makes no sense if it covers all (or more) format attempts.
	// WCA convention: cutoff N means "first N of M>N attempts decide further attempts".
	if (format && cutoffAttempts >= getAttemptCount(format)) {
		return attempts;
	}
	const firstN = attempts.slice(0, cutoffAttempts);
	const meetsCutoff = firstN.some(
		(a) => a !== null && a !== undefined && a > 0 && a < cutoffCs
	);
	if (meetsCutoff) return attempts;
	return attempts.map((a, i) => (i < cutoffAttempts ? a : null));
}

/**
 * Compare two results for ranking.
 */
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

function compareValue(a: number | null, b: number | null): number {
	const aIsBad = a === null || a === undefined || a <= 0;
	const bIsBad = b === null || b === undefined || b <= 0;
	if (aIsBad && bIsBad) return 0;
	if (aIsBad) return 1;
	if (bIsBad) return -1;
	return a - b;
}

/**
 * Rank results and return them with ranking assigned (1-based).
 */
export function rankResults<T extends {best: number | null; average: number | null; id: string}>(
	results: T[],
	format: ZktRoundFormat
): Array<T & {ranking: number}> {
	const sortByAverage = formatHasAverage(format);
	const sorted = [...results].sort((a, b) => compareResults(a, b, sortByAverage));

	const ranked: Array<T & {ranking: number}> = [];
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
		ranked.push({...r, ranking: currentRank});
	}
	return ranked;
}

/**
 * Determine which results proceed to the next round.
 */
export function determineAdvancement<T extends {best: number | null; average: number | null; ranking: number}>(
	rankedResults: T[],
	advancementType: ZktAdvancementType | null,
	advancementLevel: number | null,
	format: ZktRoundFormat
): Array<T & {proceeds: boolean}> {
	if (!advancementType || !advancementLevel) {
		return rankedResults.map((r) => ({...r, proceeds: false}));
	}

	const sortByAverage = formatHasAverage(format);
	const totalCount = rankedResults.length;

	let cutoffRank: number;
	if (advancementType === 'RANKING') {
		cutoffRank = advancementLevel;
	} else {
		cutoffRank = Math.floor((totalCount * advancementLevel) / 100);
	}

	return rankedResults.map((r) => {
		const primary = sortByAverage ? r.average : r.best;
		const hasValidResult = primary !== null && primary > 0;
		const proceeds = hasValidResult && r.ranking <= cutoffRank;
		return {...r, proceeds};
	});
}

/**
 * Upsert a result for a user+round. Auto-calculates best and average.
 */
export async function upsertZktResult(input: {
	round_id: string;
	user_id: string;
	attempt_1?: number | null;
	attempt_2?: number | null;
	attempt_3?: number | null;
	attempt_4?: number | null;
	attempt_5?: number | null;
	entered_by_id: string;
}) {
	const prisma = getPrisma();
	const round = await prisma.zktRound.findUnique({where: {id: input.round_id}});
	if (!round) {
		throw new Error('Round not found');
	}

	const rawAttempts = [
		input.attempt_1,
		input.attempt_2,
		input.attempt_3,
		input.attempt_4,
		input.attempt_5,
	];

	// Apply time_limit first (slow attempts → DNF), then cutoff (unqualified → skipped).
	// Order matters: time_limit can convert a slow "pass" into DNF, affecting cutoff check.
	const afterTimeLimit = applyTimeLimit(rawAttempts, round.time_limit_cs);
	const attempts = applyCutoff(
		afterTimeLimit,
		round.cutoff_cs,
		round.cutoff_attempts,
		round.format
	);

	const {best, average} = calculateBestAndAverage(attempts, round.format);

	const persisted = {
		attempt_1: attempts[0] ?? null,
		attempt_2: attempts[1] ?? null,
		attempt_3: attempts[2] ?? null,
		attempt_4: attempts[3] ?? null,
		attempt_5: attempts[4] ?? null,
		best,
		average,
		entered_by_id: input.entered_by_id,
	};

	return prisma.zktResult.upsert({
		where: {
			round_id_user_id: {
				round_id: input.round_id,
				user_id: input.user_id,
			},
		},
		create: {
			round_id: input.round_id,
			user_id: input.user_id,
			...persisted,
		},
		update: persisted,
	});
}

/**
 * Mark a competitor as no-show: all format attempts become DNS,
 * best/average are DNF, and no_show flag is set. Separate from a regular
 * submit: no cutoff/time_limit apply (there's nothing to measure).
 */
export async function markResultNoShow(input: {
	round_id: string;
	user_id: string;
	entered_by_id: string;
}) {
	const prisma = getPrisma();
	const round = await prisma.zktRound.findUnique({where: {id: input.round_id}});
	if (!round) {
		throw new Error('Round not found');
	}

	const attemptCount = getAttemptCount(round.format);
	const attemptValues: (number | null)[] = [null, null, null, null, null];
	for (let i = 0; i < attemptCount; i++) {
		attemptValues[i] = DNS;
	}
	const {best, average} = calculateBestAndAverage(attemptValues, round.format);

	const persisted = {
		attempt_1: attemptValues[0],
		attempt_2: attemptValues[1],
		attempt_3: attemptValues[2],
		attempt_4: attemptValues[3],
		attempt_5: attemptValues[4],
		best,
		average,
		no_show: true,
		entered_by_id: input.entered_by_id,
	};

	return prisma.zktResult.upsert({
		where: {
			round_id_user_id: {
				round_id: input.round_id,
				user_id: input.user_id,
			},
		},
		create: {
			round_id: input.round_id,
			user_id: input.user_id,
			...persisted,
		},
		update: persisted,
	});
}

/**
 * Finalize a round: compute rankings, advancement, apply records, and
 * carry advancing competitors to the next round as empty result rows.
 * `enteredById` is the acting admin's id, used as entered_by for carry rows.
 */
export async function finalizeRound(
	roundId: string,
	enteredById: string
): Promise<void> {
	const prisma = getPrisma();
	const round = await prisma.zktRound.findUnique({
		where: {id: roundId},
		include: {
			results: true,
			comp_event: true,
		},
	});
	if (!round) {
		throw new Error('Round not found');
	}

	const ranked = rankResults(round.results, round.format);
	const withAdvancement = determineAdvancement(
		ranked,
		round.advancement_type,
		round.advancement_level,
		round.format
	);

	// Persist ranking + proceeds
	await Promise.all(
		withAdvancement.map((r) =>
			prisma.zktResult.update({
				where: {id: r.id},
				data: {ranking: r.ranking, proceeds: r.proceeds},
			})
		)
	);

	// Mark round as finished
	await prisma.zktRound.update({
		where: {id: roundId},
		data: {status: 'FINISHED'},
	});

	// Advancement carry: if a next round exists, create empty result rows
	// for competitors who advanced. Skips users that already have a row
	// (idempotent — finalize can be called again after reopen without dupes).
	await carryAdvancingToNextRound(roundId, withAdvancement, enteredById);
}

async function carryAdvancingToNextRound(
	currentRoundId: string,
	ranked: Array<{user_id: string; proceeds: boolean}>,
	enteredById: string
): Promise<void> {
	const prisma = getPrisma();
	const current = await prisma.zktRound.findUnique({
		where: {id: currentRoundId},
		select: {comp_event_id: true, round_number: true},
	});
	if (!current) return;

	const nextRound = await prisma.zktRound.findUnique({
		where: {
			comp_event_id_round_number: {
				comp_event_id: current.comp_event_id,
				round_number: current.round_number + 1,
			},
		},
	});
	if (!nextRound) return;

	const advancingUserIds = ranked.filter((r) => r.proceeds).map((r) => r.user_id);
	if (advancingUserIds.length === 0) return;

	await Promise.all(
		advancingUserIds.map((userId) =>
			prisma.zktResult.upsert({
				where: {
					round_id_user_id: {
						round_id: nextRound.id,
						user_id: userId,
					},
				},
				create: {
					round_id: nextRound.id,
					user_id: userId,
					entered_by_id: enteredById,
				},
				update: {}, // don't overwrite if admin already started entering
			})
		)
	);
}
