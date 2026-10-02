// Validation for the magnet lift-to-start field study (MagnetTelemetry.resolver.ts). Kept
// apart from the resolver so the rules are unit tested without Prisma or a server: every
// field the phone sends is clamped, trimmed or dropped here before it reaches the table.

export const MAGNET_TELEMETRY_EVENTS = [
	'device',
	'near',
	'lift',
	'reject',
	'unsupported',
	'hint',
	'far_learned',
	'touch_ignored',
] as const;

/** Guards against a client bug turning one flush into an unbounded insert. */
export const MAX_EVENTS_PER_CALL = 50;
/** Raw windows per user per rolling day. A window is ~10 KB; the rows themselves are tiny. */
export const MAX_SAMPLE_WINDOWS_PER_DAY = 30;
/**
 * Longest raw window accepted, in numbers (t, x, y, z per sample). The client cuts at most
 * 4 s around an event at ~100 Hz, i.e. ~1600 numbers; this leaves room for faster sensors.
 */
export const MAX_SAMPLE_NUMBERS = 8000;

const ALLOWED_EVENTS = new Set<string>(MAGNET_TELEMETRY_EVENTS);
const PLATFORMS = new Set(['ios', 'android']);

export interface MagnetTelemetryEventLike {
	platform?: string | null;
	device_model?: string | null;
	os_version?: string | null;
	sensor_name?: string | null;
	event_type?: string | null;
	detail?: string | null;
	delta_ut?: number | null;
	latency_ms?: number | null;
	rest_ms?: number | null;
	approach_ms?: number | null;
	sigma?: number | null;
	rate_hz?: number | null;
	reversed?: boolean | null;
	/** JSON-encoded window in the test-fixture format. */
	samples?: string | null;
	app_version?: string | null;
}

export interface MagnetTelemetryRowData {
	user_id: string;
	platform: string;
	device_model: string;
	os_version: string | null;
	sensor_name: string | null;
	event_type: string;
	detail: string | null;
	delta_ut: number | null;
	latency_ms: number | null;
	rest_ms: number | null;
	approach_ms: number | null;
	sigma: number | null;
	rate_hz: number | null;
	reversed: boolean;
	samples?: SampleWindow;
	app_version: string | null;
}

/** The stored subset of a captured window (client/util/magnet-start/debug_log.ts). */
export interface SampleWindow {
	v: 1;
	kind: 'magnet-fixture';
	platform: string | null;
	note: string;
	far: number[] | null;
	labels: {lifts: {onsetRef: number; farAt: number; nearDelta: number; noiseMax: number}[]};
	d: number[];
}

function text(value: unknown, max: number): string | null {
	if (typeof value !== 'string') return null;
	const trimmed = value.trim();
	return trimmed ? trimmed.slice(0, max) : null;
}

function num(value: unknown, max: number): number | null {
	if (typeof value !== 'number' || !Number.isFinite(value)) return null;
	if (value < 0) return 0;
	return value > max ? max : Math.round(value * 10) / 10;
}

function int(value: unknown, max: number): number | null {
	const n = num(value, max);
	return n === null ? null : Math.round(n);
}

function finiteArray(value: unknown, length: number): number[] | null {
	if (!Array.isArray(value) || value.length !== length) return null;
	return value.every((n) => typeof n === 'number' && Number.isFinite(n)) ? (value as number[]) : null;
}

/**
 * Parses a JSON-encoded window and keeps only the fixture fields, so the column never
 * stores anything but samples and their labels. Anything malformed is dropped.
 */
export function parseSampleWindow(raw: unknown): SampleWindow | null {
	if (typeof raw !== 'string' || !raw || raw.length > MAX_SAMPLE_NUMBERS * 12) return null;
	let parsed: any;
	try {
		parsed = JSON.parse(raw);
	} catch (e) {
		return null;
	}
	if (!parsed || parsed.v !== 1 || parsed.kind !== 'magnet-fixture') return null;
	const d = parsed.d;
	if (!Array.isArray(d) || d.length < 40 || d.length > MAX_SAMPLE_NUMBERS || d.length % 4 !== 0) return null;
	if (!d.every((n: unknown) => typeof n === 'number' && Number.isFinite(n))) return null;

	const lifts = Array.isArray(parsed.labels?.lifts) ? parsed.labels.lifts.slice(0, 4) : [];
	return {
		v: 1,
		kind: 'magnet-fixture',
		platform: PLATFORMS.has(parsed.platform) ? parsed.platform : null,
		note: text(parsed.note, 48) || '',
		far: finiteArray(parsed.far, 3),
		labels: {
			lifts: lifts
				.map((l: any) => ({
					onsetRef: num(l?.onsetRef, 600000),
					farAt: num(l?.farAt, 600000),
					nearDelta: num(l?.nearDelta, 20000),
					noiseMax: num(l?.noiseMax, 1000),
				}))
				.filter((l: any) => l.onsetRef !== null && l.farAt !== null && l.nearDelta !== null && l.noiseMax !== null),
		},
		d,
	};
}

/** Accepted rows of one flush, ready for createMany. */
export function sanitizeMagnetTelemetry(
	events: MagnetTelemetryEventLike[] | null | undefined,
	userId: string
): MagnetTelemetryRowData[] {
	const rows: MagnetTelemetryRowData[] = [];
	for (const e of (events || []).slice(0, MAX_EVENTS_PER_CALL)) {
		if (!e || !ALLOWED_EVENTS.has(e.event_type as string) || !PLATFORMS.has(e.platform as string)) continue;
		const samples = parseSampleWindow(e.samples);
		rows.push({
			user_id: userId,
			platform: e.platform as string,
			device_model: text(e.device_model, 64) || 'unknown',
			os_version: text(e.os_version, 32),
			sensor_name: text(e.sensor_name, 64),
			event_type: e.event_type as string,
			detail: text(e.detail, 48),
			// The hot spot has been measured at ~3200 uT; 20 mT is far beyond any phone sensor.
			delta_ut: num(e.delta_ut, 20000),
			latency_ms: int(e.latency_ms, 60000),
			rest_ms: int(e.rest_ms, 3600000),
			approach_ms: int(e.approach_ms, 600000),
			sigma: num(e.sigma, 1000),
			rate_hz: num(e.rate_hz, 1000),
			reversed: e.reversed === true,
			...(samples ? {samples} : {}),
			app_version: text(e.app_version, 32),
		});
	}
	return rows;
}

/** Strips raw windows beyond what the user may still store today; the rows themselves stay. */
export function applySampleQuota(rows: MagnetTelemetryRowData[], remaining: number): MagnetTelemetryRowData[] {
	let left = Math.max(0, remaining);
	return rows.map((row) => {
		if (!row.samples) return row;
		if (left > 0) {
			left--;
			return row;
		}
		const {samples, ...rest} = row;
		return rest;
	});
}
