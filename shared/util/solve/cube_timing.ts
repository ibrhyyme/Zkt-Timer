/**
 * Smart cube timing correction: per-solve linear fit of the cube's own clock onto the
 * phone's clock.
 *
 * Ported from cstimer's tsLinearFix() and gan-cube-sample's cubeTimestampLinearFit().
 * Shared so the device and the server compute the same solve time from the same moves:
 * Online Battle recomputes every solve on the server (shared/battle/verify.ts, check 4)
 * and only agrees with the phone if both run this exact code.
 *
 * client/util/smart_cube_timing.ts re-exports everything here, so its callers did not
 * change when this moved.
 */

export interface TimestampedMove {
	turn: string;
	completedAt: number;
	cubeTimestamp: number | null;
	localTimestamp: number | null;
}

export interface CorrectedMove extends TimestampedMove {
	completedAt: number;
}

export interface LinearFitResult {
	correctedMoves: CorrectedMove[];
	finalTimeMs: number;
}

/** Spacing assumed for a move whose timestamp was lost, relative to its neighbour. */
export const MISSING_TIMESTAMP_STEP_MS = 50;

/**
 * Least squares linear regression: y = slope * x + intercept.
 * Same algorithm as gan.js:14-29.
 */
function linregress(xs: number[], ys: number[]): [number, number] {
	const n = xs.length;
	if (n < 2) return [1, 0];

	let sumX = 0;
	let sumY = 0;
	let sumXY = 0;
	let sumX2 = 0;

	for (let i = 0; i < n; i++) {
		sumX += xs[i];
		sumY += ys[i];
		sumXY += xs[i] * ys[i];
		sumX2 += xs[i] * xs[i];
	}

	const denom = n * sumX2 - sumX * sumX;
	if (denom === 0) return [1, 0];

	const slope = (n * sumXY - sumX * sumY) / denom;
	const intercept = (sumY - slope * sumX) / n;
	return [slope, intercept];
}

/**
 * Fills null timestamps from their neighbours (next - 50 ms walking backwards, then
 * previous + 50 ms walking forwards). Missed moves arrive with no stamp; this is the
 * estimate every consumer uses for them.
 */
export function fillMissingTimestamps(values: (number | null)[]): (number | null)[] {
	const out = values.slice();
	for (let i = out.length - 2; i >= 0; i--) {
		if (out[i] == null && out[i + 1] != null) {
			out[i] = out[i + 1]! - MISSING_TIMESTAMP_STEP_MS;
		}
	}
	for (let i = 1; i < out.length; i++) {
		if (out[i] == null && out[i - 1] != null) {
			out[i] = out[i - 1]! + MISSING_TIMESTAMP_STEP_MS;
		}
	}
	return out;
}

/**
 * Post-solve timestamp correction: per-solve linear fit.
 *
 * Algorithm (same as cstimer tsLinearFix / gan-cube-sample cubeTimestampLinearFit):
 * 1. Interpolate the null timestamps of missed moves (+-50 ms)
 * 2. Linear regression over the solve's (cubeTimestamp, localTimestamp) pairs
 * 3. Fitted localTimestamp for every move
 * 4. Solve time is the span between the first and the last fitted move
 *
 * `solveStartTime` is kept for signature compatibility; the fit does not need it.
 */
export function cubeTimestampLinearFit(
	moves: TimestampedMove[],
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	solveStartTime?: number
): LinearFitResult {
	if (moves.length === 0) {
		return { correctedMoves: [], finalTimeMs: 0 };
	}

	// --- Phase 1: interpolate missing timestamps ---
	const cubeTs = fillMissingTimestamps(moves.map((m) => m.cubeTimestamp ?? null));
	const localTs = fillMissingTimestamps(moves.map((m) => m.localTimestamp ?? null));
	const work = moves.map((m, i) => ({
		...m,
		cubeTimestamp: cubeTs[i],
		localTimestamp: localTs[i],
	}));

	// --- Phase 2: collect usable (cubeTimestamp, localTimestamp) pairs ---
	const validPairs: { cube: number; local: number }[] = [];
	for (const m of work) {
		if (m.cubeTimestamp != null && m.localTimestamp != null) {
			validPairs.push({ cube: m.cubeTimestamp, local: m.localTimestamp });
		}
	}

	if (validPairs.length < 2) {
		// Not enough data: return the raw completedAt values (fallback).
		const first = moves[0].completedAt;
		const last = moves[moves.length - 1].completedAt;
		return {
			correctedMoves: moves.map((m) => ({ ...m })),
			finalTimeMs: last - first,
		};
	}

	// --- Phase 3: normalised linear regression ---
	// Subtracting the first pair avoids catastrophic cancellation on large timestamps.
	const baseCube = validPairs[0].cube;
	const baseLocal = validPairs[0].local;
	const xs = validPairs.map((p) => p.cube - baseCube);
	const ys = validPairs.map((p) => p.local - baseLocal);
	const [slope, intercept] = linregress(xs, ys);

	// --- Phase 4: fitted timestamp for every move ---
	const correctedMoves: CorrectedMove[] = work.map((m) => {
		if (m.cubeTimestamp != null) {
			const fittedLocal = slope * (m.cubeTimestamp - baseCube) + intercept + baseLocal;
			return {
				...m,
				completedAt: Math.round(fittedLocal),
			};
		}
		// Still null (every value was null): keep the original completedAt.
		return { ...m };
	});

	// --- Phase 5: solve time ---
	const firstFitted = correctedMoves[0].completedAt;
	const lastFitted = correctedMoves[correctedMoves.length - 1].completedAt;
	const finalTimeMs = lastFitted - firstFitted;

	return { correctedMoves, finalTimeMs };
}
