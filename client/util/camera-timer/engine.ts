import { CameraTimerManifest, cameraBrainUrl } from './availability';
import { BrainSnap, cameraWarnings, CameraWarning, meanLuma, PadEvent } from './decision';

/**
 * The Kamera Timer's moving parts on the page: the camera stream, the brain worker and the
 * frame pump between them. The brain itself (hand model + pad timer) is a private worker the
 * server hands out (availability.ts); this file only knows its messages:
 *
 *   to brain:   init | frame { t, id, frame: VideoFrame, w, h } | reset
 *   from brain: ready { delegate, config } | result { t, id, ms, hands, events, snap, nextMs }
 *               | error { message, fatal }
 *
 * Every frame goes with its CAPTURE time (requestVideoFrameCallback), so a slow model or a
 * busy page delays a decision but never changes a measured time. While the brain is busy,
 * newer frames are skipped; between results the brain says how soon it wants the next one
 * (nextMs: a few frames a second while nothing can happen, every frame while the hands are on
 * the pads). Nothing is sent while the tab is hidden.
 */

export type EngineStage = 'off' | 'starting' | 'loading' | 'running' | 'error';
export type EngineError = 'unsupported' | 'permission' | 'not_found' | 'in_use' | 'camera' | 'brain';

export interface EngineStatus {
	stage: EngineStage;
	error: EngineError | null;
	/** The camera in use, and the ones to pick from (labels only exist after permission). */
	deviceId: string | null;
	cameras: { deviceId: string; label: string }[];
	width: number;
	height: number;
	cameraFps: number;
	modelMs: number;
	delegate: string | null;
	warnings: CameraWarning[];
	/** The pad timer's state from the latest result. */
	padState: BrainSnap['state'] | null;
}

export interface BrainResult {
	t: number;
	id: number;
	ms: number;
	hands: number[][];
	events: PadEvent[];
	snap: BrainSnap;
	nextMs: number;
}

const MODEL_WIDTH = 640;
// Half a 60 fps frame: a frame landing a hair early for the pace still goes.
const PACE_SLACK_MS = 8;
// A brain that has not answered a frame in this long is stuck (GPU lost, worker crashed). The
// brain compiles its shaders before it says ready, so a first frame is not slower than the rest;
// a result arriving after all lifts the error again.
const STALL_MS = 5000;
const STATS_EVERY_MS = 1000;
const BRIGHTNESS_EVERY_MS = 2000;
// The admin log keeps the last minute of frames, enough for one attempt with its run-up.
const LOG_WINDOW_MS = 60000;
const CAMERA_STORAGE_KEY = 'zkt_camera_timer_camera';

export function cameraTimerSupported(): boolean {
	return (
		typeof window !== 'undefined' &&
		typeof Worker !== 'undefined' &&
		typeof (window as any).VideoFrame !== 'undefined' &&
		typeof HTMLVideoElement !== 'undefined' &&
		'requestVideoFrameCallback' in HTMLVideoElement.prototype &&
		!!navigator.mediaDevices?.getUserMedia
	);
}

function readStoredCamera(): string | null {
	try {
		return window.localStorage.getItem(CAMERA_STORAGE_KEY);
	} catch (e) {
		return null;
	}
}

function storeCamera(label: string): void {
	try {
		window.localStorage.setItem(CAMERA_STORAGE_KEY, label);
	} catch (e) {
		// a convenience only
	}
}

function errorFromMedia(e: any): EngineError {
	switch (e?.name) {
		case 'NotAllowedError':
		case 'SecurityError':
			return 'permission';
		case 'NotFoundError':
		case 'OverconstrainedError':
			return 'not_found';
		case 'NotReadableError':
		case 'AbortError':
			return 'in_use';
		default:
			return 'camera';
	}
}

export const INITIAL_STATUS: EngineStatus = {
	stage: 'off',
	error: null,
	deviceId: null,
	cameras: [],
	width: 0,
	height: 0,
	cameraFps: 0,
	modelMs: 0,
	delegate: null,
	warnings: [],
	padState: null,
};

export class CameraTimerEngine {
	status: EngineStatus = INITIAL_STATUS;
	/** Latest hands and pad timer readout, for the overlay (read per animation frame, no React). */
	latest: { seq: number; hands: number[][]; snap: BrainSnap | null } = { seq: 0, hands: [], snap: null };
	leaveFar = 0.5;

