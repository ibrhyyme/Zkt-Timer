/**
 * Offline Sync Manager
 *
 * Queue'daki mutation'ları işleme ve sync etme. The decisions (what is runnable, what a
 * failure means, backoff, one run at a time) live in offline-replay.ts; this file wires
 * them to the real queue, the network, the local DB and the toasts.
 *
 * Every trigger goes through `requestQueueFlush`. There used to be several doors (the
 * browser's online event, the native network listener, a service worker Background Sync
 * message, the badge) each calling processQueue directly, and the service worker door
 * re-registered itself after every run, which on desktop Chrome fired the next run straight
 * away. With one record the server would never accept, that was an endless loop of
 * "1 solve syncing" toasts.
 */

import { gql } from '@apollo/client/core';
import { gqlMutate } from '../components/api';
import { getAllQueued, removeFromQueue, putQueued, getInFlightIds, QueuedMutation } from './offline-queue';
import { toastProgress, toastSettle, toastDismissId } from './toast';
import { emitEvent } from './event_handler';
import { deleteLocalStorage } from './data/local_storage';
import { getNetworkStatus } from './native-plugins';
import { getApiBase } from './api-base';
import { canWriteSync } from '../lib/sync-gate';
import { getStore } from '../components/store';
import { getSolveDb } from '../db/solves/init';
import { getSessionDb } from '../db/sessions/init';
import { getSetting } from '../db/settings/query';
import { getSolveTombstones } from './solve-tombstones';
import { requestPersist } from '../db/persist';
import { pickFields, SOLVE_INPUT_FIELDS, toCreateSolveInput, toSessionInput, toSolveInput } from '../db/solves/solve-input';
import { applyCreatedSolve, CREATED_SOLVE_SELECTION } from '../db/solves/apply-created';
import {
    classifyReplayError,
    countSolves,
    createFlushScheduler,
    FlushTrigger,
    isForcingTrigger,
    ReplayOutcome,
    runReplayLoop,
    selectRunnable,
} from './offline-replay';
import i18n from '../i18n/i18n';

export type { FlushTrigger } from './offline-replay';

const SYNC_TOAST_ID = 'offline-sync';
const STUCK_TOAST_ID = 'offline-sync-stuck';
// The browser's online event fires before the connection is actually usable.
const ONLINE_SETTLE_MS = 2000;
const PROBE_TIMEOUT_MS = 8000;
const REPLAY_TIMEOUT_MS = 20_000;
const LOCK_NAME = 'zkt-offline-queue';
const LOCK_WAIT_MS = 15_000;
const PROGRESS_TOAST_DELAY_MS = 800;

export interface FlushResult {
    sent: number;
    rejected: number;
    halted: boolean;
}

const NOTHING_DONE: FlushResult = { sent: 0, rejected: 0, halted: false };

const DONE: ReplayOutcome = { status: 'done' };
const HALT: ReplayOutcome = { status: 'halt' };

function rejected(error: unknown): ReplayOutcome {
    const message = (error as any)?.message || String(error);
    return { status: 'rejected', error: message };
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function currentUserId(): string | null {
    try {
        return getStore()?.getState()?.account?.me?.id || null;
    } catch {
        return null;
    }
}

/**
 * Sunucuya gerçekten erişilebildiğini doğrula
 */
async function isReallyOnline(): Promise<boolean> {
    // Bounded: on a connection that accepts the socket and never answers, an unbounded
    // probe held the whole flush (and every sync queued behind it) forever.
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS) : null;
    try {
        // Absolute base: in the native local bundle a relative /graphql would hit the
        // bundle origin (always "up"), making the probe lie about connectivity.
        const res = await fetch(`${getApiBase()}/graphql`, {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query: '{ __typename }' }),
            signal: controller?.signal,
        });
        return res.ok;
    } catch {
        return false;
    } finally {
        if (timer) clearTimeout(timer);
    }
}

/**
 * Apollo throws on GraphQL errors with the default error policy; this covers a result that
 * carries errors anyway. The errors travel on the thrown value so classifyReplayError can
 * read their codes, which a plain `new Error(message)` used to throw away.
 */
function assertNoGraphQLErrors(result: any): void {
    const errors = result?.errors;
    if (!errors || errors.length === 0) return;
    const error: any = new Error(errors[0]?.message || 'GraphQL error');
    error.graphQLErrors = errors;
    throw error;
}

// =====================================================
// Sending
// =====================================================

