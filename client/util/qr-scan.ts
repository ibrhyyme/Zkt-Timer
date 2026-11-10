import jsQR from 'jsqr';

/**
 * In-page QR scanner: the back camera through getUserMedia, frames decoded with jsQR (pure JS,
 * no WASM, no network). One path for the browser and the native shell, so it ships over OTA
 * with no native plugin. Callers own the <video> element and decide when to stop.
 */

export type QrScanError = 'unsupported' | 'denied' | 'no_camera' | 'failed';

export interface QrScanHandle {
	stop(): void;
}

export type QrScanStart =
	| {ok: true; handle: QrScanHandle}
	| {ok: false; kind: QrScanError; detail: string};

export interface QrScanOptions {
	video: HTMLVideoElement;
	/** Called for every decode, except the same text repeating inside REPEAT_GUARD_MS. */
	onResult: (text: string) => void;
	/** Pause between decode attempts. */
	intervalMs?: number;
}

// A frame is scaled so its longer side is at most this before decoding: enough pixels per
// module for a signed-URL QR held at arm's length, small enough to decode in one tick on a phone.
const DECODE_MAX_SIDE = 800;
const DEFAULT_INTERVAL_MS = 120;
const REPEAT_GUARD_MS = 1500;

export function qrScanSupported(): boolean {
	return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
}

/** Maps a getUserMedia rejection onto what the user can do about it. Pure. */
export function classifyCameraError(name: string | undefined): QrScanError {
	if (name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError') return 'denied';
	if (name === 'NotFoundError' || name === 'OverconstrainedError' || name === 'DevicesNotFoundError') return 'no_camera';
	return 'failed';
}

function describe(e: unknown): string {
	const err = e as {name?: string; message?: string} | null;
	return `${err?.name || 'Error'}: ${err?.message || ''}`.trim();
}

function release(stream: MediaStream, video: HTMLVideoElement) {
	stream.getTracks().forEach((track) => track.stop());
	video.srcObject = null;
}

export async function startQrScan(opts: QrScanOptions): Promise<QrScanStart> {
	if (!qrScanSupported()) return {ok: false, kind: 'unsupported', detail: ''};

	let stream: MediaStream;
	try {
		stream = await navigator.mediaDevices.getUserMedia({
			video: {facingMode: {ideal: 'environment'}, width: {ideal: 1280}, height: {ideal: 720}},
			audio: false,
		});
	} catch (e) {
		return {ok: false, kind: classifyCameraError((e as {name?: string} | null)?.name), detail: describe(e)};
	}

	const video = opts.video;
	// iOS only plays a camera stream inline when the element is muted and marked playsinline.
	// Set here rather than in JSX: React 17 does not write `muted` as an attribute.
	video.muted = true;
	video.setAttribute('playsinline', '');
	video.srcObject = stream;
	try {
		await video.play();
	} catch (e) {
		release(stream, video);
		return {ok: false, kind: 'failed', detail: describe(e)};
	}

	const canvas = document.createElement('canvas');
	const ctx = canvas.getContext('2d', {willReadFrequently: true});
	if (!ctx) {
		release(stream, video);
		return {ok: false, kind: 'failed', detail: 'canvas 2d context unavailable'};
	}

	const interval = opts.intervalMs ?? DEFAULT_INTERVAL_MS;
	let stopped = false;
	let timer: number | undefined;
	let lastText = '';
	let lastAt = 0;

	const tick = () => {
		if (stopped) return;
		const vw = video.videoWidth;
		const vh = video.videoHeight;
		if (vw && vh && video.readyState >= 2) {
			const scale = Math.min(1, DECODE_MAX_SIDE / Math.max(vw, vh));
			const w = Math.round(vw * scale);
			const h = Math.round(vh * scale);
			if (canvas.width !== w) canvas.width = w;
			if (canvas.height !== h) canvas.height = h;
			ctx.drawImage(video, 0, 0, w, h);
			const frame = ctx.getImageData(0, 0, w, h);
			const code = jsQR(frame.data, w, h, {inversionAttempts: 'dontInvert'});
			if (code && code.data) {
				const now = Date.now();
				if (code.data !== lastText || now - lastAt > REPEAT_GUARD_MS) {
					lastText = code.data;
					lastAt = now;
					opts.onResult(code.data);
				}
			}
		}
		timer = window.setTimeout(tick, interval);
	};
	tick();

	return {
		ok: true,
		handle: {
			stop() {
				if (stopped) return;
				stopped = true;
				if (timer !== undefined) window.clearTimeout(timer);
				release(stream, video);
			},
		},
	};
}
