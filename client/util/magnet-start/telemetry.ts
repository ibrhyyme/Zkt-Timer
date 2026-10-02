// Field study of magnet lift-to-start across phone models (server side:
// MagnetTelemetry.resolver.ts, admin readout: /admin/magnet-telemetry).
//
// It answers what two phones on one desk cannot: whether a cube at the hot spot clears the
// 150 uT threshold with margin on every phone, how fast lifts are confirmed, how often lifts
// are refused or rejected, and which phones cannot deliver 40 Hz at all.
//
// Rules that shape this file:
//   - it must never affect a solve, so every failure is swallowed
//   - it must not cost a request per solve, so rows are batched
//   - it only collects while the study is open (site flag `magnet_telemetry_enabled`, also
//     enforced by the server), and the callers never feed it from the admin test panel
//   - raw sample windows are rare: flagged events and the first lifts of each phone only
import { gqlMutate } from '../../components/api';
import { RecordMagnetTelemetryDocument } from '../../@types/generated/graphql';
import { getLastKnownSiteConfig } from '../hooks/useSiteConfig';
import { isUiReversed } from '../reversed-ui';
import type { CapturedWindow } from './debug_log';
import type { MagnetCapabilities, MagnetHint, MagnetPlatform } from './types';

export type MagnetTelemetryEventType =
	| 'device'
	| 'near'
	| 'lift'
	| 'reject'
	| 'unsupported'
	| 'hint'
	| 'far_learned'
	| 'touch_ignored';

export interface MagnetTelemetryEvent {
	event_type: MagnetTelemetryEventType;
	detail?: string;
	delta_ut?: number | null;
	latency_ms?: number | null;
	rest_ms?: number | null;
	approach_ms?: number | null;
	sigma?: number | null;
	rate_hz?: number | null;
}

interface QueuedRow {
	row: MagnetTelemetryEvent & { reversed: boolean };
	at: number;
	/** Waiting for the raw window cut around this event (debug_log key). */
	sampleKey?: string;
	samples?: string;
}

/** Flush when this many rows are ready. */
const FLUSH_AT = 20;
/** Or when this much time passes, so a short session still reports. */
const FLUSH_AFTER_MS = 60_000;
/** Hard cap: with the network down, drop the oldest rather than grow without bound. */
const MAX_BUFFER = 200;
/** A row waiting for its raw window is sent without it after this long. */
const SAMPLE_WAIT_MS = 5_000;
/** Raw windows per app session; the server caps per user per day as well. */
const MAX_SESSION_SAMPLES = 10;
/** Started lifts that carry a raw window, per phone (a baseline of normal lifts per model). */
const BASELINE_LIFT_SAMPLES = 3;
/** Rows of the chattier kinds per session. */
const SESSION_CAPS: Partial<Record<MagnetTelemetryEventType, number>> = { hint: 30, touch_ignored: 20 };
const BASELINE_KEY = 'zkt_magnet_telemetry_lift_samples';

let buffer: QueuedRow[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let listenersBound = false;
/** The server answered "study closed": collect nothing until the next launch. */
let closedForSession = false;

let platform: MagnetPlatform | null = null;
let sensorName: string | null = null;
let deviceReported = false;
let sessionSamples = 0;
const sessionCounts: Partial<Record<MagnetTelemetryEventType, number>> = {};
/** Windows that were cut before the row asking for them was recorded. */
const arrivedWindows = new Map<string, string | null>();

// "Move closer" band tracking for near rows' approach_ms.
let closerSince: number | null = null;
let noneAt: number | null = null;

function studyOpen(): boolean {
	return !closedForSession && !!getLastKnownSiteConfig()?.magnet_telemetry_enabled;
}

function bindLifecycleListeners(): void {
	if (listenersBound || typeof document === 'undefined' || typeof window === 'undefined') return;
	listenersBound = true;
	// A session usually ends with the app going to the background; send what we have.
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'hidden') void flush(true);
	});
	window.addEventListener('pagehide', () => {
		void flush(true);
	});
}