const CREATE_SOLVE = gql`
    mutation Mutate($input: SolveInput) {
        createSolve(input: $input) {
            ${CREATED_SOLVE_SELECTION}
        }
    }
`;

const UPDATE_SOLVE = gql`
    mutation Mutate($id: String, $input: SolveInput) {
        updateSolve(id: $id, input: $input) {
            id
        }
    }
`;

const DELETE_SOLVE = gql`
    mutation Mutate($id: String) {
        deleteSolve(id: $id) {
            id
        }
    }
`;

const DELETE_SOLVES = gql`
    mutation Mutate($ids: [String!]!) {
        deleteSolves(ids: $ids)
    }
`;

const BULK_CREATE_SESSIONS = gql`
    mutation Mutate($sessions: [SessionInput]) {
        bulkCreateSessions(sessions: $sessions)
    }
`;

const UPDATE_SESSION = gql`
    mutation Mutate($id: String, $input: SessionInput) {
        updateSession(id: $id, input: $input) {
            id
        }
    }
`;

const REORDER_SESSIONS = gql`
    mutation Mutate($ids: [String]!) {
        reorderSessions(ids: $ids)
    }
`;

async function send(query: any, variables: any): Promise<any> {
    const result = await gqlMutate(query, variables);
    assertNoGraphQLErrors(result);
    return result;
}

/**
 * Sends a solve create and applies the server's answer (analysis steps, a smart solve it
 * had to downgrade) to the local row, as the live save does. The replay used to ask for the
 * id only, so a smart solve timed offline had no breakdown until the next full fetch.
 * `analysisMethod` is the method the user had chosen when the solve was made; without it the
 * server detects the method from the solve.
 */
async function sendCreateSolve(input: any, analysisMethod?: string | null): Promise<void> {
    const payload = toCreateSolveInput(input, analysisMethod);
    const result = await send(CREATE_SOLVE, { input: payload });
    const applied = applyCreatedSolve(payload.id, result?.data?.createSolve);
    if (applied) {
        persistLocalSolveChange();
    }
}

/**
 * Every payload is rebuilt from the whitelist instead of replayed as stored: a record
 * written by an older app version may carry a field the schema no longer declares, and
 * graphql-js would refuse that record on every attempt, for ever.
 */
async function sendMutation(mutation: QueuedMutation): Promise<void> {
    const v = mutation.variables || {};

    switch (mutation.mutationName) {
        case 'createSolve':
            return sendCreateSolve(v.input, v.analysis_method);
        case 'updateSolve':
            await send(UPDATE_SOLVE, { id: v.id, input: pickFields(v.input, SOLVE_INPUT_FIELDS) });
            return;
        case 'deleteSolve':
            await send(DELETE_SOLVE, { id: v.id });
            return;
        case 'deleteSolves':
            await send(DELETE_SOLVES, { ids: v.ids });
            return;
        case 'createSession':
            // bulkCreateSessions keeps the id the device chose (the solves already point at
            // it) and skips it if it already arrived, so a repeat is harmless.
            await send(BULK_CREATE_SESSIONS, { sessions: [toSessionInput(v.session)] });
            return;
        case 'updateSession':
            await send(UPDATE_SESSION, { id: v.id, input: toSessionInput(v.input) });
            return;
        case 'reorderSessions':
            await send(REORDER_SESSIONS, { ids: v.ids });
            return;
        default:
            // Unknown to this version (written by a newer one?). Keep it, do not guess.
            throw new Error(`Unknown queued mutation: ${(mutation as any).mutationName}`);
    }
}

// =====================================================
// Recovering from refusals the device can fix on its own
// =====================================================

function persistLocalSolveChange() {
    void requestPersist();
    emitEvent('solveDbUpdatedEvent', null);
}

/**
 * Where a solve goes when the session it was made in no longer exists anywhere (deleted on
 * another device while this one was offline): the session the timer is on, or else the
 * first one. The solve itself is the user's data and must survive the session.
 */
function pickFallbackSessionId(excludeId: string | null | undefined): string | null {
    const sessions = getSessionDb();
    if (!sessions) return null;

    const current = getSetting('session_id') as string | null;
    if (current && current !== excludeId && sessions.findOne({ id: current })) {
        return current;
    }

    const first = sessions
        .chain()
        .find()
        .simplesort('order')
        .data()
        .find((s) => s.id !== excludeId);
    return first?.id || null;
}

/**
 * A createSolve whose session the server does not have. Usually the session was created
 * on this device without a connection and has not arrived yet: send it, then the solve.
 */
