import type {PrismaClient} from '@prisma/client';

/**
 * Server-side deletion tombstones (DeletedRecord).
 *
 * A device that has not caught up with a deletion made on another device still holds the
 * deleted solves and sessions, and every path that uploads local data (launch backfill,
 * offline queue replay, a session sent ahead of its solve) used to put them back. The
 * tombstones used to live only in the deleting device's localStorage, so no other device
 * could tell "deleted elsewhere" from "not uploaded yet". Recorded here, the server refuses
 * the id from any device, old app versions included, and devices read the list to drop
 * their own copies (myDeletedRecords).
 *
 * Tombstones are kept for good: ids are never reused, and a device can come back after
 * months offline.
 */

export type DeletedKind = 'solve' | 'session';

// Three bound parameters per row; Postgres allows 32767 per statement.
const CHUNK = 5000;

/**
 * The writes that record `ids` as deleted, for use inside the same $transaction as the
 * delete itself: a tombstone without its delete would make every device drop data the
 * server still has.
 */
export function tombstoneWrites(prisma: PrismaClient, userId: string, kind: DeletedKind, ids: string[]) {
	const unique = Array.from(new Set(ids.filter((id) => typeof id === 'string' && id)));
	const writes = [];
	for (let i = 0; i < unique.length; i += CHUNK) {
		writes.push(
			prisma.deletedRecord.createMany({
				data: unique.slice(i, i + CHUNK).map((record_id) => ({user_id: userId, kind, record_id})),
				skipDuplicates: true,
			})
		);
	}
	return writes;
}

/** Which of `ids` this user has deleted. */
export async function findTombstoned(
	prisma: PrismaClient,
	userId: string,
	kind: DeletedKind,
	ids: string[]
): Promise<Set<string>> {
	const wanted = ids.filter((id) => typeof id === 'string' && id);
	if (!wanted.length) return new Set();

	const rows = await prisma.deletedRecord.findMany({
		where: {user_id: userId, kind, record_id: {in: wanted}},
		select: {record_id: true},
	});
	return new Set(rows.map((r) => r.record_id));
}

export async function isTombstoned(prisma: PrismaClient, userId: string, kind: DeletedKind, id: string) {
	if (!id) return false;
	const row = await prisma.deletedRecord.findUnique({
		where: {user_id_kind_record_id: {user_id: userId, kind, record_id: id}},
		select: {record_id: true},
	});
	return !!row;
}

// A tombstone committed a moment after the read below would be missed by a cursor taken at
// the read itself, so the cursor handed back trails it; re-reading a minute is idempotent.
export const DELETED_CURSOR_OVERLAP_MS = 60_000;

/** Ids this user deleted after `sinceMs` (all of them for null), and the next cursor. */
export async function listDeletedSince(prisma: PrismaClient, userId: string, sinceMs: number | null) {
	const readAt = Date.now();
	const rows = await prisma.deletedRecord.findMany({
		where: {
			user_id: userId,
			...(sinceMs != null && Number.isFinite(sinceMs) ? {deleted_at: {gt: new Date(sinceMs)}} : {}),
		},
		select: {kind: true, record_id: true},
	});

	const solve_ids: string[] = [];
	const session_ids: string[] = [];
	for (const row of rows) {
		if (row.kind === 'solve') solve_ids.push(row.record_id);
		else if (row.kind === 'session') session_ids.push(row.record_id);
	}

	return {solve_ids, session_ids, cursor: readAt - DELETED_CURSOR_OVERLAP_MS};
}
