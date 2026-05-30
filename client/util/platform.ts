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
//
// Sag (mevcut) + sol (yeni) drawer iki ayri kenar dikdortgenini hariclemek
// ihtiyaci duyuyor. Native plugin iki rect'i ayri tutar; her cagrida iki rect'in
// birlesik listesini setSystemGestureExclusionRects'e gonderir.
//
// Geri uyumluluk: side opsiyonel; verilmezse 'right' (eski davranis).

type EdgeSide = 'left' | 'right';

interface GestureExclusionPlugin {
	update(options: { side?: EdgeSide; yPercent: number; heightPx: number }): Promise<void>;
	clear(options?: { side?: EdgeSide }): Promise<void>;
}

const GestureExclusion = isAndroidNative()
	? registerPlugin<GestureExclusionPlugin>('GestureExclusion')
	: null;

/** Centik bolgesini Android geri hareketinden muaf tut */
export function updateGestureExclusion(side: EdgeSide, yPercent: number, heightPx: number): void {
	GestureExclusion?.update({ side, yPercent, heightPx }).catch(() => {});
}

/** Gesture exclusion'i temizle (verilen side'in rect'ini kaldirir) */
export function clearGestureExclusion(side?: EdgeSide): void {
	GestureExclusion?.clear(side ? { side } : undefined).catch(() => {});
}
