import Cube from 'cubejs';
import {SmartAlgTracker, CubeStateOps, SmartMoveResult, quarterTurnCost} from '../smart_alg_tracker';

/*
 * The tracker is generic over the cube state. Here the state is a cubejs Cube, which knows
 * wide moves, slices, rotations and centers, and can turn itself upright from any of the 24
 * orientations. In the app the same rules run on cubing.js KPatterns.
 *
 * The smart cube never reports `r`, `M`, `x`: it reports face turns of its own core. toBleEvents
 * turns a written algorithm into what the cube sends, frame changes included, and every case
 * first checks that those events really produce the algorithm's result.
 */

function toCubejsMove(move: string): string {
	let m = move.replace(/[()]/g, '').trim();
	m = m.replace(/^([UDFBRL])w/, (_, f: string) => f.toLowerCase());
	if (m.includes('2')) m = m.replace("'", '');
	return m;
}

const ops: CubeStateOps<any> = {
	apply(state, move) {
		const c = state.clone();
		c.move(toCubejsMove(move));
		return c;
	},
	normalize(state) {
		const c = state.clone();
		const up = c.upright();
		if (up) c.move(up);
		return c;
	},
	same(a, b) {
		for (let i = 0; i < 8; i++) {
			if (a.cp[i] !== b.cp[i] || a.co[i] !== b.co[i]) return false;
		}
		for (let i = 0; i < 12; i++) {
			if (a.ep[i] !== b.ep[i] || a.eo[i] !== b.eo[i]) return false;
		}
		return true;
	},
};

type Face = 'U' | 'D' | 'F' | 'B' | 'R' | 'L';
const OPP: Record<Face, Face> = {U: 'D', D: 'U', R: 'L', L: 'R', F: 'B', B: 'F'};

interface EventOptions {
	/** Slice order: outer face on the slice's "R/U/F" side first, or the other one first. */
	sliceOrder?: 'first' | 'second';
	/** Double slice reported interleaved (R L R L) or grouped (R R L L). */
	doubleSlice?: 'interleaved' | 'grouped';
}

function toBleEvents(alg: string, opt: EventOptions = {}): string[] {
	let map: Record<Face, Face> = {U: 'U', D: 'D', F: 'F', B: 'B', R: 'R', L: 'L'};
	const events: string[] = [];

	const rotate = (axis: 'x' | 'y' | 'z', turns: number) => {
		for (let k = 0; k < ((turns % 4) + 4) % 4; k++) {
			const o = map;
			if (axis === 'x') map = {...o, U: o.F, F: o.D, D: o.B, B: o.U};
			if (axis === 'y') map = {...o, F: o.R, R: o.B, B: o.L, L: o.F};
			if (axis === 'z') map = {...o, U: o.L, L: o.D, D: o.R, R: o.U};
		}
	};
	const quarter = (face: Face, prime: boolean) => events.push(map[face] + (prime ? "'" : ''));

	const tokens = alg.replace(/[()]/g, ' ').split(/\s+/).filter(Boolean);
	for (const raw of tokens) {
		const tok = raw.replace(/^([UDFBRL])w/, (_, f: string) => f.toLowerCase());
		const base = tok[0];
		const double = tok.includes('2');
		const prime = !double && tok.includes("'");
		const turns = double ? 2 : prime ? -1 : 1;

		if ('xyz'.includes(base)) {
			rotate(base as 'x' | 'y' | 'z', turns);
		} else if ('UDFBRL'.includes(base)) {
			quarter(base as Face, prime);
			if (double) quarter(base as Face, prime);
		} else if ('udfbrl'.includes(base)) {
			// r = L x, l = R x', u = D y, d = U y', f = B z, b = F z'
			const face = base.toUpperCase() as Face;
			quarter(OPP[face], prime);
			if (double) quarter(OPP[face], prime);
			const axis = ({R: 'x', L: 'x', U: 'y', D: 'y', F: 'z', B: 'z'} as const)[face];
			const sign = face === 'R' || face === 'U' || face === 'F' ? 1 : -1;
			rotate(axis, turns * sign);
		} else if ('MES'.includes(base)) {
			// M = R L' x', E = U D' y', S = F' B z
			const [a, aPrime, bFace, bPrime, axis, sign] = ({
				M: ['R', false, 'L', true, 'x', -1],
				E: ['U', false, 'D', true, 'y', -1],
				S: ['F', true, 'B', false, 'z', 1],
			} as const)[base as 'M' | 'E' | 'S'];
			const first = (p: boolean) => quarter(a as Face, p ? !aPrime : aPrime);
			const second = (p: boolean) => quarter(bFace as Face, p ? !bPrime : bPrime);
			const pair = opt.sliceOrder === 'second' ? [second, first] : [first, second];
			if (double && opt.doubleSlice === 'grouped') {
				pair[0](prime);
				pair[0](prime);
				pair[1](prime);
				pair[1](prime);
			} else {
				pair[0](prime);
				pair[1](prime);
				if (double) {
					pair[0](prime);
					pair[1](prime);
				}
			}
			rotate(axis as 'x' | 'y' | 'z', turns * sign);
		} else {
			throw new Error(`unknown move ${raw}`);
		}
	}
	return events;
}

