import Cube from 'cubejs';
import {
	SOLVED_2X2_FACELETS,
	projectCorners,
	expand2x2Facelets,
	canonical2x2,
	Frame2x2,
	solve2x2,
	isValid2x2Facelets,
} from '../cube2x2';

/** Deterministic, so a failure reproduces. */
function rng(seed: number) {
	let s = seed >>> 0;
	return () => {
		s = (s * 1664525 + 1013904223) >>> 0;
		return s / 0x100000000;
	};
}

const SUFFIXES = ['', "'", '2'];

function randomMoves(random: () => number, faces: string, count: number): string[] {
	return Array.from({ length: count }, () =>
		faces[Math.floor(random() * faces.length)] + SUFFIXES[Math.floor(random() * 3)]
	);
}

function stateAfter(moves: string[], start?: string): string {
	const cube = start ? Cube.fromString(start) : new Cube();
	for (const m of moves) cube.move(m);
	return cube.asString();
}

const ROTATION_SEQUENCES = (() => {
	// All 24 orientations, built independently of the module under test.
	const seen = new Set<string>();
	const out: string[][] = [];
	const queue: string[][] = [[]];
	while (queue.length) {
		const moves = queue.shift()!;
		const key = stateAfter(moves);
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(moves);
		for (const r of ['x', 'y', 'z']) queue.push([...moves, r]);
	}
	return out;
})();

describe('2x2 facelets: projection and the 24-sticker layout', () => {
	it('leaves a solved cube solved', () => {
		expect(projectCorners(SOLVED_2X2_FACELETS)).toBe(SOLVED_2X2_FACELETS);
	});

	// States from smartcube-web-bluetooth's MY22 replay tests (real cube, 24-sticker form).
	// Expanding them must give exactly what cubejs computes for the same turn.
	it.each([
		['R', 'UFUFRRRRFDFDDBDBLLLLUBUB'],
		['U', 'UUUUBBRRRRFFDDDDFFLLLLBB'],
		['F', 'UULLURURFFFFRRDDLDLDBBBB'],
		["U'", 'UUUUFFRRLLFFDDDDBBLLRRBB'],
	])('places the MY22 report after %s on the cubejs corners', (move, reported) => {
		expect(expand2x2Facelets(reported)).toBe(projectCorners(stateAfter([move])));
	});

	it('rejects anything that is not 24 face letters', () => {
		expect(expand2x2Facelets('UUUU')).toBeNull();
		expect(expand2x2Facelets('X'.repeat(24))).toBeNull();
	});
});

describe('2x2 facelets: one spelling per physical state', () => {
	it('maps every orientation of a state to the same string, DBL home', () => {
		const random = rng(7);
		for (let n = 0; n < 20; n++) {
			const state = projectCorners(stateAfter(randomMoves(random, 'URF', 12)));
			for (const rotation of ROTATION_SEQUENCES) {
				const turned = stateAfter(rotation, state);
				expect(canonical2x2(turned)).toBe(state);
			}
		}
	});

	it('is idempotent', () => {
		const random = rng(11);
		const state = stateAfter(randomMoves(random, 'URFDLB', 15));
		expect(canonical2x2(canonical2x2(state))).toBe(canonical2x2(state));
	});

	it('reads any solved orientation as solved', () => {
		for (const rotation of ROTATION_SEQUENCES) {
			expect(canonical2x2(stateAfter(rotation))).toBe(SOLVED_2X2_FACELETS);
		}
	});
});

