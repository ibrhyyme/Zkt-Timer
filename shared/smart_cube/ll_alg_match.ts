/**
 * Which last layer algorithm a step was, read from the raw turns alone.
 *
 * A smart cube reports face turns about its core. A wide move arrives as one face (r is L x)
 * and a slice the timing missed as two, so a reading without the gyroscope loses the frame
 * those moves leave behind: r U R' U' r' reads as L F R' F' L'. A known algorithm settles it.
 * Written about the solver's axes and expanded the way the cube reports it (M = R L' x',
 * r = L x), it has to give the step's raw turns back: run for run, where a run is the turns
 * about one axis in a row (R L' and L' R are the same), a turn and its undo (a wobble) count
 * for nothing, and a U turn before and after it is the AUF. Then the step is written as that
 * algorithm, and the replay plays each of its moves on the raw turns behind it.
 *
 * Pure: shared by the client (SolutionInfo) and tests.
 */
import type { ParsedTurn } from './parse_turns';
import { applyRotation, Face, Frame, ReconstructionToken, ReconstructionTokenKind } from './rotation_reconstruction';

interface AlgMove {
	/** As it is written, tidied: r for Rw, R' for R3, no brackets. */
	move: string;
	kind: ReconstructionTokenKind;
}

export interface PreparedAlg {
	moves: AlgMove[];
	/** The moves expanded from a solver holding the cube square (identity frame), see expand. */
	faces: [Face, number][][];
	/** Where that holding ends: the algorithm's own rotations and slices move it. */
	end: Frame;
	/** Net quarters on each face from that holding, a cheap first test. */
	net: Record<Face, number>;
	/** Its runs but the first and last, which an AUF can change: a raw step must contain them. */
	inner: string;
}

const AXIS: Record<Face, string> = { U: 'y', D: 'y', R: 'x', L: 'x', F: 'z', B: 'z' };

/** Face turns and whole-cube turn behind each slice and wide move, in the solver's frame. */
const SPLIT: Record<string, { faces: [Face, number][]; rotation: string }> = {
	M: { faces: [['R', 1], ['L', 3]], rotation: "x'" },
	E: { faces: [['U', 1], ['D', 3]], rotation: "y'" },
	S: { faces: [['F', 3], ['B', 1]], rotation: 'z' },
	r: { faces: [['L', 1]], rotation: 'x' },
	l: { faces: [['R', 1]], rotation: "x'" },
	u: { faces: [['D', 1]], rotation: 'y' },
	d: { faces: [['U', 1]], rotation: "y'" },
	f: { faces: [['B', 1]], rotation: 'z' },
	b: { faces: [['F', 1]], rotation: "z'" },
};

const SUFFIX = ['', '', '2', "'"];