function algMovesOf(alg: string): string[] {
	return alg.split(/\s+/).filter(Boolean);
}

function applyAll(state: any, moves: string[]): any {
	return moves.reduce((s, m) => ops.apply(s, m), state);
}

function newTracker(alg: string, start: any = new Cube()) {
	const t = new SmartAlgTracker<any>(ops);
	t.setCurrent(start);
	t.load(algMovesOf(alg), new Cube());
	return t;
}

function run(t: SmartAlgTracker<any>, moves: string[], masked = false): SmartMoveResult[] {
	return moves.map((m) => t.push(m, masked) as SmartMoveResult);
}

// Algorithms that exercise rotations, wide moves, slices and doubles.
const ALGS: Record<string, string> = {
	'T perm': "R U R' U' R' F R2 U' R' U' R U R' F'",
	'Y perm (screenshot 2.8 (1))': "F R U' R' U' R U R' F' R U R' U' R' F R F'",
	'Aa perm (x rotations)': "x R' U R' D2 R U' R' D2 R2 x'",
	'H perm (M2)': "M2 U M2 U2 M2 U M2",
	'Ua perm (M, M\')': "M2 U M U2 M' U M2",
	'Sune with y': "y R U R' U R U2 R'",
	'OLL 33 (r, r\')': "r U R' U' r' F R F'",
	'OLL 34 (f and r, two axes)': "f R f' U' r' U' R U M'",
	'OLL 39 (f\', r, S)': "f' r U r' U' r' F r S",
	'E perm (x\' ... x)': "x' R U' R' D R U R' D' R U R' D R U' R' D' x",
	'AUF U2 first': "U2 R U R' U' R' F R2 U' R' U' R U R' F'",
	'AUF U\' with Rw': "U' Rw U R' U' Rw' F R F'",
	'Double prime U2\'': "R U2' R' U' R U' R'",
};

describe('toBleEvents (test helper)', () => {
	it.each(Object.entries(ALGS))('%s: reported face turns produce the algorithm result', (_name, alg) => {
		for (const sliceOrder of ['first', 'second'] as const) {
			for (const doubleSlice of ['interleaved', 'grouped'] as const) {
				const viaAlg = ops.normalize(applyAll(new Cube(), algMovesOf(alg)));
				const viaEvents = ops.normalize(applyAll(new Cube(), toBleEvents(alg, {sliceOrder, doubleSlice})));
				expect(ops.same(viaAlg, viaEvents)).toBe(true);
			}
		}
	});
});

describe('quarterTurnCost', () => {
	it('counts what the cube reports', () => {
		expect(quarterTurnCost('R')).toBe(1);
		expect(quarterTurnCost("R'")).toBe(1);
		expect(quarterTurnCost('R2')).toBe(2);
		expect(quarterTurnCost("U2'")).toBe(2);
		expect(quarterTurnCost('r')).toBe(1);
		expect(quarterTurnCost('M')).toBe(2);
		expect(quarterTurnCost('M2')).toBe(4);
		expect(quarterTurnCost('x')).toBe(0);
		expect(quarterTurnCost('(R')).toBe(1);
	});
});

