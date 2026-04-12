import { Capacitor, registerPlugin } from '@capacitor/core';
import { isNative } from './platform';

interface NativeAudioPlugin {
	preload(options: { assetId: string; fileName: string }): Promise<void>;
	play(options: { assetId: string; rate?: number }): Promise<void>;
}

const NativeAudio =
	isNative() && Capacitor.getPlatform() === 'ios' ? registerPlugin<NativeAudioPlugin>('NativeAudio') : null;

export function preloadInspectionSounds(): void {
	if (!NativeAudio) return;
	NativeAudio.preload({ assetId: '8_sec', fileName: '8_sec' }).catch(() => {});
	NativeAudio.preload({ assetId: '12_sec', fileName: '12_sec' }).catch(() => {});
}

/** iOS'ta native AVAudioPlayer ile ses calar. Basarili olursa true doner, degilse false (web fallback). */
export function playNativeSound(assetId: string, rate?: number): boolean {
	if (!NativeAudio) return false;
	NativeAudio.play({ assetId, rate }).catch(() => {});
	return true;
}