function parseMove(text: string): AlgMove | null {
	const m = text.match(/^([URFDLBMESxyzurfdlb])(w?)(\d*)(')?$/);
	if (!m) return null;
	const [, face, wide, count, prime] = m;
	if (wide && !'URFDLB'.includes(face)) return null;
	const n = (count ? parseInt(count, 10) : 1) * (prime ? -1 : 1);
	const q = ((n % 4) + 4) % 4;
	if (!q) return null;
	const base = wide ? face.toLowerCase() : face;
	const kind: ReconstructionTokenKind = 'xyz'.includes(base)
		? 'rotation'
		: 'MES'.includes(base)
			? 'slice'
			: base === base.toLowerCase()
				? 'wide'
				: 'turn';
	return { move: base + SUFFIX[q], kind };
}

function quarters(move: string): number {
	const suffix = move.slice(1);
	return suffix === '2' ? 2 : suffix === "'" ? 3 : 1;
}

/**
 * Algorithm texts ready to match. A leading y is dropped: which way the solver faced is the
 * reading's choice, not the algorithm's. So is a closing rotation, which moves no piece.
 */
export function prepareAlgs(texts: readonly string[]): PreparedAlg[] {
	const seen = new Set<string>();
	const out: PreparedAlg[] = [];
	for (const text of texts) {
		const parts = (text || '').replace(/[()[\]]/g, ' ').split(/\s+/).filter(Boolean);
		const moves = parts.map(parseMove);
		if (!moves.length || moves.some((m) => !m)) continue;
		let list = moves as AlgMove[];
		while (list.length && list[0].move[0] === 'y') list = list.slice(1);
		while (list.length && list[list.length - 1].kind === 'rotation') list = list.slice(0, -1);
		if (!list.some((m) => m.kind !== 'rotation')) continue;
		const key = list.map((m) => m.move).join(' ');
		if (seen.has(key)) continue;
		seen.add(key);
		let frame = IDENTITY;
		const faces = list.map((m) => {
			const e = expand(m, frame);
			frame = e.frame;
			return e.faces;
		});
		const net = { U: 0, D: 0, F: 0, B: 0, R: 0, L: 0 };
		for (const [f, n] of faces.flat()) net[f] = (net[f] + n) % 4;
		out.push({ moves: list, faces, end: frame, net, inner: signature(faces.flat()).slice(1, -1).join(' ') });
	}
	return out;
}

const IDENTITY: Frame = { U: 'U', D: 'D', F: 'F', B: 'B', R: 'R', L: 'L' };
const FACES: Face[] = ['U', 'D', 'F', 'B', 'R', 'L'];

/** Core face turns an algorithm move makes from `frame`, and the frame after it. */
function expand(move: AlgMove, frame: Frame): { faces: [Face, number][]; frame: Frame } {
	const q = quarters(move.move);
	if (move.kind === 'rotation') return { faces: [], frame: applyRotation(frame, move.move) };
	const split = SPLIT[move.move[0]];
	if (!split) return { faces: [[frame[move.move[0] as Face], q]], frame };
	const faces = split.faces.map(([f, n]) => [frame[f], (n * q) % 4] as [Face, number]);
	let after = frame;
	for (let i = 0; i < q; i++) after = applyRotation(after, split.rotation);
	return { faces, frame: after };
}

type Run = { axis: string; q: Partial<Record<Face, number>> };

/**
 * Turns as runs about one axis, each face's net quarters. A run that nets to nothing goes, and
 * the runs either side of it join when they share an axis.
 */
function runsOf(turns: [Face, number][]): Run[] {
	const stack: Run[] = [];
	const clean = (run: Run) => {
		for (const f of Object.keys(run.q) as Face[]) if (!run.q[f]) delete run.q[f];
		return Object.keys(run.q).length > 0;
	};
	for (const [face, n] of turns) {
		const run: Run = { axis: AXIS[face], q: { [face]: n % 4 } };
		if (!clean(run)) continue;
		const top = stack[stack.length - 1];
		if (top && top.axis === run.axis) {
			for (const f of Object.keys(run.q) as Face[]) top.q[f] = ((top.q[f] || 0) + run.q[f]!) % 4;
			if (!clean(top)) stack.pop();
		} else {
			stack.push(run);
		}
	}
	return stack;
}

function runKey(run: Run): string {
	return (Object.keys(run.q) as Face[]).sort().map((f) => f + run.q[f]).join('');
}

function signature(turns: [Face, number][]): string[] {
	return runsOf(turns).map(runKey);
}

function parseRaw(turn: string): [Face, number] | null {
	const face = turn[0] as Face;
	if (!(face in AXIS)) return null;
	const suffix = turn.slice(1);
	return [face, suffix === "'" ? 3 : suffix === '2' ? 2 : 1];
}

interface Planned {
	move: string;
	kind: ReconstructionTokenKind;
	faces: [Face, number][];
}

/**
 * The step `turns[start..end)` as one of `algs`, read from `frame` (solver position -> core
 * face), with its AUF before and after. Null when none of them gives the turns back.
 */
export function matchLastLayerAlg(
	turns: ParsedTurn[],
	[start, end]: [number, number],
	frame: Frame,
	algs: readonly PreparedAlg[]
): { tokens: ReconstructionToken[]; frame: Frame } | null {
	const raw: [Face, number][] = [];
	for (let i = start; i < end; i++) {
		const r = parseRaw(turns[i].turn);
		if (!r) return null;
		raw.push(r);
	}
	if (!raw.length) return null;
	// Compared in the solver's positions, where the algorithms were expanded once (prepareAlgs).
	const position = {} as Record<Face, Face>;
	for (const p of FACES) position[frame[p]] = p;
	const rawPos = raw.map(([c, n]) => [position[c], n] as [Face, number]);
	const want = signature(rawPos);
	const wantText = want.join(' ');
	const rawNet: Record<Face, number> = { U: 0, D: 0, F: 0, B: 0, R: 0, L: 0 };
	for (const [p, n] of rawPos) rawNet[p] = (rawNet[p] + n) % 4;

	for (const alg of algs) {
		// Only the first and last runs can change with an AUF: the rest has to be there as is.
		if (alg.inner && !wantText.includes(alg.inner)) continue;
		if (FACES.some((p) => p !== 'U' && p !== alg.end.U && rawNet[p] !== alg.net[p])) continue;
		const flat = alg.faces.flat();
		for (let pre = 0; pre < 4; pre++) {
			for (let post = 0; post < 4; post++) {
				const all: [Face, number][] = [...(pre ? [['U', pre] as [Face, number]] : []), ...flat, ...(post ? [[alg.end.U, post] as [Face, number]] : [])];
				const got = signature(all);
				if (got.length !== want.length || got.some((k, i) => k !== want[i])) continue;
				// Back to core faces: from `frame`, the square holding's position p is frame[p].
				const f = {} as Frame;
				for (const p of FACES) f[p] = frame[alg.end[p]];
				const body: Planned[] = alg.moves.map((m, i) => ({
					move: m.move,
					kind: m.kind,
					faces: alg.faces[i].map(([p, n]) => [frame[p], n] as [Face, number]),
				}));
				const tokens = assignRaws(withAuf(body, pre, post, frame.U, f.U), raw, start, turns);
				if (tokens) return { tokens, frame: f };
			}
		}
	}
	return null;
}

/** The AUF folded into the algorithm's own first or last U turn, or as a move of its own. */
function withAuf(body: Planned[], pre: number, post: number, preFace: Face, postFace: Face): Planned[] {
	const out = body.map((p) => ({ ...p, faces: p.faces.slice() }));
	const fold = (at: number, n: number, face: Face, side: 'start' | 'end') => {
		if (!n) return;
		const p = out[at];
		if (p && p.kind === 'turn' && p.move[0] === 'U' && p.faces[0][0] === face) {
			const q = (p.faces[0][1] + n) % 4;
			if (q) {
				p.move = 'U' + SUFFIX[q];
				p.faces = [[face, q]];
			} else {
				out.splice(at, 1);
			}
			return;
		}
		const auf: Planned = { move: 'U' + SUFFIX[n], kind: 'turn', faces: [[face, n]] };
		if (side === 'start') out.unshift(auf);
		else out.push(auf);
	};
	fold(0, pre, preFace, 'start');
	fold(out.length - 1, post, postFace, 'end');
	return out;
}

/**
 * Hands each raw turn to the move it belongs to, so the replay plays a move's own turns. Moves
 * on one axis in a row share a run and take its turns by face; a turn no move still needs (a
 * wobble) goes with the move before it. Null if a move ends up short.
 */
function assignRaws(planned: Planned[], raw: [Face, number][], start: number, turns: ParsedTurn[]): ReconstructionToken[] | null {
	// Groups of moves that turn faces, one per axis run.
	const groups: number[][] = [];
	planned.forEach((p, i) => {
		if (!p.faces.length) return;
		const last = groups[groups.length - 1];
		if (last && AXIS[planned[last[0]].faces[0][0]] === AXIS[p.faces[0][0]]) last.push(i);
		else groups.push([i]);
	});
	const got = planned.map(() => new Map<Face, { n: number; count: number }>());
	const raws: number[][] = planned.map(() => []);
	const need = (i: number, face: Face) => {
		const d = planned[i].faces.find(([f]) => f === face);
		if (!d) return false;
		const g = got[i].get(face);
		return !g || !g.count || g.n !== d[1];
	};
	const demands = (i: number, face: Face) => planned[i].faces.some(([f]) => f === face);
	let g = 0;
	let lastMove = groups.length ? groups[0][0] : -1;
	for (let k = 0; k < raw.length; k++) {
		const [face, n] = raw[k];
		let pick = groups[g]?.find((i) => need(i, face));
		if (pick === undefined && g + 1 < groups.length && groups[g + 1].some((i) => demands(i, face))) {
			g++;
			pick = groups[g].find((i) => need(i, face)) ?? groups[g].find((i) => demands(i, face));
		}
		if (pick === undefined) pick = lastMove;
		if (pick < 0) return null;
		const cur = got[pick].get(face) || { n: 0, count: 0 };
		got[pick].set(face, { n: (cur.n + n) % 4, count: cur.count + 1 });
		raws[pick].push(start + k);
		lastMove = pick;
	}
	if (planned.some((p, i) => p.faces.some(([f]) => need(i, f)))) return null;

	const tokens: ReconstructionToken[] = planned.map((p, i) => {
		const own = raws[i].sort((a, b) => a - b);
		return {
			move: p.move,
			kind: p.kind,
			rawStart: own.length ? own[0] : -1,
			rawEnd: own.length ? own[own.length - 1] + 1 : -1,
			raws: own,
			t: own.length ? turns[own[0]].completedAt : NaN,
		};
	});
	// A rotation inside the algorithm stands where it is written, between its neighbours' turns.
	for (let i = 0; i < tokens.length; i++) {
		if (tokens[i].raws.length) continue;
		const next = tokens.slice(i + 1).find((k) => k.raws.length);
		const prev = tokens.slice(0, i).reverse().find((k) => k.raws.length);
		const at = next ? next.rawStart : prev ? prev.rawEnd : start;
		tokens[i].rawStart = at;
		tokens[i].rawEnd = at;
		tokens[i].t = prev && next ? (prev.t + next.t) / 2 : (next || prev)?.t ?? 0;
	}
	return tokens;
}