describe('clean execution (existing behavior, now without false mistakes)', () => {
	it.each(Object.entries(ALGS))('%s completes, every report a match or a turn in progress', (_name, alg) => {
		for (const sliceOrder of ['first', 'second'] as const) {
			for (const doubleSlice of ['interleaved', 'grouped'] as const) {
				const t = newTracker(alg);
				const results = run(t, toBleEvents(alg, {sliceOrder, doubleSlice}));
				expect(results[0].started).toBe(true);
				expect(results.slice(1).every((r) => !r.started)).toBe(true);
				expect(results.every((r) => r.verdict === 'match' || r.verdict === 'partial')).toBe(true);
				expect(results.some((r) => r.mistake)).toBe(false);
				const last = results[results.length - 1];
				expect(last.completed).toBe(true);
				expect(last.matchedCount).toBe(algMovesOf(alg).length);
				expect(results.slice(0, -1).some((r) => r.completed)).toBe(false);
			}
		}
	});

	it('the first quarter of a double turn is shown as a turn in progress', () => {
		const t = newTracker("R U2 R'");
		const [r, u1, u2] = run(t, ['R', 'U', 'U']);
		expect(r.verdict).toBe('match');
		expect(u1).toMatchObject({verdict: 'partial', partial: true, mistake: false, bad: ['U'], matchedCount: 1});
		expect(u2).toMatchObject({verdict: 'match', matchedCount: 2, bad: []});
	});

	it('a double turn done the other way round (U\' U\') also counts', () => {
		const t = newTracker("R U2 R'");
		const results = run(t, ['R', "U'", "U'", "R'"]);
		expect(results.map((r) => r.verdict)).toEqual(['match', 'partial', 'match', 'match']);
		expect(results[3].completed).toBe(true);
	});

	it('an algorithm that starts with a rotation matches from the first face turn', () => {
		const t = newTracker("y R U R'");
		const first = t.push('B') as SmartMoveResult; // after y the user's R is the cube's B face
		expect(first).toMatchObject({verdict: 'match', started: true, matchedCount: 2});
	});

	it('a trailing rotation does not have to be "done"', () => {
		const alg = "x R' U R' D2 R U' R' D2 R2 x'";
		const t = newTracker(alg);
		const results = run(t, toBleEvents(alg));
		expect(results[results.length - 1]).toMatchObject({completed: true, matchedCount: 11});
	});
});

describe('2.8-c: a wrong FIRST move', () => {
	const alg = "F R U' R' U' R U R' F' R U R' U' R' F R F'"; // Y perm, starts with F

	it('is reported as an error and starts the attempt', () => {
		const t = newTracker(alg);
		const r = t.push('U') as SmartMoveResult;
		expect(r).toMatchObject({verdict: 'wrong', started: true, mistake: true, bad: ['U'], matchedCount: 0, completed: false});
	});

	it('a following move is judged too (not silently ignored)', () => {
		const t = newTracker(alg);
		const [, second] = run(t, ['U', 'F']);
		expect(second).toMatchObject({verdict: 'wrong', started: false, mistake: true, bad: ['U', 'F']});
	});

	it('undoing it brings tracking back, and the algorithm then completes', () => {
		const t = newTracker(alg);
		const results = run(t, ['U', "U'", ...toBleEvents(alg)]);
		expect(results[1]).toMatchObject({verdict: 'undo', bad: [], mistake: false});
		expect(results[2]).toMatchObject({verdict: 'match', matchedCount: 1});
		expect(results[results.length - 1].completed).toBe(true);
	});

	it('wrong, wrong, then both undone in reverse order, then the algorithm completes', () => {
		const t = newTracker(alg);
		const results = run(t, ['U', 'R', "R'", "U'", ...toBleEvents(alg)]);
		expect(results[2].bad).toEqual(['U']);
		expect(results[3].bad).toEqual([]);
		expect(results[results.length - 1].completed).toBe(true);
	});

	it('the old behavior is gone: before, U then the whole algorithm never matched anything', () => {
		// Before the fix the first U was taken as a "setup" move and ignored, so the expected
		// states stayed anchored before it and no later move could match. Now the U is pending
		// as an error the user can see and undo.
		const t = newTracker(alg);
		const results = run(t, ['U', ...toBleEvents(alg)]);
		expect(results[0].verdict).toBe('wrong');
		expect(results.every((r) => r.started === (r === results[0]))).toBe(true);
		expect(results.slice(1).every((r) => r.bad.length > 0)).toBe(true);
	});

	it('a wrong first move on an algorithm that starts with a double turn', () => {
		const t = newTracker("U2 R U R' U'");
		const r = t.push('R') as SmartMoveResult;
		expect(r).toMatchObject({verdict: 'wrong', mistake: true});
	});

	it('the right face in the wrong direction on a quarter turn is an error', () => {
		const t = newTracker("R U R' U'");
		expect(t.push("R'")).toMatchObject({verdict: 'wrong', mistake: true});
	});

	it('the first face of a slice is a turn in progress, in either order', () => {
		for (const first of ['R', "L'"]) {
			const t = newTracker("M U M'");
			expect(t.push(first)).toMatchObject({verdict: 'partial', started: true, mistake: false});
		}
	});

	it('a wrong first move on an algorithm with a rotation is an error', () => {
		const t = newTracker("y R U R'");
		expect(t.push('R')).toMatchObject({verdict: 'wrong', mistake: true});
	});
});

