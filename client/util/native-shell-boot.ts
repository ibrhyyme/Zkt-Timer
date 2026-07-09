import {Capacitor} from '@capacitor/core';
import {isLocalShell} from './api-base';

// Boot-time duties that only exist in the Faz 2 local-bundle shell. No-op on web
// and on old remote-loading binaries (isLocalShell false), so shipping this via web
// deploy is safe.
export function initNativeShellBoot(): void {
	if (!isLocalShell()) {
		return;
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