async function recoverMissingSession(mutation: QueuedMutation): Promise<ReplayOutcome> {
    const input = toSolveInput(mutation.variables?.input);
    const analysisMethod = mutation.variables?.analysis_method;
    const sessionId = input.session_id;
    const localSession = sessionId ? getSessionDb()?.findOne({ id: sessionId }) : null;

    if (localSession) {
        try {
            await send(BULK_CREATE_SESSIONS, { sessions: [toSessionInput(localSession)] });
            await sendCreateSolve(input, analysisMethod);
            return DONE;
        } catch (e) {
            return classifyReplayError('createSolve', e) === 'halt' ? HALT : rejected(e);
        }
    }

    const target = pickFallbackSessionId(sessionId);
    if (!target) {
        return rejected('No session to move the solve into');
    }

    const moved = { ...input, session_id: target };
    const solveDb = getSolveDb();
    const row = solveDb?.findOne({ id: input.id });
    if (row) {
        row.session_id = target;
        solveDb.update(row);
        persistLocalSolveChange();
    }
    // Stored before sending, so a failed attempt retries into the new session too.
    await putQueued({ ...mutation, variables: { ...mutation.variables, input: moved } });

    try {
        await sendCreateSolve(moved, analysisMethod);
        return DONE;
    } catch (e) {
        return classifyReplayError('createSolve', e) === 'halt' ? HALT : rejected(e);
    }
}

/**
 * An updateSolve for a solve the server does not have. The local row is the truth for it:
 * send the row itself. If the row is gone or was deleted on purpose, the update has
 * nothing left to do.
 */
async function recoverMissingSolve(mutation: QueuedMutation): Promise<ReplayOutcome> {
    const id = mutation.variables?.id;
    const local = id ? getSolveDb()?.findOne({ id }) : null;
    if (!local || getSolveTombstones().has(id)) {
        return DONE;
    }

    // Its create is still queued: either refused, or in flight right now. Queue order sends
    // the create first, so the update has to wait for it rather than race it.
    const queued = await getAllQueued();
    if (queued.some((m) => m.mutationName === 'createSolve' && m.variables?.input?.id === id)) {
        return rejected('Waiting for the solve to be created');
    }

    const asCreate: QueuedMutation = {
        ...mutation,
        mutationName: 'createSolve',
        variables: { input: toSolveInput(local) },
    };
    try {
        await sendCreateSolve(asCreate.variables.input);
        return DONE;
    } catch (e) {
        const kind = classifyReplayError('createSolve', e);
        if (kind === 'halt') return HALT;
        if (kind === 'session_missing') return recoverMissingSession(asCreate);
        return rejected(e);
    }
}

async function replayOne(mutation: QueuedMutation): Promise<ReplayOutcome> {
    try {
        await sendMutation(mutation);
        return DONE;
    } catch (e) {
        switch (classifyReplayError(mutation.mutationName, e)) {
            case 'halt':
                return HALT;
            case 'resolved':
                return DONE;
            case 'solve_missing':
                return recoverMissingSolve(mutation);
            case 'session_missing':
                return recoverMissingSession(mutation);
            default:
                console.error(`Mutation ${mutation.id} başarısız:`, e);
                return rejected(e);
        }
    }
}

// =====================================================
// The flush
// =====================================================

let retryTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * A refused record waits out its backoff. Without a timer it would only be looked at again
 * on the next reconnect, focus or launch, which on a desktop left open all day may be hours.
 * This is not the old loop: the delay grows to half an hour and the retry is silent.
 */
async function scheduleRetry(): Promise<void> {
    if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
    }

    const meId = currentUserId();
    if (!meId) return;

    // Only records still inside their backoff. One that is already due but was not sent
    // (the run stopped on a dead connection or an expired session) waits for the next
    // reconnect, focus or launch; arming a timer for it would re-run a failing sync every
    // second, which is the loop this whole module exists to prevent.
    const now = Date.now();
    const all = await getAllQueued();
    const waits = all
        .filter((m) => (!m.userId || m.userId === meId) && m.nextAttemptAt && m.nextAttemptAt > now)
        .map((m) => m.nextAttemptAt as number);
    if (!waits.length) return;

    const delay = Math.max(1000, Math.min(...waits) - now);
    retryTimer = setTimeout(() => {
        retryTimer = null;
        void requestQueueFlush('retry');
    }, delay);
}

