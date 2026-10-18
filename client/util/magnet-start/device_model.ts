// The phone model key of the Magnet Timer (design .feedback/designs/magnet-cubes.md 9.1).
//
// A calibration belongs to (cube, platform, phone model): the magnetometer sits in a different
// place on every model. The key is "<manufacturer> <model>" from @capacitor/device, the same
// string the telemetry study has always sent ("samsung SM-F956B", "Apple iPhone16,1"), so
// calibrations and telemetry rows of one phone line up in the admin view.
//
// An iOS binary built without the Device plugin cannot read the model. Every iPhone would then
// share one "unknown" key and borrow each other's calibration, so the key falls back to the
// screen ("Apple screen-393x852@3"): coarse, but phones with the same screen are the same
// generation and size, which is what decides where the hot spot is. The fallback is stored on
// the device so it never changes under a calibration, and once a binary with the plugin
// arrives its calibrations are copied to the real model key once (adoption below); nobody is
// asked to measure again.
import { calibrationFor, CubeState, PendingCalibration } from '../../lib/cubes/active_cube';
import type { MagnetPlatform } from './types';

const FALLBACK_STORAGE_KEY = 'zkt_magnet_model_fallback';
/** Same bound as the server's CALIBRATION_LIMITS.deviceModelMaxLength. */
const MAX_LENGTH = 80;
/** iOS machine identifiers look like "iPhone16,1" or "iPad13,8"; anything else is generic. */
const IOS_MACHINE_ID = /^[A-Za-z]+\d+,\d+$/;

export interface MagnetDeviceIdentity {
	/** Calibration and telemetry key of this phone. null only without a window (SSR). */
	deviceModel: string | null;
	/** The key is the screen fallback, not the real model. */
	isFallback: boolean;
	osVersion: string | null;
	/** OTA bundle (or asset) version on screen. */
	appVersion: string | null;
}

interface DeviceInfoLike {
	manufacturer?: string;
	model?: string;
	osVersion?: string;
	otaBundle?: string;
}

interface StoredFallback {
	v: 1;
	platform: MagnetPlatform;
	key: string;
}

function clip(value: string): string {
	return value.trim().slice(0, MAX_LENGTH).trim();
}

/** "<manufacturer> <model>", or null when the plugin did not give a usable model. */
export function modelKeyFromInfo(platform: MagnetPlatform, info: DeviceInfoLike | null | undefined): string | null {
	const model = (info?.model || '').trim();
	if (!model || model.toLowerCase() === 'unknown') return null;
	// A generic "iPhone" (a web implementation answering on iOS) would merge every iPhone.
	if (platform === 'ios' && !IOS_MACHINE_ID.test(model)) return null;
	const key = clip([info?.manufacturer, model].filter(Boolean).join(' '));
	return key || null;
}

/** Screen based key: portrait width x height in CSS px and the pixel ratio. */
export function screenModelKey(
	platform: MagnetPlatform,
	manufacturer: string | null | undefined,
	screen: { width: number; height: number; dpr: number }
): string {
	const vendor = platform === 'ios' ? 'Apple' : (manufacturer || '').trim() || 'Android';
	const w = Math.round(Math.min(screen.width, screen.height));
	const h = Math.round(Math.max(screen.width, screen.height));
	const dpr = Math.round((screen.dpr || 1) * 100) / 100;
	return clip(`${vendor} screen-${w}x${h}@${dpr}`);
}

function readFallback(platform: MagnetPlatform): string | null {
	if (typeof window === 'undefined') return null;
	try {
		const value = JSON.parse(window.localStorage.getItem(FALLBACK_STORAGE_KEY) || 'null') as StoredFallback | null;
		if (value && value.v === 1 && value.platform === platform && typeof value.key === 'string' && value.key) {
			return value.key;
		}
	} catch (e) {
		// Unreadable storage: the key is computed again below.
	}
	return null;
}

function writeFallback(platform: MagnetPlatform, key: string): void {
	try {
		const value: StoredFallback = { v: 1, platform, key };
		window.localStorage.setItem(FALLBACK_STORAGE_KEY, JSON.stringify(value));
	} catch (e) {
		// Private mode or quota: the same screen gives the same key next time anyway.
	}
}

/** The screen fallback key this device used before the real model was readable, if any. */
export function storedFallbackModel(platform: MagnetPlatform): string | null {
	return readFallback(platform);
}

async function readDeviceInfo(): Promise<DeviceInfoLike> {
	try {
		const { getDeviceInfo } = await import('../device-info');
		return (await getDeviceInfo()) || {};
	} catch (e) {
		return {};
	}
}

async function resolveIdentity(platform: MagnetPlatform): Promise<MagnetDeviceIdentity> {
	const info = await readDeviceInfo();
	const assetVersion = typeof window !== 'undefined' ? (window as any).__ASSET_VERSION__ : undefined;
	const common = {
		osVersion: info.osVersion || null,
		appVersion: info.otaBundle || assetVersion || null,
	};

	const real = modelKeyFromInfo(platform, info);
	if (real) return { ...common, deviceModel: real, isFallback: false };

	if (typeof window === 'undefined') return { ...common, deviceModel: null, isFallback: false };
	const stored = readFallback(platform);
	if (stored) return { ...common, deviceModel: stored, isFallback: true };

	const key = screenModelKey(platform, info.manufacturer, {
		width: window.screen?.width || window.innerWidth || 0,
		height: window.screen?.height || window.innerHeight || 0,
		dpr: window.devicePixelRatio || 1,
	});
	writeFallback(platform, key);
	return { ...common, deviceModel: key, isFallback: true };
}

const cache = new Map<MagnetPlatform, Promise<MagnetDeviceIdentity>>();

/** This phone's identity for calibrations and telemetry. Read once per session. */
export function magnetDeviceIdentity(platform: MagnetPlatform): Promise<MagnetDeviceIdentity> {
	let pending = cache.get(platform);
	if (!pending) {
		pending = resolveIdentity(platform);
		cache.set(platform, pending);
	}
	return pending;
}

/** The calibration key of this phone ("samsung SM-F956B", "Apple iPhone16,1", or the screen fallback). */
export async function magnetDeviceModel(platform: MagnetPlatform): Promise<string | null> {
	return (await magnetDeviceIdentity(platform)).deviceModel;
}

/**
 * Calibrations made under the screen fallback key that the real model key does not have yet
 * (or only has older): copies to save under the real key. Same physical phone, same raw
 * values, so the measurement carries over as it is (measured_at kept, so a newer measurement
 * made elsewhere still wins). Empty once every copy exists, so calling it again is harmless.
 */
export function fallbackCalibrationCopies(
	state: CubeState,
	platform: MagnetPlatform,
	fallbackModel: string,
	realModel: string
): PendingCalibration[] {
	if (!fallbackModel || !realModel || fallbackModel === realModel) return [];
	const out: PendingCalibration[] = [];
	for (const cube of state.cubes) {
		const old = calibrationFor(state, cube.id, platform, fallbackModel);
		if (!old) continue;
		const current = calibrationFor(state, cube.id, platform, realModel);
		if (current && current.measured_at >= old.measured_at) continue;
		const { id, pending, ...fields } = old;
		out.push({ ...fields, device_model: realModel });
	}
	return out;
}

export function resetMagnetDeviceModelForTests(): void {
	cache.clear();
}
