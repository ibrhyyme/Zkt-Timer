import { SOLVED_FACELET } from '../../../../shared/util/solve/facelet_masks';
import { advanceMove } from '../../../../client/util/virtual_cube/cube_moves';
import { buildCubePieces } from '../../../../client/util/virtual_cube/cube_pieces';
import { getFacelet } from '../../../../client/util/virtual_cube/facelet';
import { move2str } from '../../../../client/util/virtual_cube/notation';
import { parseVirtualScramble } from '../../../../client/util/virtual_cube/parse_scramble';
import {
	parseSmartTurns,
	serializeSmartTurnsCompact,
} from '../../../../shared/smart_cube/parse_turns';
import { getSolveSteps } from '../solve_method';

/**
 * The virtual cube writes the same `smart_turns` string a smart cube does, so the
 * server breaks its solves into steps through the same path. The two differ in
 * one way that matters here: a virtual solve can contain whole-cube rotations,
 * wide turns and slice moves, because the keyboard has keys for all of them and a
 * Bluetooth cube reports none of them.
 *
 * These tests pin what that pipeline does with such a solve. The bar is that it
 * never throws and never poisons the solve record; producing usable steps for a
 * plain face-turn solution is the part that makes replay work.
 */

/**
 * Play a move list through the engine and hand back exactly what the server would
 * receive: the moves serialized to the `smart_turns` string and parsed back out.
 * Going through the wire format rather than building turn objects directly is the
 * point, since that round trip is where a shape mismatch would hide.
 */
function record(moves: string[], dimension = 3) {
	const pieces = buildCubePieces(dimension);
	const recorded: { turn: string; completedAt: number }[] = [];
	let t = 0;

	for (const token of moves) {
		for (const move of parseVirtualScramble(token)) {
			advanceMove(pieces, move, dimension);
			t += 400;
			recorded.push({ turn: move2str(move, dimension).trim(), completedAt: t });
		}
	}

	const serialized = serializeSmartTurnsCompact(recorded, 0);
	return { turns: parseSmartTurns(serialized), serialized, facelet: getFacelet(pieces, dimension) };
}

describe('virtual cube solve analysis', () => {
	it('produces steps for a plain face-turn solution', () => {
		// A scramble and its exact inverse: a real, if unimaginative, solve. Every
		// token is a face turn, which is the shape the analyzer was written for.
		const scramble = "R U R' U' F";
		const solution = ["F'", 'U', 'R', "U'", "R'"];

		const played = record([scramble, ...solution]);
		expect(played.facelet).toBe(SOLVED_FACELET);
		// The wire format is what the server actually stores and re-reads, so pin it.
		expect(played.serialized).toBe(
			"R@400 U@800 R'@1200 U'@1600 F@2000 F'@2400 U@2800 R@3200 U'@3600 R'@4000"
		);

		// The result is an object keyed by step name, not an array, carrying the
		// method it settled on under __method.
		const steps = getSolveSteps(played.turns, scramble, 'cfop') as Record<string, any>;
		expect(steps.__method).toBe('cfop');
		expect(Object.keys(steps).length).toBeGreaterThan(1);
	});

	it('survives a solution containing rotations', () => {
		// x/y/z come from the T, Y, N, B, P, Q, A and ';' keys and are ordinary moves
		// on the virtual cube. Nothing here may throw.
		const scramble = 'R U';
		const played = record([scramble, 'y', "U'", "y'", "R'"]);
		expect(played.facelet).toBe(SOLVED_FACELET);

		expect(() => getSolveSteps(played.turns, scramble, 'cfop')).not.toThrow();
	});

	it('survives a solution containing wide and slice moves', () => {
		// Rw comes from U/M, M from the '.', X, 5 and 6 keys.
		const scramble = 'R U';
		const turns = parseSmartTurns("U'@400 Rw@800 M'@1200 R'@1600");
		expect(turns).toHaveLength(4);

		expect(() => getSolveSteps(turns, scramble, 'cfop')).not.toThrow();
	});

	it('breaks down a solve through wide and inner-layer turns as move2str writes them', () => {
		// "Rw" and "2-2Rw" (the middle layer of a 3x3) are exactly what move2str emits.
		// cubejs rejects both and the engine used to skip them, so the replay drifted and
		// the last phases never came. The scramble below is the solution undone.
		const scramble = "M' U2 M r U' r'";
		const turns = parseSmartTurns("Rw@400 U@800 Rw'@1200 2-2Rw@1600 U2@2000 2-2Rw'@2400");

		// endedSolved false: the scramble start alone has to carry it, so this passes only
		// when the moves are really applied (the derived start would skip them both ways).
		const steps = getSolveSteps(turns, scramble, 'cfop', undefined, { endedSolved: false }) as Record<string, any>;
		expect(steps.pll).toBeTruthy();
	});

	it('degrades to empty steps rather than throwing on nonsense', () => {
		// A move nothing can parse is skipped, so the solve still gets a (thin) breakdown
		// and stays saveable. Only an engine failure returns null, which callers treat as
		// "keep whatever steps are already there".
		const steps = getSolveSteps(parseSmartTurns('NOT_A_MOVE@100'), 'R U', 'cfop') as Record<
			string,
			any
		>;
		expect(steps).toBeTruthy();
		expect(steps.__method).toBeTruthy();
	});

	it('handles an empty move list', () => {
		expect(() => getSolveSteps([], 'R U', 'cfop')).not.toThrow();
	});
});