async function runFlush(trigger: FlushTrigger): Promise<FlushResult> {
    if (typeof window === 'undefined' || !canWriteSync()) {
        return NOTHING_DONE;
    }

    if (trigger === 'online') {
        await sleep(ONLINE_SETTLE_MS);
    }

    if (!(await getNetworkStatus())) {
        return NOTHING_DONE;
    }

    const all = await getAllQueued();
    const { runnable, foreign } = selectRunnable(all, {
        now: Date.now(),
        force: isForcingTrigger(trigger),
        meId: currentUserId(),
        inFlight: getInFlightIds(),
    });

    // Written under another account on this browser. Sending them now would apply that
    // account's changes to this one, and that account's local data is already gone.
    for (const mutation of foreign) {
        await removeFromQueue(mutation.id);
    }

    if (!runnable.length) {
        if (foreign.length) {
            emitEvent('offlineSyncCompleted', { successCount: 0, failCount: 0 });
        }
        // Everything left is waiting out a backoff: make sure a retry is on the clock (after
        // a reload there is none until something schedules it).
        await scheduleRetry();
        return NOTHING_DONE;
    }

    // Gerçekten sunucuya erişilebildiğini doğrula
    if (!(await isReallyOnline())) {
        return NOTHING_DONE;
    }

    // Announced only when something new is going out (or the user asked). A record that has
    // already been refused retries silently; it announced itself once already.
    // The progress toast waits a moment: a run that finishes quickly only shows its result,
    // and one that stops at once (expired session, dead connection) shows nothing at all.
    const solveCount = countSolves(runnable);
    const announce = solveCount > 0 && (trigger === 'manual' || runnable.some((m) => !m.retryCount));
    let progressShown = false;
    const progressTimer = announce
        ? setTimeout(() => {
              progressShown = true;
              toastProgress(SYNC_TOAST_ID, i18n.t('offline.sync_in_progress', { count: solveCount }));
          }, PROGRESS_TOAST_DELAY_MS)
        : null;

    const loop = await runReplayLoop(runnable, {
        replayOne,
        store: { remove: removeFromQueue, put: putQueued },
        timeoutMs: REPLAY_TIMEOUT_MS,
    });

    if (progressTimer) clearTimeout(progressTimer);
    const syncedSolves = countSolves(loop.done);
    if (syncedSolves > 0) {
        toastSettle(SYNC_TOAST_ID, 'success', i18n.t('offline.sync_done', { count: syncedSolves }));
    } else if (progressShown) {
        toastDismissId(SYNC_TOAST_ID);
    }

    if (loop.newlyStuck.length) {
        toastSettle(STUCK_TOAST_ID, 'warning', i18n.t('offline.sync_item_failed'));
    }

    if (loop.done.length) {
        // Sayfa yenilenince sunucudan taze veri çekilsin diye offlineHash'i sil
        deleteLocalStorage('offlineHash');
    }

    emitEvent('offlineSyncCompleted', { successCount: loop.done.length, failCount: loop.rejected.length });
    await scheduleRetry();

    return { sent: loop.done.length, rejected: loop.rejected.length, halted: loop.halted };
}

/**
 * Two tabs flushing the same queue send everything twice. The Web Locks API keeps it to
 * one: an automatic trigger that finds another tab flushing simply leaves it to that tab;
 * a trigger that must see the queue drained (the user asked, logout, launch) waits its turn.
 */
async function runExclusive(trigger: FlushTrigger): Promise<FlushResult> {
    const locks = typeof navigator !== 'undefined' ? (navigator as any).locks : undefined;
    if (!locks?.request) {
        return runFlush(trigger);
    }

    let result = NOTHING_DONE;
    try {
        if (!isForcingTrigger(trigger)) {
            await locks.request(LOCK_NAME, { ifAvailable: true }, async (lock: unknown) => {
                if (lock) result = await runFlush(trigger);
            });
        } else {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), LOCK_WAIT_MS);
            try {
                await locks.request(LOCK_NAME, { signal: controller.signal }, async () => {
                    clearTimeout(timer);
                    result = await runFlush(trigger);
                });
            } finally {
                clearTimeout(timer);
            }
        }
    } catch (e) {
        // Gave up waiting for another tab's flush, or the lock itself failed. The queue is
        // still intact; the next trigger picks it up.
        console.error('[offline-sync] flush skipped:', e);
    }
    return result;
}

/**
 * The one way to sync the queue. Resolves once the run it joined (or started) is over.
 */
export const requestQueueFlush = createFlushScheduler<FlushResult>(runExclusive, (result) => result.sent > 0);