function readBaselineCount(): number {
	try {
		return parseInt(window.localStorage.getItem(BASELINE_KEY) || '0', 10) || 0;
	} catch (e) {
		return BASELINE_LIFT_SAMPLES;
	}
}

function writeBaselineCount(n: number): void {
	try {
		window.localStorage.setItem(BASELINE_KEY, String(n));
	} catch (e) {
		// Without storage the baseline simply stops after this session's lifts.
	}
}

function scheduleFlush(): void {
	const ready = buffer.filter((q) => !q.sampleKey).length;
	if (ready >= FLUSH_AT) {
		void flush();
		return;
	}
	if (!flushTimer) {
		flushTimer = setTimeout(() => {
			flushTimer = null;
			void flush();
		}, FLUSH_AFTER_MS);
	}
}

function enqueue(queued: QueuedRow): void {
	bindLifecycleListeners();
	buffer.push(queued);
	if (buffer.length > MAX_BUFFER) buffer = buffer.slice(-MAX_BUFFER);
	scheduleFlush();
}

async function commonFields() {
	let device: { manufacturer?: string; model?: string; osVersion?: string; otaBundle?: string } = {};
	try {
		const { getDeviceInfo } = await import('../device-info');
		device = await getDeviceInfo();
	} catch (e) {
		// A row without a model is still a row.
	}
	const assetVersion = typeof window !== 'undefined' ? (window as any).__ASSET_VERSION__ : undefined;
	return {
		platform: platform || 'android',
		device_model: [device.manufacturer, device.model].filter(Boolean).join(' ') || 'unknown',
		os_version: device.osVersion || undefined,
		sensor_name: sensorName || undefined,
		app_version: device.otaBundle || assetVersion || undefined,
	};
}

/**
 * Sends the rows that are ready. `force` (app going to the background) also sends rows
 * still waiting for their raw window, without it.
 */
async function flush(force = false): Promise<void> {
	if (flushTimer) {
		clearTimeout(flushTimer);
		flushTimer = null;
	}
	const now = Date.now();
	const ready = buffer.filter((q) => !q.sampleKey || force || now - q.at > SAMPLE_WAIT_MS);
	buffer = buffer.filter((q) => !ready.includes(q));
	if (buffer.length) scheduleFlush();
	if (!ready.length || !studyOpen() || !platform) return;

	try {
		const common = await commonFields();
		const events = ready.map((q) => ({
			...common,
			...q.row,
			samples: q.samples,
		}));
		const res: any = await gqlMutate(RecordMagnetTelemetryDocument, { events });
		if (res?.data?.recordMagnetTelemetry?.enabled === false) {
			closedForSession = true;
			buffer = [];
		}
	} catch (e) {
		// Never retry: a failed batch is a lost observation, not a lost solve. Retrying would
		// risk every client hammering the server at once after an outage.
	}
}

