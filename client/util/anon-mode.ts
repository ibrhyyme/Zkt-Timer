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
	solves: any[];
	sessions: any[];
}

/** Everything the anonymous visitor accumulated, ready to be handed to the importer. */
export async function readAnonSnapshot(): Promise<AnonSnapshot | null> {
	const db = await openAnonDbStandalone();
	if (!db) return null;

	try {
		const solves = db.getCollection('solves')?.find() || [];
		const sessions = db.getCollection('sessions')?.find() || [];
		return {
			solves: solves.map(stripLokiJsMetadata),
			sessions: sessions.map(stripLokiJsMetadata),
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
