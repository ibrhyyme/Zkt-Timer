/**
 * A smart cube solve rebuilt with the whole-cube rotations the gyroscope saw, written the
 * way the solver held the cube.
 *
 * Inputs are both in the cube's CORE frame: `smart_turns` (face turns as the cube reports
 * them) and `smart_rotations` (gyro_rotations.ts). The solver's frame starts at `holding`,
 * the rotation that puts the cube the way it was held for the first step (the cross side
 * rotation today), and every detected rotation moves it on, so a core "R" reads as whatever
 * face was on the solver's right at that moment.
 *
 * Slice and wide moves are put back together from their parts. A cube with no sensor in its
 * middle layer reports M as R L' and the core turning the other way (M = R L' x'); a wide r as
 * L plus the core turning (r = L x). When those parts land together, they are one move.
 * "Together" means the face turns on the rotation's axis directly before or after it, with
 * nothing on another axis in between: a turn on another axis does not commute with the
 * rotation, so merging across it would change what the sequence does.
 *
 * A slice does not wait for the gyroscope. Two opposite faces turning the slice's way within
 * SLICE_PAIR_MS of each other is a slice: no hand turns R and L' as separate moves that close
 * together, and a fast M2 comes in as L R' L R' inside 65 ms, with the core through 180
 * degrees faster than an 11 Hz gyro reliably reports. Missing that rotation would leave the
 * solver frame wrong for every move after it, so the pair alone implies it, and a gyro
 * rotation of the same sense nearby is taken as that same turn, not counted again. A slower
 * pair (up to SLICE_PAIR_GYRO_MS) is a slice when the gyro confirmed it (gyro_rotations.ts).
 */
import { getPrettyMoves } from '../util/solve/pretty_moves';
import type { ParsedTurn } from './parse_turns';
import { SLICE_CONFIRM_WINDOW_MS, SLICE_PAIR_GYRO_MS, slicePairRotation } from './gyro_rotations';

export type ReconstructionTokenKind = 'turn' | 'rotation' | 'slice' | 'wide';

export interface ReconstructionToken {
	move: string;
	kind: ReconstructionTokenKind;
	/** Range of `smart_turns` indices this token stands for; empty for a lone rotation. */
	rawStart: number;
	rawEnd: number;
	/** The exact `smart_turns` indices behind it, in order: what the replay plays for it. */
	raws: number[];
	t: number;
}

export type Face = 'U' | 'D' | 'F' | 'B' | 'R' | 'L';
/** Solver position -> the core face sitting there. */
export type Frame = Record<Face, Face>;

/**
 * A wide move's face turn may lead its rotation by this much... Measured on a GAN i4: the
 * rotation of an r / r' lands 120-150 ms after its face turn, and a turn followed by a real
 * whole-cube rotation (U then y') is well past this, so it stays two moves.
 */
const PART_BEFORE_MS = 250;
/** ...or trail it by this much: the rotation is stamped mid-turn, the faces at the end. */
const PART_AFTER_MS = 150;
/**
 * Opposite faces this close are one slice move on timing alone. A GAN i4 reports a slice's two
 * faces 0-39 ms apart on the cube's clock; deliberate separate turns are far slower.
 */
const SLICE_PAIR_MS = 60;
/** A gyro rotation this close to a timing-detected slice is that slice's own core turn. */
const SLICE_GYRO_MATCH_MS = 600;

const FACES: Face[] = ['U', 'D', 'F', 'B', 'R', 'L'];

/** Positions the core faces sit in after one clockwise quarter of each rotation. */
function rotateFrame(s: Frame, letter: string): Frame {
	switch (letter) {
		case 'x':
			return { ...s, U: s.F, F: s.D, D: s.B, B: s.U };
		case 'y':
			return { ...s, F: s.R, R: s.B, B: s.L, L: s.F };
		case 'z':
			return { ...s, R: s.U, D: s.R, L: s.D, U: s.L };
		default:
			return s;
	}
}

function quarters(suffix: string): number {
	return suffix === '2' ? 2 : suffix === "'" ? 3 : 1;
}

function applyRotation(s: Frame, move: string): Frame {
	const n = quarters(move.slice(1));
	for (let i = 0; i < n; i++) s = rotateFrame(s, move[0]);
	return s;
}

function identityFrame(): Frame {
	return { U: 'U', D: 'D', F: 'F', B: 'B', R: 'R', L: 'L' };
}

