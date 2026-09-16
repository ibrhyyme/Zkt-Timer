/**
 * The undo window of a single-solve delete: the local removal happens at once, the server
 * delete waits here, and an undo inside the window cancels it. The rules are pinned
 * without a clock (the queue takes its timer functions) and without LokiJS.
 */

import {createPendingSolveDeleteQueue, SOLVE_DELETE_UNDO_MS} from '../pending-delete';
import {Solve} from '../../../../server/schemas/Solve.schema';

// A hand-rolled clock: the same reason key_release.test.ts has one, jest's modern fake
// timers cannot install on this Node.
let clock = 0;
let nextHandle = 1;
let queued: {handle: number; at: number; fn: () => void}[] = [];

function setTimer(fn: () => void, ms: number) {
	const handle = nextHandle++;
	queued.push({handle, at: clock + ms, fn});
	return handle;
}

function clearTimer(handle: number) {
	queued = queued.filter((t) => t.handle !== handle);
}

function advance(ms: number) {
	const until = clock + ms;
	for (;;) {
		const due = queued.filter((t) => t.at <= until).sort((a, b) => a.at - b.at)[0];
		if (!due) break;
		queued = queued.filter((t) => t !== due);
		clock = due.at;
		due.fn();
	}
	clock = until;
}

function solve(id: string): Solve {
	return {id, time: 12.34, cube_type: '333'} as Solve;
}

function makeQueue(delayMs = SOLVE_DELETE_UNDO_MS) {
	return createPendingSolveDeleteQueue({delayMs, setTimer, clearTimer});
}

beforeEach(() => {
	clock = 0;
	queued = [];
});

describe('the undo window', () => {
	it('holds the server delete back, then sends it once', () => {
		const queue = makeQueue();
		const commit = jest.fn();

		queue.schedule({solve: solve('s1'), commit});
		expect(queue.isPending('s1')).toBe(true);

		advance(SOLVE_DELETE_UNDO_MS - 1);
		expect(commit).not.toHaveBeenCalled();

		advance(1);
		expect(commit).toHaveBeenCalledTimes(1);
		expect(queue.isPending('s1')).toBe(false);
		expect(queue.size()).toBe(0);
	});

	it('cancels the delete on undo and hands the solve back', () => {
		const queue = makeQueue();
		const commit = jest.fn();
		const removed = solve('s1');

		queue.schedule({solve: removed, commit});
		expect(queue.undo('s1')).toBe(removed);

		advance(SOLVE_DELETE_UNDO_MS * 3);
		expect(commit).not.toHaveBeenCalled();
		expect(queue.isPending('s1')).toBe(false);
	});

	it('has nothing to give back once the window has closed', () => {
		const queue = makeQueue();
		const commit = jest.fn();

		queue.schedule({solve: solve('s1'), commit});
		advance(SOLVE_DELETE_UNDO_MS);

		// The press that lands while the toast fades out must not resurrect a solve the
		// server has already been told to delete.
		expect(queue.undo('s1')).toBeNull();
		expect(commit).toHaveBeenCalledTimes(1);
	});

	it('knows nothing about a solve it was never given', () => {
		const queue = makeQueue();
		expect(queue.undo('nope')).toBeNull();
		expect(queue.isPending('nope')).toBe(false);
	});
});

describe('flushing', () => {
	it('sends every waiting delete at once and empties the queue', () => {
		const queue = makeQueue();
		const first = jest.fn();
		const second = jest.fn();

		queue.schedule({solve: solve('s1'), commit: first});
		queue.schedule({solve: solve('s2'), commit: second});
		expect(queue.pendingIds()).toEqual(['s1', 's2']);

		queue.flush();

		expect(first).toHaveBeenCalledTimes(1);
		expect(second).toHaveBeenCalledTimes(1);
		expect(queue.size()).toBe(0);
	});

	it('does not send a flushed delete a second time when its timer would have fired', () => {
		const queue = makeQueue();
		const commit = jest.fn();

		queue.schedule({solve: solve('s1'), commit});
		queue.flush();
		advance(SOLVE_DELETE_UNDO_MS * 2);

		expect(commit).toHaveBeenCalledTimes(1);
	});

	it('leaves nothing pending when one commit throws', () => {
		const queue = makeQueue();
		const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
		const good = jest.fn();

		queue.schedule({
			solve: solve('s1'),
			commit: () => {
				throw new Error('network gone');
			},
		});
		queue.schedule({solve: solve('s2'), commit: good});

		queue.flush();

		expect(good).toHaveBeenCalledTimes(1);
		expect(queue.size()).toBe(0);
		errorSpy.mockRestore();
	});

	it('has nothing to do with an empty queue', () => {
		const queue = makeQueue();
		queue.flush();
		expect(queue.size()).toBe(0);
	});
});

describe('the pending id list the sync layer reads', () => {
	it('holds an id only while its delete has not been sent', () => {
		const queue = makeQueue();
		queue.schedule({solve: solve('s1'), commit: jest.fn()});
		queue.schedule({solve: solve('s2'), commit: jest.fn()});

		expect(queue.pendingIds().sort()).toEqual(['s1', 's2']);

		queue.undo('s1');
		expect(queue.pendingIds()).toEqual(['s2']);

		advance(SOLVE_DELETE_UNDO_MS);
		expect(queue.pendingIds()).toEqual([]);
	});

	it('never keeps two entries for the same solve', () => {
		const queue = makeQueue();
		const first = jest.fn();
		const second = jest.fn();

		queue.schedule({solve: solve('s1'), commit: first});
		// Can only happen if the same solve is deleted twice; the first delete is settled
		// rather than left behind with a timer nothing will ever clear.
		queue.schedule({solve: solve('s1'), commit: second});

		expect(first).toHaveBeenCalledTimes(1);
		expect(queue.pendingIds()).toEqual(['s1']);

		advance(SOLVE_DELETE_UNDO_MS);
		expect(second).toHaveBeenCalledTimes(1);
	});
});
