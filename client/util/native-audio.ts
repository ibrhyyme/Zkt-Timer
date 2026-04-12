import { Capacitor, registerPlugin } from '@capacitor/core';
import { isNative } from './platform';

interface NativeAudioPlugin {
	preload(options: { assetId: string; fileName: string }): Promise<void>;
	play(options: { assetId: string; rate?: number }): Promise<void>;
}

const NativeAudio =
	isNative() && Capacitor.getPlatform() === 'ios' ? registerPlugin<NativeAudioPlugin>('NativeAudio') : null;

/** Preload basarili olan asset ID'leri */
const loadedAssets = new Set<string>();

export function preloadInspectionSounds(): void {
	if (!NativeAudio) return;

	const assets = ['8_sec', '12_sec'];
	for (const id of assets) {
		NativeAudio.preload({ assetId: id, fileName: id })
			.then(() => {
				loadedAssets.add(id);
				console.log(`[NativeAudio] preloaded: ${id}`);
			})
			.catch((e) => {
				console.warn(`[NativeAudio] preload failed: ${id}`, e);
			});
	}
}

/** iOS'ta native AVAudioPlayer ile ses calar. Basarili olursa true doner, degilse false (web fallback). */
export function playNativeSound(assetId: string, rate?: number): boolean {
	if (!NativeAudio || !loadedAssets.has(assetId)) return false;
	NativeAudio.play({ assetId, rate }).catch((e) => {
		console.warn(`[NativeAudio] play failed: ${assetId}`, e);
	});
	return true;
}
