import { gqlMutate } from '../../components/api';
import { RecordSmartCubeTelemetryDocument } from '../../@types/generated/graphql';
import { isNative } from '../platform';
import type { SmartEngineEvent } from './solve_engine';

/**
 * Field study of smart cube behaviour, collected from the shared solve engine.
 *
 * The question it answers cannot be answered from the code: which cube models deliver a
 * clean move stream, and which ones lean on the facelets fallbacks. Three cubes on one
 * desk cannot tell us that; a few days of real users can.
 *
 * Two rules shape this file:
 *   - it must never affect a solve, so every failure is swallowed
 *   - it must not cost a request per solve, so rows are batched
 *
 * The server drops everything unless the `smart_telemetry_enabled` site flag is on, which
 * is how the study gets opened for a few days and closed again without a deploy.
 */

export type TelemetrySurface = 'timer' | 'room' | 'trainer';

interface TelemetryRow {
	device_name: string;
	cube_type: string;
	surface: string;
	event_type: string;
	detection_source?: string;
	detection_lag_ms?: number;
	time_ms?: number;
	turn_count?: number;
	battery_level?: number;
	time_correction_ms?: number;
	is_native?: boolean;
	app_version?: string;
}

/** Flush when the buffer reaches this, so a long session does not hold everything in memory. */
const FLUSH_AT = 10;
/** Or when this much time passes, so a short session still reports before the tab closes. */
const FLUSH_AFTER_MS = 60_000;
/** Hard cap: if the network is down, drop the oldest rather than grow without bound. */
const MAX_BUFFER = 100;

let buffer: TelemetryRow[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let listenersBound = false;

/** Identity of the cube currently connected. Set once per connection, read on every row. */
let currentDevice: { name: string; type: string } | null = null;

/**
 * Last battery percentage the cube reported. Stamped onto every row so the study can test
 * whether dropped move packets track a draining battery, which is the obvious suspect for
 * a weak transmitter but has never been measured here.
 */
let currentBattery: number | null = null;

function appVersion(): string | undefined {
	if (typeof window === 'undefined') return undefined;
	return (window as any).__ASSET_VERSION__ || undefined;
}

function bindLifecycleListeners(): void {
	if (listenersBound || typeof document === 'undefined') return;
	listenersBound = true;

	// A tab going away is the most common end of a session; flush what we have.
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'hidden') void flush();
	});
	window.addEventListener('pagehide', () => { void flush(); });
}

export function setTelemetryDevice(name: string | null, type: string | null): void {
	currentDevice = name ? { name, type: type || 'unknown' } : null;
	// A new connection means a new cube; do not carry the previous one's battery over.
	currentBattery = null;
}

export function setTelemetryBattery(level: number | null | undefined): void {
	currentBattery = typeof level === 'number' && Number.isFinite(level) ? level : null;
}

async function flush(): Promise<void> {
	if (flushTimer) {
		clearTimeout(flushTimer);
		flushTimer = null;
	}
	if (!buffer.length) return;

	const events = buffer;
	buffer = [];

	try {
		await gqlMutate(RecordSmartCubeTelemetryDocument, { events });
	} catch (e) {
		// Never retry: a failed batch is a lost observation, not a lost solve. Retrying
		// would risk hammering the server from every client at once after an outage.
	}
}

function enqueue(row: TelemetryRow): void {
	bindLifecycleListeners();

	buffer.push({
		...row,
		battery_level: currentBattery ?? undefined,
		is_native: isNative(),
		app_version: appVersion(),
	});
	if (buffer.length > MAX_BUFFER) buffer = buffer.slice(-MAX_BUFFER);

	if (buffer.length >= FLUSH_AT) {
		void flush();
		return;
	}
	if (!flushTimer) {
		flushTimer = setTimeout(() => { void flush(); }, FLUSH_AFTER_MS);
	}
}

/**
 * Translate an engine event into an observation. Called from every surface that drives the
 * engine, so the study covers the timer, rooms and the trainer with one code path.
 */
export function recordEngineEvent(event: SmartEngineEvent, surface: TelemetrySurface): void {
	if (!currentDevice) return;

	const base = {
		device_name: currentDevice.name,
		cube_type: currentDevice.type,
		surface,
	};

	switch (event.type) {
		case 'SOLVE_COMPLETE':
			enqueue({
				...base,
				event_type: 'solve',
				detection_source: event.result.source,
				detection_lag_ms: Math.round(event.result.detectionLagMs),
				time_ms: event.result.timeMs,
				// HTM, matching what the user sees and what the solve record stores. The raw
				// BLE event count would make TPS look higher than the app ever reported.
				turn_count: event.result.htmCount,
				time_correction_ms: Math.round(event.result.timeCorrectionMs),
			});
			break;

		case 'OUT_OF_SYNC':
			// Only the onset is interesting; the recovery is implied by the next solve.
			if (event.out) enqueue({ ...base, event_type: 'out_of_sync' });
			break;

		case 'LATE_SCRAMBLE_MOVE':
			enqueue({ ...base, event_type: 'late_scramble_move' });
			break;

		case 'TRACKER_RESYNCED':
			// The scramble-side counterpart of the solve rows. A re-anchor means the move
			// stream and the cube disagreed; 'realigned' is one the user never noticed,
			// 'reset' is one that cost them their place in the scramble. Until this was
			// recorded the whole failure was invisible on the server: we measured how solves
			// finished and nothing at all about how scrambling went.
			enqueue({
				...base,
				event_type: 'scramble_resync',
				detection_source: event.realigned ? 'realigned' : 'reset',
			});
			break;

		default:
			break;
	}
}

/** Connection-level observations, which the engine never sees. */
export function recordConnectionEvent(
	eventType: 'scan_error' | 'disconnect',
	surface: TelemetrySurface,
	device?: { name: string; type: string }
): void {
	const target = device || currentDevice;
	if (!target) return;
	enqueue({
		device_name: target.name,
		cube_type: target.type,
		surface,
		event_type: eventType,
	});
}
