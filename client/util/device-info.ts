import {Capacitor} from '@capacitor/core';
import {isNative} from './platform';

/**
 * What device a session is running on, for support tickets and crash reports.
 *
 * Two fields carry most of the diagnostic weight. `webViewVersion` decides which
 * Chromium behaviours apply (the Capacitor 8 keyboard regression only reproduced on
 * WebView >= 140), and `otaBundle` names the JS bundle actually on screen, which the
 * native app version does not — an OTA update changes the app without changing the
 * store version.
 */
export interface DeviceInfoSnapshot {
	platform: string;
	operatingSystem?: string;
	osVersion?: string;
	manufacturer?: string;
	model?: string;
	webViewVersion?: string;
	isVirtual?: boolean;
	/** Native app version (store version), absent on web. */
	appVersion?: string;
	/** Native build number, absent on web. */
	appBuild?: string;
	/** Capgo OTA bundle version, 'builtin' when the shipped bundle is running. */
	otaBundle?: string;
	language?: string;
}

// Nothing here changes during a session, and every consumer wants it at a moment
// where an extra round trip to the native layer would be on a user-visible path.
let cached: DeviceInfoSnapshot | null = null;

async function readOtaBundleVersion(): Promise<string | undefined> {
	if (!isNative() || !Capacitor.isPluginAvailable('CapacitorUpdater')) return undefined;
	try {
		const {CapacitorUpdater} = await import('@capgo/capacitor-updater');
		const current = await CapacitorUpdater.current();
		return current?.bundle?.version;
	} catch (e) {
		return undefined;
	}
}

async function readAppInfo(): Promise<{appVersion?: string; appBuild?: string}> {
	// App.getInfo() is native-only; on web it rejects with "not implemented".
	if (!isNative()) return {};
	try {
		const {App} = await import('@capacitor/app');
		const info = await App.getInfo();
		return {appVersion: info.version, appBuild: info.build};
	} catch (e) {
		return {};
	}
}

/**
 * Device snapshot. Works on web too — the Device plugin reports browser and OS there,
 * so a ticket opened from the website is just as identifiable as one from the app.
 */
export async function getDeviceInfo(): Promise<DeviceInfoSnapshot> {
	if (cached) return cached;

	const snapshot: DeviceInfoSnapshot = {platform: Capacitor.getPlatform()};

	try {
		const {Device} = await import('@capacitor/device');
		const info = await Device.getInfo();
		snapshot.operatingSystem = info.operatingSystem;
		snapshot.osVersion = info.osVersion;
		snapshot.manufacturer = info.manufacturer;
		snapshot.model = info.model;
		snapshot.webViewVersion = info.webViewVersion;
		snapshot.isVirtual = info.isVirtual;
	} catch (e) {
		// Leave the fields undefined: a partial snapshot still beats none.
	}

	const [appInfo, otaBundle] = await Promise.all([readAppInfo(), readOtaBundleVersion()]);
	snapshot.appVersion = appInfo.appVersion;
	snapshot.appBuild = appInfo.appBuild;
	snapshot.otaBundle = otaBundle;

	if (typeof navigator !== 'undefined') {
		snapshot.language = navigator.language;
	}

	cached = snapshot;
	return snapshot;
}

/** Serialised snapshot for storage alongside a support ticket, or undefined if it cannot be read. */
export async function collectDeviceInfo(): Promise<string | undefined> {
	try {
		return JSON.stringify(await getDeviceInfo());
	} catch (e) {
		return undefined;
	}
}
