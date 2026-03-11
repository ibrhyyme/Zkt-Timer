import Cube from 'cubejs';

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

// Cross yüzünü D'ye getiren rotasyon
const CROSS_SIDE_ROTATION: Record<string, string> = {
	D: '',
	U: 'x2',
	F: 'x',
	B: "x'",
	R: "z'",
	L: 'z',
};

// Rotasyona göre yüz dönüşüm tabloları
const FACE_TRANSFORM: Record<string, Record<string, string>> = {
	'': { U: 'U', D: 'D', F: 'F', B: 'B', R: 'R', L: 'L' },
	'x2': { U: 'D', D: 'U', F: 'B', B: 'F', R: 'R', L: 'L' },
	'x': { U: 'F', D: 'B', F: 'D', B: 'U', R: 'R', L: 'L' },
	"x'": { U: 'B', D: 'F', F: 'U', B: 'D', R: 'R', L: 'L' },
	"z'": { U: 'R', D: 'L', F: 'F', B: 'B', R: 'D', L: 'U' },
	'z': { U: 'L', D: 'R', F: 'F', B: 'B', R: 'U', L: 'D' },
};

export function transformMoves(moves: string, rotation: string): string {
	if (!rotation || !moves) return moves;
	const map = FACE_TRANSFORM[rotation];
	if (!map) return moves;

	return moves.trim().split(/\s+/).map((move) => {
		const face = move[0];
		const suffix = move.slice(1); // ', 2, vs.
		const newFace = map[face];
		if (!newFace) return move; // x, y, z gibi rotasyonlar olduğu gibi kalır
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
	for (const move of moves.trim().split(/\s+/)) {
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
	const face = move[0];
	if (!'URFDLB'.includes(face)) return null;
	const suffix = move.slice(1);
	if (suffix === '') return { face, quarters: 1 };
	if (suffix === "'") return { face, quarters: -1 };
	if (suffix === '2') return { face, quarters: 2 };
	return null;
}

function quartersToMove(face: string, quarters: number): string {
	if (quarters === 0) return '';
	if (quarters === 1) return face;
	if (quarters === -1) return face + "'";
	if (quarters === 2) return face + '2';
	if (quarters === -2) return face + "2'";
	// 3+ veya -3+ durumları: abs değeri yaz
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
			result.push({ face: token, quarters: 0 }); // bilinmeyen hamle olduğu gibi kalır
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
			if (!'URFDLB'.includes(r.face)) return r.face;
			return quartersToMove(r.face, r.quarters);
		})
		.filter(Boolean)
		.join(' ');
}
