/**
 * A smart cube solve written from the moves and the cube's state, with no gyroscope.
 *
 * The owner's rule (2026-10-30): the gyroscope moves the replay, the text reads like a normal
 * reconstruction, and the shared text solves the scramble. Reading rotations off the gyro was
 * a guess that every threshold only moved around: a look at the last layer became z x, a y that
 * went unseen put a back slot down as B U B'. Here the whole-cube rotations are not read at all.
 * Each step is held the way a solver holds it, and a rotation is written where two steps are
 * held differently:
 *
 * - The cross face is down (`crossHolding`, cross_rotation.ts) at the start of every step.
 * - An F2L step is held with the slot it filled (f2l_slots.ts) at front right, or front left
 *   when it reads more naturally that way.
 * - A last layer step is held whichever way round reads best; a known algorithm that gives its
 *   raw turns back exactly (ll_alg_match.ts) is written as that algorithm.
 * - The cross takes no particular front; like every step, it pays for a rotation it needs.
 *
 * "Reads best" is rotation_reconstruction.ts's NATURAL score; the fronts of all steps are
 * chosen together (each step's score minus what its rotations cost), so a step does not turn
 * the cube for a point it then gives back. Slices come from timing alone (frameEvents) and move
 * the frame the way the gyro reading's do.
 *
 * Any choice made here leaves the text solving the cube: a token is a core turn read through
 * the frame, and every rotation, slice and wide move written moves the frame the same way.
 */
import { matchLastLayerAlg, PreparedAlg } from './ll_alg_match';
import type { ParsedTurn } from './parse_turns';
import {
	applyRotation,
	combineRotations,
	Face,
	Frame,
	frameEvents,
	holdingFrame,
	naturalScore,
	readEvents,
	ReconstructionToken,
} from './rotation_reconstruction';

export interface StepInput {
	/** The step's `smart_turns` as [start, end) (splitTurnsBySteps). */
	range: [number, number];
	/** An F2L step: the two core faces of the slot it filled (f2l_slots.ts). */
	slot?: readonly [Face, Face] | null;
	/** A last layer step: the algorithms it may have been (prepareAlgs). */
	algs?: readonly PreparedAlg[] | null;
}

export interface StateReconstruction {
	/** How the cube was held for the first step: the cross holding and its front. */
	holding: string;
	tokens: ReconstructionToken[];
}

const Y = ['', 'y', 'y2', "y'"];
/** What a rotation costs a reading: a natural move or two, no more. */
const QUARTER_COST = 2;
const HALF_COST = 3;
/** A known algorithm given back exactly outweighs any score a guess at the front can make. */
const ALG_BONUS = 30;
/**
 * F2L inserts with the left hand at front left (U L' U L) far more often than with F at front
 * right (U F' U F); NATURAL, made for the whole solve, ranks F above L and picked the latter.
 */
const F2L_WEIGHTS: Record<string, number> = { F: 1, L: 2 };
/** Rotations to try between two frames that differ by more than a y (a slice or an algorithm left one). */
const ROTATIONS = ['y', "y'", 'y2', 'x', "x'", 'x2', 'z', "z'", 'z2'];

interface Reading {
	tokens: ReconstructionToken[];
	start: Frame;
	end: Frame;
	score: number;
}

const FACES: Face[] = ['U', 'D', 'F', 'B', 'R', 'L'];

function sameFrame(a: Frame, b: Frame): boolean {
	return FACES.every((p) => a[p] === b[p]);
}

function turnY(frame: Frame, quarters: number): Frame {
	return quarters ? applyRotation(frame, Y[quarters]) : frame;
}

/** The slot at front right or front left: the two fronts an F2L step is read with. */
function holdsSlot(frame: Frame, slot: readonly [Face, Face]): boolean {
	const has = (a: Face, b: Face) => slot.includes(frame[a]) && slot.includes(frame[b]);
	return has('F', 'R') || has('F', 'L');
}

/** The shortest rotation from one frame to the other, one token per letter. */
function rotationBetween(from: Frame, to: Frame): string[] {
	if (sameFrame(from, to)) return [];
	for (const a of ROTATIONS) if (sameFrame(applyRotation(from, a), to)) return [a];
	for (const a of ROTATIONS) {
		for (const b of ROTATIONS) if (sameFrame(applyRotation(applyRotation(from, a), b), to)) return [a, b];
	}
	return [];
}