function positionOf(s: Frame, coreFace: string): Face | null {
	return FACES.find((p) => s[p] === coreFace) || null;
}

const INVERT: Record<string, string> = { '': "'", "'": '', '2': '2' };

/** Core rotation axis -> the core face it turns about (clockwise seen from that face). */
const ROTATION_FACE: Record<string, Face> = { x: 'R', y: 'U', z: 'F' };
/** Solver position -> rotation letter about it, and whether that runs against the letter. */
const POSITION_ROTATION: Record<Face, [string, boolean]> = {
	R: ['x', false],
	L: ['x', true],
	U: ['y', false],
	D: ['y', true],
	F: ['z', false],
	B: ['z', true],
};

const AXIS_FACES: Record<string, Face[]> = { x: ['R', 'L'], y: ['U', 'D'], z: ['F', 'B'] };

/** The face turns that combine with a quarter rotation, most specific first. */
const MERGES: Record<string, { parts: string[]; move: string; kind: 'slice' | 'wide' }[]> = {
	"x'": [{ parts: ['R', "L'"], move: 'M', kind: 'slice' }, { parts: ["L'"], move: "r'", kind: 'wide' }, { parts: ['R'], move: 'l', kind: 'wide' }],
	x: [{ parts: ["R'", 'L'], move: "M'", kind: 'slice' }, { parts: ['L'], move: 'r', kind: 'wide' }, { parts: ["R'"], move: "l'", kind: 'wide' }],
	"y'": [{ parts: ['U', "D'"], move: 'E', kind: 'slice' }, { parts: ["D'"], move: "u'", kind: 'wide' }, { parts: ['U'], move: 'd', kind: 'wide' }],
	y: [{ parts: ["U'", 'D'], move: "E'", kind: 'slice' }, { parts: ['D'], move: 'u', kind: 'wide' }, { parts: ["U'"], move: "d'", kind: 'wide' }],
	z: [{ parts: ["F'", 'B'], move: 'S', kind: 'slice' }, { parts: ['B'], move: 'f', kind: 'wide' }, { parts: ["F'"], move: "b'", kind: 'wide' }],
	"z'": [{ parts: ['F', "B'"], move: "S'", kind: 'slice' }, { parts: ["B'"], move: "f'", kind: 'wide' }, { parts: ['F'], move: 'b', kind: 'wide' }],
};

interface FrameEvent {
	t: number;
	kind: 'turn' | 'rotation' | 'slice';
	/** Core move: the turn, the rotation, or for a slice its implied core rotation. */
	move: string;
	/** Raw turn indices behind it (one for a turn, two for a slice, none for a rotation). */
	raws: number[];
}

/** Gyro rotations as signed quarter counts, so a half turn can be split between two slices. */
interface GyroRotation {
	t: number;
	axis: string;
	quarters: number;
}

/**
 * Pairs the timing-detected slices off against the gyro rotations they produced. A matched
 * rotation is used up (a half turn covers the two halves of an M2); what is left over is a
 * rotation the solver made with the whole cube.
 */
function consumeSliceRotations(slices: FrameEvent[], rotations: ParsedTurn[]): GyroRotation[] {
	const left: GyroRotation[] = rotations.map((r) => ({ t: r.completedAt, axis: r.turn[0], quarters: quarters(r.turn.slice(1)) }));
	for (const s of slices) {
		const need = quarters(s.move.slice(1));
		const match = left
			.filter((g) => g.axis === s.move[0] && g.quarters !== 0 && Math.abs(g.t - s.t) <= SLICE_GYRO_MATCH_MS)
			.filter((g) => g.quarters === need || g.quarters === 2)
			.sort((a, b) => Math.abs(a.t - s.t) - Math.abs(b.t - s.t))[0];
		if (match) match.quarters = (match.quarters - need + 4) % 4;
	}
	return left.filter((g) => g.quarters !== 0);
}

/**
 * Did the gyro see the core turn of the slice whose faces are `a` and `b`? The detector stamps
 * a slice it confirmed at the second face (gyro_rotations.ts); a slow one it caught on its own
 * lands a little later.
 */
function gyroSawSlice(rotations: ParsedTurn[], token: string, a: ParsedTurn, b: ParsedTurn): boolean {
	return rotations.some(
		(r) =>
			r.turn[0] === token[0] &&
			(r.turn === token || r.turn.endsWith('2')) &&
			r.completedAt >= a.completedAt - 100 &&
			r.completedAt <= b.completedAt + SLICE_CONFIRM_WINDOW_MS
	);
}

