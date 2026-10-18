import {normalizeHalfTurns, cleanAlgorithmForCubing, algToId, mergeAUFEdges} from '../algorithm_engine';

describe('normalizeHalfTurns', () => {
	it('drops the prime from single half turns', () => {
		expect(normalizeHalfTurns("U2' x R2' D2' R U R' D2' R U' R x' U'")).toBe(
			"U2 x R2 D2 R U R' D2 R U' R x' U'"
		);
	});

	it('handles wide moves, lowercase wide, slices and rotations', () => {
		expect(normalizeHalfTurns("Rw2' r2' M2' E2' S2' x2' y2' z2' 3Rw2'")).toBe(
			'Rw2 r2 M2 E2 S2 x2 y2 z2 3Rw2'
		);
	});

	it('keeps quarter turns and plain half turns as they are', () => {
		expect(normalizeHalfTurns("R U R' U' F2 B2")).toBe("R U R' U' F2 B2");
	});

	it('keeps groups: (R U)2\' is the inverse of (R U)2, not the same sequence', () => {
		expect(normalizeHalfTurns("(R U)2' F")).toBe("(R U)2' F");
	});

	it('handles moves inside and next to parentheses', () => {
		expect(normalizeHalfTurns("(R2' U) (U2')")).toBe('(R2 U) (U2)');
	});

	it('leaves SQ1 and empty input alone', () => {
		expect(normalizeHalfTurns('/ (3,0) / (-2,1) /')).toBe('/ (3,0) / (-2,1) /');
		expect(normalizeHalfTurns('')).toBe('');
	});

	// Owner decision: only computed sequences are normalized. A stored U2' is a finger trick
	// direction hint and stays as written wherever the stored algorithm is shown.
	it('is NOT applied by cleanAlgorithmForCubing (stored algorithm, smart cube move list)', () => {
		expect(cleanAlgorithmForCubing("R U2' R' U'2 Rw2'")).toBe("R U2' R' U2' r2'");
	});

	it('does not touch the stored string used for ids', () => {
		// Display only: the id of an algorithm written with U2' must not change.
		expect(algToId("R U2' R'")).toBe('R-U2p-Rp');
	});
});

describe('mergeAUFEdges (random AUF)', () => {
	// Stand-in for the cubing.js simplifier: merges two U-layer moves, normalizes everything it
	// sees (like cubing.js, which writes every U2' as U2).
	const amount: Record<string, number> = {U: 1, "U'": 3, U2: 2, "U2'": 2};
	const write = ['', 'U', 'U2', "U'"];
	const fakeSimplify = (alg: string) => {
		const [a, b] = alg.split(' ');
		if (a in amount && b in amount) return write[(amount[a] + amount[b]) % 4];
		return normalizeHalfTurns(alg);
	};

	it('merges the AUF into the first move and keeps the stored moves as written', () => {
		expect(mergeAUFEdges(['U', 'U', "R2'", "U2'", 'F'], true, false, fakeSimplify)).toEqual(['U2', "R2'", "U2'", 'F']);
	});

	it('cancels an AUF that undoes the first move', () => {
		expect(mergeAUFEdges(["U'", 'U', "R2'", 'F'], true, false, fakeSimplify)).toEqual(["R2'", 'F']);
	});

	it('keeps a stored first move as written when the AUF does not merge with it', () => {
		// cubing.js would return "U R2" here.
		expect(mergeAUFEdges(['U', "R2'", 'F'], true, false, fakeSimplify)).toEqual(['U', "R2'", 'F']);
	});

	it('merges the post AUF into the last move only', () => {
		expect(mergeAUFEdges(['U', "R2'", "U2'", 'U'], true, true, fakeSimplify)).toEqual(['U', "R2'", "U'"]);
	});

	it("leaves a stored U2' in the middle alone even when both edges merge", () => {
		expect(mergeAUFEdges(['U2', "U2'", 'R', "U2'", 'R', "U'", 'U'], true, true, fakeSimplify)).toEqual(['R', "U2'", 'R']);
	});
});
