import { isNative } from '../platform';

/**
 * On Android the Capacitor BLE deviceId IS the peripheral's MAC address; iOS/web give a
 * UUID/handle. For QiYi/GAN/MoYu this equals the encryption MAC, so it's the most reliable
 * source on Android (manufacturer-data scans are unreliable there — plugin issue #235).
 * Returns the uppercased MAC, or null when deviceId isn't a MAC (iOS/web → caller falls back).
 */
export function macFromNativeDeviceId(deviceId?: string): string | null {
	if (!isNative() || !deviceId || !deviceId.includes(':')) return null;
	return deviceId.toUpperCase();
}
