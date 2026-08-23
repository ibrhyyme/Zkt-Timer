/**
 * Ground-truth tests for the non-CFOP methods.
 *
 * Method: build a solve whose phase boundaries are known in advance by walking
 * BACKWARDS from a solved cube — apply each phase's inverse in reverse order to
 * reach the start state. Playing it forward, the move at which each phase
 * completes is known by construction.
 *
 * The check is deliberately independent of the engine: the engine reads facelet
 * colour masks, these assertions read cubejs piece arrays (cp/co/ep/eo). Two
 * different routes agreeing is real evidence; re-running the engine's own logic
 * would not be.
 *
 * Every scenario also asserts the constructed solve actually solves the cube,
 * otherwise an invalid setup would be silently "tested".
 */

import Cube from 'cubejs';
import { analyzePhases } from '../phase_engine';
import { SolveMethod, SolveTurn } from '../types';

// cubejs piece order.
//   edges:   UR UF UL UB DR DF DL DB FR FL BL BR  (BL is 10, BR is 11)
//   corners: URF UFL ULB UBR DFR DLF DBL DRB
const LEFT_BLOCK = { edges: [6, 9, 10], corners: [5, 6] };
const RIGHT_BLOCK = { edges: [4, 8, 11], corners: [4, 7] };
const LL_CORNERS = [0, 1, 2, 3];

const mv = (alg: string) => alg.trim().split(/\s+/).filter(Boolean);
const inv = (alg: string) =>
	mv(alg)
		.reverse()
		.map((m) => (m.endsWith("'") ? m.slice(0, -1) : m.endsWith('2') ? m : m + "'"))
		.join(' ');

function edgesPlaced(cube: any, idx: number[]): boolean {
	return idx.every((i) => cube.ep[i] === i && cube.eo[i] === 0);
}
function cornersPlaced(cube: any, idx: number[]): boolean {
	return idx.every((i) => cube.cp[i] === i && cube.co[i] === 0);
}
function blockSolved(cube: any, block: { edges: number[]; corners: number[] }): boolean {
	return edgesPlaced(cube, block.edges) && cornersPlaced(cube, block.corners);
}
function eoSolved(cube: any): boolean {
	return cube.eo.every((x: number) => x === 0);
}

interface Phase {
	name: string;
	alg: string;
}

/**
 * Reverse-builds the start state, then replays forward recording a timestamped
 * turn list plus the turn index at which each phase ends.
 */
function buildSolve(phases: Phase[]) {
	const start = new Cube();
	for (let i = phases.length - 1; i >= 0; i--) {
		for (const m of mv(inv(phases[i].alg))) start.move(m);
	}
	const startState = start.asString();

	const cube = Cube.fromString(startState);
	const turns: SolveTurn[] = [];
	const expectedEnd: Record<string, number> = {};
	const stateAfter: Record<string, any> = {};
	let t = 1000;

	for (const ph of phases) {
		t += 900; // thinking time before the phase
		for (const m of mv(ph.alg)) {
			cube.move(m);
			turns.push({ turn: m, timestamp: t });
			t += 220;
		}
		expectedEnd[ph.name] = turns.length - 1;
		stateAfter[ph.name] = Cube.fromString(cube.asString());
	}

	return { startState, turns, expectedEnd, stateAfter, solved: cube.isSolved() };
}

function phaseEndIndex(result: ReturnType<typeof analyzePhases>, phase: string): number | null {
	const t = result.transitions.find((x) => x.phase === phase);
	return t ? t.turnIndex : null;
}

/**
 * The 24 cube orientations, generated systematically as
 * (which face goes down) x (which of four y positions).
 *
 * Written out by hand this list is easy to get wrong — an earlier hand-rolled
 * version produced only 23 distinct states because "x2 y2" duplicates "z2".
 */
const ALL_ORIENTATIONS: string[] = (() => {
	const faces = ['', 'x2', "x'", 'x', 'z', "z'"];
	const ys = ['', 'y', 'y2', "y'"];
	const out: string[] = [];
	for (const y of ys) {
		for (const f of faces) out.push([f, y].filter(Boolean).join(' '));
	}
	return out;
})();

function reorient(cube: any, rot: string): any {
	const k = Cube.fromString(cube.asString());
	for (const m of mv(rot)) k.move(m);
	return k;
}

/**
 * Does the cube hold an intact 1x2x3 block in ANY orientation?
 *
 * This is the question Roux actually asks. Note it is about block INTEGRITY,
 * not position: an L turn carries the first block around whole, so a solver
 * who has built a block still has one after rotating the cube.
 */
function hasIntactBlocks(cube: any, count: 1 | 2): boolean {
	for (const rot of ALL_ORIENTATIONS) {
		const k = reorient(cube, rot);
		const left = blockSolved(k, LEFT_BLOCK);
		const right = blockSolved(k, RIGHT_BLOCK);
		if (count === 1 && (left || right)) return true;
		if (count === 2 && left && right) return true;
	}
	return false;
}

