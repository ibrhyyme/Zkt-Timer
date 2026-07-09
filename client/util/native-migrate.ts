import {Consts} from '../shared/consts';
import {getApiBase, isLocalShell} from './api-base';
import {getNetworkStatus} from './native-plugins';

// One-time anonymous data bridge for the Faz 2 origin switch.
//
// Problem: the old remote-loading app stored anonymous solves/sessions/settings under
// the https://zktimer.app origin. The local-bundle shell runs on capacitor://localhost
// (different origin) and cannot read that storage. Logged-in users lose nothing
// (server resync), but anonymous users would.
//
// Bridge flow (no native code, no deep link needed):
//   1. Shell (anonymous, online, not yet migrated) sets a pending id and navigates
//      the WebView to https://zktimer.app/native-migrate?mid=<id> — a main-frame
//      navigation is the ONLY context with access to the old origin's IndexedDB.
//   2. That page (NativeMigrate.tsx) exports the old data, POSTs it to the
//      short-lived server stash under <id>, then calls history.back().
//   3. Back in the shell (bfcache restore or reload), the pending id is detected,
//      the stash is fetched cross-origin and imported into the local LokiJS.
const PENDING_KEY = 'zkt_migrate_pending';
const ATTEMPTS_KEY = 'zkt_migrate_attempts';
const DONE_KEY = 'zkt_native_migration_done';
const MAX_ATTEMPTS = 2;

// localStorage keys allowed to cross the bridge (cosmetic/config only, no secrets).
const ALLOWED_LS_KEYS = ['settings', 'zkt_theme', 'zkt_language'];

export interface NativeMigrationPayload {
	solves?: any[];
	sessions?: any[];
	local_storage?: Record<string, string>;
}

export async function maybeRunNativeMigration(): Promise<void> {
	if (!isLocalShell()) {
		return;
	}

	try {
		if (localStorage.getItem(DONE_KEY)) {
			return;
		}

		// Returning from the bridge page — consume the stash.
		const pendingMid = localStorage.getItem(PENDING_KEY);
		if (pendingMid) {
			await importFromStash(pendingMid);
			return;
		}

		// Logged-in transition: server resync restores everything, no bridge needed.
		if (localStorage.getItem('zkt_has_auth')) {
			localStorage.setItem(DONE_KEY, '1');
			return;
		}

		const attempts = parseInt(localStorage.getItem(ATTEMPTS_KEY) || '0', 10);
		if (attempts >= MAX_ATTEMPTS) {
			localStorage.setItem(DONE_KEY, '1');
			return;
		}

		const online = await getNetworkStatus();
		if (!online) {
			// Offline first boot: nothing to migrate from reachably — retry next boot.
			return;
		}

		const mid = randomMigrationId();
		localStorage.setItem(ATTEMPTS_KEY, String(attempts + 1));
		localStorage.setItem(PENDING_KEY, mid);
		window.location.href = `${Consts.STORAGE_ORIGIN}/native-migrate?mid=${mid}`;
	} catch (e) {
		// Migration must never block boot
	}
}

// history.back() from the bridge page may restore the shell from the back-forward
// cache, in which case the normal boot path doesn't re-run — catch it via pageshow.
export function registerMigrationReturnListener(): void {
	if (!isLocalShell()) {
		return;
	}

	window.addEventListener('pageshow', (e) => {
		if (!(e as PageTransitionEvent).persisted) {
			return;
		}
		const pendingMid = localStorage.getItem(PENDING_KEY);
		if (pendingMid && !localStorage.getItem(DONE_KEY)) {
			void importFromStash(pendingMid);
		}
	});
}

async function importFromStash(mid: string): Promise<void> {
	let imported = false;
	try {
		const res = await fetch(`${getApiBase()}/api/native-migrate/stash/${mid}`);
		if (res.ok) {
			const payload = (await res.json()) as NativeMigrationPayload;
			imported = await importPayload(payload);
		}
	} catch (e) {
		// Stash expired/unreachable: the data stays on the old origin; give up quietly
	} finally {
		localStorage.removeItem(PENDING_KEY);
		localStorage.setItem(DONE_KEY, '1');
		if (imported) {
			// Clean boot so the whole init pipeline reads the imported data.
			window.location.href = '/timer';
		}
	}
}

async function importPayload(payload: NativeMigrationPayload): Promise<boolean> {
	let imported = false;

	for (const key of ALLOWED_LS_KEYS) {
		const value = payload.local_storage?.[key];
		// Never overwrite: only fill keys the fresh shell hasn't written yet.
		if (value && !localStorage.getItem(key)) {
			localStorage.setItem(key, value);
			imported = true;
		}
	}

	const solves = payload.solves || [];
	const sessions = payload.sessions || [];
	if (solves.length || sessions.length) {
		const {initLokiDb, getLokiDb} = await import('../db/lokijs');
		const {initSolvesCollection, appendSolvesToDb} = await import('../db/solves/init');
		const {initSessionCollection, getSessionDb} = await import('../db/sessions/init');

		initLokiDb();
		await new Promise<void>((resolve) => getLokiDb().loadDatabase({}, () => resolve()));
		initSolvesCollection();
		initSessionCollection();

		for (const session of sessions) {
			if (session?.id && !getSessionDb().findOne({id: session.id})) {
				getSessionDb().insert(session);
			}
		}
		appendSolvesToDb(solves, true);

		await new Promise<void>((resolve) => getLokiDb().saveDatabase(() => resolve()));
		imported = true;
	}

	return imported;
}

function randomMigrationId(): string {
	const buf = new Uint8Array(16);
	window.crypto.getRandomValues(buf);
	return Array.from(buf)
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}
