// Pure rules of the Kamera Timer: what a start or stop from the brain does to the timer, how a
// frame time becomes a wall-clock time, and which camera problems the user is told about.
// No store, no React, no DOM: table-driven tests in __tests__/decision.test.ts.

import type { StartBlockReason } from '../magnet-start/start_guard';

/** Events the brain reports (times are frame capture times, performance.now() ms). */
export type PadEventType = 'ready' | 'start' | 'stop' | 'disarm' | 'idle';

export interface PadEvent {
	type: PadEventType;
	/** start: the backdated lift onset. stop: the backdated moment both hands were back. */
	t: number;
	frame: number;
	/** The frame that confirmed the event. */
	at?: number;
	atFrame?: number;
	/** stop only: t - start.t, the solve time the camera measured. */
	timeMs?: number;
	via?: string;
}

export type PadState = 'idle' | 'ready' | 'solving' | 'stopped';

export interface PadPoint {
	x: number;
	y: number;
	scale: number;
}

export interface BrainSnap {
	state: PadState;
	startT: number | null;
	/** While the hands sit in the stop pose but the stop is not confirmed: the time it will get. */
	pendingStopT: number | null;
	armMs: number;
	stopRunMs: number;
	pads: PadPoint[] | null;
	palms: PadPoint[];
}

/**
 * A frame's capture time (performance.now() time base) on the wall clock the timer uses
 * (Date.now(), timeStartedAt). The timer is started and stopped from these, so neither the
 * model's processing time nor the confirmation frames enter the solve time.
 */
export function captureToEpoch(t: number, timeOrigin: number): number {
	return Math.round(timeOrigin + t);
}

/** Never start from an onset older than the touch path accepts (events.ts startTimer). */
export const MAX_ONSET_AGE_MS = 2000;

export interface CameraTimerSide {
	guard: StartBlockReason | null;
	solving: boolean;
	inInspection: boolean;
	dnfTime: boolean;
	inspectionEnabled: boolean;
	/** inspection_except_bld on a blind subset: no inspection, straight to the solve. */
	exceptBld: boolean;
	inspectionStartedAt: number | null;
	inspectionDelayMs: number;
	now: number;
}

export type CameraStartAction =
	| { kind: 'none'; reason: StartBlockReason | 'solving' | 'stale' | 'dnf' }
	| { kind: 'startInspection'; onset: number }
	| { kind: 'startTimer'; onset: number; addTwo?: boolean };

/** A hand left its pad (brain 'start' event, onset already on the wall clock). */
export function decideOnCameraStart(c: CameraTimerSide, onset: number): CameraStartAction {
	if (c.solving) return { kind: 'none', reason: 'solving' };
	if (c.guard) return { kind: 'none', reason: c.guard };
	if (c.now - onset > MAX_ONSET_AGE_MS) return { kind: 'none', reason: 'stale' };

	const start = Math.min(onset, c.now);

	if (c.inInspection) {
		if (c.dnfTime) return { kind: 'none', reason: 'dnf' };
		// The inspection interval flips addTwoToSolve on its own 100 ms tick, and this event
		// arrives a few frames after the onset. Judge +2 by the onset, as the magnet does.
		const addTwo = c.inspectionStartedAt !== null && start - c.inspectionStartedAt >= c.inspectionDelayMs;
		return { kind: 'startTimer', onset: start, addTwo };
	}

	if (c.inspectionEnabled) {
		// startInspection would start a blind solve itself, without the backdated onset.
		if (c.exceptBld) return { kind: 'startTimer', onset: start };
		// Inspection is backdated like the solve: it began when the hands left the pads, not
		// when the brain confirmed it ~0.25 s later (owner, 2026-11-03: inspection felt late).
		return { kind: 'startInspection', onset: start };
	}

	return { kind: 'startTimer', onset: start };
}

/**
 * How far the hands are off their pads, in each pad's hand sizes: the larger of the two, as
 * the pad timer measures it (its `disp`), rebuilt from the trimmed snapshot the brain sends.
 * Two palms are left to right like the pads; a lone palm belongs to the nearer pad. Null with
 * no pads or no palm in view.
 */
