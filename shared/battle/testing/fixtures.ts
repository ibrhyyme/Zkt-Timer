// Test-only helpers for shared/battle. Kept outside __tests__ because Jest treats every
// .ts file there as a suite. Nothing in the app imports this module.
//
// There are no raw GAN or QiYi recordings in the repo, so these build solves the way the
// drivers stamp them:
//   - GAN gen2+ (gan.js:553-564): every move carries the cube clock (ms) and the phone
//     time of its packet.
//   - QiYi (qiyi.js:326): cube clock already divided by 1.6 (ms), phone time only on the
//     first move of each batch, null on the rest.
// Half turns arrive as two quarter turns of the same face a few tens of ms apart. The
// cube clock runs slightly fast against the phone (the drift the linear fit removes).

import { cubeTimestampLinearFit } from '../../util/solve/cube_timing';
import { invertNormalizedMove, normalizeMove } from '../../util/solve/notation';
import { BattleMove, BattleSolveSource } from '../types';
import { battleMovesToTimestamped, expectedProgress, ReportedProgress, VerifySolveInput } from '../verify';

function invertSequence(seq: string): string {
	return seq
		.trim()
		.split(/\s+/)
		.map(normalizeMove)
		.filter(Boolean)
		.reverse()
		.map(invertNormalizedMove)
		.join(' ');
}

/**
 * The fixture solve is shaped like a CFOP solve so its phases complete at different
 * moments: a block of moves that solves the first two layers, then an OLL (Sune), an AUF
 * and a PLL (T perm). The scramble is the inverse of that solution.
 */
const FIXTURE_F2L = "F L B' U' R B' U2 F D R U' F2 R2 U2 F2 D L2 U B2 R2 D2";
const FIXTURE_OLL = "R U R' U R U2 R'";
const FIXTURE_AUF = 'U';
const FIXTURE_PLL = "R U R' U' R' F R2 U' R' U' R U R' F'";
export const FIXTURE_SOLUTION = [FIXTURE_F2L, FIXTURE_OLL, FIXTURE_AUF, FIXTURE_PLL].join(' ');
export const FIXTURE_SCRAMBLE = invertSequence(FIXTURE_SOLUTION);

/** A solution as a smart cube reports it: quarter turns, a half turn as two of them. */
export function toQuarterTurns(solution: string): string[] {
	const out: string[] = [];
	for (const move of solution.trim().split(/\s+/).map(normalizeMove).filter(Boolean)) {
		if (move.endsWith('2')) out.push(move[0], move[0]);
		else out.push(move);
	}
	return out;
}

/** Quarter turns that undo the scramble. */
export function solutionQuarterTurns(scramble: string): string[] {
	return toQuarterTurns(invertSequence(scramble));
}

/** Deterministic pseudo random generator, so fixtures never change between runs. */
function lcg(seed: number): () => number {
	let s = seed >>> 0;
	return () => {
		s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
		return s / 0x100000000;
	};
}

export type FixtureCube = 'gan' | 'qiyi';

export interface FixtureOptions {
	cube?: FixtureCube;
	scramble?: string;
	/** Defaults to FIXTURE_SOLUTION for the fixture scramble, the inverse scramble otherwise. */
	solution?: string;
	seed?: number;
	/** Ms between the last scramble move and the first solve move. */
	inspectionMs?: number;
	/** Gap range between moves of different faces. */
	minGapMs?: number;
	maxGapMs?: number;
	/** Gap between the two quarter turns of a half turn. */
	halfTurnGapMs?: number;
	/** Cube clock speed against the phone clock. */
	drift?: number;
	/** Ms between the last two scramble moves. */
	scramblePauseMs?: number;
	/** Network delay added to both scramble_done and solve_done arrival. */
	networkMs?: number;
}

export interface FixtureSolve {
	scramble: string;
	/** Every solution move as the cube reported it, honest and complete. */
	moves: BattleMove[];
	/** Phone clock of each move after the fit, i.e. the real move times. */
	realTimes: number[];
	timeMs: number;
	inspectionMs: number;
	lastScrambleCubeTs: [number, number];
	/** Server clock arrivals for an honest client. */
	scrambleDoneServerAt: number;
	solveDoneServerAt: number;
}