/**
 * Core-frame turns, slices and rotations, in time order.
 *
 * Pairs are found the way the detector finds them (same window, same greedy order), or the two
 * disagree: an M2 arriving as L' R (90 ms) R L' (36 ms) was paired by the detector, which
 * confirmed both halves, but taken here as L', R and one slice, which then used up the first
 * half's rotation and left the frame a quarter off. A pair within SLICE_PAIR_MS is a slice on
 * timing alone; one up to SLICE_PAIR_GYRO_MS needs the gyro to have seen it.
 */
function frameEvents(turns: ParsedTurn[], rotations: ParsedTurn[]): FrameEvent[] {
	const events: FrameEvent[] = [];
	const slices: FrameEvent[] = [];
	for (let i = 0; i < turns.length; i++) {
		const next = turns[i + 1];
		const gap = next ? next.completedAt - turns[i].completedAt : Infinity;
		const token = gap <= SLICE_PAIR_GYRO_MS ? slicePairRotation(turns[i].turn, next.turn) : null;
		const implied = token && (gap <= SLICE_PAIR_MS || gyroSawSlice(rotations, token, turns[i], next)) ? token : null;
		if (implied) {
			const slice: FrameEvent = { t: turns[i].completedAt, kind: 'slice', move: implied, raws: [i, i + 1] };
			events.push(slice);
			slices.push(slice);
			i++;
			continue;
		}
		events.push({ t: turns[i].completedAt, kind: 'turn', move: turns[i].turn, raws: [i] });
	}
	for (const g of consumeSliceRotations(slices, rotations)) {
		events.push({ t: g.t, kind: 'rotation', move: g.axis + ['', '', '2', "'"][g.quarters], raws: [] });
	}
	// A rotation stamped at the same moment as a turn is applied after it.
	return events.sort((a, b) => a.t - b.t || (a.kind === 'rotation' ? 1 : 0) - (b.kind === 'rotation' ? 1 : 0));
}

/** A core rotation written about the solver's axes, given where the core faces sit. */
function solverRotation(frame: Frame, coreRotation: string): string | null {
	const face = ROTATION_FACE[coreRotation[0]];
	const pos = face ? positionOf(frame, face) : null;
	if (!pos) return null;
	const [letter, inverted] = POSITION_ROTATION[pos];
	const suffix = coreRotation.slice(1);
	return letter + (inverted ? INVERT[suffix] : suffix);
}

function solverTurn(frame: Frame, coreTurn: string): string {
	const pos = positionOf(frame, coreTurn[0]);
	return pos ? pos + coreTurn.slice(1) : coreTurn;
}

function holdingFrame(holding: string): Frame {
	let frame = identityFrame();
	for (const r of holding.split(' ').filter(Boolean)) frame = applyRotation(frame, r);
	return frame;
}

/** Core-frame turns and rotations as the solver saw them, in time order. */
function toSolverFrame(turns: ParsedTurn[], rotations: ParsedTurn[], holding: string): ReconstructionToken[] {
	let frame = holdingFrame(holding);
	const out: ReconstructionToken[] = [];
	let turnsSeen = 0;
	for (const e of frameEvents(turns, rotations)) {
		if (e.kind === 'turn') {
			out.push({ move: solverTurn(frame, turns[e.raws[0]].turn), kind: 'turn', rawStart: e.raws[0], rawEnd: e.raws[0] + 1, raws: e.raws, t: e.t });
			turnsSeen = e.raws[0] + 1;
			continue;
		}
		const rotation = solverRotation(frame, e.move);
		if (!rotation) continue;
		if (e.kind === 'slice') {
			const parts = e.raws.map((r) => solverTurn(frame, turns[r].turn));
			const slice = (MERGES[rotation] || []).find(
				(m) => m.kind === 'slice' && m.parts.length === 2 && m.parts.every((p) => parts.includes(p))
			);
			out.push({ move: slice ? slice.move : `${parts.join(' ')} ${rotation}`, kind: 'slice', rawStart: e.raws[0], rawEnd: e.raws[1] + 1, raws: e.raws, t: e.t });
			turnsSeen = e.raws[1] + 1;
		} else {
			out.push({ move: rotation, kind: 'rotation', rawStart: turnsSeen, rawEnd: turnsSeen, raws: [], t: e.t });
		}
		frame = applyRotation(frame, rotation);
	}
	return out;
}