describe('2x2 solver', () => {
	it('returns nothing to do for a solved cube', () => {
		expect(solve2x2(SOLVED_2X2_FACELETS)).toEqual([]);
	});

	it('solves random states in at most 11 moves, checked with cubejs', () => {
		const random = rng(3);
		for (let n = 0; n < 40; n++) {
			const state = canonical2x2(stateAfter(randomMoves(random, 'URFDLB', 20)));
			const solution = solve2x2(state)!;
			expect(solution).not.toBeNull();
			expect(solution.length).toBeLessThanOrEqual(11);
			expect(solution.every((m) => /^[URF]['2]?$/.test(m))).toBe(true);
			expect(projectCorners(stateAfter(solution, state))).toBe(SOLVED_2X2_FACELETS);
		}
	});

	it('refuses a string that is not a cube', () => {
		expect(solve2x2('nonsense')).toBeNull();
	});
});

describe('2x2 facelets: validity', () => {
	it('accepts every reachable state in every orientation', () => {
		const random = rng(21);
		for (let n = 0; n < 20; n++) {
			const state = stateAfter([...randomMoves(random, 'URFDLB', 15), ...ROTATION_SEQUENCES[n]]);
			expect(isValid2x2Facelets(projectCorners(state))).toBe(true);
		}
	});

	it('rejects a single twisted corner, which no turn makes', () => {
		const twisted = SOLVED_2X2_FACELETS.split('');
		// URF corner: U9, R1, F3 rotated by one.
		[twisted[8], twisted[9], twisted[20]] = ['F', 'U', 'R'];
		expect(isValid2x2Facelets(twisted.join(''))).toBe(false);
	});

	it('rejects a piece that appears twice', () => {
		const doubled = SOLVED_2X2_FACELETS.split('');
		// The UFL slot (U7, F1, L3) shows URF's colours, so URF is there twice.
		[doubled[6], doubled[18], doubled[38]] = ['U', 'R', 'F'];
		expect(isValid2x2Facelets(doubled.join(''))).toBe(false);
	});
});

describe('Frame2x2: reports in a turning frame, rewritten to the DBL frame', () => {
	/**
	 * A cube whose reference is its core reports any of the six faces, and its frame drifts
	 * whenever a layer holding DBL turns. Its own view (the device cube below) is what it would
	 * report as a state. Rewriting every turn and applying it in the DBL frame must land on the
	 * same physical state as that report, found the independent way (rotation search).
	 */
	it('follows a core-frame cube turn by turn', () => {
		const random = rng(42);
		const frame = new Frame2x2();
		const device = new Cube();
		const canonical = new Cube();
		for (const move of randomMoves(random, 'URFDLB', 300)) {
			device.move(move);
			const rewritten = frame.move(move);
			expect(rewritten).toMatch(/^[URF]['2]?$/);
			canonical.move(rewritten);
			expect(projectCorners(canonical.asString())).toBe(canonical2x2(device.asString()));
		}
		expect(frame.rotated).toBe(true);
		// A state report re-derives the same frame it already had.
		const report = device.asString();
		expect(frame.adopt(report)).toBe(projectCorners(canonical.asString()));
	});

	it('picks the frame up from a state report when the cube starts rotated', () => {
		const random = rng(5);
		const frame = new Frame2x2();
		const rotation = ROTATION_SEQUENCES[13];
		const device = Cube.fromString(stateAfter([...rotation, ...randomMoves(random, 'URFDLB', 10)]));
		const canonical = Cube.fromString(frame.adopt(device.asString()));
		for (const move of randomMoves(random, 'URFDLB', 100)) {
			device.move(move);
			canonical.move(frame.move(move));
			expect(projectCorners(canonical.asString())).toBe(canonical2x2(device.asString()));
		}
	});

	it('does not rotate twice for a turn the adopted state already holds', () => {
		const frame = new Frame2x2();
		const device = new Cube();
		// The state report overtakes the D turn's own packet.
		device.move('D');
		const adopted = frame.adopt(device.asString());
		expect(frame.move('D', true)).toBe('U');
		// The next turn is read in the frame the report set up.
		device.move('R');
		const next = Cube.fromString(adopted);
		next.move(frame.move('R'));
		expect(projectCorners(next.asString())).toBe(canonical2x2(device.asString()));
	});

	it('leaves a cube that reports from DBL untouched', () => {
		const random = rng(9);
		const frame = new Frame2x2();
		for (const move of randomMoves(random, 'URF', 50)) {
			expect(frame.move(move)).toBe(move);
		}
		expect(frame.rotated).toBe(false);
	});
});
