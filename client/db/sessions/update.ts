import { gqlMutateTyped } from '../../components/api';
import { getSessionDb } from './init';
import { emitEvent } from '../../util/event_handler';
import { getSolveDb } from '../solves/init';
import { clearSolveStatCache, clearSolveStatCacheForSession } from '../solves/stats/solves/caching';
import { Session } from '../../../server/schemas/Session.schema';
import {
	BulkDeleteSessionsDocument,
	CreateSessionDocument,
	DeleteSessionDocument,
	MergeSessionsDocument,
	ReorderSessionsDocument,
	UpdateSessionDocument,
} from '../../@types/generated/graphql';
import { fetchSessionById, fetchSessions } from './query';
import { canWriteSync } from '../../lib/sync-gate';
import { requestPersist } from '../persist';
import { generateId } from '../../../shared/code';
import { recordDeletedSolves } from '../../components/daily-goal/helpers/deleted-solves';
import { addToQueue, transformQueue } from '../../util/offline-queue';
import { requestQueueFlush } from '../../util/offline-sync';
import { isConnectivityError } from '../../util/offline-replay';
import { toSessionInput } from '../solves/solve-input';
import { toastError, toastWarning } from '../../util/toast';
import i18n from '../../i18n/i18n';

// Offline model for sessions: creating, renaming and reordering work without a connection
// (queued, replayed in order before the solves that depend on them). Deleting and merging
// do not: they go to the server first and only then change local data. Done locally while
// offline, they used to be silently undone by the next reconciliation (the server still had
// the session) and a merge left this device and the server disagreeing about every solve.

export async function createSessionDb(sessionInput: Partial<Session>) {
	const sessionDb = getSessionDb();
	let session = sessionInput as Session;
	let queueCreate = false;

	if (canWriteSync()) {
		try {
			const res = await gqlMutateTyped(CreateSessionDocument, {
				input: {
					name: session.name,
				},
			});
			session = res.data.createSession as Session;
		} catch (e) {
			// Only a connection failure falls back to a local session. A refusal (an invalid
			// name) is the user's to see: a local session made from it would be refused
			// again on every sync, and its solves with it.
			if (!isConnectivityError(e)) {
				throw e;
			}
			console.error('Failed to create session on server, falling back to local', e);
			session = { ...session, id: generateId() } as Session;
			queueCreate = true;
		}
	} else {
		session = { ...session, id: generateId() } as Session;
	}

	const nextOrder = fetchSessions().length;

	sessionDb.insert({
		...session,
		order: session.order ?? nextOrder,
	});
	updateLocalDbOrderValueForAllSessions();

	if (queueCreate) {
		// Before any solve can be timed in it: the queue replays in order, so the session
		// always reaches the server ahead of its solves. Reconciliation also reads this
		// record as "not deleted elsewhere, just not sent yet".
		await addToQueue('createSession', { session: toSessionInput(fetchSessionById(session.id) || session) });
	}

	postProcessDbUpdate(session, false);

	return session;
}

/**
 * Sends a destructive session change to the server before any local data is touched.
 * Returns whether the local change should go ahead.
 *
 * Anything still queued is flushed first, so the server has seen every session and solve
 * this device knows about. The server's NOT_FOUND means it never had the session (a local
 * default session, or one whose creation is still queued): the change is then purely local.
 */
async function confirmOnServer(sendToServer: () => Promise<unknown>): Promise<boolean> {
	if (!canWriteSync()) {
		return true;
	}

	try {
		await requestQueueFlush('manual');
	} catch (e) {
		// A failed flush is not a reason to refuse; the server call below decides
	}

	try {
		await sendToServer();
		return true;
	} catch (e: any) {
		if (isConnectivityError(e)) {
			toastWarning(i18n.t('offline.requires_connection'));
			return false;
		}
		const codes = (e?.graphQLErrors || []).map((err: any) => err?.extensions?.code);
		if (codes.includes('NOT_FOUND')) {
			return true;
		}
		console.error('Session change refused by the server', e);
		toastError(e);
		return false;
	}
}

/**
 * Queued records for sessions that were just deleted locally, and for the solves that went
 * with them, can only do harm now: a queued solve create for a vanished session would be
 * "rescued" into another session on replay, bringing back a solve the user deleted.
 */
async function purgeQueuedForSessions(sessionIds: string[], solveIds: string[]): Promise<void> {
	const sessions = new Set(sessionIds);
	const solves = new Set(solveIds);

	await transformQueue((m) => {
		const v = m.variables || {};
		switch (m.mutationName) {
			case 'createSession':
				return sessions.has(v.session?.id) ? null : m;
			case 'updateSession':
				return sessions.has(v.id) ? null : m;
			case 'createSolve':
				return sessions.has(v.input?.session_id) || solves.has(v.input?.id) ? null : m;
			case 'updateSolve':
				return solves.has(v.id) ? null : m;
			default:
				return m;
		}
	});
}

/** deleteSessionDb and friends run `onConfirmed` after the server agreed, before the local change. */
export async function deleteSessionDb(session: Session, onConfirmed?: () => void): Promise<boolean> {
	const confirmed = await confirmOnServer(() =>
		gqlMutateTyped(DeleteSessionDocument, {
			id: session.id,
		})
	);
	if (!confirmed) {
		return false;
	}

	onConfirmed?.();

	const sessionDb = getSessionDb();
	const solveDb = getSolveDb();

	// Deleting a session deletes its solves, so they are tallied like any other deletion
	const removedSolves = solveDb.find({session_id: session.id});
	const stored = sessionDb.findOne({id: session.id});
	if (stored) {
		sessionDb.remove(stored);
	}
	solveDb.removeWhere({
		session_id: session.id,
	});
	recordDeletedSolves(removedSolves);

	postProcessDbUpdate(session, true, true);
	updateLocalDbOrderValueForAllSessions();

	await purgeQueuedForSessions(
		[session.id],
		removedSolves.map((s) => s.id)
	);

	return true;
}

