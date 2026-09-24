// Test-only helpers. Kept outside __tests__ because Jest treats every .ts file there as
// a suite. Nothing in the app imports this module (it uses fs).
import * as fs from 'fs';
import * as path from 'path';
import type { DetectorEvent, MagnetPlatform, MagnetSample, Vec3 } from '../types';
import type { MagnetDetector } from '../detector';

export interface FixtureLiftLabel {
	/** Reference onset, ms from the fixture start (last sample on the near plateau). */
	onsetRef: number;
	/** First sample back inside the far zone, ms from the fixture start. */
	farAt: number;
	nearDelta: number;
	noiseMax: number;
}

/**
 * Same shape as the admin debug export's sample windows, so a field log can be dropped
 * in here as a new fixture unchanged.
 */
export interface MagnetFixture {
	v: number;
	kind: string;
	platform: MagnetPlatform;
	source: string;
	note?: string;
	far: Vec3;
	labels: { lifts: FixtureLiftLabel[] };
	/** Flat [t, x, y, z, ...], t in ms relative to the fixture start. */
	d: number[];
}

/** Arbitrary epoch base so fixture times look like real native timestamps. */
export const FIXTURE_T0 = 1_790_000_000_000;

export function loadFixture(name: string): MagnetFixture {
	const file = path.join(__dirname, '..', '__tests__', 'fixtures', name);
	return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export function fixtureSamples(fx: MagnetFixture, t0 = FIXTURE_T0): MagnetSample[] {
	const out: MagnetSample[] = [];
	for (let i = 0; i + 3 < fx.d.length; i += 4) {
		out.push({ t: t0 + fx.d[i], x: fx.d[i + 1], y: fx.d[i + 2], z: fx.d[i + 3] });
	}
	return out;
}

/** Splits samples into native-style batches by time. */
export function toBatches(samples: MagnetSample[], batchMs = 50): MagnetSample[][] {
	const batches: MagnetSample[][] = [];
	let current: MagnetSample[] = [];
	for (const s of samples) {
		if (current.length && s.t - current[0].t >= batchMs) {
			batches.push(current);
			current = [];
		}
		current.push(s);
	}
	if (current.length) batches.push(current);
	return batches;
}

export function runDetector(det: MagnetDetector, samples: MagnetSample[], batchMs = 50): DetectorEvent[] {
	const events: DetectorEvent[] = [];
	for (const batch of toBatches(samples, batchMs)) {
		events.push(...det.push(batch));
	}
	return events;
}

/** Keeps roughly one sample per 1000/hz ms, as a slower sensor would deliver. */
export function resample(samples: MagnetSample[], hz: number): MagnetSample[] {
	const step = 1000 / hz;
	const out: MagnetSample[] = [];
	let next = -Infinity;
	for (const s of samples) {
		if (s.t >= next) {
			out.push(s);
			next = s.t + step - 0.5;
		}
	}
	return out;
}

export function liftsOf(events: DetectorEvent[]) {
	return events.filter((e): e is Extract<DetectorEvent, { type: 'lift' }> => e.type === 'lift');
}

export function nearsOf(events: DetectorEvent[]) {
	return events.filter((e): e is Extract<DetectorEvent, { type: 'near' }> => e.type === 'near');
}
