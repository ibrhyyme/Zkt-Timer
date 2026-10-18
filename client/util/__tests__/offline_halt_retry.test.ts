/**
 * What the offline queue does when a run stops on the connection, and what it tells the user.
 *
 * The field report: with no data in a metro tunnel the app said "syncing", then nothing,
 * later "N solves synced", and another device was still 50 solves behind. A run that stopped
 * on the connection was never re-tried until the app was reopened, a live save hung on a dead
 * connection hid its solve from every sync, and "synced" was said for a partial run.
 */

import {
	classifyReplayError,
	isConnectivityError,
	nextHaltRetryMs,
	raceTimeout,
	SaveTimeoutError,
	syncResultMessage,
} from '../offline-replay';

describe('nextHaltRetryMs', () => {
	it('starts at 30 seconds and doubles', () => {
		expect(nextHaltRetryMs(1)).toBe(30_000);
		expect(nextHaltRetryMs(2)).toBe(60_000);
		expect(nextHaltRetryMs(3)).toBe(120_000);
	});

	it('never waits more than five minutes', () => {
		expect(nextHaltRetryMs(4)).toBe(240_000);
		expect(nextHaltRetryMs(5)).toBe(300_000);
		expect(nextHaltRetryMs(50)).toBe(300_000);
	});

	it('treats a zero or negative streak as the first retry', () => {
		expect(nextHaltRetryMs(0)).toBe(30_000);
		expect(nextHaltRetryMs(-3)).toBe(30_000);
	});
});

describe('raceTimeout', () => {
	it('passes a timely answer through', async () => {
		const p = raceTimeout(Promise.resolve('ok'), 1000);
		await expect(p).resolves.toBe('ok');
	});

	it('passes a timely failure through unchanged', async () => {
		const err = new Error('boom');
		await expect(raceTimeout(Promise.reject(err), 1000)).rejects.toBe(err);
	});

	it('gives up on a request that never answers, as a connectivity failure', async () => {
		const never = new Promise<never>(() => {});
		// Real timers with a short budget: modern fake timers do not install on this Node.
		const err = await raceTimeout(never, 20).catch((e) => e);
		expect(err).toBeInstanceOf(SaveTimeoutError);
		// The queue must read it as "the connection", never as the server refusing the solve:
		// a refusal would put the solve into backoff and count it against its retries.
		expect(isConnectivityError(err)).toBe(true);
		expect(classifyReplayError('createSolve', err)).toBe('halt');
		expect(classifyReplayError('updateSolve', err)).toBe('halt');
	});
});

describe('syncResultMessage', () => {
	it('says synced only when nothing is left waiting', () => {
		expect(syncResultMessage(50, 0, true)).toEqual({key: 'offline.sync_done', params: {count: 50}});
		expect(syncResultMessage(3, 0, false)).toEqual({key: 'offline.sync_done', params: {count: 3}});
	});

	it('says how many still wait after a partial run', () => {
		expect(syncResultMessage(3, 47, true)).toEqual({
			key: 'offline.sync_partial',
			params: {count: 3, remaining: 47},
		});
		expect(syncResultMessage(3, 47, false)).toEqual({
			key: 'offline.sync_partial',
			params: {count: 3, remaining: 47},
		});
	});

	it('turns a shown "syncing" toast into "stopped" when nothing went out', () => {
		expect(syncResultMessage(0, 50, true)).toEqual({key: 'offline.sync_interrupted', params: {count: 50}});
	});

	it('stays silent when nothing went out and nothing was announced', () => {
		expect(syncResultMessage(0, 50, false)).toBeNull();
		expect(syncResultMessage(0, 0, true)).toBeNull();
		expect(syncResultMessage(0, 0, false)).toBeNull();
	});
});
