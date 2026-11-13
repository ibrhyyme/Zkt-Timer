import { gql } from '@apollo/client/core';
import { gqlQuery } from '../components/api';
import { getSolveDb } from '../db/solves/init';
import { getSessionDb } from '../db/sessions/init';
import { requestPersist } from '../db/persist';
import { canReadSync } from '../lib/sync-gate';
import { getStore } from '../components/store';
import { emitEvent } from './event_handler';
import { deleteLocalStorage, getLocalStorage, setLocalStorageObject } from './data/local_storage';

/**
 * Applies deletions made on any device (the server's DeletedRecord tombstones) to this
 * device's local data.
 *
 * Before this the only record of a deletion was the deleting device's own localStorage, so
 * every other device read "here but not on the server" as "not uploaded yet": the launch
 * reconcile refused a large removal as suspicious, and the backfill and the queue replay
 * then put the deleted solves and sessions back on the server. An explicit tombstone is not
 * ambiguous, so it is applied without that guard, before anything reconciles or uploads.
 *
 * Read sync only (Pro): a Basic device keeps its history local by design. The server refuses
 * a tombstoned id from every device either way.
 */

const CURSOR_KEY = 'zkt_server_deletions_cursor';

const MY_DELETED_RECORDS = gql`
	query MyDeletedRecords($since: Float) {
		myDeletedRecords(since: $since) {
			solve_ids
			session_ids
			cursor
		}
	}
`;

interface DeletedRecords {
	solve_ids: string[];
	session_ids: string[];
	cursor: number;
}

interface StoredCursor {
	userId: string;
	cursor: number;
}

function readCursor(userId: string): number | null {
	try {
		const stored = getLocalStorage(CURSOR_KEY) as StoredCursor | null;
		if (stored && stored.userId === userId && Number.isFinite(stored.cursor)) {
			return stored.cursor;
		}
	} catch {
		// unreadable: start from the beginning
	}
	return null;
}

function writeCursor(userId: string, cursor: number) {
	try {
		setLocalStorageObject(CURSOR_KEY, { userId, cursor });
	} catch {
		// the next run reads from further back, which is harmless
	}
}

export function clearServerDeletionsCursor() {
	try {
		deleteLocalStorage(CURSOR_KEY);
	} catch {
		// ignore
	}
}

function currentUserId(): string | null {
	try {
		return getStore()?.getState()?.account?.me?.id || null;
	} catch {
		return null;
	}
}

/** Removes from `collection` the documents whose id is in `ids`. Returns how many went. */
function removeByIds(collection: any, ids: string[]): number {
	if (!collection || !ids?.length) return 0;
	const wanted = new Set(ids);
	const rows = collection.where((doc: any) => wanted.has(doc.id));
	if (rows.length) collection.remove(rows);
	return rows.length;
}

/**
 * Returns whether the read succeeded. Resolves after the local removal is written to disk;
 * the cursor only moves then, so an app killed in between applies the same list again.
 */
export async function applyServerDeletions(): Promise<boolean> {
	const userId = currentUserId();
	if (!userId || !canReadSync()) return false;

	let records: DeletedRecords | undefined;
	try {
		const res = await gqlQuery<{ myDeletedRecords: DeletedRecords }>(MY_DELETED_RECORDS, {
			since: readCursor(userId),
		});
		records = res?.data?.myDeletedRecords;
	} catch (e) {
		console.error('[ServerDeletions] read failed', e);
		return false;
	}
	if (!records) return false;

	const solvesRemoved = removeByIds(getSolveDb(), records.solve_ids);
	const sessionsRemoved = removeByIds(getSessionDb(), records.session_ids);

	if (solvesRemoved) emitEvent('solveDbUpdatedEvent');
	if (sessionsRemoved) emitEvent('sessionsDbUpdatedEvent');

	if (solvesRemoved || sessionsRemoved) {
		await requestPersist({ destructive: true });
	}
	writeCursor(userId, records.cursor);
	return true;
}
