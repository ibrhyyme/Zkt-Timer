/**
 * Timing rules of the local save and the offline hash.
 *
 * The bug behind them: every change serialised the whole database on the spot, inside the
 * handler that stops the timer, and Pro accounts sent one hash request per solve.
 */

import {
	createPersistScheduler,
	HASH_QUIET_MS,
	PersistDeps,
	SAVE_DEBOUNCE_MS,
	SAVE_MAX_WAIT_MS,
	SOLVING_MAX_DEFER_MS,
} from '../persist-scheduler';

function harness(opts: {wantsHash?: boolean} = {}) {
	let now = 0;
	let nextId = 1;
	let timers: {id: number; at: number; fn: () => void}[] = [];
	const state = {solving: false, wantsHash: opts.wantsHash ?? true};

	const save = jest.fn(() => Promise.resolve());
	const saveAndHash = jest.fn(() => Promise.resolve());

	const deps: PersistDeps = {
		save,
		saveAndHash,
		wantsHash: () => state.wantsHash,
		isSolving: () => state.solving,
		now: () => now,
		setTimer: (fn, ms) => {
			const id = nextId++;
			timers.push({id, at: now + ms, fn});
			return id;
		},
		clearTimer: (id) => {
			timers = timers.filter((t) => t.id !== id);
		},
		runIdle: (fn) => fn(),
	};

	async function settle() {
		for (let i = 0; i < 10; i++) await Promise.resolve();
	}

	async function advance(ms: number) {
		const end = now + ms;
		for (;;) {
			const due = timers.filter((t) => t.at <= end).sort((a, b) => a.at - b.at)[0];
			if (!due) break;
			now = due.at;
			timers = timers.filter((t) => t.id !== due.id);
			due.fn();
			await settle();
		}
		now = end;
		await settle();
	}

	return {scheduler: createPersistScheduler(deps), save, saveAndHash, state, advance, settle};
}

describe('local save', () => {
	it('is not done on the spot, and a burst is written once', async () => {
		const h = harness({wantsHash: false});
		h.scheduler.request();
		await h.settle();
		expect(h.save).not.toHaveBeenCalled();

		h.scheduler.request();
		await h.advance(SAVE_DEBOUNCE_MS / 2);
		h.scheduler.request();
		await h.advance(SAVE_DEBOUNCE_MS);
		expect(h.save).toHaveBeenCalledTimes(1);
	});

	it('still writes a burst that never pauses', async () => {
		const h = harness({wantsHash: false});
		for (let t = 0; t < SAVE_MAX_WAIT_MS + SAVE_DEBOUNCE_MS * 2; t += SAVE_DEBOUNCE_MS / 2) {
			h.scheduler.request();
			await h.advance(SAVE_DEBOUNCE_MS / 2);
		}
		expect(h.save).toHaveBeenCalled();
	});

	it('waits for a running solve to end', async () => {
		const h = harness({wantsHash: false});
		h.state.solving = true;
		h.scheduler.request();
		await h.advance(SAVE_DEBOUNCE_MS + 5000);
		expect(h.save).not.toHaveBeenCalled();

		h.state.solving = false;
		await h.advance(2000);
		expect(h.save).toHaveBeenCalledTimes(1);
	});

	it('does not wait for a solve forever', async () => {
		const h = harness({wantsHash: false});
		h.state.solving = true;
		h.scheduler.request();
		await h.advance(SOLVING_MAX_DEFER_MS + 2000);
		expect(h.save).toHaveBeenCalledTimes(1);
	});
});

describe('offline hash', () => {
	it('is not sent per change for additive changes', async () => {
		const h = harness();
		for (let i = 0; i < 5; i++) {
			h.scheduler.request();
			await h.advance(15_000);
		}
		expect(h.saveAndHash).not.toHaveBeenCalled();
		expect(h.save.mock.calls.length).toBeGreaterThan(0);
	});

	it('is sent after a quiet minute', async () => {
		const h = harness();
		h.scheduler.request();
		await h.advance(HASH_QUIET_MS + 10);
		expect(h.saveAndHash).toHaveBeenCalledTimes(1);
	});

	it('is sent at once for a destructive change', async () => {
		const h = harness();
		h.scheduler.request({destructive: true});
		await h.settle();
		expect(h.saveAndHash).toHaveBeenCalledTimes(1);
	});

	it('is sent on flush when there are unannounced changes', async () => {
		const h = harness();
		h.scheduler.request();
		await h.scheduler.flush();
		expect(h.saveAndHash).toHaveBeenCalledTimes(1);
		// Nothing left over for the timers
		await h.advance(HASH_QUIET_MS * 2);
		expect(h.saveAndHash).toHaveBeenCalledTimes(1);
		expect(h.save).not.toHaveBeenCalled();
	});

	it('is never sent for an account without read sync', async () => {
		const h = harness({wantsHash: false});
		h.scheduler.request({destructive: true});
		await h.advance(HASH_QUIET_MS * 2);
		await h.scheduler.flush();
		expect(h.saveAndHash).not.toHaveBeenCalled();
		expect(h.save).toHaveBeenCalled();
	});
});

describe('flush and cancel', () => {
	it('flush writes a pending save right away', async () => {
		const h = harness({wantsHash: false});
		h.scheduler.request();
		await h.scheduler.flush();
		expect(h.save).toHaveBeenCalledTimes(1);
	});

	it('cancel drops everything pending', async () => {
		const h = harness();
		h.scheduler.request();
		h.scheduler.cancel();
		await h.advance(HASH_QUIET_MS * 2);
		await h.scheduler.flush();
		expect(h.save).not.toHaveBeenCalled();
		expect(h.saveAndHash).not.toHaveBeenCalled();
	});
});