const CUBE_CLOCK_BASE = 734_512;
const PHONE_CLOCK_BASE = 1_760_000_000_000;
/** The engine notices scramble completion this long after the last scramble move. */
const SCRAMBLE_DETECT_LAG_MS = 120;
/** The engine commits a solve this long after the last move (grace / detection). */
const SOLVE_DETECT_LAG_MS = 80;

export function buildSolve(opts: FixtureOptions = {}): FixtureSolve {
	const cube = opts.cube ?? 'gan';
	const scramble = opts.scramble ?? FIXTURE_SCRAMBLE;
	const rand = lcg(opts.seed ?? 7);
	const inspectionMs = opts.inspectionMs ?? 8000;
	const minGap = opts.minGapMs ?? 150;
	const maxGap = opts.maxGapMs ?? 450;
	const halfGap = opts.halfTurnGapMs ?? 45;
	const drift = opts.drift ?? 1.0004;
	const network = opts.networkMs ?? 60;

	const turns = opts.solution
		? toQuarterTurns(opts.solution)
		: scramble === FIXTURE_SCRAMBLE
		? toQuarterTurns(FIXTURE_SOLUTION)
		: solutionQuarterTurns(scramble);
	const scrambleLastCube = CUBE_CLOCK_BASE;
	const scrambleBeforeLastCube = scrambleLastCube - (opts.scramblePauseMs ?? 350);
	const firstCube = scrambleLastCube + inspectionMs;

	const cubeTimes: number[] = [];
	let c = firstCube;
	for (let i = 0; i < turns.length; i++) {
		if (i > 0) {
			const sameFace = turns[i] === turns[i - 1] && turns[i].length === 1 && turns[i - 1].length === 1;
			c += sameFace ? halfGap : Math.round(minGap + rand() * (maxGap - minGap));
		}
		cubeTimes.push(c);
	}

	const phoneOf = (cubeTs: number) => Math.round(PHONE_CLOCK_BASE + (cubeTs - CUBE_CLOCK_BASE) / drift);
	const moves: BattleMove[] = turns.map((t, i) => {
		// QiYi counts 1.6 ticks per ms and the driver divides (qiyi.js:326).
		const cubeTs = cube === 'qiyi' ? Math.trunc(Math.round(cubeTimes[i] * 1.6) / 1.6) : cubeTimes[i];
		// Packet jitter on the phone side: 0-25 ms.
		const local = phoneOf(cubeTimes[i]) + Math.round(rand() * 25);
		const stampsLocal = cube === 'gan' ? true : i % 3 === 0;
		return { t, c: cubeTs, l: stampsLocal ? local : null };
	});

	const { correctedMoves, finalTimeMs } = cubeTimestampLinearFit(battleMovesToTimestamped(moves));
	const timeMs = Math.round(finalTimeMs);

	// Server clock: offset from the phone clock is irrelevant, only the interval counts.
	const scrambleDoneServerAt = 5_000_000 + SCRAMBLE_DETECT_LAG_MS + network;
	const solveDoneServerAt =
		5_000_000 + inspectionMs + (cubeTimes[cubeTimes.length - 1] - firstCube) + SOLVE_DETECT_LAG_MS + network;

	return {
		scramble,
		moves,
		realTimes: correctedMoves.map((m) => m.completedAt),
		timeMs,
		inspectionMs,
		lastScrambleCubeTs: [scrambleBeforeLastCube, scrambleLastCube],
		scrambleDoneServerAt,
		solveDoneServerAt,
	};
}

/** The honest verify input for a fixture solve, as the client would send it. */
export function honestInput(solve: FixtureSolve, overrides: Partial<VerifySolveInput> = {}): VerifySolveInput {
	return {
		scramble: solve.scramble,
		moves: solve.moves,
		clientTimeMs: solve.timeMs,
		clientPenalty: null,
		source: 'tracker' as BattleSolveSource,
		timeCorrectionMs: 0,
		lastScrambleCubeTs: solve.lastScrambleCubeTs,
		clientInspectionMs: solve.inspectionMs,
		progress: honestProgress(solve.scramble, solve.moves),
		scrambleDoneServerAt: solve.scrambleDoneServerAt,
		solveDoneServerAt: solve.solveDoneServerAt,
		...overrides,
	};
}

/** The CFOP progress events an honest client derives from the same moves. */
export function honestProgress(scramble: string, moves: BattleMove[]): ReportedProgress[] {
	return expectedProgress(scramble, moves) || [];
}
