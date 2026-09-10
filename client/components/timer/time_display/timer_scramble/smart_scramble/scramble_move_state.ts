import type {MatchStatus} from '../../../../../util/smart_cube/solve_engine';

/**
 * Display state for the smart-cube scramble move list.
 *
 * Everything here is derived from position alone — no memory of what happened
 * last render. That is deliberate and it is what makes the display robust: the
 * engine republishes older status arrays on every deviation and clears the array
 * outright when the scramble completes, so any code that tried to remember "this
 * move was just finished" had to defend against progress running backwards. A
 * function of the current position has nothing to get out of sync.
 */

/**
 * How many moves are done. The engine always emits a prefix of 'perfect', then
 * at most one 'half', then 'pending' — but counting leading entries rather than
 * filtering keeps this correct even if that ever stops holding.
 */
export function doneCount(matchStatus: MatchStatus[]): number {
	let n = 0;
	while (n < matchStatus.length && matchStatus[n] === 'perfect') n++;
	return n;
}

/**
 * The move the user should turn next, or -1 once the scramble is complete.
 *
 * A half-finished move (they turned R on an R2) stays the current one, which
 * falls out of "first entry that is not perfect" without a special case.
 */
export function currentMoveIndex(matchStatus: MatchStatus[], total: number): number {
	const done = doneCount(matchStatus);
	return done >= total ? -1 : done;
}

export type MoveDisplayState = 'past' | 'current' | 'upcoming';

/**
 * Where a move sits relative to the user's progress. Purely positional — the
 * match colour (green / blue / orange) is a separate axis handled by the caller.
 */
export function moveDisplayState(index: number, current: number): MoveDisplayState {
	if (current < 0) return 'past'; // scramble complete: everything is behind us
	if (index < current) return 'past';
	if (index === current) return 'current';
	return 'upcoming';
}
