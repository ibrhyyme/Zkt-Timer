import {Capacitor} from '@capacitor/core';
import type {CapacitorUpdaterPlugin} from '@capgo/capacitor-updater';
import {isLocalShell} from './api-base';
import {getStore} from '../components/store';

// Remembers the bundle version that was downloaded and handed to the plugin. A bundle
// that fails to boot gets rolled back by Capgo, and without this guard the next launch
// would fetch and apply it again, reload-looping the app.
//
// It is written AFTER the download, not before. Those are two different failures: a
// download cut short by the user closing the app is worth retrying immediately, while a
// bundle that crashes on boot is not. Marking before the download conflated them and
// left anyone who backgrounded the app mid-download stranded on the old bundle until
// the next deploy, which is the opposite of what an updater is for.
const OTA_ATTEMPT_KEY = 'zkt_ota_attempted_version';

// How long to keep waiting for a solve to finish before reloading anyway. Bounded so
// a stuck flag can never park an update forever; the bundle is applied either way.
const RELOAD_WAIT_TIMEOUT_MS = 60 * 1000;
const RELOAD_POLL_MS = 1000;

/**
 * Holds a reload or restart until the timer is idle.
 *
 * The bundle swap reloads the WebView, and doing that under someone mid-solve destroys
 * the one thing this app exists to measure. Everything else about the reload stays as
 * it was: this only moves it by a few seconds, never cancels it. Shared with the store
 * update flow (util/app-update.ts), whose install restarts the whole app.
 */
export async function waitUntilNotSolving(): Promise<void> {
	const deadline = Date.now() + RELOAD_WAIT_TIMEOUT_MS;

	while (Date.now() < deadline) {
		let solving = false;
		try {
			solving = Boolean(getStore()?.getState()?.timer?.solving);
		} catch (e) {
			// No store yet: nothing is being timed, so there is nothing to protect.
		}
		if (!solving) return;

		await new Promise((resolve) => setTimeout(resolve, RELOAD_POLL_MS));
	}
}

/**
 * Applies a pending OTA bundle at boot instead of waiting for the next cold start.
 *
 * With plain `autoUpdate`, Capgo downloads in the background and only swaps the bundle on
 * the FOLLOWING launch, so a device can sit a full deploy behind while the user is looking
 * at it, which is where "it works on iOS but not on Android" after a web-only fix came
 * from. Doing download -> set -> reload here is the JS equivalent of the plugin's
 * `directUpdate` config flag, without needing a new native binary to turn it on.
 *
 * The cost is a reload a few seconds into a session, which is worth revisiting: applying
 * on the next return-from-background would be gentler. That change needs to be verified
 * on a real device before it ships, because getting it wrong means updates stop arriving
 * and the fix for that cannot be delivered either.
 */
export async function armLatestBundle(updater: CapacitorUpdaterPlugin): Promise<void> {
	const [current, latest] = await Promise.all([updater.current(), updater.getLatest()]);

	if (!latest?.version || latest.error || !latest.url) {
		return;
	}

	if (current?.bundle?.version === latest.version) {
		// Running the newest bundle: clear the guard so the next version can be tried.
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

	const bundle = await updater.download({
		url: latest.url,
		version: latest.version,
		checksum: latest.checksum,
		sessionKey: latest.sessionKey,
	});

	// Downloaded successfully, so from here a failure is the bundle's fault and must
	// not be retried on the next launch.
	try {
		localStorage.setItem(OTA_ATTEMPT_KEY, latest.version);
	} catch (e) {}

	await updater.set({id: bundle.id});
	await waitUntilNotSolving();
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
				await armLatestBundle(CapacitorUpdater);
			})
			.catch(() => {})
			// Store update check runs after the OTA one, never alongside it: an OTA that
			// is about to reload the WebView should not be racing a Play dialog. If the
			// OTA reloaded, this never runs — the fresh boot checks again.
			.then(() => import('./app-update'))
			.then(({checkAppUpdate}) => checkAppUpdate())
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
