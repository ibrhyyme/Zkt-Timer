import Cube from 'cubejs';
import { expandNotation } from '../../../util/expand_notation';

const sideIndex = { U: 0, R: 1, F: 2, D: 3, L: 4, B: 5 };
const edgeIndices = [1, 3, 5, 7];

const edgeAdj = {
	U: { R: 1, F: 1, L: 1, B: 1 },
	R: { U: 5, F: 5, B: 3, D: 5 },
	L: { U: 3, F: 3, D: 3, B: 5 },
	F: { U: 7, R: 3, D: 1, L: 5 },
	D: { R: 7, F: 7, L: 7, B: 7 },
	B: { U: 1, R: 5, D: 7, L: 3 },
};

const SIDES = ['U', 'R', 'F', 'D', 'L', 'B'];

// Rotation to move cross face to D (cstimer cross.js:226-228 reference):
// faceStr = ["D", "U", "L", "R", "F", "B"]
// rotIdx  = ["",  "z2","z'","z", "x'","x" ]
// Use z2 to put yellow on bottom (cubing community standard — rotates sides).
// Use z2 instead of x2 — this swaps left/right, keeps front/back same.
const CROSS_SIDE_ROTATION: Record<string, string> = {
	D: '',
	U: 'z2',
	F: "x'",
	B: 'x',
	R: 'z',
	L: "z'",
};

// Face transform tables by rotation (CORE → user perspective).
// Smart cube BLE sends moves relative to cube's CORE. If user rotates the cube,
// the cube's CORE faces are physically in different positions.
// transformMoves converts CORE move to user's positional move.
//
// Logic: after rotation, where is cube's CORE U face physically?
// Example z (clockwise from front): top → right → bottom → left → top
// So CORE U stickers go to physical R position → BLE sends "U" → user did "R".
const FACE_TRANSFORM: Record<string, Record<string, string>> = {
	'': { U: 'U', D: 'D', F: 'F', B: 'B', R: 'R', L: 'L' },
	'x2': { U: 'D', D: 'U', F: 'B', B: 'F', R: 'R', L: 'L' },
	// x (R direction, clockwise from right): top → back → bottom → front → top
	'x': { U: 'B', D: 'F', F: 'U', B: 'D', R: 'R', L: 'L' },
	// x' (R' direction, counter-clockwise from right): top → front → bottom → back → top
	"x'": { U: 'F', D: 'B', F: 'D', B: 'U', R: 'R', L: 'L' },
	// z (F direction, clockwise from front): top → right → bottom → left → top
	'z': { U: 'R', D: 'L', F: 'F', B: 'B', R: 'D', L: 'U' },
	// z' (F' direction, counter-clockwise from front): top → left → bottom → right → top
	"z'": { U: 'L', D: 'R', F: 'F', B: 'B', R: 'U', L: 'D' },
	'z2': { U: 'D', D: 'U', F: 'F', B: 'B', R: 'L', L: 'R' },
};

export function transformMoves(moves: string, rotation: string): string {
	if (!rotation || !moves) return moves;
	const map = FACE_TRANSFORM[rotation];
	if (!map) return moves;

	return moves.trim().split(/\s+/).map((move) => {
		const face = move[0];
		const suffix = move.slice(1); // ', 2, etc.
		const newFace = map[face];
		if (!newFace) return move; // x, y, z rotations stay as-is
		return newFace + suffix;
	}).join(' ');
}

function getAbsoluteIndex(side: string, localIndex: number): number {
	return sideIndex[side] * 9 + localIndex;
}

function pieceSameAsCenter(absoluteIndex: number, state: string): boolean {
	const centerIndex = 9 * Math.floor(absoluteIndex / 9) + 4;
	return state[absoluteIndex] === state[centerIndex];
}

function areEdgesOriented(side: string, state: string): boolean {
	for (const edgeIndex of edgeIndices) {
		if (!pieceSameAsCenter(getAbsoluteIndex(side, edgeIndex), state)) return false;
	}
	return true;
}

function areEdgesSolved(side: string, state: string): boolean {
	if (!areEdgesOriented(side, state)) return false;
	const keys = Object.keys(edgeAdj[side]);
	for (const key of keys) {
		const index = getAbsoluteIndex(key, edgeAdj[side][key]);
		if (!pieceSameAsCenter(index, state)) return false;
	}
	return true;
}

function applyMoves(cube: any, moves: string) {
	// cubejs only accepts U/U'/U2. step.turns may contain cascade notation like U3/U4/L4
	// (cascadeQuartersForDisplay). Expand to single-quarter sequence before giving to cubejs
	// (L4 → "L L L L"). Without expand, it throws and getCrossSide returns null
	// → rotation lost, all solves look like white cross.
	const expanded = expandNotation(moves);
	for (const move of expanded.trim().split(/\s+/)) {
		if (move) cube.move(move);
	}
}

export function getCrossSide(scramble: string, crossTurns: string): string | null {
	try {
		const cube = new Cube();
		applyMoves(cube, scramble);
		applyMoves(cube, crossTurns);

		const state = cube.asString();
		for (const side of SIDES) {
			if (areEdgesSolved(side, state)) {
				return side;
			}
		}
		return null;
	} catch {
		return null;
	}
}

export function getCrossRotation(scramble: string, crossTurns: string): string {
	const side = getCrossSide(scramble, crossTurns);
	if (!side) return '';
	return CROSS_SIDE_ROTATION[side] || '';
}

function moveToQuarters(move: string): { face: string; quarters: number } | null {
	// Arbitrary-n suffix support: U, U', U2, U3, U4, U2', U3' ...
	const m = move.match(/^([URFDLB])(\d+)?([''])?$/);
	if (!m) return null;
	const [, face, count, prime] = m;
	const n = parseInt(count || '1', 10);
	if (n <= 0) return null;
	return { face, quarters: prime ? -n : n };
}

function quartersToMove(face: string, quarters: number): string {
	if (quarters === 0) return '';
	if (quarters === 1) return face;
	if (quarters === -1) return face + "'";
	if (quarters === 2) return face + '2';
	if (quarters === -2) return face + "2'";
	// 3+ or -3+ cases: write abs value
	const abs = Math.abs(quarters);
	return face + abs + (quarters < 0 ? "'" : '');
}

export function simplifyMoves(moves: string): string {
	if (!moves) return moves;
	const tokens = moves.trim().split(/\s+/);
	const result: { face: string; quarters: number }[] = [];

	for (const token of tokens) {
		const parsed = moveToQuarters(token);
		if (!parsed) {
			result.push({ face: token, quarters: 0 }); // unknown move stays as-is
			continue;
		}
		if (result.length > 0 && result[result.length - 1].face === parsed.face) {
			result[result.length - 1].quarters += parsed.quarters;
		} else {
			result.push(parsed);
		}
	}

	return result
		.map((r) => {
			if (!'URFDLB'.includes(r.face)) return r.face; // Unknown move stays as-is
			return quartersToMove(r.face, r.quarters);
		})
		.filter(Boolean)
		.join(' ');
}
