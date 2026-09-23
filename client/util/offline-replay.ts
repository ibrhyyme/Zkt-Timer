/**
 * The decision logic of the offline queue, kept free of IndexedDB, Apollo and the DOM so
 * it can be tested on its own. offline-sync.ts wires it to the real queue, the network and
 * the toasts.
 *
 * What went wrong before this existed: the queue never dropped a record (on purpose, see
 * processQueue's history), but it also never told a record the server will not take apart
 * from one that merely met a dead connection, and every sync retried everything at once.
 * On desktop Chrome the service worker's Background Sync re-fired a sync the moment the
 * last one finished, so a single unsendable record turned into a sync every couple of
 * seconds, each with its own "1 solve syncing" toast, for as long as the tab stayed open.
 */

import {isNetworkError} from './network-error';
import {SOLVE_SESSION_MISSING_I18N_KEY} from '../../shared/solve';
import type {QueuedMutation, QueuedMutationName} from './offline-queue';

export type FlushTrigger = 'online' | 'resume' | 'retry' | 'boot' | 'manual' | 'logout';

/**
 * - `halt`: nothing is wrong with this record. The connection is gone, the server is
 *   unreachable, or the session expired. Stop the whole run and count nothing against it.
 * - `resolved`: the server refused, but the refusal is the outcome the record wanted (a
 *   delete for something already gone). Treat as sent.
 * - `solve_missing`: an update for a solve the server does not have. Recoverable from the
 *   local row.
 * - `session_missing`: a create for a solve whose session the server does not have.
 *   Recoverable by sending the session first.
 * - `server`: any other refusal. Kept, retried later with a growing delay.
 */
export type ReplayErrorKind = 'halt' | 'resolved' | 'solve_missing' | 'session_missing' | 'server';

/** Automatic triggers wait out a record's backoff; these three try everything once. */
const FORCING_TRIGGERS: FlushTrigger[] = ['manual', 'logout', 'boot'];

export function isForcingTrigger(trigger: FlushTrigger): boolean {
	return FORCING_TRIGGERS.includes(trigger);
}

const BACKOFF_BASE_MS = 30_000;
const BACKOFF_MAX_MS = 30 * 60_000;

/** Delay before the next automatic attempt, after `retryCount` refusals. */
export function nextBackoffMs(retryCount: number): number {
	const exponent = Math.max(0, retryCount - 1);
	return Math.min(BACKOFF_BASE_MS * 2 ** exponent, BACKOFF_MAX_MS);
}

/** After this many refusals the user is told, once, that a record is stuck. */
export const NOTIFY_AFTER_RETRIES = 3;

function graphQLErrorsOf(err: any): any[] {
	if (Array.isArray(err?.graphQLErrors) && err.graphQLErrors.length) return err.graphQLErrors;
	if (Array.isArray(err?.errors) && err.errors.length) return err.errors;
	const fromBody = err?.networkError?.result?.errors;
	return Array.isArray(fromBody) ? fromBody : [];
}

/**
 * Did this request fail for reasons that have nothing to do with its content?
 *
 * Stricter than isNetworkError, which calls anything carrying `networkError` a network
 * failure. Apollo sets `networkError` for every non-2xx response, and graphql-js answers an
 * input it cannot validate with a 400. Read as "offline", that verdict would stop every run
 * at the same record and starve everything queued behind it.
 */
export function isConnectivityError(err: any): boolean {
	const status = err?.networkError?.statusCode ?? err?.statusCode;
	if (typeof status === 'number') {
		// A response came back. A 4xx is the server judging this request; only a timeout
		// or a rate limit among them says something about the connection instead.
		if (status >= 400 && status < 500 && status !== 408 && status !== 429) {
			return false;
		}
		return true;
	}

	if (graphQLErrorsOf(err).length && !err?.networkError) {
		return false;
	}

	return isNetworkError(err);
}

export function classifyReplayError(mutationName: QueuedMutationName, err: any): ReplayErrorKind {
	if (isConnectivityError(err)) {
		return 'halt';
	}

	const errors = graphQLErrorsOf(err);
	const codes = errors.map((e) => e?.extensions?.code);
	const keys = errors.map((e) => e?.extensions?.i18nKey);

	// Not this record's fault: the account's session is gone. Everything behind it would
	// fail the same way, so stop and let the next signed-in run send them.
	if (codes.includes('UNAUTHENTICATED') || codes.includes('FORBIDDEN')) {
		return 'halt';
	}

	if (keys.includes(SOLVE_SESSION_MISSING_I18N_KEY)) {
		return mutationName === 'createSolve' ? 'session_missing' : 'server';
	}

	if (codes.includes('NOT_FOUND')) {
		switch (mutationName) {
			case 'deleteSolve':
			case 'deleteSolves':
			case 'updateSession':
			case 'reorderSessions':
				return 'resolved';
			case 'updateSolve':
				return 'solve_missing';
			default:
				return 'server';
		}
	}

	return 'server';
}

/** The solve ids a record touches. Session records touch none. */
export function solveIdsOf(mutation: QueuedMutation): string[] {
	const v = mutation?.variables;
	switch (mutation?.mutationName) {
		case 'createSolve':
			return v?.input?.id ? [v.input.id] : [];
		case 'updateSolve':
		case 'deleteSolve':
			return v?.id ? [v.id] : [];
		case 'deleteSolves':
			return Array.isArray(v?.ids) ? v.ids.filter(Boolean) : [];
		default:
			return [];
	}
}

export function countSolves(mutations: QueuedMutation[]): number {
	const ids = new Set<string>();
	for (const m of mutations) {
		for (const id of solveIdsOf(m)) ids.add(id);
	}
	return ids.size;
}

