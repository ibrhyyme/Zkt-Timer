/**
 * The turns behind replay positions. A position is one table token (or one flat quarter
 * without gyro data); its `move` is the core turns it plays, space separated.
 */

/** The turns one replay position plays: one, several (a gyro token), or none (a rotation). */
export function turnsAt(entry: { move: string }): string[] {
	return entry.move.split(' ').filter(Boolean);
}

/**
 * Every turn from solved to position `idx`: the scramble, then the positions' own turns. The
 * holding is not among them: it is the scene's orientation, and the recorded core turns solve
 * the scramble as it is.
 */
export function turnsUpTo(scramble: string, moves: { move: string }[], idx: number): string[] {
	return [...scramble.split(/\s+/).filter(Boolean), ...moves.slice(0, idx).flatMap(turnsAt)];
}
