// The single owner of the native magnetometer stream and of the detector.
//
// Consumers acquire the stream instead of starting it: the timer hook holds it while the
// timer is idle or in inspection, the settings panel holds it in test mode. The native
// stream runs while anyone holds it and the page is visible; start/stop calls are
// serialised so a fast acquire/release/acquire always ends in one running stream.
// (Slam-to-stop's owner-token model does not fit here: the hook is active whenever the
// timer is idle, so a panel taking the stream would leave the hook with nothing.)
import { onVisibilityChange, isAppVisible } from '../app-visibility';
import { ARM_FAR_MS, detectorConfigFor } from './config';
import { isArmed } from './controller';
import { magnetDebugLog } from './debug_log';
import { MagnetDetector, distVV } from './detector';
import {
	magnetPlatform,
	probeMagnetDetector,
	setMagnetSamplesHandler,
	startMagnetStream,
	stopMagnetStream,
} from './plugin';
import { getStoredFar, setStoredFar } from './settings';
import { setMagnetStatus } from './status_store';
import {
	decodeSamples,
	DetectorEvent,
	DetectorSnapshot,
	MagnetCapabilities,
	MagnetPlatform,
	MagnetSamplesPayload,
	Vec3,
} from './types';

export type AcquireKind = 'solve' | 'test';

export type LiftEvent = Extract<DetectorEvent, { type: 'lift' }>;

export interface ServiceBatch {
	events: DetectorEvent[];
	/** Each confirmed lift with whether its placement was armed. */
	lifts: { event: LiftEvent; armed: boolean }[];
	snapshot: DetectorSnapshot;
	/** Whether the current near plateau (if any) may start something from idle. */
	armed: boolean;
	/** Samples before this epoch-ms instant belong to an earlier stream. */
	resumeAt: number;
	testMode: boolean;
}

export interface LiveReading {
	delta: number | null;
	snapshot: DetectorSnapshot;
}

// Samples queued before a restart arrive in a burst on resume; anything this far before
// the restart instant is from the old stream. Small negative skew between the native
// clock conversion and Date.now() is tolerated.
const STALE_TOLERANCE_MS = 250;
// Persist the far baseline when it moved this much, at most this often.
const FAR_PERSIST_MIN_SHIFT = 1;
const FAR_PERSIST_INTERVAL_MS = 10_000;
// A resize this large (or an aspect flip) is a fold, unfold or rotation.
const RESIZE_RESET_RATIO = 0.1;

class MagnetService {
	private counts: Record<AcquireKind, number> = { solve: 0, test: 0 };
	private running = false;
	private chain: Promise<void> = Promise.resolve();

	private caps: MagnetCapabilities | null = null;
	private platform: MagnetPlatform | null = null;
	private detector: MagnetDetector | null = null;

	private resumeAt = 0;
	private disarmedAt = 0;
	private armed = false;

	private lastPersistedFar: Vec3 | null = null;
	private lastPersistAt = 0;

	private globalsAttached = false;
	private lastSize: { w: number; h: number } | null = null;

	private batchListeners = new Set<(batch: ServiceBatch) => void>();
	private liveListeners = new Set<(live: LiveReading) => void>();

	/** Holds the stream. The returned function releases it (idempotent). */
	acquire(kind: AcquireKind): () => void {
		this.counts[kind]++;
		this.attachGlobals();
		this.scheduleReconcile();
		let released = false;
		return () => {
			if (released) return;
			released = true;
			this.counts[kind] = Math.max(0, this.counts[kind] - 1);
			this.scheduleReconcile();
		};
	}

	isTestMode(): boolean {
		return this.counts.test > 0;
	}

	isRunning(): boolean {
		return this.running;
	}

	subscribe(listener: (batch: ServiceBatch) => void): () => void {
		this.batchListeners.add(listener);
		return () => {
			this.batchListeners.delete(listener);
		};
	}

	subscribeLive(listener: (live: LiveReading) => void): () => void {
		this.liveListeners.add(listener);
		return () => {
			this.liveListeners.delete(listener);
		};
	}

	/**
	 * After a stop, cancel or DNF: the current placement may no longer start anything
	 * from idle, and the next one needs the cube away for ARM_FAR_MS first.
	 */
	disarm(reason: string): void {
		this.disarmedAt = Date.now();
		if (this.armed) this.armed = false;
		magnetDebugLog.record('disarm', { reason });
	}

