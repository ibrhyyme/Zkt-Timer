/**
 * Move counter — cstimer-grade HTM/OBTM/ETM/STM calculation.
 *
 * HTM is a port of cstimer recons.js (GPL v3) MoveCounterHTM, fed the way cstimer feeds it:
 * with the move as it lands on the cube's fixed frame (CubieCube.selfMoveStr's return value),
 * so a turn after a rotation, a wide turn and a slice are counted on the physical face they
 * move. OBTM/ETM/STM are Zkt-Timer's own raw counts.
 * License: cstimer GPL v3 — direct port, credit in header.
 *
 * Metric definitions:
 *   HTM (Half Turn Metric): cstimer-style — parallel plane logic.
 *     Consecutive parallel plane repeated moves on same face count as 1 move.
 *     Example: R R = 1 (equivalent to R2), R L = 2, R L R' = 2, R U R = 3 (U opens a new
 *     plane, so the second R starts another group), R U R' = 3.
 *
 *   OBTM (Outer Block Turn Metric): face + wide turns 1, slice/rotation 0.
 *     No burst counting — raw move count.
 *
 *   ETM (Execution Turn Metric): face + wide + slice 1, rotation 0.
 *
 *   STM (Slice Turn Metric): face + slice 1, wide 1, rotation 0.
 *     (Outer block + slice counted separately.)
 *
 * Move encoding (cstimer convention, URFDLB order), as CubieCube.selfMoveStr returns it:
 *   axis 0=U, 1=R, 2=F, 3=D, 4=L, 5=B (face turns, on the cube's fixed frame)
 *   axis 6-11 for slices (selfMoveStr returns them offset by 18)
 *   axis%3 determines parallel plane: 0=U-D-E, 1=R-L-M, 2=F-B-S
 *   A wide turn moves the opposite face and rotates the frame (Rw = L + x)
 *   Rotation (x, y, z) is not counted; it only rotates the frame
 *
 * Move integer = axis * 3 + power (power: 0=normal, 1=double, 2=prime).
 */

import { CubieCube } from '../../scramble/lib/mathlib';
import { normalizeMove } from './notation';

const ROTATION_BASES = new Set(['x', 'y', 'z']);
const FACE_BASES = new Set(['U', 'R', 'F', 'D', 'L', 'B']);
const WIDE_BASES = new Set(['Uw', 'Rw', 'Fw', 'Dw', 'Lw', 'Bw', 'u', 'r', 'f', 'd', 'l', 'b']);
const SLICE_BASES = new Set(['M', 'E', 'S']);

interface ParsedMove {
	base: string;
	suffix: string; // '', '2' or "'"
}

function parseMove(move: string): ParsedMove | null {
	if (!move) return null;
	const trimmed = move.trim();
	if (!trimmed) return null;
	const m = trimmed.match(/^([URFDLB]w?|[urfdlb]|[MES]|[xyz])(['2]?)$/);
	if (!m) return null;
	return { base: m[1], suffix: m[2] };
}

/** cstimer spells a wide turn "Rw"; the rest of the notation is shared. */
function toCstimerNotation(base: string, suffix: string): string {
	return (/^[urfdlb]$/.test(base) ? base.toUpperCase() + 'w' : base) + suffix;
}

export class MoveCounter {
	htm = 0;
	obtm = 0;
	etm = 0;
	stm = 0;
	moves: string[] = [];

	// HTM state — cstimer MoveCounterHTM
	private lastHtmMove = -3;
	private lastHtmPow = 0;
	// The cube's orientation, as cstimer's recons tracks it through CubieCube.ori.
	private frame = new CubieCube();

	push(rawMove: string) {
		const move = normalizeMove(rawMove);
		const parsed = parseMove(move);
		if (!parsed) return;
		const { base, suffix } = parsed;
		this.moves.push(move);

		// Every move goes through the frame, rotations included: they change which
		// physical face the following turns move. undefined for a rotation.
		const effMove = this.frame.selfMoveStr(toCstimerNotation(base, suffix));

		const isRotation = ROTATION_BASES.has(base);
		if (isRotation) {
			// Rotation: no metric increments.
			return;
		}

		const isFace = FACE_BASES.has(base);
		const isWide = WIDE_BASES.has(base);
		const isSlice = SLICE_BASES.has(base);

		// OBTM/ETM/STM (not cstimer-grade, simple raw counting)
		if (isFace || isWide) {
			this.obtm += 1;
			this.stm += 1;
		} else if (isSlice) {
			this.stm += 1;
		}
		this.etm += 1; // face + wide + slice (excluding rotation) = ETM

		// HTM: cstimer MoveCounterHTM.push(effMove) — parallel plane logic
		if (effMove === undefined) return;
		const axis = Math.floor(effMove / 3);
		const amask = 1 << axis;
		if (axis % 3 !== this.lastHtmMove % 3) {
			this.lastHtmMove = axis;
			this.lastHtmPow = 0;
		}
		if ((this.lastHtmPow & amask) !== amask) {
			this.htm += 1;
		}
		this.lastHtmPow |= amask;
	}

	snapshot() {
		return {
			htm: this.htm,
			obtm: this.obtm,
			etm: this.etm,
			stm: this.stm,
		};
	}

	clear() {
		this.htm = 0;
		this.obtm = 0;
		this.etm = 0;
		this.stm = 0;
		this.moves = [];
		this.lastHtmMove = -3;
		this.lastHtmPow = 0;
		this.frame = new CubieCube();
	}

	clone(): MoveCounter {
		const c = new MoveCounter();
		c.htm = this.htm;
		c.obtm = this.obtm;
		c.etm = this.etm;
		c.stm = this.stm;
		c.moves = this.moves.slice();
		c.lastHtmMove = this.lastHtmMove;
		c.lastHtmPow = this.lastHtmPow;
		c.frame = new CubieCube().init(this.frame.ca, this.frame.ea);
		c.frame.ori = this.frame.ori;
		return c;
	}
}

/**
 * Returns all metrics for the given move sequence.
 */
export function countMoves(moves: string[]) {
	const counter = new MoveCounter();
	for (const m of moves) counter.push(m);
	return counter.snapshot();
}

/**
 * cstimer-grade HTM move count — single source of truth for all turn count displays in project.
 */
export function countHTM(moves: string[]): number {
	return countMoves(moves).htm;
}

/**
 * Calculates TPS (HTM-based) for given move sequence and time (seconds).
 */
export function calculateTPS(moves: string[], timeSeconds: number): number {
	if (timeSeconds <= 0) return 0;
	const htm = countHTM(moves);
	return Math.floor((htm / timeSeconds) * 100) / 100;
}