/** Rebuilds the cube state as it stood after `turnIndex` turns. */
function stateAtTurn(startState: string, turns: SolveTurn[], turnIndex: number): any {
	const c = Cube.fromString(startState);
	for (let i = 0; i <= turnIndex; i++) c.move(turns[i].turn);
	return c;
}

// Roux: first block, second block, CMLL corners, last six edges.
// LSE uses M slice moves, which is what a real Roux solve looks like.
//
// The first-block setup is deliberately long enough to leave no intact 1x2x3
// block anywhere on the cube. Roux scans all 24 orientations and only asks
// whether a block is INTACT, so a lightly scrambled state can read as "first
// block already done" and the fb step would legitimately be reported as skipped.
const ROUX_PHASES: Phase[] = [
	{ name: 'fb', alg: "F R U' L D2 R' F'" },
	{ name: 'sb', alg: "R U R' U' R U R'" },
	{ name: 'cmll', alg: "R U R' U R U2 R'" },
	{ name: 'lse', alg: "M2 U M2 U2 M2 U M2" },
];

// ZZ: EOLine, then the two bottom blocks, then the last layer.
const ZZ_PHASES: Phase[] = [
	{ name: 'eoline', alg: "R U L' D" },
	{ name: 'block_1', alg: "L U' L' U L U' L'" },
	{ name: 'block_2', alg: "R U R' U' R U R'" },
	{ name: 'll', alg: "R U R' U' R' F R2 U' R' U' R U R' F'" },
];

describe('Roux — phase boundaries against independent piece checks', () => {
	const built = buildSolve(ROUX_PHASES);

	it('constructed solve actually solves the cube', () => {
		expect(built.solved).toBe(true);
	});

	it('setup is valid: nothing reads as solved before the first move', () => {
		// Guards the test itself. If the start state already satisfied a step, the
		// engine would rightly skip it and the boundary assertions would be testing
		// a scenario that does not exist.
		const res = analyzePhases(built.turns, built.startState, { method: 'roux' });
		expect(res.transitions.filter((t) => !t.skipped)).toHaveLength(ROUX_PHASES.length);
	});

	it('independent check: blocks complete in order', () => {
		expect(blockSolved(built.stateAfter.fb, LEFT_BLOCK)).toBe(true);
		expect(blockSolved(built.stateAfter.sb, LEFT_BLOCK)).toBe(true);
		expect(blockSolved(built.stateAfter.sb, RIGHT_BLOCK)).toBe(true);
		expect(cornersPlaced(built.stateAfter.cmll, LL_CORNERS)).toBe(true);
		expect(built.stateAfter.lse.isSolved()).toBe(true);
	});

	it('every boundary the engine reports is confirmed by piece-level checks', () => {
		// Roux boundaries are not asserted against the constructed indices. The
		// engine reports the EARLIEST turn at which a block is intact across all 24
		// orientations, which can precede the last move of a block-building
		// sequence — a real property of the method, not a defect. What must hold is
		// that the state at each reported boundary genuinely satisfies that step.
		const res = analyzePhases(built.turns, built.startState, { method: 'roux' });

		const fbAt = phaseEndIndex(res, 'fb');
		expect(fbAt).not.toBeNull();
		expect(hasIntactBlocks(stateAtTurn(built.startState, built.turns, fbAt!), 1)).toBe(true);

		const sbAt = phaseEndIndex(res, 'sb');
		expect(sbAt).not.toBeNull();
		expect(hasIntactBlocks(stateAtTurn(built.startState, built.turns, sbAt!), 2)).toBe(true);

		const cmllAt = phaseEndIndex(res, 'cmll');
		expect(cmllAt).not.toBeNull();
		const atCmll = stateAtTurn(built.startState, built.turns, cmllAt!);
		expect(hasIntactBlocks(atCmll, 2)).toBe(true);

		const lseAt = phaseEndIndex(res, 'lse');
		expect(lseAt).toBe(built.turns.length - 1);
		expect(stateAtTurn(built.startState, built.turns, lseAt!).isSolved()).toBe(true);
	});

	it('boundaries are strictly ordered', () => {
		const res = analyzePhases(built.turns, built.startState, { method: 'roux' });
		const idx = ROUX_PHASES.map((p) => phaseEndIndex(res, p.name)!);
		for (let i = 1; i < idx.length; i++) {
			expect(idx[i]).toBeGreaterThan(idx[i - 1]);
		}
	});

	it('engine finds every phase at the constructed boundary', () => {
		// The construction — not the engine — is the source of truth here: each
		// phase's moves were derived by inverting a solved cube, so the turn at
		// which each phase completes is known before the engine ever runs.
		const res = analyzePhases(built.turns, built.startState, { method: 'roux' });
		for (const ph of ROUX_PHASES) {
			expect([ph.name, phaseEndIndex(res, ph.name)]).toEqual([ph.name, built.expectedEnd[ph.name]]);
		}
	});

	it('recognizes the CMLL case', () => {
		// Our algorithm library covers only part of the 43-case corner set, so the
		// lookup falls back to the standard case name (H-1, S-1, ...) rather than
		// reporting nothing when there is no local key.
		const res = analyzePhases(built.turns, built.startState, { method: 'roux' });
		const cmll = (res.cases || []).find((c) => c.set === 'cmll');
		expect(cmll).toBeDefined();
		expect(cmll!.case).toBeTruthy();
	});

	it('reports roux as the analysed method', () => {
		const res = analyzePhases(built.turns, built.startState, { method: 'roux' });
		expect(res.method).toBe('roux');
	});

	it('HTM total equals the sum over phases', () => {
		const res = analyzePhases(built.turns, built.startState, { method: 'roux' });
		const sum = res.transitions.reduce((a, t) => a + t.moveCount.htm, 0);
		expect(sum).toBe(res.totalMoves.htm);
	});
});