export function padDisplacement(pads: PadPoint[] | null, palms: PadPoint[]): number | null {
	if (!pads || pads.length !== 2 || !palms.length) return null;
	const dist = (a: PadPoint, b: PadPoint) => Math.hypot(a.x - b.x, a.y - b.y);
	let worst: number | null = null;
	pads.forEach((pad, s) => {
		let palm: PadPoint | null = null;
		if (palms.length >= 2) palm = palms[s];
		else if (dist(palms[0], pad) <= dist(palms[0], pads[1 - s])) palm = palms[0];
		if (!palm) return;
		const d = dist(palm, pad) / pad.scale;
		worst = worst === null ? d : Math.max(worst, d);
	});
	return worst;
}

/**
 * Share of the start distance (the brain's leaveFar) at which the green goes out. The start
 * itself needs the full distance on two frames; at 0.7 of it the green drops a median 60 ms
 * sooner, and in 33 recorded waits on the pads (2026-11-03) resting hands slid at most 0.34
 * hand sizes, so it never flickers while they rest (owner: the lift felt late).
 */
export const EARLY_LEAVE = 0.7;

/** Digits green: armed, no solve running, and no hand has started to leave its pad. */
export function cameraGreen(snap: Pick<BrainSnap, 'state' | 'pads' | 'palms'>, running: boolean, leaveFar: number): boolean {
	if (running || snap.state !== 'ready') return false;
	const d = padDisplacement(snap.pads, snap.palms);
	return d === null || d <= EARLY_LEAVE * leaveFar;
}

/** The camera's stop applies only to a solve that is running (Space may have ended it). */
export function cameraStopApplies(solving: boolean, ev: PadEvent): boolean {
	return solving && typeof ev.timeMs === 'number' && ev.timeMs > 0;
}

/**
 * The time the display freezes at while the hands sit in the stop pose (pad timer
 * pendingStopT), in seconds since the solve started; null when it should keep running.
 */
export function frozenSeconds(pendingStopEpoch: number | null, timeStartedAt: number | null): number | null {
	if (pendingStopEpoch === null || timeStartedAt === null) return null;
	const s = (pendingStopEpoch - timeStartedAt) / 1000;
	return s > 0 ? s : null;
}

// ---------- Quality warnings ----------

export type CameraWarning = 'unsupported_rate' | 'low_fps' | 'dark' | 'low_res' | 'slow' | 'no_hands';

export interface CameraQualityInput {
	/** Frames per second the camera delivers (0 while unknown). */
	cameraFps: number;
	width: number;
	height: number;
	/** Mean luma 0-255 of a small copy of the frame, null while unknown. */
	brightness: number | null;
	/** Average model time per frame in ms (0 while unknown). */
	modelMs: number;
	/** Ms since a frame last showed at least one hand, null if none yet. */
	sinceHandsMs: number | null;
	/** Ms since the model became ready. */
	runningMs: number;
}

export const QUALITY = {
	// The pad timer was measured at 60 fps and holds at 30; 15 fps already costs ~70 ms of accuracy.
	minFps: 24,
	minHeight: 480,
	// Mean luma below this: MediaPipe starts losing hands and the camera drops its frame rate.
	minBrightness: 55,
	// The model has to keep up with at least ~20 frames a second while the hands are on the pads.
	maxModelMs: 50,
	noHandsMs: 6000,
	// Readings settle during the first seconds (auto exposure, model warm-up).
	settleMs: 3000,
};

/** What to tell the user about the camera, most important first. */
export function cameraWarnings(q: CameraQualityInput): CameraWarning[] {
	if (q.runningMs < QUALITY.settleMs) return [];
	const out: CameraWarning[] = [];
	if (q.cameraFps > 0 && q.cameraFps < QUALITY.minFps) out.push('low_fps');
	if (q.brightness !== null && q.brightness < QUALITY.minBrightness) out.push('dark');
	if (q.height > 0 && q.height < QUALITY.minHeight) out.push('low_res');
	if (q.modelMs > QUALITY.maxModelMs) out.push('slow');
	if (q.sinceHandsMs === null ? q.runningMs > QUALITY.noHandsMs : q.sinceHandsMs > QUALITY.noHandsMs) {
		out.push('no_hands');
	}
	return out;
}

/** Mean luma of RGBA pixel data. Pure. */
export function meanLuma(data: ArrayLike<number>): number | null {
	const n = Math.floor(data.length / 4);
	if (!n) return null;
	let sum = 0;
	for (let i = 0; i < n; i++) {
		sum += 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
	}
	return sum / n;
}
