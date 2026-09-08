import { SOLVED_FACELET } from '../../../../shared/util/solve/facelet_masks';
import { parseVirtualScramble } from '../parse_scramble';
import { VirtualCubeScene } from '../scene';
import type { MoveStep, VrcMove } from '../types';

/**
 * Scene tests. No canvas is attached, so `render()` returns early and everything
 * here exercises the queue, the animation stepping and the input dispatch.
 *
 * The animation frame loop is driven by hand rather than by real time, which is
 * the only way to assert the ordering guarantees that make solved detection fire
 * on the right move.
 */

let frameCallbacks: FrameRequestCallback[] = [];
let nextHandle = 1;

beforeEach(() => {
	frameCallbacks = [];
	nextHandle = 1;
	(global as any).requestAnimationFrame = (cb: FrameRequestCallback) => {
		frameCallbacks.push(cb);
		return nextHandle++;
	};
	(global as any).cancelAnimationFrame = () => {
		frameCallbacks = [];
	};
});

/** Run queued frames, advancing the clock so animations actually progress. */
function runFrames(count: number, msPerFrame = 1000) {
	const realNow = Date.now;
	let clock = realNow();
	Date.now = () => clock;

	for (let i = 0; i < count; i++) {
		const pending = frameCallbacks;
		frameCallbacks = [];
		clock += msPerFrame;
		for (const cb of pending) cb(clock);
	}

	Date.now = realNow;
}

function makeScene(dimension = 3, speed = 100) {
	return new VirtualCubeScene({ dimension, getSpeed: () => speed });
}

