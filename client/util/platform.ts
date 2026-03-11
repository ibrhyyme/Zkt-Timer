import { Capacitor } from '@capacitor/core';

export function isNative(): boolean {
	return Capacitor.isNativePlatform();
}

export function isAndroidNative(): boolean {
	return Capacitor.getPlatform() === 'android';
}

export function isWebBluetoothAvailable(): boolean {
	return !isNative() && typeof navigator !== 'undefined' && !!navigator.bluetooth;
}