describe('undo and recovery (existing behavior)', () => {
	it('undoing the first correct move goes back to the start', () => {
		const t = newTracker("R U R' U'");
		const [, undo] = run(t, ['R', "R'"]);
		// Like taking back any other correct move: back on a known state, not a mistake.
		// (Before, this one case flashed and counted as a mistake while the same undo one
		// move later did not.)
		expect(undo).toMatchObject({verdict: 'undo', matchedCount: 0, bad: [], mistake: false});
		const rest = run(t, ['R', 'U', "R'", "U'"]);
		expect(rest[3].completed).toBe(true);
	});

	it('a wrong move mid algorithm and its undo (case 2)', () => {
		const t = newTracker("R U R' U'");
		const results = run(t, ['R', 'U', 'L', "L'", "R'", "U'"]);
		expect(results[2]).toMatchObject({verdict: 'wrong', mistake: true, bad: ['L'], matchedCount: 2});
		// Same as before: the undo lands back on an algorithm state, so it simply matches.
		expect(results[3]).toMatchObject({verdict: 'match', mistake: false, bad: [], matchedCount: 2});
		expect(results[5].completed).toBe(true);
	});

	it('undoing a turn in progress is not a mistake', () => {
		const t = newTracker("R U2 R'");
		const results = run(t, ['R', 'U', "U'"]);
		expect(results[2]).toMatchObject({verdict: 'match', mistake: false, matchedCount: 1});
	});

	it('undoing a first turn in progress is not a mistake', () => {
		const t = newTracker("U2 R U R'");
		const results = run(t, ['U', "U'"]);
		expect(results[1]).toMatchObject({verdict: 'undo', mistake: false, bad: []});
	});

	it('a wrong face turned a full turn clears itself (case 3)', () => {
		const t = newTracker("R U R' U'");
		const results = run(t, ['U', 'U', 'U', 'U']);
		expect(results[3].bad).toEqual([]);
		const rest = run(t, ['R', 'U', "R'", "U'"]);
		expect(rest[3].completed).toBe(true);
	});

	it('going back to an earlier algorithm state lowers the count', () => {
		const t = newTracker("R U R' U'");
		const results = run(t, ['R', 'U', "U'"]);
		expect(results[2]).toMatchObject({verdict: 'match', matchedCount: 1});
	});

	it('a different order that reaches the same state still completes', () => {
		const t = newTracker('R L U');
		const results = run(t, ['L', 'R', 'U']);
		expect(results[0]).toMatchObject({verdict: 'wrong', mistake: true});
		expect(results[1]).toMatchObject({verdict: 'match', matchedCount: 2});
		expect(results[2].completed).toBe(true);
	});
});

describe('masked moves', () => {
	it('start on the first move and only check the end state', () => {
		const alg = "R U R' U'";
		const t = newTracker(alg);
		const results = run(t, ['U', "U'", 'R', 'U', "R'", "U'"], true);
		expect(results[0]).toMatchObject({verdict: 'masked', started: true, completed: false, mistake: false});
		expect(results.slice(0, -1).some((r) => r.completed)).toBe(false);
		expect(results[5].completed).toBe(true);
	});
});

describe('baseline and completion', () => {
	it('expectations follow a cube that was not solved at the start', () => {
		const start = applyAll(new Cube(), ['F', 'R', "U'", 'B2', 'L']);
		const alg = "R U R' U R U2 R'";
		const t = newTracker(alg, start);
		const results = run(t, toBleEvents(alg));
		expect(results[results.length - 1].completed).toBe(true);
	});

	it('re-anchors when the cube state is re-read before the first move', () => {
		const t = newTracker("R U R' U'");
		t.setCurrent(applyAll(new Cube(), ['F2']));
		t.rebuild();
		const results = run(t, ['R', 'U', "R'", "U'"]);
		expect(results[3].completed).toBe(true);
	});

	it('after completion, moves are applied but not judged, and the next algorithm starts from there', () => {
		const t = newTracker("R U R' U'");
		run(t, ['R', 'U', "R'", "U'"]);
		expect(t.push('F')).toBeNull();
		t.load(algMovesOf("R U R' U'"), new Cube());
		const results = run(t, ['R', 'U', "R'", "U'"]);
		expect(results[0]).toMatchObject({verdict: 'match', started: true});
		expect(results[3].completed).toBe(true);
	});

	it('ignores moves until an algorithm is loaded', () => {
		const t = new SmartAlgTracker<any>(ops);
		t.setCurrent(new Cube());
		expect(t.push('R')).toBeNull();
		expect(ops.same(t.getCurrent(), new Cube())).toBe(true);
	});

	it('reset keeps the expectations and waits for a new first move', () => {
		const t = newTracker("R U R' U'");
		run(t, ['R', 'U']);
		t.setCurrent(new Cube());
		t.resetProgress();
		const results = run(t, ['R', 'U', "R'", "U'"]);
		expect(results[0].started).toBe(true);
		expect(results[3].completed).toBe(true);
	});
});
