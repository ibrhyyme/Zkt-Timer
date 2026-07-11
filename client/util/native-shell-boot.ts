import {Capacitor} from '@capacitor/core';
import {isLocalShell} from './api-base';

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
			.then(({CapacitorUpdater}) => CapacitorUpdater.notifyAppReady())
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
