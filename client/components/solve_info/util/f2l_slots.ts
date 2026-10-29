import Cube from 'cubejs';
import { expandNotation } from '../../../util/expand_notation';

/**
 * Which slot each F2L step filled, as the two side faces of it, for the colour mark beside
 * the step name (acubemy shows the same thing).
 *
 * The steps do not record their slot, so the solve is played on a cube: after each step, the
 * slot that has just become solved (its corner and edge home) is the one that step built.
 * Faces are the core's: with a smart cube the core's U is always the white centre, whatever
 * the solver's holding, so a face maps to one sticker colour.
 */

export type Face = 'U' | 'R' | 'F' | 'D' | 'L' | 'B';

export interface SlotFaces {
	/** The slot's two side faces as seen from outside with the cross down: left, then right. */
	left: Face;
	right: Face;
}

// Kociemba facelet layout (cubejs): U R F D L B, nine each, row by row.
const FACE_OFFSET: Record<Face, number> = { U: 0, R: 9, F: 18, D: 27, L: 36, B: 45 };
const CORNERS = ['U9 R1 F3', 'U7 F1 L3', 'U1 L1 B3', 'U3 B1 R3', 'D3 F9 R7', 'D1 L9 F7', 'D7 B9 L7', 'D9 R9 B7'];
const EDGES = ['U6 R2', 'U8 F2', 'U4 L2', 'U2 B2', 'D6 R8', 'D2 F8', 'D4 L8', 'D8 B8', 'F6 R4', 'F4 L6', 'B6 L4', 'B4 R6'];

const OPPOSITE: Record<Face, Face> = { U: 'D', D: 'U', R: 'L', L: 'R', F: 'B', B: 'F' };
const NORMAL: Record<Face, [number, number, number]> = {
	R: [1, 0, 0], L: [-1, 0, 0], U: [0, 1, 0], D: [0, -1, 0], F: [0, 0, 1], B: [0, 0, -1],
};

type Sticker = { face: Face; index: number };
const parse = (piece: string): Sticker[] =>
	piece.split(' ').map((s) => ({ face: s[0] as Face, index: FACE_OFFSET[s[0] as Face] + Number(s[1]) - 1 }));
const CORNER_STICKERS = CORNERS.map(parse);
const EDGE_STICKERS = EDGES.map(parse);

function pieceWith(pieces: Sticker[][], faces: Face[]): Sticker[] {
	return pieces.find((p) => p.length === faces.length && faces.every((f) => p.some((s) => s.face === f)))!;
}

/** The four slots around the cross face, each as its corner and edge stickers. */
function slotsAround(cross: Face): { faces: SlotFaces; stickers: Sticker[] }[] {
	const sides = (Object.keys(OPPOSITE) as Face[]).filter((f) => f !== cross && f !== OPPOSITE[cross]);
	const out: { faces: SlotFaces; stickers: Sticker[] }[] = [];
	for (let i = 0; i < sides.length; i++) {
		for (let j = i + 1; j < sides.length; j++) {
			const [a, b] = [sides[i], sides[j]];
			if (OPPOSITE[a] === b) continue;
			out.push({
				faces: leftRight(cross, a, b),
				stickers: [...pieceWith(CORNER_STICKERS, [cross, a, b]), ...pieceWith(EDGE_STICKERS, [a, b])],
			});
		}
	}
	return out;
}

/** Looking at the slot from outside, cross face down: which of its faces is on the right. */
function leftRight(cross: Face, a: Face, b: Face): SlotFaces {
	const [na, nb, nc] = [NORMAL[a], NORMAL[b], NORMAL[cross]];
	const view = [-(na[0] + nb[0]), -(na[1] + nb[1]), -(na[2] + nb[2])];
	const up = [-nc[0], -nc[1], -nc[2]];
	// right = view x up
	const right = [view[1] * up[2] - view[2] * up[1], view[2] * up[0] - view[0] * up[2], view[0] * up[1] - view[1] * up[0]];
	const aRight = na[0] * right[0] + na[1] * right[1] + na[2] * right[2] > 0;
	return aRight ? { left: b, right: a } : { left: a, right: b };
}

function solvedSlots(state: string, slots: { faces: SlotFaces; stickers: Sticker[] }[]): Set<number> {
	const solved = new Set<number>();
	slots.forEach((slot, i) => {
		if (slot.stickers.every((s) => state[s.index] === s.face)) solved.add(i);
	});
	return solved;
}

/**
 * `ranges[i]` is step i's run of `turns` (splitTurnsBySteps); `stepNames[i]` its name. One
 * entry per step: the slot an F2L step filled, null for other steps or when it cannot be
 * told (no cross face, the step filled none or two).
 */
export function f2lSlotFaces(
	scramble: string,
	turns: string[],
	ranges: [number, number][],
	stepNames: string[],
	crossFace: string | null
): (SlotFaces | null)[] {
	const none = stepNames.map(() => null);
	if (!crossFace || !(crossFace in OPPOSITE)) return none;
	try {
		const cube = new Cube();
		const apply = (moves: string) => {
			for (const m of expandNotation(moves).trim().split(/\s+/)) if (m) cube.move(m);
		};
		apply(scramble || '');
		const slots = slotsAround(crossFace as Face);
		let before = solvedSlots(cube.asString(), slots);
		return ranges.map(([start, end], i) => {
			apply(turns.slice(start, end).join(' '));
			const after = solvedSlots(cube.asString(), slots);
			const filled = [...after].filter((s) => !before.has(s));
			before = after;
			if (!stepNames[i]?.startsWith('f2l_') || filled.length !== 1) return null;
			return slots[filled[0]].faces;
		});
	} catch {
		return none;
	}
}
