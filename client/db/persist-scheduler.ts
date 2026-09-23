/**
 * When the local database is written back to IndexedDB, and when the offline hash is sent.
 *
 * Pure: every side effect comes in through `deps`, so the timing rules can be tested.
 * client/db/persist.ts wires it to LokiJS, the store and the page lifecycle.
 *
 * Why this exists. Every solve, session change and settings write used to call
 * updateOfflineHash() or saveLokiDb() on the spot. LokiJS serialises the ENTIRE database
 * synchronously when it saves (measured: 5 MB for 10k solves, 18 MB when 2k of them are
 * smart solves made on the device, 40 MB for 40k; tens of ms on a desktop, several times
 * that on a phone), and the call ran inside createSolveDb, i.e. at the moment the timer
 * stopped. Pro users also sent one updateOfflineHash request per solve, and reordering
 * sessions did both once per session.
 *
 * The rules:
 * - Local save: trailing debounce, so a burst of changes is written once. Not while a
 *   solve is being timed (that is when a freeze hurts), but never deferred for longer than
 *   a ceiling either, since until it runs the change exists only in memory.
 * - Offline hash, additive changes (new solves, edits, renames): sent when the page is
 *   hidden or closed, or after a quiet minute. Another device opening in between loses
 *   nothing: launch reconciliation fetches recent solves whatever the hash says.
 * - Offline hash, destructive changes (deletes, merges): sent at once. The hash is what
 *   tells another device "run a full delta". If it lags, a device opening meanwhile takes
 *   the reconcile path, whose mass-deletion guard refuses a large deletion, and the launch
 *   backfill then uploads the deleted solves again.
 */

export interface PersistDeps {
	/** Write the database to IndexedDB (saveLokiDb). */
	save: () => Promise<unknown>;
	/** Write the database, then send a new offline hash (updateOfflineHash). */
	saveAndHash: () => Promise<unknown>;
	/** Whether this account keeps an offline hash at all (Pro read sync). */
	wantsHash: () => boolean;
	isSolving: () => boolean;
	now: () => number;
	setTimer: (fn: () => void, ms: number) => any;
	clearTimer: (handle: any) => void;
	/** Run when the main thread is free (requestIdleCallback), or soon. */
	runIdle: (fn: () => void) => void;
}

export const SAVE_DEBOUNCE_MS = 1000;
/** A continuous burst of changes still saves at least this often. */
export const SAVE_MAX_WAIT_MS = 5000;
/** How long a save may wait for a running solve to end. */
export const SOLVING_MAX_DEFER_MS = 30_000;
export const SOLVING_RECHECK_MS = 1000;
export const HASH_QUIET_MS = 60_000;

export interface PersistScheduler {
	request: (opts?: {destructive?: boolean}) => Promise<void>;
	flush: () => Promise<void>;
	cancel: () => void;
}

export function createPersistScheduler(deps: PersistDeps): PersistScheduler {
	let saveTimer: any = null;
	let hashTimer: any = null;
	let savePending = false;
	let hashDirty = false;
	// When the oldest unsaved change was made: the reference for both ceilings.
	let firstChangeAt: number | null = null;
	// Serialises writes: two saves of the same database must not overlap.
	let chain: Promise<unknown> = Promise.resolve();
	// Bumped by cancel(): anything already scheduled for an older generation does nothing.
	let generation = 0;

	function run(fn: () => Promise<unknown>): Promise<void> {
		const gen = generation;
		chain = chain
			.then(() => (gen === generation ? fn() : undefined))
			.catch(() => {
				// Both writers log their own failures; the chain must keep going
			});
		return chain.then(() => undefined);
	}

	function clearSaveTimer() {
		if (saveTimer !== null) {
			deps.clearTimer(saveTimer);
			saveTimer = null;
		}
	}

	function clearHashTimer() {
		if (hashTimer !== null) {
			deps.clearTimer(hashTimer);
			hashTimer = null;
		}
	}

	function doSave(): Promise<void> {
		savePending = false;
		firstChangeAt = null;
		return run(deps.save);
	}

	function doSaveAndHash(): Promise<void> {
		clearSaveTimer();
		clearHashTimer();
		savePending = false;
		hashDirty = false;
		firstChangeAt = null;
		return run(deps.saveAndHash);
	}

	function onSaveTimer() {
		saveTimer = null;
		if (!savePending) return;

		const waited = firstChangeAt === null ? 0 : deps.now() - firstChangeAt;
		if (deps.isSolving() && waited < SOLVING_MAX_DEFER_MS) {
			saveTimer = deps.setTimer(onSaveTimer, SOLVING_RECHECK_MS);
			return;
		}

		const gen = generation;
		deps.runIdle(() => {
			if (gen !== generation || !savePending) return;
			void doSave();
		});
	}

	function armSave() {
		const now = deps.now();
		if (firstChangeAt === null) {
			firstChangeAt = now;
		}
		// Trailing debounce, except that a burst which never pauses still gets written.
		if (saveTimer !== null && now - firstChangeAt >= SAVE_MAX_WAIT_MS) {
			return;
		}
		clearSaveTimer();
		saveTimer = deps.setTimer(onSaveTimer, SAVE_DEBOUNCE_MS);
	}

	function armHash() {
		clearHashTimer();
		hashTimer = deps.setTimer(() => {
			hashTimer = null;
			if (hashDirty) void doSaveAndHash();
		}, HASH_QUIET_MS);
	}

	return {
		request({destructive = false} = {}) {
			const wantsHash = deps.wantsHash();

			if (destructive && wantsHash) {
				return doSaveAndHash();
			}

			savePending = true;
			armSave();

			if (wantsHash) {
				hashDirty = true;
				armHash();
			}
			return Promise.resolve();
		},

		flush() {
			if (hashDirty && deps.wantsHash()) {
				return doSaveAndHash();
			}
			clearHashTimer();
			hashDirty = false;
			if (savePending) {
				clearSaveTimer();
				return doSave();
			}
			return chain.then(() => undefined);
		},

		cancel() {
			generation++;
			clearSaveTimer();
			clearHashTimer();
			savePending = false;
			hashDirty = false;
			firstChangeAt = null;
		},
	};
}