function rotationCost(rotation: string[]): number {
	return rotation.reduce((s, r) => s + (r.endsWith('2') ? HALF_COST : QUARTER_COST), 0);
}

export function reconstructFromState(turns: ParsedTurn[], steps: StepInput[], crossHolding = ''): StateReconstruction {
	const events = frameEvents(turns, []);
	// A slice whose two faces straddle a step boundary stays with the step it began in.
	const stepEvents = steps.map(({ range: [start, end] }) => events.filter((e) => e.raws[0] >= start && e.raws[0] < end));

	// Every step starts with the cross face down, one of four ways round. A slice can leave the
	// centres turned (an M in the cross); the rotation before the next step then puts it back,
	// as the solver did, instead of every later step reading U turns as D.
	const fronts = [0, 1, 2, 3].map((a) => turnY(holdingFrame(crossHolding), a));
	const readings: (Reading | null)[][] = [];
	steps.forEach((step, i) => {
		const own = stepEvents[i];
		if (!own.length) {
			readings.push([null, null, null, null]);
			return;
		}
		const slotFits = step.slot ? fronts.map((f) => holdsSlot(f, step.slot!)) : null;
		const anyFits = !!slotFits && slotFits.some(Boolean);
		readings.push(
			fronts.map((start, a) => {
				if (anyFits && !slotFits![a]) return null;
				const read = readEvents(turns, own, start);
				const tokens = combineRotations(read.tokens, new Set());
				const generic: Reading = { tokens, start, end: read.frame, score: naturalScore(tokens, step.slot ? F2L_WEIGHTS : undefined) };
				if (!step.algs?.length) return generic;
				const alg = matchLastLayerAlg(turns, step.range, start, step.algs);
				return alg ? { tokens: alg.tokens, start, end: alg.frame, score: naturalScore(alg.tokens) + ALG_BONUS } : generic;
			})
		);
	});

	// The fronts chosen together: best[a] is the best total with the current step read from
	// fronts[a], from[u][a] the front the step before it had on that path.
	const used = readings.map((row, i) => (row.some(Boolean) ? i : -1)).filter((i) => i >= 0);
	if (!used.length) return { holding: crossHolding, tokens: [] };
	let best = readings[used[0]].map((r) => (r ? r.score : -Infinity));
	const from: number[][] = [];
	for (let u = 1; u < used.length; u++) {
		const prev = readings[used[u - 1]];
		const row = readings[used[u]];
		const next = [-Infinity, -Infinity, -Infinity, -Infinity];
		const back = [0, 0, 0, 0];
		for (let a = 0; a < 4; a++) {
			if (!row[a]) continue;
			for (let b = 0; b < 4; b++) {
				if (!prev[b]) continue;
				const total = best[b] - rotationCost(rotationBetween(prev[b]!.end, row[a]!.start)) + row[a]!.score;
				if (total > next[a]) {
					next[a] = total;
					back[a] = b;
				}
			}
		}
		from[u] = back;
		best = next;
	}
	const chosen: number[] = new Array(used.length);
	chosen[used.length - 1] = best.indexOf(Math.max(...best));
	for (let u = used.length - 1; u > 0; u--) chosen[u - 1] = from[u][chosen[u]];

	// Written out: each step's reading, after the rotation that gets the cube there.
	const tokens: ReconstructionToken[] = [];
	let frame: Frame | null = null;
	used.forEach((i, u) => {
		const reading = readings[i][chosen[u]]!;
		if (frame) {
			const start = steps[i].range[0];
			const t = start > 0 ? (turns[start - 1].completedAt + turns[start].completedAt) / 2 : turns[start].completedAt;
			for (const move of rotationBetween(frame, reading.start)) {
				tokens.push({ move, kind: 'rotation', rawStart: start, rawEnd: start, raws: [], t });
			}
		}
		tokens.push(...reading.tokens);
		frame = reading.end;
	});
	const holding = [crossHolding, Y[chosen[0]]].filter(Boolean).join(' ');
	return { holding, tokens };
}