	/** Ignores lift triggers for `ms` (our own vibration). */
	mute(ms: number): void {
		this.detector?.mute(Date.now() + ms);
	}

	/** Takes the current steady reading as the far baseline. */
	relearnFar(): boolean {
		if (!this.detector || !this.running) return false;
		const res = this.detector.relearnFar();
		if (res.ok) {
			this.persistFar(true);
			this.logEvents(res.events);
		}
		magnetDebugLog.record('relearn', { ok: res.ok });
		this.emitLive();
		return res.ok;
	}

	getCapabilities(): MagnetCapabilities | null {
		return this.caps;
	}

	getPlatform(): MagnetPlatform | null {
		return this.platform;
	}

	getSnapshot(): DetectorSnapshot | null {
		return this.detector ? this.detector.snapshot() : null;
	}

	exportLog(): Promise<void> {
		return magnetDebugLog.exportToFile({
			platform: this.platform,
			capabilities: this.caps,
			config: this.detector ? this.detector.getConfig() : null,
			far: this.detector ? this.detector.getFar() : null,
		});
	}

	private wanted(): boolean {
		return this.counts.solve + this.counts.test > 0 && isAppVisible();
	}

	private scheduleReconcile(): void {
		this.chain = this.chain.then(() => this.reconcile()).catch(() => undefined);
	}

	private async reconcile(): Promise<void> {
		// Re-read the wish after every await: it may have flipped while a native call was in flight.
		for (let guard = 0; guard < 4; guard++) {
			const want = this.wanted();
			if (want === this.running) return;

			if (want) {
				const caps = await probeMagnetDetector();
				this.caps = caps;
				if (!caps || !caps.available) {
					setMagnetStatus({ active: false, stage: 'off', green: false, orange: false });
					return;
				}
				this.ensureDetector();
				this.detector.reset();
				this.armed = false;
				this.resumeAt = Date.now();
				this.disarmedAt = this.resumeAt;
				setMagnetSamplesHandler(this.onPayload);
				const ok = await startMagnetStream();
				this.running = ok;
				magnetDebugLog.record(ok ? 'stream_start' : 'stream_start_failed');
				setMagnetStatus({ active: ok, phase: 'unknown', hint: 'none' });
				if (!ok) return;
			} else {
				this.running = false;
				await stopMagnetStream();
				this.persistFar(true);
				magnetDebugLog.flushPending();
				magnetDebugLog.record('stream_stop');
				setMagnetStatus({ active: false, stage: 'off', green: false, orange: false, phase: 'unknown', hint: 'none' });
			}
		}
	}

	private ensureDetector(): void {
		if (this.detector) return;
		this.platform = magnetPlatform() ?? 'android';
		magnetDebugLog.setPlatform(this.platform);
		const far = getStoredFar(this.platform);
		this.detector = new MagnetDetector(detectorConfigFor(this.platform), far);
		this.lastPersistedFar = far;
	}

	private onPayload = (payload: MagnetSamplesPayload): void => {
		if (!this.running || !this.detector) return;
		const minT = this.resumeAt - STALE_TOLERANCE_MS;
		const samples = decodeSamples(payload?.d).filter((s) => s.t >= minT);
		if (!samples.length) return;

		magnetDebugLog.addSamples(samples);
		const events = this.detector.push(samples);
		const lifts: ServiceBatch['lifts'] = [];

		for (const e of events) {
			if (e.type === 'near') {
				// A re-placement keeps the arming of the placement it came from.
				if (!e.replaced) this.armed = isArmed(e.farSince, e.t, this.disarmedAt, ARM_FAR_MS);
			} else if (e.type === 'lift') {
				lifts.push({ event: e, armed: this.armed });
				this.armed = false;
			}
		}
		if (events.length) this.logEvents(events, payload?.clk);

		const snapshot = this.detector.snapshot();
		// A lift is usually confirmed a batch or two after it starts, so the arming of the
		// placement has to survive the 'lifting' phase.
		if (snapshot.phase !== 'near' && snapshot.phase !== 'lifting') this.armed = false;
		setMagnetStatus({ phase: snapshot.phase, hint: snapshot.hint });
		this.persistFar(false);

		const batch: ServiceBatch = {
			events,
			lifts,
			snapshot,
			armed: this.armed,
			resumeAt: this.resumeAt,
			testMode: this.isTestMode(),
		};
		this.batchListeners.forEach((listener) => listener(batch));
		this.emitLive(snapshot);
	};

