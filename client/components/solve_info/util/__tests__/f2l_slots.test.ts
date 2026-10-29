import { f2lSlotFaces } from '../f2l_slots';

const steps = ['cross', 'f2l_1'];

describe('f2lSlotFaces', () => {
	it('finds the front-right slot with the cross down: F on the left, R on the right', () => {
		// R U R' takes the FR pair out without breaking the D cross; R U' R' is its insert.
		expect(f2lSlotFaces("R U R'", ['R', "U'", "R'"], [[0, 0], [0, 3]], steps, 'D')).toEqual([
			null,
			{ left: 'F', right: 'R' },
		]);
	});

	it('finds the front-left slot', () => {
		expect(f2lSlotFaces("L' U' L", ["L'", 'U', 'L'], [[0, 0], [0, 3]], steps, 'D')).toEqual([
			null,
			{ left: 'L', right: 'F' },
		]);
	});

	it('mirrors left and right for a cross on top, held upside down', () => {
		// White cross (core U) solved upside down: the core R face is on the solver's left.
		expect(f2lSlotFaces("R' D' R", ["R'", 'D', 'R'], [[0, 0], [0, 3]], steps, 'U')).toEqual([
			null,
			{ left: 'R', right: 'F' },
		]);
	});

	it('gives no slot when a step fills none, and without a cross face', () => {
		expect(f2lSlotFaces("R U R'", ['U', "U'"], [[0, 0], [0, 2]], steps, 'D')).toEqual([null, null]);
		expect(f2lSlotFaces("R U R'", ['R', "U'", "R'"], [[0, 0], [0, 3]], steps, null)).toEqual([null, null]);
	});
});
