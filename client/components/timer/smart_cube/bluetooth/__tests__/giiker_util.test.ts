// Giiker move decoding, pinned against cstimer's `giikercube.js`.
//
// The decoder used to collapse the turn amount to a sign, which silently halved every
// double turn: a "B2" on the cube arrived as "B". Nothing errors when that happens — the
// tracker simply drifts one turn away from the cube and stays there — so it is exactly the
// kind of bug that needs a test rather than a field report.

import GiikerUtil from '../giiker_util';

/** The decoder needs no BLE: it is a pure function of the two nibbles in the packet. */
const decode = (face: number, amount: number): string =>
	new (GiikerUtil as any)(null, null).giikerMoveToAlgMove(face, amount);

describe('Giiker move decoding', () => {
	it('maps the face nibble in cstimer BDLURF order', () => {
		expect(decode(1, 1)).toBe('B');
		expect(decode(2, 1)).toBe('D');
		expect(decode(3, 1)).toBe('L');
		expect(decode(4, 1)).toBe('U');
		expect(decode(5, 1)).toBe('R');
		expect(decode(6, 1)).toBe('F');
	});

	it('decodes quarter turns in both directions', () => {
		expect(decode(5, 1)).toBe('R');
		expect(decode(5, 3)).toBe("R'");
	});

	it('decodes half turns as half turns', () => {
		// The regression: amount 2 and amount 9 both mean a double turn. Reading them as a
		// single turn (or as a single turn the wrong way round) desynced the whole solve.
		expect(decode(5, 2)).toBe('R2');
		expect(decode(5, 9)).toBe('R2');
	});

	it('returns nothing for a face it cannot read', () => {
		// An unreadable packet must not become an empty "turn" in the move stream.
		expect(decode(0, 1)).toBe('');
		expect(decode(7, 1)).toBe('');
	});

	it('never emits a move with whitespace in it', () => {
		// Redux stores turns unpadded; cstimer's table pads a quarter turn with a space.
		for (let face = 1; face <= 6; face++) {
			for (const amount of [1, 2, 3, 9]) {
				expect(decode(face, amount)).not.toMatch(/\s/);
			}
		}
	});
});
