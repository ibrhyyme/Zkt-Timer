import { Capacitor, registerPlugin } from '@capacitor/core';

export function isNative(): boolean {
	return Capacitor.isNativePlatform();
}

export function isAndroidNative(): boolean {
	return Capacitor.getPlatform() === 'android';
}

export function isWebBluetoothAvailable(): boolean {
	return !isNative() && typeof navigator !== 'undefined' && !!navigator.bluetooth;
}

// --- Android Gesture Exclusion Plugin ---
interface GestureExclusionPlugin {
	update(options: { yPercent: number; heightPx: number }): Promise<void>;
	clear(): Promise<void>;
}

const GestureExclusion = isAndroidNative()
	? registerPlugin<GestureExclusionPlugin>('GestureExclusion')
	: null;

/** Centik bolgesini Android geri hareketinden muaf tut */
export function updateGestureExclusion(yPercent: number, heightPx: number): void {
	GestureExclusion?.update({ yPercent, heightPx }).catch(() => {});
}

/** Gesture exclusion'i temizle */
export function clearGestureExclusion(): void {
	GestureExclusion?.clear().catch(() => {});
}
