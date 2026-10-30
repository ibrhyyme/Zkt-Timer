import { detectCubeRotations, GyroSample } from '../gyro_rotations';
import { bestHolding, reconstructWithRotations } from '../rotation_reconstruction';
import { decodeGyroSamples } from '../gyro_codec';
import { parseSmartTurns } from '../parse_turns';
import capture from './fixtures/gani4_rotation_protocol.json';
import zperm from './fixtures/gani4_zperm_solve.json';

/** Device-frame sample of a rotation about a frame axis (+X = R, +Y = U, +Z = F), see fromDevice. */
function sample(t: number, axis: 'x' | 'y' | 'z', deg: number): GyroSample {
	const h = (deg * Math.PI) / 360;
	const s = Math.sin(h);
	// Frame (x, y, z) is device (x, z, -y), so the device quaternion is (x, -z, y).
	const f = { x: axis === 'x' ? s : 0, y: axis === 'y' ? s : 0, z: axis === 'z' ? s : 0 };
	return { t, w: Math.cos(h), x: f.x, y: -f.z, z: f.y };
}

/** A cube held still, turned to `deg` over 300 ms, then held still again; 10 Hz like a GAN i4. */
function sweep(axis: 'x' | 'y' | 'z', deg: number): GyroSample[] {
	const out: GyroSample[] = [];
	for (let t = 0; t <= 3000; t += 100) {
		const k = Math.min(1, Math.max(0, (t - 1000) / 300));
		out.push(sample(t, axis, deg * k));
	}
	return out;
}

describe('detectCubeRotations', () => {
	it('reads a clockwise quarter turn about R as x, and its inverse as x\'', () => {
		expect(detectCubeRotations(sweep('x', -90)).map((r) => r.turn)).toEqual(['x']);
		expect(detectCubeRotations(sweep('x', 90)).map((r) => r.turn)).toEqual(["x'"]);
	});

	it('reads the other axes and half turns', () => {
		expect(detectCubeRotations(sweep('y', -90)).map((r) => r.turn)).toEqual(['y']);
		expect(detectCubeRotations(sweep('z', 90)).map((r) => r.turn)).toEqual(["z'"]);
		// A half turn passes through the quarter on the way: either spelling is the same orientation.
		const half = detectCubeRotations(sweep('y', 180)).map((r) => r.turn).join(' ');
		expect(['y2', 'y y', "y' y'"]).toContain(half);
	});

	it('ignores a tilt that never reaches the next orientation', () => {
		expect(detectCubeRotations(sweep('x', 35))).toEqual([]);
	});

	it('does not take a look at the last layer for a rotation', () => {
		// Lifted 70 degrees and put back within 200 ms: 20 degrees from x', but never settled there.
		const out: GyroSample[] = [];
		for (let t = 0; t <= 3000; t += 100) out.push(sample(t, 'x', t >= 1100 && t <= 1200 ? 70 : 0));
		expect(detectCubeRotations(out)).toEqual([]);
	});

	it('takes a quick rotation for a wide move only with the face turn that makes one', () => {
		// Tilted 70 degrees about R for 200 ms and back: never settled.
		const out: GyroSample[] = [];
		for (let t = 0; t <= 3000; t += 100) out.push(sample(t, 'x', t >= 1100 && t <= 1200 ? 70 : 0));
		// R' next to x' is no wide move (l' is R' x): the look stays a look.
		expect(detectCubeRotations(out, [{ turn: "R'", completedAt: 1150 }])).toEqual([]);
		// R next to x' is l: the quick rule takes it.
		expect(detectCubeRotations(out, [{ turn: 'R', completedAt: 1150 }]).map((r) => r.turn)[0]).toBe("x'");
	});

	it('starts from the first quiet hold, not a stream that opens mid-rotation', () => {
		// Still turning for the first 500 ms, held from then on, then one y at 2.0-2.3 s.
		const out: GyroSample[] = [];
		for (let t = 0; t <= 4000; t += 100) {
			const deg = t < 500 ? 60 * (1 - t / 500) : -90 * Math.min(1, Math.max(0, (t - 2000) / 300));
			out.push(sample(t, 'y', deg));
		}
		const rotations = detectCubeRotations(out);
		expect(rotations.map((r) => r.turn)).toEqual(['y']);
		expect(rotations[0].completedAt).toBeGreaterThanOrEqual(2000);
	});

	it('stamps a rotation when the cube crosses into the new orientation', () => {
		const [r] = detectCubeRotations(sweep('y', -90));
		expect(r.completedAt).toBeGreaterThanOrEqual(1100);
		expect(r.completedAt).toBeLessThanOrEqual(1300);
	});

	it('finds the rotations of the recorded GAN i4 protocol', () => {
		const rotations = detectCubeRotations(capture.gyro);
		const at = (from: number, to: number) =>
			rotations.filter((r) => r.completedAt >= from && r.completedAt < to).map((r) => r.turn).join(' ');
		expect(at(40000, 48000)).toBe("y y'");
		// Up and down twice: back first, then forward, then back home.
		expect(at(48000, 62000)).toBe("x' x x x'");
		// The slice and wide steps, each one rotation in the core frame.
		expect(at(80000, 99000)).toBe("x' x x x'");
		expect(at(100000, 103000)).toBe("y'");
		expect(at(104000, 108000)).toBe("x'");
		// Normal and fast R U R' U': no rotation from the hands' wobble.
		expect(at(70000, 80000)).toBe('');
		expect(at(108000, 124000)).toBe('');
	});
});