	onResult: ((r: BrainResult) => void) | null = null;

	private manifest: CameraTimerManifest;
	private video: HTMLVideoElement | null = null;
	private stream: MediaStream | null = null;
	private worker: Worker | null = null;
	private listeners = new Set<() => void>();
	private closed = false;
	private openSeq = 0;
	private ready = false;
	private busy = false;
	private sentAt = 0;
	private stalled = false;
	private lastT = -Infinity;
	private lastSentT = -Infinity;
	private nextMs = 0;
	private hidden = false;
	private readyAt = 0;
	private lastHandsAt: number | null = null;
	private cameraTimes: number[] = [];
	private modelMs = 0;
	private statsTimer: ReturnType<typeof setInterval> | null = null;
	private lastBrightnessAt = 0;
	private brightness: number | null = null;
	private lumaCanvas: HTMLCanvasElement | null = null;
	private log: { frames: [number, number, number, number[][]][]; events: (PadEvent & { kind?: string })[]; notes: any[] } = {
		frames: [],
		events: [],
		notes: [],
	};

	constructor(manifest: CameraTimerManifest) {
		this.manifest = manifest;
	}

	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}

	private setStatus(partial: Partial<EngineStatus>): void {
		let changed = false;
		for (const key of Object.keys(partial) as (keyof EngineStatus)[]) {
			const a = this.status[key] as any;
			const b = partial[key] as any;
			if (Array.isArray(a) && Array.isArray(b) ? a.join('|') !== b.join('|') : a !== b) {
				changed = true;
				break;
			}
		}
		if (!changed) return;
		this.status = { ...this.status, ...partial };
		this.listeners.forEach((l) => l());
	}

	/** Opens the camera (the stored one, or `deviceId`) and starts the brain once. */
	async open(video: HTMLVideoElement, deviceId?: string): Promise<void> {
		if (this.closed) return;
		if (!cameraTimerSupported()) {
			this.setStatus({ stage: 'error', error: 'unsupported' });
			return;
		}
		const seq = ++this.openSeq;
		this.video = video;
		video.muted = true;
		video.playsInline = true;
		this.setStatus({ stage: 'starting', error: null });

		this.stopStream();
		let stream: MediaStream;
		try {
			const wanted = deviceId ?? (await this.storedDeviceId());
			const constraints: MediaTrackConstraints = {
				width: { ideal: 1280 },
				height: { ideal: 720 },
				frameRate: { ideal: 60 },
			};
			if (wanted) constraints.deviceId = { exact: wanted };
			try {
				stream = await navigator.mediaDevices.getUserMedia({ video: constraints, audio: false });
			} catch (e: any) {
				// A stored camera that is gone: fall back to any camera rather than fail.
				if (!deviceId && wanted && (e?.name === 'NotFoundError' || e?.name === 'OverconstrainedError')) {
					delete constraints.deviceId;
					stream = await navigator.mediaDevices.getUserMedia({ video: constraints, audio: false });
				} else {
					throw e;
				}
			}
		} catch (e) {
			if (seq === this.openSeq) this.setStatus({ stage: 'error', error: errorFromMedia(e) });
			return;
		}
		if (this.closed || seq !== this.openSeq) {
			stream.getTracks().forEach((t) => t.stop());
			return;
		}

		this.stream = stream;
		const track = stream.getVideoTracks()[0];
		const settings = track.getSettings();
		if (track.label) storeCamera(track.label);
		track.addEventListener('ended', () => {
			if (this.stream === stream) this.setStatus({ stage: 'error', error: 'camera' });
		});
		video.srcObject = stream;
		try {
			await video.play();
		} catch (e) {
			// autoplay of a muted stream does not fail in practice; frames still arrive
		}
		this.cameraTimes = [];
		this.setStatus({
			deviceId: settings.deviceId || null,
			width: settings.width || video.videoWidth || 0,
			height: settings.height || video.videoHeight || 0,
			stage: this.ready ? 'running' : 'loading',
		});
		this.refreshCameraList();
		this.note('camera', { label: track.label, width: settings.width, height: settings.height, frameRate: settings.frameRate });

		// Another camera (or the same one reopened) sees the table from elsewhere: the pads the
		// brain learnt no longer apply.
		if (this.ready) this.reset();
		this.startBrain();
		this.pump(video, stream);
		if (!this.statsTimer) this.statsTimer = setInterval(() => this.tickStats(), STATS_EVERY_MS);
	}

	private async storedDeviceId(): Promise<string | null> {
		const label = readStoredCamera();
		if (!label) return null;
		try {
			const devices = await navigator.mediaDevices.enumerateDevices();
			const match = devices.find((d) => d.kind === 'videoinput' && d.label === label);
			return match ? match.deviceId : null;
		} catch (e) {
			return null;
		}
	}

	private async refreshCameraList(): Promise<void> {
		try {
			const devices = await navigator.mediaDevices.enumerateDevices();
			const cameras = devices
				.filter((d) => d.kind === 'videoinput' && d.deviceId)
				.map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Camera ${i + 1}` }));
			if (!this.closed) this.setStatus({ cameras });
		} catch (e) {
			// the list is a convenience
		}
	}

	private startBrain(): void {
		if (this.worker) return;
		let worker: Worker;
		try {
			worker = new Worker(cameraBrainUrl(this.manifest));
		} catch (e) {
			this.setStatus({ stage: 'error', error: 'brain' });
			return;
		}
		this.worker = worker;
		worker.onmessage = (e: MessageEvent) => this.onBrainMessage(e.data);
		worker.onerror = () => {
			if (!this.ready) this.setStatus({ stage: 'error', error: 'brain' });
		};
		worker.postMessage({ type: 'init' });
	}

	private onBrainMessage(m: any): void {
		if (this.closed || !m) return;
		if (m.type === 'ready') {
			this.ready = true;
			this.readyAt = performance.now();
			if (m.config && typeof m.config.leaveFar === 'number') this.leaveFar = m.config.leaveFar;
			this.note('ready', { delegate: m.delegate });
			this.setStatus({ stage: this.stream ? 'running' : 'loading', delegate: m.delegate || null });
			return;
		}
		if (m.type === 'error') {
			this.note('error', { message: m.message, fatal: !!m.fatal });
			if (m.fatal) this.setStatus({ stage: 'error', error: 'brain' });
			return;
		}
		if (m.type !== 'result') return;

		this.busy = false;
		if (this.stalled) {
			this.stalled = false;
			this.note('recovered', {});
			if (this.status.error === 'brain') this.setStatus({ stage: 'running', error: null });
		}
		const r = m as BrainResult;
		this.nextMs = Math.max(0, Number(r.nextMs) || 0);
		this.modelMs = this.modelMs ? this.modelMs * 0.9 + r.ms * 0.1 : r.ms;
		if (r.hands.length) this.lastHandsAt = performance.now();
		this.latest = { seq: this.latest.seq + 1, hands: r.hands, snap: r.snap };

		this.log.frames.push([Math.round(r.t * 1000) / 1000, r.id, Math.round(r.ms * 10) / 10, r.hands]);
		for (const ev of r.events) this.log.events.push(ev);
		this.trimLog(r.t);

		if (r.snap.state !== this.status.padState) this.setStatus({ padState: r.snap.state });
		this.onResult?.(r);
	}

	private pump(video: HTMLVideoElement, stream: MediaStream): void {
		const onFrame = (now: number, md: any) => {
			if (this.closed || this.stream !== stream) return;
			video.requestVideoFrameCallback(onFrame);

			if (typeof md.mediaTime === 'number') {
				this.cameraTimes.push(md.mediaTime);
				if (this.cameraTimes.length > 31) this.cameraTimes.shift();
			}
			if (now - this.lastBrightnessAt > BRIGHTNESS_EVERY_MS) {
				this.lastBrightnessAt = now;
				this.sampleBrightness(video);
			}

			// Capture time, on the performance.now() clock; receive time or the callback time
			// for sources that do not report one.
			const t: number = md.captureTime ?? md.receiveTime ?? now;
			if (!this.ready || !this.worker || this.hidden || !(t > this.lastT)) return;
			if (this.busy) {
				if (!this.stalled && now - this.sentAt > STALL_MS) {
					this.stalled = true;
					this.note('stall', {});
					this.setStatus({ stage: 'error', error: 'brain' });
				}
				return;
			}
			if (t - this.lastSentT < this.nextMs - PACE_SLACK_MS) return;

			let frame: any;
			try {
				frame = new (window as any).VideoFrame(video, { timestamp: Math.round(t * 1000) });
			} catch (e) {
				return; // no decodable frame yet
			}
			this.busy = true;
			this.sentAt = now;
			this.lastT = t;
			this.lastSentT = t;
			const w = Math.min(MODEL_WIDTH, frame.displayWidth);
			const h = Math.round((frame.displayHeight * w) / frame.displayWidth);
			this.worker.postMessage({ type: 'frame', t, id: md.presentedFrames, frame, w, h }, [frame]);
		};
		video.requestVideoFrameCallback(onFrame);
	}

	private sampleBrightness(video: HTMLVideoElement): void {
		try {
			if (!this.lumaCanvas) {
				this.lumaCanvas = document.createElement('canvas');
				this.lumaCanvas.width = 32;
				this.lumaCanvas.height = 18;
			}
			const ctx = this.lumaCanvas.getContext('2d', { willReadFrequently: true } as any) as CanvasRenderingContext2D | null;
			if (!ctx) return;
			ctx.drawImage(video, 0, 0, 32, 18);
			this.brightness = meanLuma(ctx.getImageData(0, 0, 32, 18).data);
		} catch (e) {
			// a warning only
		}
	}

	private tickStats(): void {
		if (this.closed) return;
		const ts = this.cameraTimes;
		let cameraFps = 0;
		if (ts.length > 5) {
			const span = ts[ts.length - 1] - ts[0];
			if (span > 0) cameraFps = (ts.length - 1) / span;
		}
		const now = performance.now();
		const warnings = this.ready
			? cameraWarnings({
					cameraFps,
					width: this.status.width,
					height: this.status.height,
					brightness: this.brightness,
					modelMs: this.modelMs,
					sinceHandsMs: this.lastHandsAt === null ? null : now - this.lastHandsAt,
					runningMs: now - this.readyAt,
			  })
			: [];
		this.setStatus({
			cameraFps: Math.round(cameraFps),
			modelMs: Math.round(this.modelMs),
			warnings,
		});
	}

	/** Back to idle: the next attempt needs both hands on the pads again (inspection began). */
	reset(): void {
		this.worker?.postMessage({ type: 'reset' });
		this.note('reset', {});
	}

	/** The tab went to the background or came back. Nothing is sent while hidden. */
	setHidden(hidden: boolean): void {
		if (this.hidden === hidden) return;
		this.hidden = hidden;
		this.note(hidden ? 'hidden' : 'visible', {});
		// Whatever the brain held from before the pause is stale; a solve in progress keeps going.
		if (!hidden && this.latest.snap && this.latest.snap.state !== 'solving') this.reset();
	}

	/** Records a timer decision in the admin log, next to the frames that caused it. */
	note(kind: string, data: Record<string, unknown>): void {
		this.log.notes.push({ kind, at: Math.round(performance.now()), ...data });
		if (this.log.notes.length > 500) this.log.notes.shift();
	}

	private trimLog(t: number): void {
		const floor = t - LOG_WINDOW_MS;
		const frames = this.log.frames;
		let drop = 0;
		while (drop < frames.length && frames[drop][0] < floor) drop++;
		if (drop) frames.splice(0, drop);
		const events = this.log.events;
		let dropE = 0;
		while (dropE < events.length && events[dropE].t < floor) dropE++;
		if (dropE) events.splice(0, dropE);
	}

	/** The last minute as a file, for admins to send when the timer got something wrong. */
	exportLog(): Blob {
		const body = {
			format: 'zkt-camlive-v1',
			createdAt: new Date().toISOString(),
			timeOrigin: performance.timeOrigin,
			brain: this.manifest.brain,
			mediapipe: this.manifest.mediapipe,
			userAgent: navigator.userAgent,
			camera: { width: this.status.width, height: this.status.height, fps: this.status.cameraFps },
			delegate: this.status.delegate,
			// [captureTime ms, frame number, model ms, hands (flat x,y,z * 21 each)]
			frames: this.log.frames,
			events: this.log.events,
			notes: this.log.notes,
		};
		return new Blob([JSON.stringify(body)], { type: 'application/json' });
	}

	private stopStream(): void {
		if (this.stream) {
			this.stream.getTracks().forEach((t) => t.stop());
			this.stream = null;
		}
		if (this.video) this.video.srcObject = null;
	}

	close(): void {
		this.closed = true;
		this.openSeq++;
		this.stopStream();
		this.worker?.terminate();
		this.worker = null;
		if (this.statsTimer) clearInterval(this.statsTimer);
		this.statsTimer = null;
		this.onResult = null;
		this.listeners.clear();
	}
}
