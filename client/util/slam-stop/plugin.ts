import { Capacitor, registerPlugin, PluginListenerHandle } from '@capacitor/core';
import { isNative } from '../platform';

export interface SlamEvent {
	timestamp: number; // epoch ms, emitted at detection time on the native side
	magnitude: number; // |magnitude - 1g| deviation in g
}

interface SlamDetectorNativePlugin {
	start(options: { threshold: number; refractoryMs: number }): Promise<void>;
	stop(): Promise<void>;
	addListener(eventName: 'slam', listener: (event: SlamEvent) => void): Promise<PluginListenerHandle>;
}

const SlamDetector = isNative() ? registerPlugin<SlamDetectorNativePlugin>('SlamDetector') : null;

/**
 * Whether to show the slam-stop setting on this device.
 *
 * Android: `isPluginAvailable` is reliable because the plugin is explicitly
 * registered in MainActivity (`registerPlugin(SlamDetectorPlugin.class)`).
 *
 * iOS: `isPluginAvailable` returns false for our Swift CAPBridgedPlugin even
 * when the binary ships it — the auto-discovery registry isn't reflected by
 * that check the same way, so the row stayed hidden on iOS despite the plugin
 * being present. On iOS we therefore gate on platform only; if the plugin is
 * genuinely missing (old binary), `start()` is wrapped in try/catch and the
 * feature just no-ops instead of crashing.
 */
export function isSlamDetectorAvailable(): boolean {
	if (!isNative()) return false;
	if (Capacitor.getPlatform() === 'ios') return true;
	return Capacitor.isPluginAvailable('SlamDetector');
}

// FiveTimer grace window — no re-trigger for 750ms after a slam
const REFRACTORY_MS = 750;

// The native detector is a singleton shared by two consumers (solve mode and
// the settings test indicator). Ownership tokens prevent a stale consumer's
// cleanup from killing the detector another consumer just started: last
// start() wins ownership, stop() is a no-op unless the caller still owns it.
let activeOwner: symbol | null = null;
let activeCallback: ((event: SlamEvent) => void) | null = null;
let listenerHandle: PluginListenerHandle | null = null;

async function ensureListener(): Promise<void> {
	if (!SlamDetector || listenerHandle) return;
	listenerHandle = await SlamDetector.addListener('slam', (event) => {
		activeCallback?.(event);
	});
}

/**
 * Starts (or re-arms) the native slam detector with the given threshold.
 * Returns an owner token, or null when unavailable (web, no accelerometer).
 */
export async function startSlamDetector(
	threshold: number,
	onSlam: (event: SlamEvent) => void
): Promise<symbol | null> {
	if (!SlamDetector) return null;

	const owner = Symbol('slam-owner');
	activeOwner = owner;
	activeCallback = onSlam;

	try {
		await ensureListener();
		await SlamDetector.start({ threshold, refractoryMs: REFRACTORY_MS });
	} catch (e) {
		// Accelerometer unavailable — feature silently disabled
		if (activeOwner === owner) {
			activeOwner = null;
			activeCallback = null;
		}
		return null;
	}

	return owner;
}

/** Stops the detector only if the caller is still the active owner. */
export async function stopSlamDetector(owner: symbol | null): Promise<void> {
	if (!SlamDetector || !owner || activeOwner !== owner) return;

	activeOwner = null;
	activeCallback = null;
	try {
		await SlamDetector.stop();
	} catch (e) {
		// Already stopped — nothing to do
	}
}