describe('slices confirmed by faces and gyro together', () => {
	/** About R for `deg` from 1000 ms on, reaching `reach` of it by 1300 ms and staying there. */
	function lagging(deg: number, reach: number): GyroSample[] {
		const out: GyroSample[] = [];
		for (let t = 0; t <= 2500; t += 90) {
			const k = Math.min(1, Math.max(0, (t - 1000) / 300)) * reach;
			out.push(sample(t, 'x', deg * k));
		}
		return out;
	}

	it('takes a slice the stream never settles on, when its faces say so', () => {
		// The reading stops 35 degrees short of x', as on the Z perm: alone, nothing counts.
		const samples = lagging(90, 55 / 90);
		expect(detectCubeRotations(samples)).toEqual([]);
		const turns = [{ turn: 'R', completedAt: 1000 }, { turn: "L'", completedAt: 1100 }];
		expect(detectCubeRotations(samples, turns)).toEqual([{ turn: "x'", completedAt: 1100 }]);
	});

	it('leaves R and L\' as two moves when the core did not turn', () => {
		const still = lagging(90, 0);
		const turns = [{ turn: 'R', completedAt: 1000 }, { turn: "L'", completedAt: 1050 }];
		expect(detectCubeRotations(still, turns)).toEqual([]);
	});

	it('takes both halves of an M2 the reading jumps straight through', () => {
		const samples = lagging(180, 160 / 180);
		const turns = [
			{ turn: 'R', completedAt: 1000 }, { turn: "L'", completedAt: 1010 },
			{ turn: "L'", completedAt: 1060 }, { turn: 'R', completedAt: 1070 },
		];
		expect(detectCubeRotations(samples, turns).map((r) => r.turn)).toEqual(["x'", "x'"]);
	});
});

describe('a real GAN i4 solve with a fast Z perm', () => {
	it('reads the Z perm whole', () => {
		const turns = parseSmartTurns(zperm.smart_turns);
		const gyro = decodeGyroSamples(zperm.smart_gyro);
		const last = turns[turns.length - 1].completedAt;
		const rotations = detectCubeRotations(gyro.filter((s) => s.t <= last), turns);
		const holding = bestHolding(turns, rotations, 'z2');
		const tokens = reconstructWithRotations(turns, rotations, holding).map((k) => k.move);
		expect(tokens.slice(-11).join(' ')).toBe('U M2 U M2 U M U2 M2 U2 M U');
	});
});

describe('a reconstruction anyone can replay', () => {
	// What a shared solve has to do: the scramble, then the text as written, solves the cube.
	// The scramble is the raw turns undone, so the raw turns solve it by construction.
	const solved = (facelets: string) => [0, 1, 2, 3, 4, 5].every((f) => new Set(facelets.slice(f * 9, f * 9 + 9)).size === 1);
	const undo = (turns: string[]) => turns.slice().reverse().map((t) => (t.endsWith("'") ? t[0] : t.endsWith('2') ? t : `${t}'`)).join(' ');

	it('solves the scramble with the Z perm solve written as the table shows it', () => {
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const Cube = require('cubejs');
		const turns = parseSmartTurns(zperm.smart_turns);
		const gyro = decodeGyroSamples(zperm.smart_gyro);
		const rotations = detectCubeRotations(gyro.filter((s) => s.t <= turns[turns.length - 1].completedAt), turns);
		const holding = bestHolding(turns, rotations, 'z2');
		const text = [holding, ...reconstructWithRotations(turns, rotations, holding).map((k) => k.move)].join(' ');
		const cube = new Cube();
		cube.move(undo(turns.map((t) => t.turn)));
		cube.move(text);
		expect(solved(cube.asString())).toBe(true);
	});
});

describe('the recorded protocol, reconstructed', () => {
	it('puts slice and wide moves back together', () => {
		const turns = capture.moves.map((m) => ({ turn: m.turn, completedAt: m.t }));
		const tokens = reconstructWithRotations(turns, detectCubeRotations(capture.gyro));
		const at = (from: number, to: number) => tokens.filter((k) => k.t >= from && k.t < to).map((k) => k.move).join(' ');
		expect(at(70000, 80000)).toBe("R U R' U'");
		expect(at(80000, 90000)).toBe("M M'");
		expect(at(90000, 99000)).toBe("r r'");
		expect(at(100000, 108000)).toBe('E S');
		// Done after S, with the centres moved: still the R U R' U' the hands made.
		expect(at(108000, 116000)).toBe("R U R' U' R U R' U' R U R' U' R U R' U'");
	});
});
