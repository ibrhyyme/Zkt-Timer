import { matchLastLayerAlg, prepareAlgs } from '../ll_alg_match';
import { holdingFrame } from '../rotation_reconstruction';

/** Raw turns 100 ms apart, the way smart_turns parses. */
const raw = (s: string) => s.split(' ').filter(Boolean).map((turn, i) => ({ turn, completedAt: i * 100 }));

function match(rawTurns: string, algs: string[], holding = '') {
	const turns = raw(rawTurns);
	return matchLastLayerAlg(turns, [0, turns.length], holdingFrame(holding), prepareAlgs(algs));
}

const T_PERM = "R U R' U' R' F R2 U' R' U' R U R' F'";

describe('prepareAlgs', () => {
	it('tidies the notation and drops a leading y and a closing rotation', () => {
		const [alg] = prepareAlgs(["y (R U R') U' Rw2 R3 x"]);
		expect(alg.moves.map((m) => m.move)).toEqual(['R', 'U', "R'", "U'", 'r2', "R'"]);
		expect(alg.moves.map((m) => m.kind)).toEqual(['turn', 'turn', 'turn', 'turn', 'wide', 'turn']);
	});

	it('skips what it cannot read, and the same algorithm twice', () => {
		expect(prepareAlgs(['R U Q', "R U R'", "(R U R')"])).toHaveLength(1);
	});
});

describe('matchLastLayerAlg', () => {
	it('reads a T perm with its AUF, a half turn arriving as two quarters', () => {
		const m = match(`U ${T_PERM.replace('R2', 'R R')} U U`, [T_PERM])!;
		expect(m.tokens.map((k) => k.move).join(' ')).toBe(`U ${T_PERM} U2`);
		expect(m.tokens.find((k) => k.move === 'R2')!.raws).toEqual([7, 8]);
	});

	it('reads it from whichever way the solver held the cube', () => {
		// Held y, the solver's R is the core's B and F the core's R.
		const m = match("B U B' U' B' R B B U' B' U' B U B' R'", [T_PERM], 'y')!;
		expect(m.tokens.map((k) => k.move).join(' ')).toBe(T_PERM);
	});

	it('puts a wide move back, and the frame it left', () => {
		// r = L x: the core reports L, and the solver's U is the core's F until r' turns it back.
		const m = match("L F R' F' L' F R F'", ["r U R' U' r' F R F'"])!;
		expect(m.tokens.map((k) => k.move).join(' ')).toBe("r U R' U' r' F R F'");
		expect(m.tokens.map((k) => k.kind)[0]).toBe('wide');
		expect(m.frame).toEqual(holdingFrame(''));
	});

	it('takes slice faces in either order, and a wobble in between', () => {
		// H perm: every M2 turns the core x2, so the U turns between come in as D.
		const m = match("L R' L R' D F F' R' L R' L U U L R' R' L D R L' R L'", ['M2 U M2 U2 M2 U M2'])!;
		expect(m.tokens.map((k) => k.move).join(' ')).toBe('M2 U M2 U2 M2 U M2');
		// The wobble plays with the move before it; every raw turn plays once, in order.
		expect(m.tokens[1].raws).toEqual([4, 5, 6]);
		expect(m.tokens.flatMap((k) => k.raws)).toEqual([...Array(22).keys()]);
	});

	it('folds the AUF into the algorithm\'s own U turn', () => {
		const m = match("R U R' U U", ["R U R' U"])!;
		expect(m.tokens.map((k) => k.move).join(' ')).toBe("R U R' U2");
	});

	it('finds nothing in turns no algorithm gives back', () => {
		expect(match("R U R' F", [T_PERM])).toBeNull();
		expect(match(T_PERM.replace('R2', 'R R'), [T_PERM], 'y')).toBeNull();
	});
});