export async function bulkDeleteSessionsDb(ids: string[], onConfirmed?: () => void): Promise<boolean> {
	if (!ids.length) return false;

	const confirmed = await confirmOnServer(() => gqlMutateTyped(BulkDeleteSessionsDocument, {ids}));
	if (!confirmed) {
		return false;
	}

	onConfirmed?.();

	const sessionDb = getSessionDb();
	const solveDb = getSolveDb();

	const removedSolves = solveDb.find({session_id: {$in: ids}});
	sessionDb.removeWhere((s) => ids.includes(s.id));
	solveDb.removeWhere((s) => ids.includes(s.session_id));
	recordDeletedSolves(removedSolves);

	const remainingIds = fetchSessions().map((s) => s.id);
	for (let i = 0; i < remainingIds.length; i += 1) {
		const sid = remainingIds[i];
		const session = fetchSessionById(sid);
		sessionDb.update({...session, order: i});
	}

	for (const id of ids) {
		clearSolveStatCacheForSession(id);
	}
	emitEvent('solveDbUpdatedEvent');
	emitEvent('sessionsDbUpdatedEvent');

	void requestPersist({ destructive: true });

	await purgeQueuedForSessions(
		ids,
		removedSolves.map((s) => s.id)
	);

	return true;
}

export async function reorderSessions(sessionIds: string[]) {
	const validIds = sessionIds.filter(Boolean);
	if (!validIds.length) return;

	updateLocalDbOrderValuesForSessionIds(validIds);

	if (canWriteSync()) {
		try {
			await gqlMutateTyped(ReorderSessionsDocument, {
				ids: validIds,
			});
		} catch (e) {
			if (isConnectivityError(e)) {
				await addToQueue('reorderSessions', { ids: validIds });
			} else {
				console.error('reorderSessions failed', e);
			}
		}
	}
}

function updateLocalDbOrderValueForAllSessions() {
	const sessionIds = fetchSessions().map((s) => s.id);
	updateLocalDbOrderValuesForSessionIds(sessionIds);
}

function updateLocalDbOrderValuesForSessionIds(ids: string[]) {
	const sessionDb = getSessionDb();

	for (let i = 0; i < ids.length; i += 1) {
		const sessionId = ids[i];
		const session = fetchSessionById(sessionId);

		const updated = sessionDb.update({
			...session,
			order: i,
		});

		postProcessDbUpdate(updated, false);
	}
}

export async function updateSessionDb(session: Session, input: Partial<Session>) {
	const sessionDb = getSessionDb();

	sessionDb.update({
		...session,
		...input,
	});
	postProcessDbUpdate(session, false);

	if (canWriteSync()) {
		try {
			await gqlMutateTyped(UpdateSessionDocument, {
				id: session.id,
				input: {
					...input,
				},
			});
		} catch (e) {
			if (isConnectivityError(e)) {
				await addToQueue('updateSession', { id: session.id, input: toSessionInput(input) });
			} else {
				console.error('updateSession failed', e);
				toastError(e as Error);
			}
		}
	}
}

export async function mergeSessionsDb(oldSessionId: string, newSessionId: string): Promise<boolean> {
	const confirmed = await confirmOnServer(() =>
		gqlMutateTyped(MergeSessionsDocument, {
			oldSessionId,
			newSessionId,
		})
	);
	if (!confirmed) {
		return false;
	}

	const solvesDb = getSolveDb();
	const sessionsDb = getSessionDb();

	// First, update all the solves with the old session ID to have the Yeni Sezon ID
	solvesDb.findAndUpdate(
		{
			session_id: oldSessionId,
		},
		(solve) => {
			solve.session_id = newSessionId;
		}
	);

	// Next, delete the old session from the local DB
	const oldSession = fetchSessionById(oldSessionId);
	const newSession = fetchSessionById(newSessionId);

	sessionsDb.remove(oldSession);

	// Finally, update the database
	postProcessDbUpdate(oldSession, true, true);
	postProcessDbUpdate(newSession, true);
	updateLocalDbOrderValueForAllSessions();

	// Queued solves still name the old session. Point them at the one they now belong to,
	// and drop what only concerned the old session (its pending creation, a rename).
	await transformQueue((m) => {
		const v = m.variables || {};
		if (m.mutationName === 'createSession' && v.session?.id === oldSessionId) return null;
		if (m.mutationName === 'updateSession' && v.id === oldSessionId) return null;
		if (m.mutationName === 'createSolve' && v.input?.session_id === oldSessionId) {
			return { ...m, variables: { ...v, input: { ...v.input, session_id: newSessionId } } };
		}
		if (m.mutationName === 'updateSolve' && v.input?.session_id === oldSessionId) {
			return { ...m, variables: { ...v, input: { ...v.input, session_id: newSessionId } } };
		}
		return m;
	});

	return true;
}

/**
 * `destructive` for a deleted or merged-away session: its offline hash goes out at once so
 * no other device can open in between and re-upload what was removed (persist-scheduler.ts).
 * Everything else is written out with the next scheduled save; reordering, which calls this
 * once per session, used to serialise the whole database and send a request each time.
 */
function postProcessDbUpdate(session: Session, clearSolveCache = true, destructive = false) {
	if (clearSolveCache) {
		clearSolveStatCache({
			filterOptions: {
				session_id: session.id,
			},
		});
	}

	emitEvent('solveDbUpdatedEvent');
	emitEvent('sessionsDbUpdatedEvent', session);

	void requestPersist({ destructive });
}
