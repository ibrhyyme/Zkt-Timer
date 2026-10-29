import { bestHolding, framesAlongTokens, reconstructWithRotations, splitTurnsBySteps } from '../rotation_reconstruction';

/** "R@0 L'@50" style input, the compact smart_turns spelling. */
function seq(s: string) {
	return s
		.split(' ')
		.filter(Boolean)
		.map((p) => {
			const [turn, t] = p.split('@');
			return { turn, completedAt: Number(t) };
		});
}

const moves = (turns: string, rotations = '', holding = '') =>
	reconstructWithRotations(seq(turns), seq(rotations), holding)
		.map((k) => k.move)
		.join(' ');

describe('reconstructWithRotations', () => {
	it('keeps plain face turns as they are with no rotation and no holding', () => {
		expect(moves("R@0 U@100 R'@200 U'@300")).toBe("R U R' U'");
	});

	it('reads core turns through the holding rotation', () => {
		// z2 holding: the core R face is on the solver's left (FACE_TRANSFORM z2).
		expect(moves('R@0 U@100', '', 'z2')).toBe('L D');
		// x holding: the core U face is at the back.
		expect(moves('U@0', '', 'x')).toBe('B');
	});

	it('moves the solver frame on after a rotation', () => {
		// After y the core R face is at the front.
		expect(moves('R@0 R@1000', 'y@500')).toBe('R y F');
	});

	it('writes rotations about the solver\'s axes, not the core\'s', () => {
		// Held z2, a turn about the core R axis is a turn about the solver's L axis: x'.
		expect(moves('', 'x@0', 'z2')).toBe("x'");
	});

	it('builds slices from a face pair and the core rotation', () => {
		expect(moves("R@0 L'@60", "x'@150")).toBe('M');
		expect(moves("L@0 R'@60", 'x@150')).toBe("M'");
		expect(moves("U@0 D'@60", "y'@150")).toBe('E');
		expect(moves("F'@0 B@60", 'z@150')).toBe('S');
	});

	it('builds wide moves from one face and the core rotation', () => {
		expect(moves('L@0', 'x@120')).toBe('r');
		// 150 ms between the face and the rotation, as measured for r' on a GAN i4.
		expect(moves("L'@0", "x'@150")).toBe("r'");
		expect(moves('D@0', 'y@100')).toBe('u');
		expect(moves('B@0', 'z@100')).toBe('f');
	});

	it('keeps a turn and a later whole-cube rotation apart', () => {
		expect(moves('U@0', "y'@400")).toBe("U y'");
	});

	it('reads two opposite faces turned together as a slice without the gyro', () => {
		// A fast M2 as a GAN i4 reports it: four faces inside 65 ms, the gyro saw none of it.
		// The M2 took the core D centre to the top, so the solver's U turn arrives as D.
		expect(moves("L@0 R'@0 L@65 R'@66 D@150")).toBe('M2 U');
		// The slice moved the core: the U turn after an M is read through the new frame.
		expect(moves("R@0 L'@10 F@300")).toBe('M D');
	});

	it('takes a slower pair as a slice only when the gyro saw it', () => {
		// 90 ms apart: past timing alone. The detector stamps a confirmed slice at its second face.
		expect(moves("L'@0 R@90 U@400", "x'@90")).toBe('M F');
		expect(moves("L'@0 R@90 U@400")).toBe("L' R U");
	});

	it('pairs the faces the way the detector does', () => {
		// An M2 as L' R (90 ms) then R L' (36 ms), both halves confirmed: one M2, not L' R M.
		expect(moves("L'@0 R@90 R@90 L'@126 D@300", "x'@90 x'@126")).toBe('M2 U');
	});

	it('does not count a slice\'s gyro rotation a second time', () => {
		// After M the core U centre faces the solver.
		expect(moves("R@0 L'@10 U@400", "x'@120")).toBe('M F');
		// A half turn of the gyro covers both halves of an M2.
		expect(moves("L@0 R'@0 L@65 R'@66 D@400", 'x2@100')).toBe('M2 U');
	});

	it('tidies repeated face turns the way the plain rows do', () => {
		expect(moves("U@0 U@100 F'@200 F'@300 R@400 R'@500")).toBe('U2 F2');
	});

	it('does not tidy across a step boundary', () => {
		const tokens = reconstructWithRotations(seq('U@0 U@100'), [], '', [0, 1]);
		expect(tokens.map((k) => k.move)).toEqual(['U', 'U']);
	});

	it('takes a part that lands just after the rotation', () => {
		expect(moves("R@0 L'@250", "x'@100")).toBe('M');
	});

	it('does not merge across a turn on another axis', () => {
		expect(moves('L@0 U@100', 'x@200')).toBe('L U x');
	});

	it('does not merge parts too far from the rotation', () => {
		expect(moves('L@0', 'x@2000')).toBe('L x');
	});

	it('combines adjacent rotations about one axis, but keeps a rotation and its undo', () => {
		expect(moves('R@0 R@1000', 'y@200 y@400')).toBe('R y2 L');
		// Turned to look and back: two rotations the replay must show.
		expect(moves('R@0 R@1000', "y@200 y'@400")).toBe("R y y' R");
	});

	it('maps the merged move ranges back to the raw turns', () => {
		const tokens = reconstructWithRotations(seq("U@0 R@100 L'@160 F@400"), seq("x'@250"));
		expect(tokens.map((k) => [k.move, k.rawStart, k.rawEnd])).toEqual([
			['U', 0, 1],
			['M', 1, 3],
			// M turns like L, taking the front centre down: the core F face is now at the bottom.
			['D', 3, 4],
		]);
	});
});

