import { Capacitor, registerPlugin, PluginListenerHandle } from '@capacitor/core';
import { isNative } from '../platform';
import { PROBE_TIMEOUT_MS, STREAM_BATCH_MS, STREAM_PERIOD_US } from './config';
import type { MagnetCapabilities, MagnetPlatform, MagnetSamplesPayload } from './types';

interface MagnetDetectorNativePlugin {
	getCapabilities(): Promise<MagnetCapabilities>;
	start(options: { periodUs: number; batchMs: number }): Promise<void>;
	stop(): Promise<void>;
	addListener(eventName: 'samples', listener: (payload: MagnetSamplesPayload) => void): Promise<PluginListenerHandle>;
}

// Behind the native guard so the handle is null on web and during SSR: a module-scope
// registerPlugin would otherwise run inside Node on every server boot.
const MagnetDetector = isNative() ? registerPlugin<MagnetDetectorNativePlugin>('MagnetDetector') : null;

export function magnetPlatform(): MagnetPlatform | null {
	if (!isNative()) return null;
	const platform = Capacitor.getPlatform();
	return platform === 'ios' || platform === 'android' ? platform : null;
}

/**
 * Cheap synchronous gate. Android: `isPluginAvailable` is reliable because the plugin
 * is registered explicitly in MainActivity. iOS: app-target Swift plugins are registered
 * in ZKTBridgeViewController and `isPluginAvailable` is unreliable for them, so the
 * async probe below is the real check (an old binary simply has no plugin).
 */
export function isMagnetDetectorPlatform(): boolean {
	if (!isNative()) return false;
	if (Capacitor.getPlatform() === 'ios') return true;
	return Capacitor.isPluginAvailable('MagnetDetector');
}

let samplesHandler: ((payload: MagnetSamplesPayload) => void) | null = null;

/** The service owns the one consumer of the native stream. */
export function setMagnetSamplesHandler(handler: ((payload: MagnetSamplesPayload) => void) | null): void {
	samplesHandler = handler;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
	return Promise.race([
		promise,
		new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
	]);
}

let probePromise: Promise<MagnetCapabilities | null> | null = null;

/**
 * The real gate, once per session. An app binary built before this plugin existed has
 * no bridge entry: the call rejects, or on Capacitor's iOS bridge may never settle,
 * hence the timeout. Also attaches the single `samples` listener, which is never removed.
 */
export function probeMagnetDetector(): Promise<MagnetCapabilities | null> {
	if (!MagnetDetector || !isMagnetDetectorPlatform()) return Promise.resolve(null);
	if (!probePromise) {
		probePromise = (async () => {
			try {
				const caps = await withTimeout(MagnetDetector.getCapabilities(), PROBE_TIMEOUT_MS);
				if (!caps) return null;
				const usable = caps.version >= 1 && caps.available === true && caps.uncalibrated === true;
				if (!usable) return { ...caps, available: false };

				const handle = await withTimeout(
					MagnetDetector.addListener('samples', (payload) => samplesHandler?.(payload)),
					PROBE_TIMEOUT_MS
				);
				return handle ? caps : null;
			} catch (e) {
				// Old binary without the plugin. Expected, not an error worth logging.
				return null;
			}
		})();
	}
	return probePromise;
}

export async function startMagnetStream(): Promise<boolean> {
	if (!MagnetDetector) return false;
	try {
		await MagnetDetector.start({ periodUs: STREAM_PERIOD_US, batchMs: STREAM_BATCH_MS });
		return true;
	} catch (e) {
		return false;
	}
}

export async function stopMagnetStream(): Promise<void> {
	if (!MagnetDetector) return;
	try {
		await MagnetDetector.stop();
	} catch (e) {
		// Already stopped
	}
}
