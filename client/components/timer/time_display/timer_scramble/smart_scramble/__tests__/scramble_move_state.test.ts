import {
	doneCount,
	currentMoveIndex,
	moveDisplayState,
	sequenceMatchStatus,
} from '../scramble_move_state';
import type {MatchStatus} from '../../../../../../util/smart_cube/solve_engine';

// Shorthand for the shape the engine actually emits: a run of 'perfect', at most
// one 'half', then 'pending' to the end.
function status(done: number, total: number, half = false): MatchStatus[] {
	const out: MatchStatus[] = [];
	for (let i = 0; i < done; i++) out.push('perfect');
	if (half && out.length < total) out.push('half');
	while (out.length < total) out.push('pending');
	return out;
}

describe('doneCount', () => {
	it('counts the leading run of completed moves', () => {
		expect(doneCount(status(0, 5))).toBe(0);
		expect(doneCount(status(3, 5))).toBe(3);
		expect(doneCount(status(5, 5))).toBe(5);
	});

	it('stops at a half move rather than counting past it', () => {
		expect(doneCount(status(2, 5, true))).toBe(2);
	});

	it('handles an empty array', () => {
		expect(doneCount([])).toBe(0);
	});
});

describe('currentMoveIndex', () => {
	it('points at the first move not yet done', () => {
		expect(currentMoveIndex(status(0, 5), 5)).toBe(0);
		expect(currentMoveIndex(status(3, 5), 5)).toBe(3);
	});

	// The user turned R on an R2: the move is started but not finished, so it is
	// still the one they are working on.
	it('keeps a half-finished move as the current one', () => {
		expect(currentMoveIndex(status(2, 5, true), 5)).toBe(2);
	});

	it('returns -1 once every move is done', () => {
		expect(currentMoveIndex(status(5, 5), 5)).toBe(-1);
	});

	// The status array arrives empty before the engine has published anything.
	it('points at the first move when nothing has been published yet', () => {
		expect(currentMoveIndex([], 5)).toBe(0);
	});
});

describe('moveDisplayState', () => {
	it('splits the line into past, current and upcoming', () => {
		expect(moveDisplayState(0, 2)).toBe('past');
		expect(moveDisplayState(1, 2)).toBe('past');
		expect(moveDisplayState(2, 2)).toBe('current');
		expect(moveDisplayState(3, 2)).toBe('upcoming');
	});

	it('treats every move as past once the scramble is complete', () => {
		expect(moveDisplayState(0, -1)).toBe('past');
		expect(moveDisplayState(9, -1)).toBe('past');
	});

	it('marks the very first move current before anything is turned', () => {
		expect(moveDisplayState(0, 0)).toBe('current');
	});
});

describe('sequenceMatchStatus', () => {
	// The trainer used to paint moves itself: done up to matchedMoveCount, then the
	// move in progress red on a wrong turn or orange on a partial one. These pin the
	// conversion so the shared list shows exactly what the trainer showed before.
	it('marks the done moves and leaves the rest pending', () => {
		expect(sequenceMatchStatus(4, 2)).toEqual(['perfect', 'perfect', 'pending', 'pending']);
	});

	it('puts a wrong verdict on the move in progress only', () => {
		expect(sequenceMatchStatus(4, 1, 'wrong')).toEqual(['perfect', 'wrong', 'pending', 'pending']);
	});

	it('puts a partial verdict on the move in progress only', () => {
		expect(sequenceMatchStatus(3, 0, 'half')).toEqual(['half', 'pending', 'pending']);
	});

	it('makes the move in progress the current one, even when it is wrong', () => {
		const status = sequenceMatchStatus(5, 2, 'wrong');
		expect(currentMoveIndex(status, 5)).toBe(2);
	});

	it('treats a fully drilled algorithm as complete', () => {
		const status = sequenceMatchStatus(3, 3);
		expect(status).toEqual(['perfect', 'perfect', 'perfect']);
		expect(currentMoveIndex(status, 3)).toBe(-1);
	});

	it('ignores a verdict once there is no move left to judge', () => {
		expect(sequenceMatchStatus(2, 2, 'wrong')).toEqual(['perfect', 'perfect']);
	});
});
