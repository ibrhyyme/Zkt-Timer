import {Capacitor, registerPlugin} from '@capacitor/core';
import {isNative} from './platform';
import {resourceUri} from './storage';

interface NativeAudioPlugin {
	preload(options: {assetId: string; fileName: string}): Promise<void>;
	play(options: {assetId: string; rate?: number}): Promise<void>;
}

// iOS keeps the hand-written AVAudioPlayer plugin (ios/App/App/NativeAudioPlugin.swift).
// It works and is tuned, so it is deliberately left alone.
const NativeAudio =
	isNative() && Capacitor.getPlatform() === 'ios' ? registerPlugin<NativeAudioPlugin>('NativeAudio') : null;

/** Asset IDs that are ready to play through whichever path this platform uses. */
const loadedAssets = new Set<string>();

const ASSET_IDS = ['8_sec', '12_sec', 'success'];

/*
 * Everywhere except iOS the sounds go through the Web Audio API rather than `new
 * Audio(src)`.
 *
 * The old path constructed an Audio element at the moment the sound was needed, so the
 * file was fetched and decoded inside the 100ms inspection tick — on Android that
 * showed up as a variable 100-300ms delay on the 8 and 12 second calls, which are
 * WCA-timed and cannot drift. Here each clip is fetched and decoded once at boot and
 * kept as a ready AudioBuffer; playing it is then just wiring a source node, which
 * starts in single-digit milliseconds.
 *
 * `@capacitor-community/native-audio` was the other candidate and was rejected: its
 * API has no playback rate (only volume), and these clips are played at 2.3x.
 */
type AudioContextConstructor = typeof AudioContext;

let audioContext: AudioContext | null = null;
const buffers = new Map<string, AudioBuffer>();

function getAudioContextConstructor(): AudioContextConstructor | null {
	if (typeof window === 'undefined') return null;
	return window.AudioContext || (window as any).webkitAudioContext || null;
}

function getAudioContext(): AudioContext | null {
	if (audioContext) return audioContext;

	const Ctor = getAudioContextConstructor();
	if (!Ctor) return null;

	try {
		audioContext = new Ctor();
	} catch (e) {
		console.warn('[NativeAudio] AudioContext unavailable:', e);
		return null;
	}

	// Autoplay policy: a context created before any user gesture starts suspended.
	// Resuming on the first interaction means the first inspection call is not the
	// one that pays for unlocking it.
	if (audioContext.state === 'suspended' && typeof document !== 'undefined') {
		const unlock = () => {
			audioContext?.resume().catch(() => {});
		};
		document.addEventListener('pointerdown', unlock, {once: true});
		document.addEventListener('keydown', unlock, {once: true});
	}

	return audioContext;
}

async function preloadWebAudio(): Promise<void> {
	const ctx = getAudioContext();
	if (!ctx) return;

	await Promise.all(
		ASSET_IDS.map(async (id) => {
			try {
				const response = await fetch(resourceUri(`/audio/${id}.mp3`));
				const encoded = await response.arrayBuffer();
				// decodeAudioData is callback-based in older WebKit; the promise form is
				// what every engine this app targets implements.
				const buffer = await ctx.decodeAudioData(encoded);
				buffers.set(id, buffer);
				loadedAssets.add(id);
			} catch (e) {
				console.warn(`[NativeAudio] decode failed: ${id}`, e);
			}
		})
	);
}

function preloadIos(): void {
	for (const id of ASSET_IDS) {
		NativeAudio.preload({assetId: id, fileName: id})
			.then(() => {
				loadedAssets.add(id);
				console.log(`[NativeAudio] preloaded: ${id}`);
			})
			.catch((e) => {
				console.warn(`[NativeAudio] preload failed: ${id}`, e);
			});
	}
}

export function preloadTimerSounds(): void {
	if (NativeAudio) {
		preloadIos();
		return;
	}

	preloadWebAudio().catch((e) => {
		console.warn('[NativeAudio] web audio preload failed:', e);
	});
}

/** Plays a preloaded sound. Returns false when the caller must fall back to `new Audio()`. */
export function playNativeSound(assetId: string, rate?: number): boolean {
	if (!loadedAssets.has(assetId)) return false;

	if (NativeAudio) {
		NativeAudio.play({assetId, rate}).catch((e) => {
			console.warn(`[NativeAudio] play failed: ${assetId}`, e);
		});
		return true;
	}

	const ctx = audioContext;
	const buffer = buffers.get(assetId);
	if (!ctx || !buffer) return false;

	try {
		// A source node is single use, so one is created per play.
		const source = ctx.createBufferSource();
		source.buffer = buffer;
		if (rate) {
			source.playbackRate.value = rate;
		}
		source.connect(ctx.destination);

		// Still suspended (no gesture yet, or the OS suspended it in the background):
		// resume and start anyway. Context time is frozen while suspended, so the clip
		// resumes from its beginning rather than losing its opening.
		if (ctx.state === 'suspended') {
			ctx.resume().catch(() => {});
		}

		source.start(0);
		return true;
	} catch (e) {
		console.warn(`[NativeAudio] play failed: ${assetId}`, e);
		return false;
	}
}
