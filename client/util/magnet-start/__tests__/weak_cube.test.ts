// Calibrated thresholds on the detector (design 6.7) and the "phone in the hand" signal (6.4).
//
// Weak cubes are simulated from the real recordings: the cube's part of the field (B - F) is
// scaled by k, and the sensor noise that scaling removed is put back, so the detector sees a
// k times weaker magnet on the same phone with the same noise. Thresholds come from
// deriveThresholds with the rest value such a cube would measure, as the calibration flow
// would produce them.
import { deriveThresholds } from '../../../../shared/magnet_calibration';
import { detectorConfigFor } from '../config';
import { MagnetDetector } from '../detector';
import { isMoving } from '../service';
import type { MagnetPlatform, MagnetSample, Vec3 } from '../types';
import { FIXTURE_T0, fixtureSamples, liftsOf, loadFixture, MagnetFixture, nearsOf, runDetector, toBatches } from '../testing/load_fixture';
import { ANDROID_NOISE, IOS_NOISE, SignalBuilder, add } from '../testing/synth';

function seededGauss(seed: number): () => number {
	let a = seed >>> 0;
	const rand = () => {
		a = (a + 0x6d2b79f5) >>> 0;
		let t = a;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
	return () => {
		let u = 0;
		while (u === 0) u = rand();
		return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
	};
}

const AXIS_NOISE: Record<MagnetPlatform, number> = { ios: IOS_NOISE, android: ANDROID_NOISE };
/** Vector rms of the rest noise as calibration step 1 measures it (per-axis noise x sqrt 3). */
const NOISE_RMS: Record<MagnetPlatform, number> = { ios: IOS_NOISE * Math.sqrt(3), android: ANDROID_NOISE * Math.sqrt(3) };

function scaled(fx: MagnetFixture, k: number, seed = 11): MagnetSample[] {
	const gauss = seededGauss(seed);
	const restore = AXIS_NOISE[fx.platform] * Math.sqrt(1 - k * k);
	const F = fx.far;
	return fixtureSamples(fx).map((s) => ({
		t: s.t,
		x: F[0] + k * (s.x - F[0]) + restore * gauss(),
		y: F[1] + k * (s.y - F[1]) + restore * gauss(),
		z: F[2] + k * (s.z - F[2]) + restore * gauss(),
	}));
}

function calibratedDetector(platform: MagnetPlatform, rest: number, far: Vec3) {
	const t = deriveThresholds({ peak: rest * 1.5, rest, noise: NOISE_RMS[platform] }, platform);
	return { det: new MagnetDetector(detectorConfigFor(platform, { nearMin: t.nearMin, farMax: t.farMax }), far), t };
}

describe('calibrated thresholds on weak cubes (scaled real recordings)', () => {
	const lifts = loadFixture('android_fold6_lifts.json');
	const labels = lifts.labels.lifts;
	const restFull = Math.min(...labels.map((l) => l.nearDelta));
	// The third lift follows a re-placement wiggle by less than a plateau window. Whether the
	// wiggle settles into a plateau before the lift is a matter of ~10 ms even at full strength
	// (it does there by one sample); when it does not, the onset is backdated to the start of
	// the wiggle. Same detector rule at any strength, so that lift only has to stay in its window.
	const WIGGLE_LIFT = 2;
	const WIGGLE_MS = 400;

	it('the full-strength recording matches its labels (reference for the scaled runs)', () => {
		const found = liftsOf(runDetector(new MagnetDetector(detectorConfigFor('android'), lifts.far), fixtureSamples(lifts)));
		expect(found.map((l) => l.onset - FIXTURE_T0)).toEqual(labels.map((l, i) => (i === WIGGLE_LIFT ? l.onsetRef + 10 : l.onsetRef)));
	});

	it.each([0.4, 0.2])('Z Fold 6 at %s strength: every lift, onsets in the same window, nothing extra', (k) => {
		const { det, t } = calibratedDetector('android', k * restFull, lifts.far);
		expect(t.quality).not.toBe('fail');
		const events = runDetector(det, scaled(lifts, k));
		const found = liftsOf(events);

		expect(found).toHaveLength(labels.length);
		found.forEach((lift, i) => {
			const diff = lift.onset - FIXTURE_T0 - labels[i].onsetRef;
			// A weaker magnet leaves the band a few samples later at the start of a lift: up to
			// 40 ms late at 0.2 strength, never early (the solve is not lengthened).
			if (i === WIGGLE_LIFT) expect(diff).toBeGreaterThanOrEqual(-WIGGLE_MS);
			else expect(diff).toBeGreaterThanOrEqual(0);
			expect(diff).toBeLessThanOrEqual(50);
			expect(lift.latencyMs).toBeLessThanOrEqual(WIGGLE_MS + 100);
		});
		expect(nearsOf(events).filter((n) => !n.replaced)).toHaveLength(labels.length);
	});

	it('the same weak-cube thresholds stay silent on a 20 s far rest (noisy Samsung sensor)', () => {
		const fx = loadFixture('android_fold6_far_rest.json');
		const { det } = calibratedDetector('android', 0.2 * restFull, fx.far);
		const events = runDetector(det, fixtureSamples(fx));
		expect(liftsOf(events)).toHaveLength(0);
		expect(nearsOf(events)).toHaveLength(0);
	});

	it.each([0.4, 0.2])('iPhone placement at %s strength: one near, then rest without lifts', (k) => {
		const fx = loadFixture('ios_iphone15pro_place_rest.json');
		const full = runDetector(new MagnetDetector(detectorConfigFor('ios'), fx.far), fixtureSamples(fx));
		const rest = nearsOf(full)[0].delta * k;
		const { det } = calibratedDetector('ios', rest, fx.far);
		const events = runDetector(det, scaled(fx, k));
		expect(nearsOf(events)).toHaveLength(1);
		expect(liftsOf(events)).toHaveLength(0);
	});

	it('a cube resting from the session start still never becomes near with low thresholds', () => {
		const fx = loadFixture('ios_iphone15pro_static_near_start.json');
		const { det } = calibratedDetector('ios', 0.4 * 500, fx.far);
		const events = runDetector(det, scaled(fx, 0.4));
		const firstLift = liftsOf(events)[0];
		// Whatever happens later, nothing starts from the static reading at the start.
		const nearBefore = nearsOf(events).filter((n) => !firstLift || n.t < firstLift.t);
		expect(nearBefore.every((n) => n.farSince !== null)).toBe(true);
	});

	it('the weakest iOS line (30 uT) does not take a 4-5 uT cube on the middle of the screen for a placement', () => {
		const fx = loadFixture('ios_iphone15pro_weak_center.json');
		const { det, t } = calibratedDetector('ios', 90, fx.far);
		expect(t.nearMin).toBeCloseTo(31.5, 6);
		const events = runDetector(det, fixtureSamples(fx));
		expect(nearsOf(events)).toHaveLength(0);
		expect(liftsOf(events)).toHaveLength(0);
	});
});

describe('phone in the hand (moving)', () => {
	const FAR: Vec3 = [-120, 70, -150];

	function movingTrace(det: MagnetDetector, samples: MagnetSample[]): boolean[] {
		const out: boolean[] = [];
		for (const batch of toBatches(samples)) {
			det.push(batch);
			out.push(isMoving(det.snapshot()));
		}
		return out;
	}

	it('a phone turned in the hand reads as moving after 1.5 s, and stops at the first steady plateau', () => {
		const b = new SignalBuilder(FAR, { noise: IOS_NOISE, seed: 5 });
		b.hold(1000);
		const pickedUp = b.lastT();
		// The earth field turns with the phone: tens of uT, never still.
		for (let i = 0; i < 12; i++) b.moveTo(add(FAR, i % 2 ? [25, -20, 10] : [-20, 25, -15]), 250);
		b.moveTo(FAR, 200).hold(1000);

		const det = new MagnetDetector(detectorConfigFor('ios'), FAR);
		const trace: { t: number; moving: boolean }[] = [];
		for (const batch of toBatches(b.samples())) {
			det.push(batch);
			trace.push({ t: batch[batch.length - 1].t, moving: isMoving(det.snapshot()) });
		}
		expect(trace.some((x) => x.moving)).toBe(true);
		// Not before 1.5 s without a plateau.
		const first = trace.find((x) => x.moving) as { t: number };
		expect(first.t - pickedUp).toBeGreaterThanOrEqual(1500);
		expect(trace[trace.length - 1].moving).toBe(false);
	});

	it.each([
		['android_fold6_far_rest.json'],
		['ios_iphone15pro_weak_center.json'],
	])('%s: a phone lying on the table never reads as moving', (name) => {
		const fx = loadFixture(name);
		const det = new MagnetDetector(detectorConfigFor(fx.platform), fx.far);
		expect(movingTrace(det, fixtureSamples(fx)).some(Boolean)).toBe(false);
	});

	it.each([1, 0.4, 0.2])('iPhone placement at %s strength: a cube settling at the phone is not a moving phone', (k) => {
		const fx = loadFixture('ios_iphone15pro_place_rest.json');
		const rest = 495 * k;
		const { det } = calibratedDetector('ios', rest, fx.far);
		// Full strength: 2.3 s unsteady at 460-500 uT before the plateau, only the delta bound
		// keeps it from reading as a phone in the hand.
		expect(movingTrace(det, k === 1 ? fixtureSamples(fx) : scaled(fx, k)).some(Boolean)).toBe(false);
	});

	it('Fold lifts: the cube moving next to a still phone only reads as moving between placements, never at the phone', () => {
		const fx = loadFixture('android_fold6_lifts.json');
		const det = new MagnetDetector(detectorConfigFor('android'), fx.far);
		for (const batch of toBatches(fixtureSamples(fx))) {
			det.push(batch);
			const snap = det.snapshot();
			if (snap.phase === 'near' || snap.phase === 'lifting') expect(isMoving(snap)).toBe(false);
		}
	});

	it('a delivery stall restarts the count instead of reading as a moving phone', () => {
		const b = new SignalBuilder(FAR, { noise: IOS_NOISE, seed: 9 });
		b.hold(1000).gap(3000).hold(200);
		const det = new MagnetDetector(detectorConfigFor('ios'), FAR);
		det.push(b.samples());
		expect(det.snapshot().unsteadyMs as number).toBeLessThan(300);
		expect(isMoving(det.snapshot())).toBe(false);
	});

	it('counts from the start of the reading when no plateau was ever seen, and resets with the detector', () => {
		const b = new SignalBuilder(FAR, { noise: IOS_NOISE, seed: 13 });
		for (let i = 0; i < 10; i++) b.moveTo(add(FAR, i % 2 ? [30, 0, 0] : [0, 30, 0]), 200);
		const det = new MagnetDetector(detectorConfigFor('ios'), FAR);
		det.push(b.samples());
		expect(isMoving(det.snapshot())).toBe(true);
		det.reset();
		expect(det.snapshot().unsteadyMs).toBeNull();
		expect(isMoving(det.snapshot())).toBe(false);
	});
});
