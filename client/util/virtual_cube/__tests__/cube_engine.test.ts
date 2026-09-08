import { SOLVED_FACELET } from '../../../../shared/util/solve/facelet_masks';
import { getVirtualProgress } from '../../../../shared/util/solve/virtual_progress';
import { advanceMove, MoveCounter } from '../cube_moves';
import { buildCubePieces } from '../cube_pieces';
import { getFacelet } from '../facelet';
import { generateCubeKeyMapping } from '../key_mapping';
import { matrixVector3Dot } from '../math';
import { isParallelMove, isRotation, move2str } from '../notation';
import { parseVirtualScramble } from '../parse_scramble';
import { getVirtualCubeSize } from '../size';
import { isSolved } from '../solved';
import type { VrcMove } from '../types';

const FINISHED = { animationFinished: true, moveFinished: true };

function apply(pieces: ReturnType<typeof buildCubePieces>, moves: VrcMove[], dim: number) {
	for (const move of moves) {
		advanceMove(pieces, move, dim);
	}
}

function cube(dim: number) {
	return buildCubePieces(dim);
}

describe('virtual cube engine', () => {
	describe('facelet extraction', () => {
		it('reads a solved 3x3 as the canonical solved facelet', () => {
			expect(getFacelet(cube(3), 3)).toBe(SOLVED_FACELET);
		});

		it.each([2, 4, 5, 7])('reads a solved %ix%i as uniform faces', (dim) => {
			const facelet = getFacelet(cube(dim), dim);
			expect(facelet).toHaveLength(6 * dim * dim);
			// Each face must be a single repeated letter, in URFDLB order.
			const faces = 'URFDLB'.split('');
			for (let f = 0; f < 6; f++) {
				const slice = facelet.slice(f * dim * dim, (f + 1) * dim * dim);
				expect(slice).toBe(faces[f].repeat(dim * dim));
			}
		});
	});

	describe('move application', () => {
		it('returns to solved after six sexy moves', () => {
			// (R U R' U') has order 6, so six repetitions is identity and anything
			// fewer is not. Both halves matter: the first proves the moves compose,
			// the second proves they actually change the cube.
			const pieces = cube(3);
			const moves = parseVirtualScramble("R U R' U'");
			expect(moves).toHaveLength(4);

			for (let i = 0; i < 5; i++) {
				apply(pieces, moves, 3);
				expect(getFacelet(pieces, 3)).not.toBe(SOLVED_FACELET);
			}
			apply(pieces, moves, 3);

			expect(getFacelet(pieces, 3)).toBe(SOLVED_FACELET);
		});

		it('is not solved partway through', () => {
			const pieces = cube(3);
			apply(pieces, parseVirtualScramble("R U R' U'"), 3);
			expect(getFacelet(pieces, 3)).not.toBe(SOLVED_FACELET);
		});

		it('a move and its inverse cancel', () => {
			const pieces = cube(3);
			apply(pieces, parseVirtualScramble("R R'"), 3);
			expect(getFacelet(pieces, 3)).toBe(SOLVED_FACELET);
		});

		it('four quarter turns of one face are identity', () => {
			const pieces = cube(4);
			apply(pieces, parseVirtualScramble('R R R R'), 4);
			expect(getFacelet(pieces, 4)).toBe(getFacelet(cube(4), 4));
		});

		it('a whole-cube rotation leaves the cube solved', () => {
			const pieces = cube(3);
			apply(pieces, parseVirtualScramble('x y z'), 3);
			// The facelet string changes because the cube is oriented differently,
			// but solved detection is orientation-agnostic.
			expect(isSolved(pieces, 3, 'n', FINISHED)).toBe(0);
		});
	});

	describe('layer selection', () => {
		// A move touches stickers whose distance along the face normal falls inside
		// the layer window. Counting them is the cheapest way to pin the window
		// arithmetic, which is where an off-by-one would silently turn Rw into R.
		function movedStickerCount(dim: number, move: VrcMove): number {
			const before = cube(dim);
			const after = cube(dim);
			advanceMove(after, move, dim);

			let moved = 0;
			for (let f = 0; f < 6; f++) {
				for (let i = 0; i < before[f].length; i++) {
					if (!before[f][i].logical.equals(after[f][i].logical)) {
						moved++;
					}
				}
			}
			return moved;
		}

		it('an outer face turn moves one layer of stickers', () => {
			// One full face (n^2) plus the ring of n stickers on each of the four
			// adjacent faces.
			expect(movedStickerCount(3, [1, 1, 'R', 1])).toBe(3 * 3 + 4 * 3);
			expect(movedStickerCount(5, [1, 1, 'R', 1])).toBe(5 * 5 + 4 * 5);
		});

		it('a wide turn moves two layers', () => {
			expect(movedStickerCount(4, [1, 2, 'R', 1])).toBe(4 * 4 + 2 * 4 * 4);
		});

		it('an inner slice moves only the slice', () => {
			expect(movedStickerCount(3, [2, 2, 'R', 1])).toBe(4 * 3);
		});

		it('a rotation moves every sticker', () => {
			expect(movedStickerCount(3, [1, 100, 'R', 1])).toBe(6 * 9);
			expect(movedStickerCount(4, [1, 100, 'U', 1])).toBe(6 * 16);
		});
	});

	describe('numeric stability', () => {
		it('logical matrices stay on exact integers after 500 random moves', () => {
			const dim = 4;
			const pieces = cube(dim);
			const faces: VrcMove[2][] = ['U', 'R', 'F', 'D', 'L', 'B'];
			const powers = [1, 2, -1, -2];

			let seed = 12345;
			const rand = (n: number) => {
				// Deterministic LCG so a failure is reproducible.
				seed = (seed * 1103515245 + 12345) & 0x7fffffff;
				return seed % n;
			};

			for (let i = 0; i < 500; i++) {
				const start = 1 + rand(dim - 1);
				const end = start + rand(dim - start + 1);
				advanceMove(pieces, [start, end, faces[rand(6)], powers[rand(4)]], dim);
			}

			for (let f = 0; f < 6; f++) {
				for (const sticker of pieces[f]) {
					for (const value of sticker.logical.elements) {
						expect(Math.abs(value - Math.round(value))).toBeLessThan(1e-9);
					}
				}
			}
		});
	});

	describe('solved detection', () => {
		it('reports 0 for a solved cube at every supported size', () => {
			for (const dim of [2, 3, 4, 5, 6, 7]) {
				expect(isSolved(cube(dim), dim, 'n', FINISHED)).toBe(0);
			}
		});

		it('reports non-zero for a scrambled cube', () => {
			const pieces = cube(3);
			apply(pieces, parseVirtualScramble("R U R' U' F"), 3);
			expect(isSolved(pieces, 3, 'n', FINISHED)).toBeGreaterThan(0);
		});

		it('reports 99 while an animation is in flight', () => {
			expect(isSolved(cube(3), 3, 'n', { animationFinished: false, moveFinished: false })).toBe(99);
		});

		it('never reports solved while moves are still queued', () => {
			// A queued R R' passes through solved between the two moves; stopping the
			// timer there would end the solve on a state the user is only passing through.
			const pieces = cube(3);
			expect(isSolved(pieces, 3, 'n', { animationFinished: true, moveFinished: false })).toBe(1);
		});

		it('detects a solved big cube regardless of orientation', () => {
			const pieces = cube(5);
			apply(pieces, parseVirtualScramble("x y z x' y2"), 5);
			expect(isSolved(pieces, 5, 'n', FINISHED)).toBe(0);
		});
	});

	describe('multi-phase progress', () => {
		it('reports 0 for a solved cube under every method', () => {
			for (const method of ['n', 'cfop', 'fp', 'cf4op', 'cf4o2p2', 'roux'] as const) {
				expect(getVirtualProgress(SOLVED_FACELET, method)).toBe(0);
			}
		});

		it('reports the full ladder height for a scrambled cube', () => {
			const pieces = cube(3);
			apply(pieces, parseVirtualScramble("R U R' U' F' L F R2 D B"), 3);
			const facelet = getFacelet(pieces, 3);

			expect(getVirtualProgress(facelet, 'cfop')).toBe(4);
			expect(getVirtualProgress(facelet, 'cf4op')).toBe(7);
			expect(getVirtualProgress(facelet, 'cf4o2p2')).toBe(9);
			expect(getVirtualProgress(facelet, 'roux')).toBe(4);
			expect(getVirtualProgress(facelet, 'n')).toBe(1);
		});

		it('is orientation-agnostic', () => {
			const pieces = cube(3);
			apply(pieces, parseVirtualScramble("R U R' U'"), 3);
			const upright = getVirtualProgress(getFacelet(pieces, 3), 'cf4op');

			apply(pieces, parseVirtualScramble("x y' z2"), 3);
			expect(getVirtualProgress(getFacelet(pieces, 3), 'cf4op')).toBe(upright);
		});
	});

	describe('scramble parsing', () => {
		it('parses plain face turns', () => {
			expect(parseVirtualScramble("R U' F2")).toEqual([
				[1, 1, 'R', 1],
				[1, 1, 'U', -1],
				[1, 1, 'F', 2],
			]);
		});

		it('parses wide moves', () => {
			expect(parseVirtualScramble('Rw')).toEqual([[1, 2, 'R', 1]]);
			expect(parseVirtualScramble('3Rw')).toEqual([[1, 3, 'R', 1]]);
			expect(parseVirtualScramble('r')).toEqual([[1, 2, 'R', 1]]);
		});

		it('parses an explicit layer range', () => {
			// This is the case the shared tokenizer used to drop: coercing "3-4"
			// straight to a number yields 0 and falls through to the wide default.
			expect(parseVirtualScramble('3-4Rw2')).toEqual([[3, 4, 'R', 2]]);
		});

		it('parses rotations as spanning every layer', () => {
			expect(parseVirtualScramble('x')).toEqual([[1, 100, 'R', 1]]);
			expect(parseVirtualScramble("y'")).toEqual([[1, 100, 'U', -1]]);
			expect(parseVirtualScramble('z2')).toEqual([[1, 100, 'F', 2]]);
		});

		it('decomposes slice moves into two turns', () => {
			const moves = parseVirtualScramble('M');
			expect(moves).toHaveLength(2);
			expect(moves[0][2]).toBe('L');
			expect(moves[1][2]).toBe('L');
		});

		it('returns nothing for a blank scramble', () => {
			expect(parseVirtualScramble('')).toEqual([]);
			expect(parseVirtualScramble('   ')).toEqual([]);
		});
	});

	describe('notation', () => {
		it('renders face turns', () => {
			expect(move2str([1, 1, 'R', 1], 3).trim()).toBe('R');
			expect(move2str([1, 1, 'R', -1], 3).trim()).toBe("R'");
			expect(move2str([1, 1, 'R', 2], 3).trim()).toBe('R2');
		});

		it('renders wide and ranged turns', () => {
			expect(move2str([1, 2, 'R', 1], 4).trim()).toBe('Rw');
			expect(move2str([1, 3, 'R', 1], 5).trim()).toBe('3Rw');
			expect(move2str([2, 3, 'R', 1], 5).trim()).toBe('2-3Rw');
		});

		it('renders rotations as x/y/z with the direction of the opposite face mirrored', () => {
			expect(move2str([1, 3, 'U', 1], 3).trim()).toBe('y');
			expect(move2str([1, 3, 'R', 1], 3).trim()).toBe('x');
			expect(move2str([1, 3, 'F', 1], 3).trim()).toBe('z');
			// D, L and B span the same axes but turn the opposite way.
			expect(move2str([1, 3, 'D', 1], 3).trim()).toBe("y'");
			expect(move2str([1, 3, 'L', 1], 3).trim()).toBe("x'");
			expect(move2str([1, 3, 'B', 1], 3).trim()).toBe("z'");
		});

		it('classifies rotations', () => {
			expect(isRotation([1, 3, 'U', 1], 3)).toBe(true);
			expect(isRotation([1, 100, 'U', 1], 3)).toBe(true);
			expect(isRotation([1, 2, 'U', 1], 3)).toBe(false);
			expect(isRotation([2, 2, 'R', 1], 3)).toBe(false);
		});

		it('classifies parallel moves', () => {
			expect(isParallelMove([1, 1, 'R', 1], [1, 1, 'L', 1])).toBe(true);
			expect(isParallelMove([1, 1, 'U', 1], [1, 1, 'D', 1])).toBe(true);
			expect(isParallelMove([1, 1, 'R', 1], [1, 1, 'U', 1])).toBe(false);
		});
	});

	describe('key mapping', () => {
		it('has exactly 36 keys', () => {
			expect(Object.keys(generateCubeKeyMapping(1, 1, 3))).toHaveLength(36);
		});

		it('maps the six face keys to plain quarter turns on a 3x3', () => {
			const map = generateCubeKeyMapping(1, 1, 3);
			const named = (code: number) => move2str(map[code], 3).trim();

			expect(named(73)).toBe('R'); // I
			expect(named(75)).toBe("R'"); // K
			expect(named(74)).toBe('U'); // J
			expect(named(70)).toBe("U'"); // F
			expect(named(72)).toBe('F'); // H
			expect(named(71)).toBe("F'"); // G
			expect(named(68)).toBe('L'); // D
			expect(named(69)).toBe("L'"); // E
			expect(named(83)).toBe('D'); // S
			expect(named(76)).toBe("D'"); // L
			expect(named(87)).toBe('B'); // W
			expect(named(79)).toBe("B'"); // O
		});

		it('maps the rotation keys', () => {
			const map = generateCubeKeyMapping(1, 1, 3);
			const named = (code: number) => move2str(map[code], 3).trim();

			expect(named(186)).toBe('y'); // ;
			expect(named(65)).toBe("y'"); // A
			expect(named(89)).toBe('x'); // Y
			expect(named(84)).toBe('x'); // T, the mirrored spelling of the same turn
			expect(named(78)).toBe("x'"); // N
			expect(named(66)).toBe("x'"); // B
			expect(named(80)).toBe('z'); // P
			expect(named(81)).toBe("z'"); // Q
		});

		it('widens the R and L families with the slice offsets', () => {
			const base = generateCubeKeyMapping(1, 1, 7);
			const wide = generateCubeKeyMapping(2, 3, 7);

			expect(base[73]).toEqual([1, 1, 'R', 1]); // I is R
			expect(wide[73]).toEqual([1, 3, 'R', 1]); // I becomes 3Rw
			expect(base[68]).toEqual([1, 1, 'L', 1]); // D is L
			expect(wide[68]).toEqual([1, 2, 'L', 1]); // D becomes Lw
		});
	});

	describe('move counter', () => {
		it('ignores rotations and collapses repeated faces', () => {
			const counter = new MoveCounter();
			counter.count([1, 1, 'R', 1], 3);
			counter.count([1, 1, 'R', -1], 3); // same face, collapses
			counter.count([1, 1, 'U', 1], 3);
			expect(counter.value()).toBe(2);
		});

		it('lets a rotation swallow the next turn of the same face', () => {
			// A rotation does not increment, but it does overwrite `lastMove`, so a
			// turn of the face it happens to name is then read as a repeat and is
			// not counted either. That is cstimer's behaviour (twistynnn.js:576-581),
			// quirk included, and it is what the reported move count is built on.
			const counter = new MoveCounter();
			counter.count([1, 3, 'U', 1], 3); // y rotation, not counted
			counter.count([1, 1, 'U', 1], 3); // U, swallowed as a repeat of 'U'
			expect(counter.value()).toBe(0);

			counter.count([1, 1, 'R', 1], 3); // different face, counted
			expect(counter.value()).toBe(1);
		});

		it('clears before returning, so a clearing read is always zero', () => {
			// moveCnt(true) zeroes first and returns the fresh value; callers that
			// want the total read it without the flag. twistynnn.js:582-588.
			const counter = new MoveCounter();
			counter.count([1, 1, 'R', 1], 3);
			expect(counter.value()).toBe(1);
			expect(counter.value(true)).toBe(0);
			expect(counter.value()).toBe(0);
		});

		it('starts a fresh run after clearing', () => {
			const counter = new MoveCounter();
			counter.count([1, 1, 'R', 1], 3);
			counter.value(true);
			counter.count([1, 1, 'R', 1], 3);
			expect(counter.value()).toBe(1);
		});
	});

	describe('cube size resolution', () => {
		it('resolves standalone cube types', () => {
			expect(getVirtualCubeSize('222')).toBe(2);
			expect(getVirtualCubeSize('333')).toBe(3);
			expect(getVirtualCubeSize('333cfop')).toBe(3);
			expect(getVirtualCubeSize('444yau')).toBe(4);
			expect(getVirtualCubeSize('777')).toBe(7);
		});

		it('resolves WCA events through the subset', () => {
			expect(getVirtualCubeSize('wca', '333')).toBe(3);
			expect(getVirtualCubeSize('wca', '444')).toBe(4);
			expect(getVirtualCubeSize('wca', '333oh')).toBe(3);
			expect(getVirtualCubeSize('wca')).toBe(3);
		});

		it('refuses non-NxN puzzles', () => {
			expect(getVirtualCubeSize('pyram')).toBeNull();
			expect(getVirtualCubeSize('sq1')).toBeNull();
			expect(getVirtualCubeSize('clock')).toBeNull();
			expect(getVirtualCubeSize('wca', 'minx')).toBeNull();
			expect(getVirtualCubeSize('some_custom_type')).toBeNull();
		});
	});

	describe('sticker geometry', () => {
		it('builds 6n^2 stickers', () => {
			for (const dim of [2, 3, 7]) {
				const pieces = buildCubePieces(dim);
				expect(pieces).toHaveLength(6);
				for (const face of pieces) {
					expect(face).toHaveLength(dim * dim);
				}
			}
		});

		it('places every sticker on its own face at distance `dimension`', () => {
			const dim = 3;
			const pieces = buildCubePieces(dim);
			const normals = [
				{ x: 0, y: 1, z: 0 }, // U
				{ x: 1, y: 0, z: 0 }, // R
				{ x: 0, y: 0, z: 1 }, // F
				{ x: 0, y: -1, z: 0 }, // D
				{ x: -1, y: 0, z: 0 }, // L
				{ x: 0, y: 0, z: -1 }, // B
			];

			for (let f = 0; f < 6; f++) {
				for (const sticker of pieces[f]) {
					expect(matrixVector3Dot(sticker.logical, normals[f] as any)).toBeCloseTo(dim, 9);
				}
			}
		});
	});
});