describe('ZZ — phase boundaries against independent piece checks', () => {
	const built = buildSolve(ZZ_PHASES);

	it('constructed solve actually solves the cube', () => {
		expect(built.solved).toBe(true);
	});

	it('independent check: EO holds from EOLine onwards', () => {
		expect(eoSolved(built.stateAfter.eoline)).toBe(true);
		expect(built.stateAfter.eoline.ep[5]).toBe(5); // DF
		expect(built.stateAfter.eoline.ep[7]).toBe(7); // DB
		expect(eoSolved(built.stateAfter.block_2)).toBe(true);
	});

	it('independent check: both blocks are built by block_2', () => {
		expect(blockSolved(built.stateAfter.block_2, LEFT_BLOCK)).toBe(true);
		expect(blockSolved(built.stateAfter.block_2, RIGHT_BLOCK)).toBe(true);
		expect(built.stateAfter.ll.isSolved()).toBe(true);
	});

	it('recognizes the last-layer corner case', () => {
		// ZZ reaches the last layer with edges oriented, which is the state COLL
		// describes — readable without the 493-case ZBLL set.
		const res = analyzePhases(built.turns, built.startState, { method: 'zz' });
		const coll = (res.cases || []).find((c) => c.set === 'coll');
		expect(coll).toBeDefined();
		expect(coll!.case).toBeTruthy();
	});

	it('engine finds every phase at the constructed boundary', () => {
		const res = analyzePhases(built.turns, built.startState, { method: 'zz' });
		for (const ph of ZZ_PHASES) {
			expect([ph.name, phaseEndIndex(res, ph.name)]).toEqual([ph.name, built.expectedEnd[ph.name]]);
		}
	});
});

describe('CFOP two-look — last layer splits into EO / OLL / CP / PLL', () => {
	// Sune orients edges and corners in one go for this setup, so the EO and CO
	// boundaries land on the same turn; the point of the test is that the ladder
	// produces the four last-layer steps rather than collapsing to two.
	const phases: Phase[] = [
		{ name: 'cross', alg: "F R U' D2 L" },
		{ name: 'f2l_1', alg: "R U R'" },
		{ name: 'f2l_2', alg: "L' U' L" },
		{ name: 'f2l_3', alg: "R' U' R" },
		{ name: 'f2l_4', alg: "L U L'" },
		{ name: 'll', alg: "R U R' U R U2 R' R U R' U' R' F R2 U' R' U' R U R' F'" },
	];
	const built = buildSolve(phases);

	it('constructed solve actually solves the cube', () => {
		expect(built.solved).toBe(true);
	});

	it('produces the two-look step ids', () => {
		const res = analyzePhases(built.turns, built.startState, { method: 'cfop2' });
		const names = res.transitions.map((t) => t.phase);
		expect(names).toContain('cross');
		expect(names).toContain('f2l_4');
		// The two-look ladder must expose EO and CP as their own steps.
		expect(names).toContain('eo');
		expect(names).toContain('cp');
	});

	it('HTM total equals the sum over phases', () => {
		const res = analyzePhases(built.turns, built.startState, { method: 'cfop2' });
		const sum = res.transitions.reduce((a, t) => a + t.moveCount.htm, 0);
		expect(sum).toBe(res.totalMoves.htm);
	});
});

describe('method selection', () => {
	const built = buildSolve(ROUX_PHASES);

	it('unknown method falls back to cfop rather than throwing', () => {
		const res = analyzePhases(built.turns, built.startState, {
			method: 'nonsense' as SolveMethod,
		});
		expect(res.method).toBe('cfop');
	});

	it('empty turns produce an empty result for every method', () => {
		for (const m of ['cfop', 'cfop2', 'roux', 'zz'] as SolveMethod[]) {
			const res = analyzePhases([], undefined, { method: m });
			expect(res.transitions).toHaveLength(0);
			expect(res.cases).toHaveLength(0);
		}
	});
});
