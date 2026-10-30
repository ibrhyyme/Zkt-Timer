import { reconstructFromState, StepInput } from '../state_reconstruction';
import { prepareAlgs } from '../ll_alg_match';
import { parseSmartTurns } from '../parse_turns';
import zperm from './fixtures/gani4_zperm_solve.json';

/** "R@0 L'@10" style input, the compact smart_turns spelling. */
function seq(s: string) {
	return s
		.split(' ')
		.filter(Boolean)
		.map((p) => {
			const [turn, t] = p.split('@');
			return { turn, completedAt: Number(t) };
		});
}

/** Turns 300 ms apart from `from` on: never a slice on timing. */
const spaced = (moves: string, from = 0) =>
	moves.split(' ').filter(Boolean).map((m, i) => `${m}@${from + i * 300}`).join(' ');

function read(turns: string, steps: StepInput[], crossHolding = '') {
	const r = reconstructFromState(seq(turns), steps, crossHolding);
	return { holding: r.holding, text: r.tokens.map((k) => k.move).join(' ') };
}

describe('reconstructFromState', () => {
	it('holds each F2L slot at front right and writes the y between', () => {
		// Slot F/R, then slot R/B: the core's R U R' and then B U B' are both R U R' to the solver.
		const turns = `${spaced("R U R'")} ${spaced("B U B'", 2000)}`;
		const r = read(turns, [
			{ range: [0, 3], slot: ['F', 'R'] },
			{ range: [3, 6], slot: ['R', 'B'] },
		]);
		expect(r).toEqual({ holding: '', text: "R U R' y R U R'" });
	});

	it('holds the slot at front left when the step reads better with L', () => {
		const r = read(spaced("U L' U L"), [{ range: [0, 4], slot: ['L', 'F'] }]);
		expect(r).toEqual({ holding: '', text: "U L' U L" });
	});

	it('keeps the cross face down: a slice in the cross is turned back before the next step', () => {
		// The M takes the core F centre down; without the x, every F2L turn would read a face off.
		const r = read(`R@0 L'@10 ${spaced("R U R'", 1000)}`, [
			{ range: [0, 2] },
			{ range: [2, 5], slot: ['F', 'R'] },
		]);
		expect(r.text).toBe("M x R U R'");
	});

	it('writes a last layer step as the algorithm it was', () => {
		// A T perm held y: the solver's R is the core's B, F the core's R.
		const algs = prepareAlgs(["R U R' U' R' F R2 U' R' U' R U R' F'"]);
		const r = read(spaced("B U B' U' B' R B B U' B' U' B U B' R'"), [{ range: [0, 15], algs }]);
		expect(r).toEqual({ holding: 'y', text: "R U R' U' R' F R2 U' R' U' R U R' F'" });
	});

	it('picks the front of a step with no slot by how naturally it reads', () => {
		// The core's F U F' U' held y' is R U R' U'.
		expect(read(spaced("F U F' U'"), [{ range: [0, 4] }])).toEqual({ holding: "y'", text: "R U R' U'" });
	});
});

describe('a state reading anyone can replay', () => {
	// The scramble is the raw turns undone, so the raw turns solve it by construction; the text
	// written in their place has to as well.
	const solved = (facelets: string) => [0, 1, 2, 3, 4, 5].every((f) => new Set(facelets.slice(f * 9, f * 9 + 9)).size === 1);
	const undo = (turns: string[]) => turns.slice().reverse().map((t) => (t.endsWith("'") ? t[0] : t.endsWith('2') ? t : `${t}'`)).join(' ');

	it('solves the scramble with the Z perm solve as written', () => {
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const Cube = require('cubejs');
		const turns = parseSmartTurns(zperm.smart_turns);
		const r = reconstructFromState(turns, [{ range: [0, turns.length] }], 'z2');
		const cube = new Cube();
		cube.move(undo(turns.map((t) => t.turn)));
		cube.move([r.holding, ...r.tokens.map((k) => k.move)].join(' '));
		expect(solved(cube.asString())).toBe(true);
	});
});
