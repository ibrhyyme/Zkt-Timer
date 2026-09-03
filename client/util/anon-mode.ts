// Helpers for the signed-out visitor.
//
// An anonymous visitor's solves live in their own IndexedDB database (ANON_DB_NAME)
// and never reach the server — `canWriteSync()` is `!!me`, so every mutation path is
// already closed. What is left is knowing, once they do sign up, that there is
// something on this device worth offering to move.

import Loki from 'lokijs';
import LokiIndexDbAdaptor from 'lokijs/src/loki-indexed-adapter.js';
import {getLocalStorage, setLocalStorage, deleteLocalStorage} from './data/local_storage';
import {getSolveDb} from '../db/solves/init';
import {ANON_DB_NAME, stripLokiJsMetadata} from '../db/lokijs';
import {canWriteSync} from '../lib/sync-gate';
import {SessionInput, SolveInput} from '../@types/generated/graphql';

const ANON_SOLVE_COUNT_KEY = 'zkt_anon_solve_count';

/**
 * How many solves the anonymous database holds.
 *
 * Read from localStorage rather than the database itself: a signed-in boot has the
 * account's database open, and opening the anonymous one to count rows would tear
 * that connection down (initLokiDb swaps the single shared instance). A number in
 * localStorage answers the same question for free.
 */
export function getAnonSolveCount(): number {
	try {
		const raw = getLocalStorage(ANON_SOLVE_COUNT_KEY);
		const n = parseInt(raw || '0', 10);
		return Number.isFinite(n) && n > 0 ? n : 0;
	} catch {
		return 0;
	}
}

/**
 * Refresh the counter after a local write. No-op for signed-in users, whose solves
 * are on the server and have nothing to do with this number.
 */
export function syncAnonSolveCount() {
	if (typeof window === 'undefined') return;
	if (canWriteSync()) return;

	try {
		const db = getSolveDb();
		if (!db) return;
		setLocalStorage(ANON_SOLVE_COUNT_KEY, String(db.count()));
	} catch {
		// A broken counter must never take a solve down with it.
	}
}

/** Called once the anonymous data has been transferred (or deliberately discarded). */
export function clearAnonSolveCount() {
	try {
		deleteLocalStorage(ANON_SOLVE_COUNT_KEY);
	} catch {}
}

// ---------------------------------------------------------------------------
// Reading the anonymous database from a signed-in session
// ---------------------------------------------------------------------------

/**
 * Open the anonymous database as its OWN Loki instance.
 *
 * Not `initLokiDb`: that swaps the single shared instance, which during a signed-in
 * session would close the account's database out from under the running app. This
 * one is opened, read and thrown away.
 */
function openAnonDbStandalone(): Promise<Loki | null> {
	return new Promise((resolve) => {
		if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
			resolve(null);
			return;
		}

		try {
			const db = new Loki(ANON_DB_NAME, {
				adapter: new LokiIndexDbAdaptor(),
				autosave: false,
				autoload: false,
			} as any);

			const timeout = setTimeout(() => resolve(null), 8000);
			db.loadDatabase(undefined, (err) => {
				clearTimeout(timeout);
				resolve(err ? null : db);
			});
		} catch {
			resolve(null);
		}
	});
}

export interface AnonSnapshot {
	solves: SolveInput[];
	sessions: SessionInput[];
}

// A local row is not a GraphQL input, and the difference is not cosmetic: graphql-js
// rejects an input object carrying a field the schema does not declare, and it does so
// during validation, before the resolver runs. One stray field therefore fails the whole
// mutation, not the row that carried it.
//
// That is what broke the first transfer in the field. `ensureLocalDefaultSession` stamps
// every anonymous session with `created_at` and `user_id: '_local'`, neither of which
// exists on SessionInput, so the session batch was refused every time and the prompt fell
// through to "some of them could not be moved" with nothing moved at all.
//
// Whitelists, not deletions: a field added to the local row later must not silently start
// travelling to the server. These mirror `input SessionInput` and `input SolveInput` in
// schema.graphql.
export const SESSION_INPUT_FIELDS: (keyof SessionInput)[] = ['id', 'name', 'order'];

export const SOLVE_INPUT_FIELDS: (keyof SolveInput)[] = [
	'id',
	'time',
	'raw_time',
	'cube_type',
	'scramble_subset',
	'scramble',
	'session_id',
	'started_at',
	'ended_at',
	'dnf',
	'plus_two',
	'bulk',
	'notes',
	'from_timer',
	'trainer_name',
	'is_smart_cube',
	'training_session_id',
	'smart_device_id',
	'smart_turn_count',
	'smart_turns',
	'smart_put_down_time',
	'smart_pick_up_time',
	'inspection_time',
	'phase_splits',
	// `analysis_method` is deliberately absent. The schema accepts it, but it is an
	// instruction to the resolver rather than a stored column, and `sanitizeSolve` strips
	// it on the normal save path too.
];

function pickFields<T>(row: any, fields: (keyof T)[]): T {
	const out: any = {};
	for (const field of fields) {
		if (row[field] !== undefined) out[field] = row[field];
	}
	return out as T;
}

/** Everything the anonymous visitor accumulated, shaped for the import mutations. */
export async function readAnonSnapshot(): Promise<AnonSnapshot | null> {
	const db = await openAnonDbStandalone();
	if (!db) return null;

	try {
		const solves = db.getCollection('solves')?.find() || [];
		const sessions = db.getCollection('sessions')?.find() || [];
		return {
			solves: solves.map(stripLokiJsMetadata).map((row) => pickFields<SolveInput>(row, SOLVE_INPUT_FIELDS)),
			sessions: sessions
				.map(stripLokiJsMetadata)
				.map((row) => pickFields<SessionInput>(row, SESSION_INPUT_FIELDS)),
		};
	} catch {
		return null;
	}
}

/**
 * Drop the anonymous database for good.
 *
 * Only ever called after a transfer that reported zero failures — a partial import
 * must leave the local copy exactly where it is, because it is the only copy.
 */
export async function deleteAnonData(): Promise<void> {
	const db = await openAnonDbStandalone();
	if (!db) {
		clearAnonSolveCount();
		return;
	}

	await new Promise<void>((resolve) => {
		try {
			db.deleteDatabase(() => resolve());
		} catch {
			resolve();
		}
	});
	clearAnonSolveCount();
}
