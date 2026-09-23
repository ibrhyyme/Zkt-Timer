/**
 * The offline queue's decision logic.
 *
 * The bug these guard against: one record the server would never accept, retried by a
 * sync that restarted itself the moment it finished, showed a "1 solve syncing" toast every
 * couple of seconds on desktop for as long as the tab was open.
 */

import {
	classifyReplayError,
	countSolves,
	createFlushScheduler,
	isConnectivityError,
	nextBackoffMs,
	NOTIFY_AFTER_RETRIES,
	runReplayLoop,
	selectRunnable,
} from '../offline-replay';
import {SOLVE_SESSION_MISSING_I18N_KEY} from '../../../shared/solve';
import type {QueuedMutation} from '../offline-queue';

function gqlError(code: string, i18nKey?: string) {
	return {graphQLErrors: [{message: 'x', extensions: i18nKey ? {code, i18nKey} : {code}}]};
}

function record(overrides: Partial<QueuedMutation> = {}): QueuedMutation {
	return {
		id: overrides.id || `r_${Math.random()}`,
		mutationName: 'createSolve',
		variables: {input: {id: 'solve-1'}},
		timestamp: 1,
		retryCount: 0,
		...overrides,
	};
}

function memoryStore(initial: QueuedMutation[]) {
	const rows = new Map(initial.map((m) => [m.id, m]));
	return {
		rows,
		remove: async (id: string) => {
			rows.delete(id);
		},
		put: async (m: QueuedMutation) => {
			rows.set(m.id, m);
		},
	};
}

describe('isConnectivityError', () => {
	it('treats a failed fetch as connectivity', () => {
		expect(isConnectivityError({networkError: new TypeError('Failed to fetch')})).toBe(true);
	});

	it('treats a gateway error and the service worker offline 503 as connectivity', () => {
		expect(isConnectivityError({networkError: {statusCode: 502}})).toBe(true);
		expect(isConnectivityError({networkError: {statusCode: 503}})).toBe(true);
	});

	it('does not treat a 400 validation refusal as connectivity', () => {
		// Apollo reports it through networkError; reading it as "offline" would stop every
		// run at that record and starve everything queued behind it.
		expect(isConnectivityError({networkError: {statusCode: 400}})).toBe(false);
	});

	it('does not treat a GraphQL refusal as connectivity', () => {
		expect(isConnectivityError(gqlError('BAD_INPUT'))).toBe(false);
	});
});

describe('classifyReplayError', () => {
	it('halts the run on connection failures', () => {
		expect(classifyReplayError('createSolve', {networkError: new TypeError('Load failed')})).toBe('halt');
	});

	it('halts the run when the session is gone instead of blaming the record', () => {
		expect(classifyReplayError('createSolve', gqlError('FORBIDDEN'))).toBe('halt');
		expect(classifyReplayError('updateSolve', gqlError('UNAUTHENTICATED'))).toBe('halt');
	});

	it('counts a delete of something already gone as done', () => {
		expect(classifyReplayError('deleteSolve', gqlError('NOT_FOUND'))).toBe('resolved');
		expect(classifyReplayError('deleteSolves', gqlError('NOT_FOUND'))).toBe('resolved');
	});

	it('marks an update of a solve the server lacks as recoverable', () => {
		expect(classifyReplayError('updateSolve', gqlError('NOT_FOUND'))).toBe('solve_missing');
	});

	it('recognises a create whose session the server lacks', () => {
		const err = gqlError('NOT_FOUND', SOLVE_SESSION_MISSING_I18N_KEY);
		expect(classifyReplayError('createSolve', err)).toBe('session_missing');
	});

	it('treats session renames and reorders of vanished sessions as done', () => {
		expect(classifyReplayError('updateSession', gqlError('NOT_FOUND'))).toBe('resolved');
		expect(classifyReplayError('reorderSessions', gqlError('NOT_FOUND'))).toBe('resolved');
	});

	it('leaves any other refusal to the backoff', () => {
		expect(classifyReplayError('createSolve', gqlError('BAD_INPUT'))).toBe('server');
		expect(classifyReplayError('createSolve', gqlError('INTERNAL_SERVER_ERROR'))).toBe('server');
		expect(classifyReplayError('createSolve', {networkError: {statusCode: 400}})).toBe('server');
	});
});

describe('nextBackoffMs', () => {
	it('grows and stays capped', () => {
		expect(nextBackoffMs(1)).toBe(30_000);
		expect(nextBackoffMs(2)).toBe(60_000);
		expect(nextBackoffMs(3)).toBe(120_000);
		expect(nextBackoffMs(50)).toBe(30 * 60_000);
	});
});

describe('selectRunnable', () => {
	it('skips a record inside its backoff on automatic triggers only', () => {
		const waiting = record({id: 'a', nextAttemptAt: 2000});
		expect(selectRunnable([waiting], {now: 1000, force: false}).runnable).toEqual([]);
		expect(selectRunnable([waiting], {now: 1000, force: true}).runnable).toEqual([waiting]);
		expect(selectRunnable([waiting], {now: 3000, force: false}).runnable).toEqual([waiting]);
	});

	it('skips a record whose own request is still out', () => {
		const inFlight = record({id: 'a'});
		expect(selectRunnable([inFlight], {now: 0, force: true, inFlight: new Set(['a'])}).runnable).toEqual([]);
	});

	it('separates records written under another account', () => {
		const mine = record({id: 'a', userId: 'me'});
		const legacy = record({id: 'b'});
		const theirs = record({id: 'c', userId: 'someone-else'});
		const {runnable, foreign} = selectRunnable([mine, legacy, theirs], {now: 0, force: false, meId: 'me'});
		expect(runnable.map((m) => m.id)).toEqual(['a', 'b']);
		expect(foreign.map((m) => m.id)).toEqual(['c']);
	});

	it('keeps creation order so a session goes before its solves', () => {
		const solve = record({id: 's', timestamp: 20});
		const session = record({id: 'x', mutationName: 'createSession', timestamp: 10, variables: {session: {id: 'se'}}});
		expect(selectRunnable([solve, session], {now: 0, force: true}).runnable.map((m) => m.id)).toEqual(['x', 's']);
	});
});