export const magnetTelemetry = {
	/** The stream (re)started: a new placement sequence begins. */
	begin(nextPlatform: MagnetPlatform | null, caps: MagnetCapabilities | null): void {
		platform = nextPlatform;
		sensorName = caps?.name || null;
		closerSince = null;
		noneAt = null;
	},

	/** Once per app session, when the sensor's delivery rate has been measured. */
	reportDevice(rateHz: number | null, sigma: number | null): void {
		if (deviceReported || rateHz === null) return;
		deviceReported = true;
		this.record({ event_type: 'device', rate_hz: rateHz, sigma });
	},

	/**
	 * Records one observation. With `sampleKey` and `wantSamples` the row waits (briefly) for
	 * the raw window debug_log cuts under that key, within the session's window budget.
	 */
	record(event: MagnetTelemetryEvent, sample?: { key: string; want: boolean }): void {
		if (!studyOpen()) return;
		const cap = SESSION_CAPS[event.event_type];
		if (cap !== undefined) {
			const used = sessionCounts[event.event_type] || 0;
			if (used >= cap) return;
			sessionCounts[event.event_type] = used + 1;
		}

		const queued: QueuedRow = { row: { ...event, reversed: isUiReversed() }, at: Date.now() };
		if (sample?.want) {
			const waiting = buffer.filter((q) => q.sampleKey).length;
			if (sessionSamples + waiting < MAX_SESSION_SAMPLES) {
				if (arrivedWindows.has(sample.key)) {
					const json = arrivedWindows.get(sample.key);
					arrivedWindows.delete(sample.key);
					if (json) {
						queued.samples = json;
						sessionSamples++;
					}
				} else {
					queued.sampleKey = sample.key;
				}
			}
		}
		enqueue(queued);
	},

	/** A lift and what the controller made of it (useMagnetStart). */
	recordLift(
		lift: { onset: number; nearSince: number; delta: number; sigma: number; latencyMs: number },
		decision: string
	): void {
		if (!studyOpen()) return;
		const refused = decision.startsWith('none:');
		let want = refused;
		if (!want) {
			const taken = readBaselineCount();
			if (taken < BASELINE_LIFT_SAMPLES) {
				writeBaselineCount(taken + 1);
				want = true;
			}
		}
		this.record(
			{
				event_type: 'lift',
				detail: decision,
				delta_ut: lift.delta,
				latency_ms: lift.latencyMs,
				rest_ms: lift.onset - lift.nearSince,
				sigma: lift.sigma,
			},
			{ key: `lift@${lift.onset}`, want }
		);
	},

	/** debug_log cut (or gave up on) the window requested under `key`. */
	onWindow(captured: CapturedWindow | null, key: string | undefined): void {
		if (!key || !studyOpen()) return;
		const json = captured ? JSON.stringify(captured) : null;
		const holder = buffer.find((q) => q.sampleKey === key);
		if (!holder) {
			arrivedWindows.set(key, json);
			// Only the latest few matter; a row that never asks leaves nothing behind.
			if (arrivedWindows.size > 20) arrivedWindows.delete(arrivedWindows.keys().next().value as string);
			return;
		}
		holder.sampleKey = undefined;
		if (json && sessionSamples < MAX_SESSION_SAMPLES) {
			holder.samples = json;
			sessionSamples++;
		}
		scheduleFlush();
	},

	/** Hint transitions feed approach_ms: time in the "move closer" band before a placement. */
	noteHint(hint: MagnetHint, t: number): void {
		if (hint === 'closer') {
			// A 'none' in between means the cube went away; the approach starts over.
			if (closerSince === null || noneAt !== null) closerSince = t;
			noneAt = null;
		} else if (hint === 'none') {
			noneAt = t;
		} else {
			closerSince = null;
			noneAt = null;
		}
	},

	/**
	 * approach_ms for a fresh placement at `t`. The detector clears the hint and enters near
	 * on the same sample, so a 'none' at exactly `t` is the placement itself.
	 */
	takeApproach(t: number): number | null {
		const approach = closerSince !== null && (noneAt === null || noneAt === t) ? t - closerSince : null;
		closerSince = null;
		noneAt = null;
		return approach;
	},

	flush,
};

export function resetMagnetTelemetryForTests(): void {
	buffer = [];
	if (flushTimer) clearTimeout(flushTimer);
	flushTimer = null;
	closedForSession = false;
	platform = null;
	sensorName = null;
	deviceReported = false;
	sessionSamples = 0;
	for (const key of Object.keys(sessionCounts)) delete sessionCounts[key as MagnetTelemetryEventType];
	arrivedWindows.clear();
	closerSince = null;
	noneAt = null;
}

export function getMagnetTelemetryBufferForTests(): QueuedRow[] {
	return buffer;
}