/** Puts slice and wide moves back together around each quarter rotation. */
function mergeParts(tokens: ReconstructionToken[]): ReconstructionToken[] {
	const out = tokens.slice();
	for (let i = 0; i < out.length; i++) {
		const rot = out[i];
		if (rot.kind !== 'rotation' || !MERGES[rot.move]) continue;
		const axisFaces = AXIS_FACES[rot.move[0]];
		const onAxis = (tok: ReconstructionToken) => tok.kind === 'turn' && axisFaces.includes(tok.move[0] as Face);

		// The unbroken run of same-axis face turns on each side, within the time window.
		const candidates: number[] = [];
		for (let j = i - 1; j >= 0 && onAxis(out[j]) && rot.t - out[j].t <= PART_BEFORE_MS; j--) candidates.push(j);
		for (let j = i + 1; j < out.length && onAxis(out[j]) && out[j].t - rot.t <= PART_AFTER_MS; j++) candidates.push(j);

		for (const merge of MERGES[rot.move]) {
			const used: number[] = [];
			for (const part of merge.parts) {
				const pick = candidates
					.filter((j) => !used.includes(j) && out[j].move === part)
					.sort((a, b) => Math.abs(out[a].t - rot.t) - Math.abs(out[b].t - rot.t))[0];
				if (pick === undefined) break;
				used.push(pick);
			}
			if (used.length !== merge.parts.length) continue;

			const all = [...used, i];
			const first = Math.min(...all);
			const merged: ReconstructionToken = {
				move: merge.move,
				kind: merge.kind,
				rawStart: Math.min(...used.map((j) => out[j].rawStart)),
				rawEnd: Math.max(...used.map((j) => out[j].rawEnd)),
				raws: used.flatMap((j) => out[j].raws).sort((a, b) => a - b),
				t: Math.min(...used.map((j) => out[j].t)),
			};
			for (const j of all.sort((a, b) => b - a)) out.splice(j, 1);
			out.splice(first, 0, merged);
			i = first;
			break;
		}
	}
	return out;
}

/**
 * Adjacent rotations about the same axis become one (y y -> y2), and so do two quarters of
 * the same slice (M' M' -> M2, the way an M2 arrives). A rotation and its undo (y y') stay
 * as two: the solver did turn the cube and back (to look at a side, say), the replay has to
 * show it, and dropping the pair left the replay a quarter turn off the gyro meanwhile.
 * Opposite slice quarters stay for the same reason.
 */
function combineRotations(tokens: ReconstructionToken[], breaks: Set<number>): ReconstructionToken[] {
	const out: ReconstructionToken[] = [];
	for (const tok of tokens) {
		// Nothing is combined across a step boundary: each half belongs to its own row.
		const prev = breaks.has(tok.rawStart) && out.length && out[out.length - 1].rawStart < tok.rawStart
			? undefined
			: out[out.length - 1];
		if (tok.kind === 'rotation' && prev && prev.kind === 'rotation' && prev.move[0] === tok.move[0]
			&& (quarters(prev.move.slice(1)) + quarters(tok.move.slice(1))) % 4 !== 0) {
			const q = (quarters(prev.move.slice(1)) + quarters(tok.move.slice(1))) % 4;
			prev.move = prev.move[0] + ['', '', '2', "'"][q];
			continue;
		}
		// Face turns tidied the way the plain rows are (getPrettyMoves): U U -> U2, U U' -> nothing.
		if (tok.kind === 'turn' && prev && prev.kind === 'turn' && prev.move[0] === tok.move[0] && tok.move.length <= 2 && prev.move.length <= 2) {
			const q = (quarters(prev.move.slice(1)) + quarters(tok.move.slice(1))) % 4;
			if (q === 0) out.pop();
			else {
				prev.move = prev.move[0] + ['', '', '2', "'"][q];
				prev.rawEnd = tok.rawEnd;
				prev.raws.push(...tok.raws);
			}
			continue;
		}
		if (tok.kind === 'slice' && prev && prev.kind === 'slice' && prev.move.length <= 2 && tok.move.length <= 2
			&& prev.move[0] === tok.move[0] && prev.move.slice(1) === tok.move.slice(1) && tok.move.slice(1) !== '2') {
			prev.move = prev.move[0] + '2';
			prev.rawEnd = tok.rawEnd;
			prev.raws.push(...tok.raws);
			continue;
		}
		out.push({ ...tok, raws: tok.raws.slice() });
	}
	return out;
}

