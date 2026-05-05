/**
 * cstimer getPrettyMoves port doğrulaması.
 *
 * Test case'leri cstimer'in beklenen output'una göre. Her test case tek seq input
 * (cstimer'in nested rawMoveSeqs[0] ile aynı).
 */

import { getPrettyMoves, getPrettyMovesFromStrings, TimedMove } from '../pretty_moves';

function timed(moves: string[], gapMs = 50): TimedMove[] {
	return moves.map((turn, i) => ({ turn, timestamp: i * gapMs }));
}

describe('getPrettyMoves — same-axis collapse', () => {
	it('R + R = R2', () => {
		expect(getPrettyMoves(timed(['R', 'R']))).toBe('R2');
	});

	it("R + R' = (cancel)", () => {
		expect(getPrettyMoves(timed(['R', "R'"]))).toBe('');
	});

	it("R + R2 = R'", () => {
		expect(getPrettyMoves(timed(['R', 'R2']))).toBe("R'");
	});

	it('R2 + R2 = (cancel)', () => {
		expect(getPrettyMoves(timed(['R2', 'R2']))).toBe('');
	});

	it("R + R + R + R = (cancel via triple-collapse)", () => {
		expect(getPrettyMoves(timed(['R', 'R', 'R', 'R']))).toBe('');
	});

	it("R R2 R' = R2", () => {
		expect(getPrettyMoves(timed(['R', 'R2', "R'"]))).toBe('R2');
	});
});

describe('getPrettyMoves — slice merge (parallel-axis opposite-power)', () => {
	it("R + L' = M", () => {
		expect(getPrettyMoves(timed(['R', "L'"]))).toBe('M');
	});

	it("R' + L = M'", () => {
		expect(getPrettyMoves(timed(["R'", 'L']))).toBe("M'");
	});

	it("L' + R = M (order independent)", () => {
		expect(getPrettyMoves(timed(["L'", 'R']))).toBe('M');
	});

	it('R + L (parallel, same direction) = no slice merge, both kept', () => {
		expect(getPrettyMoves(timed(['R', 'L']))).toBe('R L');
	});

	it("R' + L' (parallel, same direction prime) = no slice merge", () => {
		expect(getPrettyMoves(timed(["R'", "L'"]))).toBe("R' L'");
	});

	it("U + D' = E (cstimer center tracking)", () => {
		// axisM=0, POWER_SIGN[0]=1, powM=(0-1)*1+1=0 → E base
		expect(getPrettyMoves(timed(['U', "D'"]))).toBe('E');
	});

	it("F + B' = S' (cstimer center tracking)", () => {
		// axisM=2, POWER_SIGN[2]=-1, powM=(0-1)*(-1)+1=2 → S'
		expect(getPrettyMoves(timed(['F', "B'"]))).toBe("S'");
	});
});

describe('getPrettyMoves — burst detection (100ms threshold)', () => {
	it('R + L\' within 50ms = M (burst)', () => {
		expect(getPrettyMoves([
			{ turn: 'R', timestamp: 0 },
			{ turn: "L'", timestamp: 50 },
		])).toBe('M');
	});

	it("R + L' across 200ms gap = R L' (burst broken)", () => {
		expect(getPrettyMoves([
			{ turn: 'R', timestamp: 0 },
			{ turn: "L'", timestamp: 200 },
		])).toBe("R L'");
	});

	it("R + L' exactly 100ms = R L' (>100ms condition: strictly greater than)", () => {
		// cstimer: moveSeq[i+1] - moveSeq[i] > 100 → burst broken
		// Tam 100ms: NOT broken, slice merge tetiklenir → "M"
		expect(getPrettyMoves([
			{ turn: 'R', timestamp: 0 },
			{ turn: "L'", timestamp: 100 },
		])).toBe('M');
	});

	it("R + L' at 101ms = R L' (burst broken)", () => {
		expect(getPrettyMoves([
			{ turn: 'R', timestamp: 0 },
			{ turn: "L'", timestamp: 101 },
		])).toBe("R L'");
	});
});

describe('getPrettyMoves — complex sequences', () => {
	it("R U R' (no merge possible) = R U R'", () => {
		expect(getPrettyMoves(timed(['R', 'U', "R'"]))).toBe("R U R'");
	});

	it("R L U' R' L' (no slice — same direction parallel pairs)", () => {
		// R+L: parallel same direction, no merge. R'+L': aynı, no merge. Hepsi pass through.
		expect(getPrettyMoves(timed(['R', 'L', "U'", "R'", "L'"]))).toBe("R L U' R' L'");
	});

	it("R L' U' R' L (cstimer: center tracking sonrasi U' → F')", () => {
		// R + L' = M (slice, center rotate). U' artik F' olarak yorumlanir cstimer'de.
		// R' + L = M' (sonraki slice, center geri donuyor).
		// Cstimer'in birebir output'u — smart cube context'inde kullaniciya garip
		// gorunebilir ama cstimer convention bu.
		expect(getPrettyMoves(timed(['R', "L'", "U'", "R'", 'L']))).toBe("M F' M'");
	});
});

describe('getPrettyMoves — pass-through (non-URFDLB inputs)', () => {
	it('Cube rotations pass through', () => {
		expect(getPrettyMoves(timed(['x', 'R', "R'"]))).toBe('x');
	});

	it('Wide moves pass through', () => {
		expect(getPrettyMoves(timed(['Rw', 'U', 'Rw']))).toBe('Rw U Rw');
	});

	it('Slice moves (already M/E/S) pass through', () => {
		expect(getPrettyMoves(timed(['M', 'U', 'M']))).toBe('M U M');
	});

	it('Empty input', () => {
		expect(getPrettyMoves([])).toBe('');
	});
});

describe('getPrettyMovesFromStrings — backward-compat (no timestamps)', () => {
	it("R R = R2 (timestamps default to 0, all in same burst)", () => {
		expect(getPrettyMovesFromStrings(['R', 'R'])).toBe('R2');
	});

	it("R L' = M", () => {
		expect(getPrettyMovesFromStrings(['R', "L'"])).toBe('M');
	});

	it('Empty array', () => {
		expect(getPrettyMovesFromStrings([])).toBe('');
	});
});