	private emitLive(snapshot?: DetectorSnapshot): void {
		if (!this.liveListeners.size || !this.detector) return;
		const snap = snapshot ?? this.detector.snapshot();
		const live: LiveReading = { delta: snap.delta, snapshot: snap };
		this.liveListeners.forEach((listener) => listener(live));
	}

	private logEvents(events: DetectorEvent[], clk?: string): void {
		const far = this.detector ? this.detector.getFar() : null;
		for (const e of events) {
			switch (e.type) {
				case 'lift':
					magnetDebugLog.record('lift', {
						onset: e.onset,
						latencyMs: Math.round(e.latencyMs),
						delta: Math.round(e.delta),
						sigma: +e.sigma.toFixed(2),
						trigger: +e.trigger.toFixed(1),
						restMs: Math.round(e.onset - e.nearSince),
						clk,
					}, e.t);
					// 3 s before the onset so a short rest still includes the placement (and the far
					// plateau before it): the detector never trusts a static near reading, so a
					// window without them could not be replayed as a test fixture.
					magnetDebugLog.captureAround({
						label: 'lift',
						centerT: e.onset,
						beforeMs: 3000,
						afterMs: 1000,
						onset: e.onset,
						confirmedAt: e.t,
						nearDelta: e.delta,
						far,
					});
					break;
				case 'reject':
					magnetDebugLog.record('reject', { reason: e.reason, peak: +e.peak.toFixed(1) }, e.t);
					magnetDebugLog.captureAround({ label: `reject_${e.reason}`, centerT: e.t, far });
					break;
				case 'near':
					magnetDebugLog.record('near', { delta: Math.round(e.delta), replaced: e.replaced }, e.t);
					break;
				case 'far_learned':
					magnetDebugLog.record('far_learned', { source: e.source, shift: +e.shift.toFixed(1) }, e.t);
					break;
				case 'hint':
					magnetDebugLog.record('hint', { hint: e.hint, delta: e.delta === null ? null : Math.round(e.delta) }, e.t);
					break;
				case 'gap':
					magnetDebugLog.record('gap', { ms: Math.round(e.ms) }, e.t);
					break;
				case 'unsupported':
					magnetDebugLog.record('unsupported', { rateHz: +e.rateHz.toFixed(1) }, e.t);
					break;
				case 'phase':
					break;
			}
		}
	}

	private persistFar(force: boolean): void {
		if (!this.detector || !this.platform) return;
		const far = this.detector.getFar();
		if (!far) return;
		const now = Date.now();
		const moved = !this.lastPersistedFar || distVV(far, this.lastPersistedFar) >= FAR_PERSIST_MIN_SHIFT;
		if (!moved) return;
		if (!force && now - this.lastPersistAt < FAR_PERSIST_INTERVAL_MS) return;
		setStoredFar(this.platform, far);
		this.lastPersistedFar = far;
		this.lastPersistAt = now;
	}

	private attachGlobals(): void {
		if (this.globalsAttached) return;
		this.globalsAttached = true;

		// app-visibility guards its own document access, so this needs no window check.
		onVisibilityChange((visible) => {
			if (!visible) this.disarm('hidden');
			this.scheduleReconcile();
		});

		if (typeof window === 'undefined') return;
		this.lastSize = { w: window.innerWidth, h: window.innerHeight };
		window.addEventListener('resize', () => {
			const prev = this.lastSize;
			const next = { w: window.innerWidth, h: window.innerHeight };
			this.lastSize = next;
			if (!prev || !this.detector || !this.running) return;
			const widthJump = prev.w > 0 && Math.abs(next.w - prev.w) / prev.w > RESIZE_RESET_RATIO;
			const aspectFlip = prev.w > prev.h !== next.w > next.h;
			if (widthJump || aspectFlip) {
				// Fold, unfold or rotation: the magnetometer moved relative to everything.
				this.detector.reset();
				this.resumeAt = Date.now();
				this.disarm('resize');
				magnetDebugLog.record('resize_reset', { from: prev, to: next });
			}
		});
	}
}

export const magnetService = new MagnetService();
