/**
 * Notation normalisation for the phase engine.
 *
 * The virtual cube stores wide turns as "Rw" and the middle layer of a 3x3 as the
 * layer range "2-2Rw" (client/util/virtual_cube/notation.ts move2str). cubejs
 * rejects both, and the engine skipped every rejected move, so one such turn
 * desynchronised the whole replay.
 */

import Cube from 'cubejs';
import { analyzePhases } from '../phase_engine';
import { normalizeMove } from '../notation';
import { startStateFromSolvedEnd } from '../start_state';

describe('normalizeMove', () => {
	const cases: Array<[string, string]> = [
		['R', 'R'],
		["R'", "R'"],
		['R2', 'R2'],
		["R2'", 'R2'],
		["R'2", 'R2'],
		['Rw', 'r'],
		["Rw'", "r'"],
		['Rw2', 'r2'],
		['2Rw', 'r'],
		['2-2Rw', "M'"],
		["2-2Rw'", 'M'],
		['2-2Rw2', 'M2'],
		['2-2Lw', 'M'],
		['2-2Uw', "E'"],
		['2-2Dw', 'E'],
		['2-2Fw', 'S'],
		["2-2Bw", "S'"],
		['3Rw', 'x'],
		["3Uw'", "y'"],
		['3Fw2', 'z2'],
		['x', 'x'],
		[' U ', 'U'],
		['’', "'"],
	];

	for (const [input, expected] of cases) {
		it(`${JSON.stringify(input)} -> ${JSON.stringify(expected)}`, () => {
			expect(normalizeMove(input)).toBe(expected);
		});
	}

	it('every face turn it produces is one cubejs accepts', () => {
		const cube = new Cube();
		for (const [input] of cases.slice(0, 22)) {
			expect(() => cube.move(normalizeMove(input))).not.toThrow();
		}
	});

	it('an inner-layer turn matches the equivalent slice on the cube', () => {
		const viaRange = new Cube();
		viaRange.move(normalizeMove('2-2Rw'));
		// The middle layer turned the way R turns is M' (M follows L): M' = R' L x.
		const viaSlice = new Cube();
		viaSlice.move("R' L x");
		expect(viaRange.asString()).toBe(viaSlice.asString());
	});
});

describe('phase engine with virtual cube notation', () => {
	it('keeps the replay in step through wide and slice turns', () => {
		// A solve whose moves only make sense if "Rw" and "2-2Rw" are applied.
		const solution = "Rw U R' 2-2Rw U2 Rw' F R U' R'".split(' ');
		const turns = solution.map((turn, i) => ({ turn, timestamp: 1000 + i * 200 }));
		const start = startStateFromSolvedEnd(turns);
		const result = analyzePhases(turns, start, { method: 'cfop' });
		expect(result.finalProgress).toBe(0);
		expect(result.totalMoves.htm).toBeGreaterThan(0);
	});
});