/** `stepStarts`: raw turn indices where a step begins, so its moves stay in its own row. */
export function reconstructWithRotations(
	turns: ParsedTurn[],
	rotations: ParsedTurn[],
	holding = '',
	stepStarts: number[] = []
): ReconstructionToken[] {
	return combineRotations(mergeParts(toSolverFrame(turns, rotations, holding)), new Set(stepStarts));
}

/** The whole-cube turn a token makes, in the solver's notation (M = R L' x', r = L x). */
const IMPLIED_ROTATION: Record<string, string> = {
	M: "x'", E: "y'", S: 'z',
	r: 'x', l: "x'", u: 'y', d: "y'", f: 'z', b: "z'",
};

function rotationOf(token: ReconstructionToken): string | null {
	if (token.kind === 'rotation') return token.move;
	// A slice that did not match a name is written out as its parts, its rotation last.
	if (token.move.includes(' ')) return token.move.split(' ').pop() || null;
	const base = IMPLIED_ROTATION[token.move[0]];
	if (!base || (token.kind !== 'slice' && token.kind !== 'wide')) return null;
	const suffix = token.move.slice(1);
	if (suffix === '2') return base[0] + '2';
	return suffix === "'" ? base[0] + INVERT[base.slice(1)] : base;
}

/**
 * How the solver held the cube along the replay: `frames[i]` with the first i tokens played,
 * so frames[0] is the holding and every rotation, slice and wide move turns it on. The replay
 * steps token by token, so a rotation is a step of its own and plays when the solver made it.
 */
export function framesAlongTokens(tokens: ReconstructionToken[], holding = ''): Frame[] {
	const frames: Frame[] = [holdingFrame(holding)];
	for (const token of tokens) {
		const rotation = rotationOf(token);
		frames.push(rotation ? applyRotation(frames[frames.length - 1], rotation) : frames[frames.length - 1]);
	}
	return frames;
}

/**
 * How natural a move reads for a speedcuber: R and U carry most solves, then F, M and r;
 * B, S and b are rare. Only used to rank the four ways the front could have been.
 */
const NATURAL: Record<string, number> = {
	R: 3, U: 3, F: 2, L: 1.5, D: 1, B: -2,
	M: 2, E: -1, S: -2,
	r: 2, l: 1, u: 1, f: 1, d: 0, b: -2,
};

/**
 * The holding to read the solve with: `crossHolding` (which face was down, from the cross)
 * plus the front that makes the solve read most naturally. The cross fixes only the bottom;
 * which side faced the solver is not in the moves, and the wrong guess turns every M into
 * an S and most R into B for the whole solve once rotations carry the frame along.
 */
export function bestHolding(turns: ParsedTurn[], rotations: ParsedTurn[], crossHolding = ''): string {
	let best = crossHolding;
	let bestScore = -Infinity;
	for (const y of ['', 'y', 'y2', "y'"]) {
		const holding = [crossHolding, y].filter(Boolean).join(' ');
		const score = reconstructWithRotations(turns, rotations, holding)
			.reduce((s, k) => s + (NATURAL[k.move[0]] ?? 0), 0);
		if (score > bestScore) {
			bestScore = score;
			best = holding;
		}
	}
	return best;
}

/**
 * Which `smart_turns` each method step was built from, as [start, end) index ranges.
 *
 * A step stores its moves already tidied (getPrettyMoves: U U becomes U2, U U' can vanish),
 * so its move count is not the number of raw turns behind it. The ranges are found again by
 * tidying growing runs of raw turns until they read like the step. Null when the steps do
 * not line up with the turns end to end; the caller then keeps its plain display.
 */
export function splitTurnsBySteps(turns: string[], stepTurns: string[]): [number, number][] | null {
	const tidy = (from: number, to: number) => getPrettyMoves(turns.slice(from, to).map((turn) => ({ turn, timestamp: 0 })), false);
	const ranges: [number, number][] = [];
	let cursor = 0;
	for (const step of stepTurns) {
		const target = (step || '').split(' ').filter(Boolean).join(' ');
		let end = -1;
		// Longest run that still reads like the step: a pair that cancels at a step boundary
		// belongs to the step it was made in more often than to the next one.
		for (let to = cursor; to <= turns.length; to++) {
			if (tidy(cursor, to) === target) end = to;
		}
		if (end < 0) return null;
		ranges.push([cursor, end]);
		cursor = end;
	}
	return cursor === turns.length ? ranges : null;
}