describe('VirtualCubeScene', () => {
	describe('instant mode (vrcSpeed = 0)', () => {
		it('applies moves with no animation at all', () => {
			const scene = makeScene(3, 0);
			scene.addMoves(parseVirtualScramble("R U R' U'"));

			expect(scene.isMoveFinished()).toBe(true);
			expect(scene.isAnimationFinished()).toBe(true);
			expect(frameCallbacks).toHaveLength(0);
			expect(scene.getFacelet()).not.toBe(SOLVED_FACELET);
		});

		it('reports solved immediately once the cube is solved', () => {
			const scene = makeScene(3, 0);
			scene.addMoves(parseVirtualScramble('R'));
			expect(scene.isSolved('n')).toBe(1);

			scene.addMoves(parseVirtualScramble("R'"));
			expect(scene.isSolved('n')).toBe(0);
		});

		it('announces every move up front, then starts and ends each one', () => {
			const scene = makeScene(3, 0);
			const steps: MoveStep[] = [];
			scene.addMoveListener((_move, step) => steps.push(step));

			scene.addMoves(parseVirtualScramble("R U'"));

			// Both moves are announced (step 0) before either is committed, which is
			// what lets the timer start on the first keypress rather than on the first
			// completed animation. The instant path still walks each move through
			// start (1) and end (2), exactly as twisty.js:495-502 does.
			expect(steps).toEqual([0, 0, 1, 2, 1, 2]);
		});
	});

	describe('animated mode', () => {
		it('queues rather than applying immediately', () => {
			const scene = makeScene(3, 100);
			scene.addMoves(parseVirtualScramble('R'));

			expect(scene.isMoveFinished()).toBe(false);
			expect(scene.isAnimationFinished()).toBe(false);
			expect(scene.getFacelet()).toBe(SOLVED_FACELET); // not committed yet
		});

		it('reports 99 while a move is in flight', () => {
			const scene = makeScene(3, 100);
			scene.addMoves(parseVirtualScramble('R'));
			expect(scene.isSolved('n')).toBe(99);
		});

		it('commits the move once its animation completes', () => {
			const scene = makeScene(3, 100);
			scene.addMoves(parseVirtualScramble('R'));

			runFrames(3);

			expect(scene.isMoveFinished()).toBe(true);
			expect(scene.getFacelet()).not.toBe(SOLVED_FACELET);
			expect(scene.isSolved('n')).toBe(1);
		});

		it('never reports solved between a move and its inverse', () => {
			// This is the reason isSolved consults the queue. R R' passes through a
			// solved state that the solver is only travelling through; stopping the
			// timer there would end the solve on the wrong move.
			const scene = makeScene(3, 100);
			const readings: number[] = [];
			scene.addMoveListener((_m, step) => {
				if (step === 2) readings.push(scene.isSolved('n'));
			});

			scene.addMoves(parseVirtualScramble("R R'"));
			runFrames(6);

			expect(readings).toHaveLength(2);
			expect(readings[0]).toBeGreaterThan(0); // mid-pair, queue not empty
			expect(readings[1]).toBe(0); // genuinely solved at the end
		});

		it('plays a batch one move at a time', () => {
			// A single addMoves call runs startAnimation once, so a batch drains
			// sequentially. Parallelism comes from a second call arriving mid-flight,
			// which is the real keyboard case, covered below.
			const scene = makeScene(3, 100);
			const started: VrcMove[] = [];
			scene.addMoveListener((move, step) => {
				if (step === 1) started.push(move);
			});

			scene.addMoves(parseVirtualScramble('R L'));
			expect(started).toHaveLength(1);
		});

		it('joins a same-axis keypress to the turn already in flight', () => {
			// R and L share an axis, so pressing L while R is still turning starts it
			// in the same frame instead of queueing behind. twisty.js:548.
			const scene = makeScene(3, 100);
			const started: VrcMove[] = [];
			scene.addMoveListener((move, step) => {
				if (step === 1) started.push(move);
			});

			scene.addMoves(parseVirtualScramble('R'));
			scene.addMoves(parseVirtualScramble('L'));

			expect(started).toHaveLength(2);
			expect(scene.isAnimationFinished()).toBe(false);
		});

		it('makes a perpendicular keypress wait its turn', () => {
			const scene = makeScene(3, 100);
			const started: VrcMove[] = [];
			scene.addMoveListener((move, step) => {
				if (step === 1) started.push(move);
			});

			scene.addMoves(parseVirtualScramble('R'));
			scene.addMoves(parseVirtualScramble('U'));

			expect(started).toHaveLength(1);
		});

		it('commits two parallel turns together and ends solved', () => {
			const scene = makeScene(3, 100);
			scene.addMoves(parseVirtualScramble('R'));
			scene.addMoves(parseVirtualScramble('L'));
			runFrames(6);
			scene.addMoves(parseVirtualScramble("R'"));
			scene.addMoves(parseVirtualScramble("L'"));
			runFrames(6);

			expect(scene.isMoveFinished()).toBe(true);
			expect(scene.getFacelet()).toBe(SOLVED_FACELET);
		});

		it('drains a long queue and ends solved', () => {
			const scene = makeScene(3, 100);
			const moves = parseVirtualScramble("R U R' U'");

			for (let i = 0; i < 6; i++) {
				scene.addMoves(moves);
			}
			runFrames(200);

			expect(scene.isMoveFinished()).toBe(true);
			expect(scene.getFacelet()).toBe(SOLVED_FACELET);
			expect(scene.isSolved('n')).toBe(0);
		});
	});

	describe('applyMoves', () => {
		it('is instant regardless of the speed setting', () => {
			const scene = makeScene(3, 1000);
			scene.applyMoves(parseVirtualScramble("R U R' U' F R U"));

			expect(scene.isMoveFinished()).toBe(true);
			expect(scene.getFacelet()).not.toBe(SOLVED_FACELET);
		});

		it('flushes a queue that was already animating', () => {
			const scene = makeScene(3, 100);
			scene.addMoves(parseVirtualScramble('R'));
			scene.applyMoves(parseVirtualScramble("R'"));

			expect(scene.isMoveFinished()).toBe(true);
			expect(scene.getFacelet()).toBe(SOLVED_FACELET);
		});
	});

	describe('keyboard', () => {
		it('turns the cube', () => {
			const scene = makeScene(3, 0);
			scene.keydown(73); // I = R
			scene.keydown(75); // K = R'
			expect(scene.getFacelet()).toBe(SOLVED_FACELET);
		});

		it('passes over modifier combinations so app shortcuts stay reachable', () => {
			const scene = makeScene(3, 0);
			expect(scene.keydown(73, { altKey: true })).toBe(false);
			expect(scene.keydown(73, { ctrlKey: true })).toBe(false);
			expect(scene.getFacelet()).toBe(SOLVED_FACELET);
		});

		it('ignores keys that are not bound', () => {
			const scene = makeScene(3, 0);
			expect(scene.keydown(112)).toBe(false); // F1
		});

		it('moves the camera with the arrow keys and clamps', () => {
			const scene = makeScene(3, 0);
			const before = scene.camera.theta;
			expect(scene.keydown(37)).toBe(true); // left
			expect(scene.camera.theta).toBe(before + 1);

			for (let i = 0; i < 20; i++) scene.keydown(37);
			expect(scene.camera.theta).toBe(6);
		});

		it('shifts the slice offsets and rebuilds the key map', () => {
			const scene = makeScene(7, 0);
			expect(scene.oSr).toBe(1);

			scene.keydown(55); // '7' widens the right offset
			expect(scene.oSr).toBe(2);

			// I now turns two layers instead of one.
			scene.keydown(73);
			const twoLayer = scene.getFacelet();

			const fresh = makeScene(7, 0);
			fresh.addMoves([[1, 2, 'R', 1]]);
			expect(twoLayer).toBe(fresh.getFacelet());
		});

		it('clamps the offsets to the cube size', () => {
			const scene = makeScene(5, 0);
			for (let i = 0; i < 10; i++) scene.keydown(55); // '7'
			expect(scene.oSr).toBe(4); // dimension - 1

			for (let i = 0; i < 10; i++) scene.keydown(56); // '8'
			expect(scene.oSr).toBe(1);
		});

		it('resets both offsets on space', () => {
			const scene = makeScene(7, 0);
			scene.keydown(55);
			scene.keydown(55);
			scene.keydown(52);
			expect(scene.oSr).toBe(3);
			expect(scene.oSl).toBe(2);

			scene.keydown(32); // space
			expect(scene.oSl).toBe(1);
			expect(scene.oSr).toBe(1);
		});
	});

	describe('touch gestures', () => {
		it('resolves a swipe into a move', () => {
			const scene = makeScene(3, 0);
			expect(scene.touchMove(6, 3)).toEqual([1, 1, 'R', 1]); // right edge, upward
			expect(scene.touchMove(3, 6)).toEqual([1, 1, 'R', -1]);
			expect(scene.touchMove(5, 2)).toEqual([1, 3, 'R', 1]); // centre, x rotation
		});

		it('returns null for a gesture with no move', () => {
			expect(makeScene(3, 0).touchMove(1, 1)).toBeNull();
		});

		it('labels every valid target from a cell', () => {
			const labels = makeScene(3, 0).touchLabels(6);
			expect(labels[3]).toBe('R');
			expect(labels[9]).toBe('F');
			expect(Object.keys(labels).length).toBeGreaterThan(4);
		});

		it('tracks the slice offsets', () => {
			const scene = makeScene(7, 0);
			expect(scene.touchMove(6, 3)).toEqual([1, 1, 'R', 1]);
			scene.keydown(55); // widen right offset
			expect(scene.touchMove(6, 3)).toEqual([1, 2, 'R', 1]);
		});
	});

	describe('reset and resize', () => {
		it('reset returns to a solved cube', () => {
			const scene = makeScene(3, 0);
			scene.addMoves(parseVirtualScramble("R U F"));
			expect(scene.getFacelet()).not.toBe(SOLVED_FACELET);

			scene.reset();
			expect(scene.getFacelet()).toBe(SOLVED_FACELET);
			expect(scene.moveCnt()).toBe(0);
		});

		it('setDimension rebuilds at the new size', () => {
			const scene = makeScene(3, 0);
			scene.addMoves(parseVirtualScramble('R'));
			scene.setDimension(5);

			expect(scene.dimension).toBe(5);
			expect(scene.getFacelet()).toHaveLength(6 * 25);
			expect(scene.isSolved('n')).toBe(0);
		});

		it('setDimension to the same size just resets', () => {
			const scene = makeScene(3, 0);
			scene.addMoves(parseVirtualScramble('R'));
			scene.setDimension(3);
			expect(scene.getFacelet()).toBe(SOLVED_FACELET);
		});
	});

	describe('colour visibility', () => {
		it('greys every sticker when hidden and restores on solve', () => {
			const scene = makeScene(3, 0);
			scene.toggleColorVisible(false);
			expect(scene.pieces[0][0].color).toBe(0x7f7f7f);

			scene.toggleColorVisible(true);
			expect(scene.pieces[0][0].color).toBe(0xffffff);
		});

		it('keeps the reachable rings visible on a huge cube', () => {
			const scene = makeScene(9, 0);
			scene.toggleColorVisibleHuge(false, false);

			// The outer ring stays coloured because the slice offsets can reach it.
			expect(scene.pieces[0][0].color).toBe(0xffffff);
			// A deep interior sticker is greyed and loses its outline.
			const middle = scene.pieces[0][4 * 9 + 4];
			expect(middle.color).toBe(0x7f7f7f);
			expect(middle.border).toBe(false);
		});
	});

	describe('move counting', () => {
		it('counts committed turns', () => {
			const scene = makeScene(3, 0);
			scene.addMoves(parseVirtualScramble("R U F"));
			expect(scene.moveCnt()).toBe(3);
		});

		it('skips rotations', () => {
			const scene = makeScene(3, 0);
			scene.addMoves(parseVirtualScramble('R x z'));
			expect(scene.moveCnt()).toBe(1);
		});
	});
});
