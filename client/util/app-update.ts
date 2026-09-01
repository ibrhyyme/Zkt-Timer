import {Capacitor} from '@capacitor/core';
import i18n from '../i18n/i18n';
import {isNative} from './platform';
import {toastInfo} from './toast';
import {waitUntilNotSolving} from './native-shell-boot';

// Play's own dialog is what the user actually answers, so this only governs how often
// the app is allowed to raise the subject at all.
const LAST_PROMPT_KEY = 'zkt_app_update_prompted_on';

function promptedToday(): boolean {
	try {
		return localStorage.getItem(LAST_PROMPT_KEY) === new Date().toDateString();
	} catch (e) {
		// Storage blocked: better to ask once per launch than never.
		return false;
	}
}

function markPromptedToday(): void {
	try {
		localStorage.setItem(LAST_PROMPT_KEY, new Date().toDateString());
	} catch (e) {}
}

/**
 * Tells the user when the store has a newer build than the one they are running.
 *
 * The Capgo OTA updater next door only replaces the web bundle. Anything native (a
 * plugin, a Capacitor upgrade, a manifest change) needs a store update, and until now
 * nothing told the user that: they simply kept running the old binary, and the
 * `min_native` gate in build-ota-zip.js quietly withheld web updates from them too.
 *
 * Android gets Play's flexible flow, which downloads in the background and leaves the
 * user working. iOS has no in-app update API, so it gets a single notice.
 */
export async function checkAppUpdate(): Promise<void> {
	if (!isNative()) return;

	try {
		const {AppUpdate, AppUpdateAvailability, FlexibleUpdateInstallStatus} = await import(
			'@capawesome/capacitor-app-update'
		);
		const result = await AppUpdate.getAppUpdateInfo();

		// A previous session already downloaded it; install now that we are at a safe point.
		if (Capacitor.getPlatform() === 'android' && result.installStatus === FlexibleUpdateInstallStatus.DOWNLOADED) {
			await finishFlexibleUpdate(AppUpdate);
			return;
		}

		if (result.updateAvailability !== AppUpdateAvailability.UPDATE_AVAILABLE) return;
		if (promptedToday()) return;
		markPromptedToday();

		if (Capacitor.getPlatform() !== 'android') {
			// No in-app flow on iOS. Say it once and let the user decide; yanking someone
			// into the App Store mid-session is worse than the stale build. The key is
			// named _ios because the copy names that store: Android never reaches this
			// line, it gets Play's own update dialog from startFlexibleUpdate() below.
			toastInfo(i18n.t('app_update.available_ios'));
			return;
		}

		await AppUpdate.startFlexibleUpdate();

		// The download outlives this call, so the completion is handled by a listener.
		AppUpdate.addListener('onFlexibleUpdateStateChange', (state) => {
			if (state.installStatus === FlexibleUpdateInstallStatus.DOWNLOADED) {
				finishFlexibleUpdate(AppUpdate).catch(() => {});
			}
		});
	} catch (e) {
		// Not installed from Play, no network, store listing unavailable: never fatal.
		console.warn('[AppUpdate] check failed:', e);
	}
}

type AppUpdatePlugin = typeof import('@capawesome/capacitor-app-update')['AppUpdate'];

/**
 * Installing restarts the app, which is the one thing this product must not do to
 * someone mid-solve, so it waits for the timer to be idle exactly like the OTA reload.
 */
async function finishFlexibleUpdate(AppUpdate: AppUpdatePlugin): Promise<void> {
	await waitUntilNotSolving();
	toastInfo(i18n.t('app_update.installing'));
	await AppUpdate.completeFlexibleUpdate();
}
