import { matchScrambleWithCommutative } from '../smart_scramble';

/**
 * What the scramble display paints while a smart cube is being scrambled.
 *
 * Two things used to read as "you made a mistake" when the user had done nothing wrong,
 * and both sent them to a correction hint that undid a correct move:
 *
 *  - A double move is two quarter turns on the wire. After the first one the move is owed,
 *    not wrong, and anything the user turns in the meantime that commutes with it is fine.
 *  - Opposite faces commute. Turning R2 before L2 leaves the cube in exactly the same
 *    place, so the pair may be done in either order.
 */

function match(expected: string, user: string) {
	return matchScrambleWithCommutative(
		expected.split(' '),
		user.trim() ? user.split(' ') : []
	);
}

describe('scramble matcher — half turns', () => {
	it('marks an unfinished double move as half, not wrong', () => {
		const { matched, matchStatus } = match('D2 F2 R2 L2', 'D2 F2 R');
		expect(matchStatus).toEqual(['perfect', 'perfect', 'half', 'pending']);
		expect(matched).toBe(false);
	});

	it('still credits the next move when it commutes with the unfinished one', () => {
		// R (half of R2) then L2: L2 commutes with R, so the cube is exactly where those two
		// moves put it. This used to paint L2 red and offer to undo it.
		const { matchStatus } = match('D2 F2 R2 L2', 'D2 F2 R L2');
		expect(matchStatus).toEqual(['perfect', 'perfect', 'half', 'perfect']);
	});

	it('completes a double move finished after a commuting turn', () => {
		// R, L2, R is the same cube as R2, L2.
		const { matched, matchStatus } = match('D2 F2 R2 L2', 'D2 F2 R L2 R');
		expect(matchStatus).toEqual(['perfect', 'perfect', 'perfect', 'perfect']);
		expect(matched).toBe(true);
	});

	it('still calls a colliding move wrong after a half turn', () => {
		// U does not commute with R2, so the user really has gone off script.
		const { matchStatus } = match('D2 F2 R2 L2', 'D2 F2 R U');
		expect(matchStatus).toEqual(['perfect', 'perfect', 'half', 'wrong']);
	});
});

describe('scramble matcher — opposite faces in either order', () => {
	it('accepts the second of an opposite pair being turned first', () => {
		// L2 is simply not done yet; it is not a mistake. Both used to go red here.
		const { matched, matchStatus } = match('D2 F2 L2 R2', 'D2 F2 R2');
		expect(matchStatus).toEqual(['perfect', 'perfect', 'pending', 'perfect']);
		expect(matched).toBe(false);
	});

	it('completes the pair whichever way round it was done', () => {
		const { matched, matchStatus } = match('D2 F2 L2 R2', 'D2 F2 R2 L2');
		expect(matchStatus).toEqual(['perfect', 'perfect', 'perfect', 'perfect']);
		expect(matched).toBe(true);
	});

	it('carries on past a reordered pair', () => {
		const { matched } = match('D2 F2 L2 R2 U', 'D2 F2 R2 L2 U');
		expect(matched).toBe(true);
	});

	it('handles a reordered pair at the very start', () => {
		const { matched } = match('F2 B2 U', 'B2 F2 U');
		expect(matched).toBe(true);
	});

	it('does not excuse a move that commutes with nothing outstanding', () => {
		const { matchStatus } = match('D2 F2 R2 L2', 'D2 F2 U');
		expect(matchStatus).toEqual(['perfect', 'perfect', 'wrong', 'wrong']);
	});
});