export interface RunnableSelection {
	runnable: QueuedMutation[];
	/** Written under another account. Can never be sent correctly from this one. */
	foreign: QueuedMutation[];
}

export function selectRunnable(
	mutations: QueuedMutation[],
	opts: {now: number; force: boolean; meId?: string | null; inFlight?: Set<string>}
): RunnableSelection {
	const runnable: QueuedMutation[] = [];
	const foreign: QueuedMutation[] = [];

	for (const m of mutations) {
		// Records from before the stamp existed carry no userId: they can only have been
		// written by whoever is signed in, because logout used to leave the queue alone
		// only by accident and account switches were rare. Treat them as ours.
		if (m.userId && opts.meId && m.userId !== opts.meId) {
			foreign.push(m);
			continue;
		}
		// Its own request is still out. Sending it again would only race that request.
		if (opts.inFlight?.has(m.id)) continue;
		if (!opts.force && m.nextAttemptAt && m.nextAttemptAt > opts.now) continue;
		runnable.push(m);
	}

	// Queue order is creation order, and it matters: a session has to exist before the
	// solves in it, a solve before its update.
	runnable.sort((a, b) => a.timestamp - b.timestamp || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
	return {runnable, foreign};
}

export type ReplayOutcome = {status: 'done'} | {status: 'halt'} | {status: 'rejected'; error?: string};

export interface ReplayStore {
	remove(id: string): Promise<void>;
	put(mutation: QueuedMutation): Promise<void>;
}

export interface ReplayLoopResult {
	done: QueuedMutation[];
	rejected: QueuedMutation[];
	/** Rejected records that just crossed the notification threshold. */
	newlyStuck: QueuedMutation[];
	halted: boolean;
}

export interface ReplayLoopDeps {
	replayOne: (mutation: QueuedMutation) => Promise<ReplayOutcome>;
	store: ReplayStore;
	now?: () => number;
	/** A request that never settles must not hold the queue (and every later sync) forever. */
	timeoutMs?: number;
}

const TIMED_OUT = Symbol('timed-out');

function withTimeout<T>(promise: Promise<T>, ms: number | undefined): Promise<T | typeof TIMED_OUT> {
	if (!ms) return promise;
	return new Promise((resolve, reject) => {
		const timer = setTimeout(() => resolve(TIMED_OUT), ms);
		promise.then(
			(value) => {
				clearTimeout(timer);
				resolve(value);
			},
			(err) => {
				clearTimeout(timer);
				reject(err);
			}
		);
	});
}

export async function runReplayLoop(runnable: QueuedMutation[], deps: ReplayLoopDeps): Promise<ReplayLoopResult> {
	const now = deps.now || Date.now;
	const result: ReplayLoopResult = {done: [], rejected: [], newlyStuck: [], halted: false};

	for (const mutation of runnable) {
		let outcome: ReplayOutcome;
		try {
			const raced = await withTimeout(deps.replayOne(mutation), deps.timeoutMs);
			// The request may still land later. The record stays queued, and sending it
			// again is safe: a create that already arrived is answered as a success.
			outcome = raced === TIMED_OUT ? {status: 'halt'} : raced;
		} catch (e: any) {
			outcome = {status: 'rejected', error: e?.message || String(e)};
		}

		if (outcome.status === 'halt') {
			result.halted = true;
			break;
		}

		if (outcome.status === 'done') {
			await deps.store.remove(mutation.id);
			result.done.push(mutation);
			continue;
		}

		const retryCount = (mutation.retryCount || 0) + 1;
		const crossed = retryCount >= NOTIFY_AFTER_RETRIES && !mutation.notified;
		const updated: QueuedMutation = {
			...mutation,
			retryCount,
			nextAttemptAt: now() + nextBackoffMs(retryCount),
			lastError: outcome.error,
			notified: mutation.notified || crossed,
		};
		await deps.store.put(updated);
		result.rejected.push(updated);
		if (crossed) result.newlyStuck.push(updated);
	}

	return result;
}

const TRIGGER_RANK: Record<FlushTrigger, number> = {
	retry: 0,
	resume: 1,
	online: 2,
	boot: 3,
	manual: 4,
	logout: 5,
};

function stronger(a: FlushTrigger | null, b: FlushTrigger): FlushTrigger {
	if (!a) return b;
	return TRIGGER_RANK[b] > TRIGGER_RANK[a] ? b : a;
}

/**
 * One flush at a time. A trigger that arrives mid-run joins that run instead of starting a
 * second one next to it (the old guard was set only after a two second wait, so the
 * browser's `online` event, the native network listener and the service worker all got
 * through it together). The joined trigger is remembered and gets its own pass once the
 * current one ends, if that pass can achieve anything: the last run made progress, or the
 * waiting trigger is one that retries records still inside their backoff.
 */
export function createFlushScheduler<T>(
	run: (trigger: FlushTrigger) => Promise<T>,
	madeProgress: (result: T) => boolean
): (trigger: FlushTrigger) => Promise<T> {
	let running: Promise<T> | null = null;
	let waiting: FlushTrigger | null = null;

	return function request(trigger: FlushTrigger): Promise<T> {
		if (running) {
			waiting = stronger(waiting, trigger);
			return running;
		}

		running = (async () => {
			try {
				let result = await run(trigger);
				while (waiting) {
					const next = waiting;
					waiting = null;
					if (!madeProgress(result) && !isForcingTrigger(next)) break;
					result = await run(next);
				}
				return result;
			} finally {
				waiting = null;
				running = null;
			}
		})();

		return running;
	};
}