describe('framesAlongTokens', () => {
	const along = (turns: string, rotations = '') => {
		const tokens = reconstructWithRotations(seq(turns), seq(rotations));
		return { moves: tokens.map((k) => k.move), frames: framesAlongTokens(tokens) };
	};

	it('gives a rotation a position of its own', () => {
		const { moves: m, frames } = along('R@0 R@1000', 'y@500');
		expect(m).toEqual(['R', 'y', 'F']);
		expect(frames.map((f) => f.F)).toEqual(['F', 'F', 'R', 'R']);
	});

	it('turns the frame with a slice and with a wide move', () => {
		// M takes the core F centre down; r (L x) takes it up.
		expect(along("R@0 L'@10 U@300").frames[1].D).toBe('F');
		expect(along('L@0', 'x@120').frames[1].U).toBe('F');
	});

	it('keeps the raw turns behind every token for the replay', () => {
		const tokens = reconstructWithRotations(seq("L@0 R'@0 L@65 R'@66 D@150 D@250"), []);
		expect(tokens.map((k) => [k.move, k.raws])).toEqual([
			['M2', [0, 1, 2, 3]],
			['U2', [4, 5]],
		]);
	});
});

describe('bestHolding', () => {
	it('picks the front that turns an S-heavy reading back into M and R/U', () => {
		// An H perm made with the core R/L axis facing the solver reads as S2 U S2 U2...
		// with the plain holding; a y puts that axis on the solver's sides.
		// After the first M2 the solver's top is the core D face; the second one brings U back.
		const hPerm = "F@0 B'@0 F@65 B'@66 D@300 F@600 B'@600 F@665 B'@666 U@900 U@1000";
		const holding = bestHolding(seq(hPerm), []);
		expect(['y', "y'"]).toContain(holding);
		expect(moves(hPerm, '', holding)).toBe('M2 U M2 U2');
	});

	it('keeps the cross holding as the base', () => {
		expect(bestHolding(seq("R@0 U@100 R'@200 U'@300"), [], 'z2').startsWith('z2')).toBe(true);
	});
});

describe('splitTurnsBySteps', () => {
	it('finds the raw range behind each tidied step', () => {
		const raw = ['R', 'R', 'U', "U'", 'F', 'D'];
		// "R R" was stored as R2, "U U'" vanished.
		expect(splitTurnsBySteps(raw, ['R2', 'F', 'D'])).toEqual([
			[0, 4],
			[4, 5],
			[5, 6],
		]);
	});

	it('gives up when the steps do not cover the turns', () => {
		expect(splitTurnsBySteps(['R', 'U'], ['R'])).toBeNull();
		expect(splitTurnsBySteps(['R', 'U'], ['F', 'U'])).toBeNull();
	});
});
