import {Solve} from '../../../server/schemas/Solve.schema';
import {onVisibilityChange} from '../../util/app-visibility';

/**
 * The undo window of a single-solve delete.
 *
 * Deleting a solve is split in two. The local half (LokiJS, stat caches, tombstone,
 * deleted-solve tally) happens at once, so the row disappears and every number on screen
 * is already right. The server half waits here for a few seconds, because it is the half
 * that cannot be taken back: `deleteSolve` cascades the solve's leaderboard entries, its
 * top averages, its method steps, its views and its share code, and re-creating the row
 * afterwards would hand the user a different solve wearing the same id.
 *
 * So an undo inside the window has nothing to repair server-side, and a delete that
 * reaches the end of the window is the ordinary delete this app always did.
 *
 * The window closes early whenever waiting would be wrong: the page is being hidden or
 * unloaded (below), or another action needs the delete to be settled first (bulk deletes,
 * session deletes, logout, which call `flushPendingSolveDeletes`). If the browser dies
 * without any of that firing, the tombstone written at delete time still tells the next
 * sync to re-issue the delete, so the user's intent is never lost.
 */

export const SOLVE_DELETE_UNDO_MS = 5000;

export interface PendingSolveDelete {
	/** A detached copy of the removed solve, which is what an undo puts back. */
	solve: Solve;
	/** Sends the delete for real. Runs exactly once, on expiry or on a flush. */
	commit: () => void;
}

export interface PendingSolveDeleteQueue {
	schedule(entry: PendingSolveDelete): void;
	/** Cancels a pending delete and hands back its solve, or null if it already went out. */
	undo(id: string): Solve | null;
	isPending(id: string): boolean;
	pendingIds(): string[];
	/** Commits everything still waiting, now. */
	flush(): void;
	size(): number;
}

interface QueueOptions {
	delayMs?: number;
	setTimer?: (fn: () => void, ms: number) => any;
	clearTimer?: (handle: any) => void;
}

/**
 * Timer functions are injectable so the rules can be tested without a clock; the app uses
 * the real ones through the module singleton below.
 */
export function createPendingSolveDeleteQueue(options: QueueOptions = {}): PendingSolveDeleteQueue {
	const delayMs = options.delayMs ?? SOLVE_DELETE_UNDO_MS;
	const setTimerFn = options.setTimer ?? ((fn: () => void, ms: number) => setTimeout(fn, ms));
	const clearTimerFn = options.clearTimer ?? ((handle: any) => clearTimeout(handle));

	const entries = new Map<string, {entry: PendingSolveDelete; handle: any}>();

	function take(id: string): PendingSolveDelete | null {
		const pending = entries.get(id);
		if (!pending) {
			return null;
		}

		entries.delete(id);
		clearTimerFn(pending.handle);
		return pending.entry;
	}

	function commit(id: string) {
		const entry = take(id);
		if (!entry) {
			return;
		}

		try {
			entry.commit();
		} catch (e) {
			// A failed commit must not strand the rest of the queue. The delete is still
			// tombstoned locally, so the next sync re-issues it.
			console.error('[solve] deferred delete failed to commit:', e);
		}
	}

	return {
		schedule(entry: PendingSolveDelete) {
			// Same solve scheduled twice: the first one is already on its way out anyway,
			// and leaving it behind would leak a timer that never resolves.
			commit(entry.solve.id);

			const id = entry.solve.id;
			entries.set(id, {
				entry,
				handle: setTimerFn(() => commit(id), delayMs),
			});
		},

		undo(id: string): Solve | null {
			const entry = take(id);
			return entry ? entry.solve : null;
		},

		isPending(id: string): boolean {
			return entries.has(id);
		},

		pendingIds(): string[] {
			return Array.from(entries.keys());
		},

		flush() {
			for (const id of Array.from(entries.keys())) {
				commit(id);
			}
		},

		size(): number {
			return entries.size;
		},
	};
}

let queue: PendingSolveDeleteQueue | null = null;

function getQueue(): PendingSolveDeleteQueue {
	if (!queue) {
		queue = createPendingSolveDeleteQueue();
		bindWindowFlush();
	}
	return queue;
}

let flushBound = false;

function bindWindowFlush() {
	if (flushBound || typeof window === 'undefined') {
		return;
	}
	flushBound = true;

	// Closing the tab, navigating away, or the app going to the background all end the
	// undo window: the toast is gone, nobody can press it any more, and a sync pass on the
	// way back must not find a delete that is neither local nor sent.
	window.addEventListener('pagehide', () => flushPendingSolveDeletes());
	onVisibilityChange((visible) => {
		if (!visible) {
			flushPendingSolveDeletes();
		}
	});
}

export function schedulePendingSolveDelete(entry: PendingSolveDelete) {
	getQueue().schedule(entry);
}

export function undoPendingSolveDelete(id: string): Solve | null {
	return queue ? queue.undo(id) : null;
}

/**
 * Ids of solves that are deleted locally but whose delete has not been sent yet. The sync
 * layer reads this: such an id is still on the server on purpose, so it must not be
 * fetched back, and the tombstone it already carries must not trigger a re-delete either.
 */
export function getPendingSolveDeleteIds(): string[] {
	return queue ? queue.pendingIds() : [];
}

export function flushPendingSolveDeletes() {
	if (queue) {
		queue.flush();
	}
}
