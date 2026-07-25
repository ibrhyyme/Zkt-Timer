import {Capacitor} from '@capacitor/core';
import type {CapacitorUpdaterPlugin} from '@capgo/capacitor-updater';
import {isLocalShell} from './api-base';

// Remembers the bundle version we last tried to apply. A version that fails to boot
// (rollback) or fails to download must not be retried on every launch — that would
// reload-loop the app.
const OTA_ATTEMPT_KEY = 'zkt_ota_attempted_version';

/**
 * Applies a pending OTA bundle at boot instead of waiting for the next cold start.
 *
 * With plain `autoUpdate`, Capgo downloads in the background and only swaps the bundle on
 * the FOLLOWING launch, so a device can sit a full deploy behind while the user is looking
 * at it — the source of "it works on iOS but not on Android" after a web-only fix. Doing
 * download -> set -> reload here is the JS equivalent of the plugin's `directUpdate`
 * config flag, without needing a new native binary to turn it on.
 */
async function applyLatestBundleAtBoot(updater: CapacitorUpdaterPlugin): Promise<void> {
	const [current, latest] = await Promise.all([updater.current(), updater.getLatest()]);

	if (!latest?.version || latest.error || !latest.url) {
		return;
	}

	if (current?.bundle?.version === latest.version) {
		// Running the newest bundle — clear the guard so the next version can be attempted.
		try {
			localStorage.removeItem(OTA_ATTEMPT_KEY);
		} catch (e) {}
		return;
	}

	let attempted: string | null = null;
	try {
		attempted = localStorage.getItem(OTA_ATTEMPT_KEY);
	} catch (e) {}
	if (attempted === latest.version) {
		return;
	}
	try {
		localStorage.setItem(OTA_ATTEMPT_KEY, latest.version);
	} catch (e) {}

	const bundle = await updater.download({
		url: latest.url,
		version: latest.version,
		checksum: latest.checksum,
		sessionKey: latest.sessionKey,
	});
	await updater.set({id: bundle.id});
	await updater.reload();
}

// Boot-time duties that only exist in the Faz 2 local-bundle shell. No-op on web
// and on old remote-loading binaries (isLocalShell false), so shipping this via web
// deploy is safe.
export function initNativeShellBoot(): void {
	if (!isLocalShell()) {
		return;
	}

	// On-device DevTools (console + network panels), hidden behind a manual flag so
	// end users never see it. To enable on a device, run in any in-app console (or
	// have the app evaluate): localStorage.setItem('zkt_debug', '1') and restart;
	// remove the key to disable. Loaded dynamically, so it costs nothing when off.
	let debugEnabled = false;
	try {
		debugEnabled = localStorage.getItem('zkt_debug') === '1';
	} catch (e) {}
	if (debugEnabled) {
		import('eruda')
			.then((mod) => {
				const eruda = (mod as any).default || mod;
				eruda.init();
			})
			.catch(() => {});
	}

	// Capgo: confirm this bundle boots successfully — if this call never arrives
	// within appReadyTimeout after an OTA update, the plugin rolls back to the
	// previous bundle (the guard against shipping a broken update).
	if (Capacitor.isPluginAvailable('CapacitorUpdater')) {
		import('@capgo/capacitor-updater')
			.then(async ({CapacitorUpdater}) => {
				await CapacitorUpdater.notifyAppReady();
				await applyLatestBundleAtBoot(CapacitorUpdater);
			})
			.catch(() => {});
	}

	// One-time anonymous data bridge from the old remote origin (see native-migrate.ts)
	import('./native-migrate')
		.then(({registerMigrationReturnListener, maybeRunNativeMigration}) => {
			registerMigrationReturnListener();
			return maybeRunNativeMigration();
		})
		.catch(() => {});
}
