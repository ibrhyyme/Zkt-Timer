/**
 * HTM counting, as cstimer counts it.
 *
 * cstimer's MoveCounterHTM (recons.js) is fed the move as it lands on the cube's fixed
 * frame (CubieCube.selfMoveStr), so a rotation changes which physical face later turns
 * move, a wide turn is the opposite face plus a rotation, and a slice is its own axis.
 * Smart cubes only report face turns, so for them nothing changes.
 */

import { countHTM, countMoves } from '../move_counter';

const mv = (a: string) => a.trim().split(/\s+/).filter(Boolean);

describe('countHTM — face turns (every smart cube solve)', () => {
	const cases: Array<[string, number]> = [
		['R R', 1],
		['R L', 2],
		['R U R', 3],
		["R U R'", 3],
		["R U R' U'", 4],
		["R L R'", 2],
		['R2 R', 1],
	];
	for (const [moves, htm] of cases) {
		it(`${moves} = ${htm}`, () => {
			expect(countHTM(mv(moves))).toBe(htm);
		});
	}
});

describe('countHTM — rotations, wide turns and slices follow the cube frame', () => {
	it('a turn after a rotation counts on the physical face it moves', () => {
		// After x the face in the B position is the old U face: U then that is one face.
		expect(countHTM(mv('U x B'))).toBe(1);
		expect(countHTM(mv('U B'))).toBe(2);
	});

	it('a wide turn moves the opposite face, so R then Rw is two faces', () => {
		expect(countHTM(mv('R Rw'))).toBe(2);
		expect(countHTM(mv('R r'))).toBe(2);
	});

	it('the virtual cube inner-layer notation counts like the slice it is', () => {
		expect(countHTM(mv('2-2Rw'))).toBe(countHTM(mv("M'")));
		expect(countHTM(mv("M'"))).toBe(1);
	});

	it('rotations alone count nothing', () => {
		expect(countHTM(mv("x y' z2"))).toBe(0);
	});

	it('leaves OBTM, ETM and STM as raw counts', () => {
		const counts = countMoves(mv("R x U Rw M'"));
		expect(counts.obtm).toBe(3);
		expect(counts.etm).toBe(4);
		expect(counts.stm).toBe(4);
	});
});
