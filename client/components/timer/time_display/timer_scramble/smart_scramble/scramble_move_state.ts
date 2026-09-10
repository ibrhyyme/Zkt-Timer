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

/**
 * Build a status array for any move sequence the user is working through, from
 * just "how many are done" plus an optional verdict on the move they are on.
 *
 * The scramble gets its array straight from the solve engine. Other sequences (an
 * algorithm being drilled in the trainer) only know a done count, so this lets them
 * feed the same move list and get the same display without a second implementation.
 *
 * `currentTone` marks the move in progress: 'half' when it is partly done (turned R
 * on an R2), 'wrong' when the user has gone off the sequence at that point.
 */
export function sequenceMatchStatus(
	total: number,
	done: number,
	currentTone?: 'half' | 'wrong'
): MatchStatus[] {
	const status: MatchStatus[] = [];
	for (let i = 0; i < total; i++) {
		if (i < done) status.push('perfect');
		else if (i === done && currentTone) status.push(currentTone);
		else status.push('pending');
	}
	return status;
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