describe('countSolves', () => {
	it('counts distinct solves, not records, and ignores sessions', () => {
		const n = countSolves([
			record({variables: {input: {id: 'a'}}}),
			record({mutationName: 'updateSolve', variables: {id: 'a', input: {}}}),
			record({mutationName: 'deleteSolves', variables: {ids: ['b', 'c']}}),
			record({mutationName: 'createSession', variables: {session: {id: 's'}}}),
		]);
		expect(n).toBe(3);
	});
});

describe('runReplayLoop', () => {
	it('removes sent records and stops at the first connection failure without penalty', async () => {
		const a = record({id: 'a'});
		const b = record({id: 'b'});
		const c = record({id: 'c'});
		const store = memoryStore([a, b, c]);
		const outcomes: any = {a: {status: 'done'}, b: {status: 'halt'}, c: {status: 'done'}};

		const result = await runReplayLoop([a, b, c], {
			replayOne: async (m) => outcomes[m.id],
			store,
		});

		expect(result.halted).toBe(true);
		expect(result.done.map((m) => m.id)).toEqual(['a']);
		expect(store.rows.has('a')).toBe(false);
		// Neither the halted record nor the one behind it was touched
		expect(store.rows.get('b')).toEqual(b);
		expect(store.rows.get('c')).toEqual(c);
	});

	it('keeps a refused record, pushes its next attempt out and carries on', async () => {
		const bad = record({id: 'bad'});
		const good = record({id: 'good'});
		const store = memoryStore([bad, good]);

		const result = await runReplayLoop([bad, good], {
			replayOne: async (m) => (m.id === 'bad' ? {status: 'rejected', error: 'nope'} : {status: 'done'}),
			store,
			now: () => 1000,
		});

		expect(result.done.map((m) => m.id)).toEqual(['good']);
		const kept = store.rows.get('bad');
		expect(kept?.retryCount).toBe(1);
		expect(kept?.nextAttemptAt).toBe(1000 + nextBackoffMs(1));
		expect(kept?.lastError).toBe('nope');
	});

	it('flags a stuck record for the user exactly once', async () => {
		let row = record({id: 'bad', retryCount: NOTIFY_AFTER_RETRIES - 1});
		const store = memoryStore([row]);
		const replayOne = async () => ({status: 'rejected' as const});

		const first = await runReplayLoop([row], {replayOne, store});
		expect(first.newlyStuck).toHaveLength(1);

		row = store.rows.get('bad') as QueuedMutation;
		const second = await runReplayLoop([row], {replayOne, store});
		expect(second.newlyStuck).toHaveLength(0);
	});

	it('treats a request that never settles as a halt', async () => {
		const hung = record({id: 'hung'});
		const store = memoryStore([hung]);
		const result = await runReplayLoop([hung], {
			replayOne: () => new Promise(() => {}),
			store,
			timeoutMs: 10,
		});
		expect(result.halted).toBe(true);
		expect(store.rows.get('hung')).toEqual(hung);
	});

	it('keeps a record whose replay threw', async () => {
		const r = record({id: 'r'});
		const store = memoryStore([r]);
		const result = await runReplayLoop([r], {
			replayOne: async () => {
				throw new Error('boom');
			},
			store,
		});
		expect(result.rejected).toHaveLength(1);
		expect(store.rows.get('r')?.retryCount).toBe(1);
	});
});

describe('createFlushScheduler', () => {
	it('joins triggers that arrive mid-run instead of running twice at once', async () => {
		let running = 0;
		let maxConcurrent = 0;
		let calls = 0;
		const request = createFlushScheduler(
			async () => {
				calls++;
				running++;
				maxConcurrent = Math.max(maxConcurrent, running);
				await new Promise((r) => setTimeout(r, 5));
				running--;
				return {sent: 0};
			},
			(r) => r.sent > 0
		);

		await Promise.all([request('online'), request('online'), request('resume')]);
		expect(maxConcurrent).toBe(1);
		// No progress and no forcing trigger waiting: nothing to gain from another pass
		expect(calls).toBe(1);
	});

	it('runs once more for a waiting forcing trigger', async () => {
		const seen: string[] = [];
		const request = createFlushScheduler(
			async (trigger) => {
				seen.push(trigger);
				await new Promise((r) => setTimeout(r, 5));
				return {sent: 0};
			},
			(r) => r.sent > 0
		);

		await Promise.all([request('online'), request('manual')]);
		expect(seen).toEqual(['online', 'manual']);
	});

	it('starts a fresh run after the previous one ended', async () => {
		let calls = 0;
		const request = createFlushScheduler(
			async () => {
				calls++;
				return {sent: 0};
			},
			() => false
		);
		await request('online');
		await request('online');
		expect(calls).toBe(2);
	});

	it('recovers when a run throws', async () => {
		let calls = 0;
		const request = createFlushScheduler(
			async () => {
				calls++;
				if (calls === 1) throw new Error('boom');
				return {sent: 0};
			},
			() => false
		);
		await expect(request('online')).rejects.toThrow('boom');
		await request('online');
		expect(calls).toBe(2);
	});
});
