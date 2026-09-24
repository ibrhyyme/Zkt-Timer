import { MagnetDetector, distVV } from '../detector';
import { detectorConfigFor } from '../config';
import type { DetectorEvent, Vec3 } from '../types';
import {
	FIXTURE_T0,
	fixtureSamples,
	liftsOf,
	loadFixture,
	nearsOf,
	resample,
	runDetector,
} from '../testing/load_fixture';
import { ANDROID_NOISE, IOS_NOISE, SignalBuilder, add } from '../testing/synth';

const FAR: Vec3 = [-120, 70, -150];
const NEAR_OFFSET: Vec3 = [-110, -470, 80]; // |offset| ~ 490 uT, like the rear-camera hot spot
const NEAR: Vec3 = add(FAR, NEAR_OFFSET);

function phasesOf(events: DetectorEvent[]) {
	return events.filter((e) => e.type === 'phase').map((e: any) => e.phase);
}

function rejectsOf(events: DetectorEvent[]) {
	return events.filter((e) => e.type === 'reject') as Extract<DetectorEvent, { type: 'reject' }>[];
}

describe('magnet detector on real recordings', () => {
	it('Z Fold 6: detects every lift once, with the onset on the reference sample', () => {
		const fx = loadFixture('android_fold6_lifts.json');
		const det = new MagnetDetector(detectorConfigFor('android'), fx.far);
		const events = runDetector(det, fixtureSamples(fx));
		const lifts = liftsOf(events);

		// Reference onsets were labelled offline (numpy): the last sample within
		// max(2 uT, 3 rms) of a clean plateau taken 100-400 ms before the trigger.
		expect(fx.labels.lifts).toHaveLength(6);
		expect(lifts).toHaveLength(fx.labels.lifts.length);
		lifts.forEach((lift, i) => {
			const ref = FIXTURE_T0 + fx.labels.lifts[i].onsetRef;
			expect(Math.abs(lift.onset - ref)).toBeLessThanOrEqual(10); // one sample
			expect(lift.latencyMs).toBeLessThanOrEqual(150);
			expect(lift.delta).toBeGreaterThan(400);
		});
	});

	it('Z Fold 6: every lift leaves a near plateau that was entered from far', () => {
		const fx = loadFixture('android_fold6_lifts.json');
		const det = new MagnetDetector(detectorConfigFor('android'), fx.far);
		const events = runDetector(det, fixtureSamples(fx));

		let sawNear = false;
		for (const e of events) {
			if (e.type === 'near') sawNear = true;
			if (e.type === 'lift') {
				expect(sawNear).toBe(true);
				sawNear = false;
			}
		}
		// Six placements; re-placement wiggles add more near events but never a lift.
		expect(nearsOf(events).filter((n) => !n.replaced).length).toBe(6);
	});

	it('Z Fold 6: 20 s far rest with the noisy Samsung sensor produces nothing', () => {
		const fx = loadFixture('android_fold6_far_rest.json');
		const det = new MagnetDetector(detectorConfigFor('android'), fx.far);
		const events = runDetector(det, fixtureSamples(fx));

		expect(liftsOf(events)).toHaveLength(0);
		expect(nearsOf(events)).toHaveLength(0);
		expect(det.snapshot().phase).toBe('far');
	});

	it('iPhone: placement becomes near once, then 19 s of rest never looks like a lift', () => {
		const fx = loadFixture('ios_iphone15pro_place_rest.json');
		const det = new MagnetDetector(detectorConfigFor('ios'), fx.far);
		const events = runDetector(det, fixtureSamples(fx));

		expect(nearsOf(events)).toHaveLength(1);
		expect(liftsOf(events)).toHaveLength(0);
		expect(rejectsOf(events)).toHaveLength(0);
		expect(det.snapshot().phase).toBe('near');
		expect(det.snapshot().nearDelta).toBeGreaterThan(450);
	});

	it('iPhone: a session that starts with the cube already resting never becomes near', () => {
		const fx = loadFixture('ios_iphone15pro_static_near_start.json');
		const det = new MagnetDetector(detectorConfigFor('ios'), fx.far);
		const events = runDetector(det, fixtureSamples(fx));

		expect(nearsOf(events)).toHaveLength(0);
		expect(liftsOf(events)).toHaveLength(0);
		expect(events.some((e) => e.type === 'hint' && e.hint === 'unknown')).toBe(true);
		// Once the cube is gone the stored baseline matches again.
		expect(det.snapshot().phase).toBe('far');
		expect(det.snapshot().hint).toBe('none');
	});

	it('iPhone: a weak cube on the middle of the screen (4-5 uT) never becomes near', () => {
		const fx = loadFixture('ios_iphone15pro_weak_center.json');
		const det = new MagnetDetector(detectorConfigFor('ios'), fx.far);
		const events = runDetector(det, fixtureSamples(fx));

		expect(nearsOf(events)).toHaveLength(0);
		expect(liftsOf(events)).toHaveLength(0);
	});

	it('still detects every Fold lift when the sensor only delivers 50 Hz', () => {
		const fx = loadFixture('android_fold6_lifts.json');
		const det = new MagnetDetector(detectorConfigFor('android'), fx.far);
		const events = runDetector(det, resample(fixtureSamples(fx), 50));
		const lifts = liftsOf(events);

		expect(lifts).toHaveLength(6);
		lifts.forEach((lift, i) => {
			const ref = FIXTURE_T0 + fx.labels.lifts[i].onsetRef;
			expect(Math.abs(lift.onset - ref)).toBeLessThanOrEqual(20); // one 50 Hz sample
			expect(lift.latencyMs).toBeLessThanOrEqual(200);
		});
	});

	it('marks a 25 Hz sensor as unsupported and stays silent', () => {
		const fx = loadFixture('android_fold6_lifts.json');
		const det = new MagnetDetector(detectorConfigFor('android'), fx.far);
		const events = runDetector(det, resample(fixtureSamples(fx), 25));

		expect(events.some((e) => e.type === 'unsupported')).toBe(true);
		expect(liftsOf(events)).toHaveLength(0);
		expect(det.snapshot().phase).toBe('unsupported');
	});
});

describe('magnet detector on synthetic signals', () => {
	function placeAndRest(b: SignalBuilder, restMs = 1500) {
		b.hold(1000).moveTo(NEAR, 400).hold(restMs);
	}

	it('backdates a fast lift to the motion start and confirms it quickly', () => {
		for (const [platform, noise] of [['ios', IOS_NOISE], ['android', ANDROID_NOISE]] as const) {
			const b = new SignalBuilder(FAR, { noise, seed: 7 });
			placeAndRest(b);
			const motionStart = b.now();
			b.moveTo(FAR, 90).hold(1000);

			const det = new MagnetDetector(detectorConfigFor(platform), FAR);
			const lifts = liftsOf(runDetector(det, b.samples()));
			expect(lifts).toHaveLength(1);
			expect(Math.abs(lifts[0].onset - motionStart)).toBeLessThanOrEqual(20);
			expect(lifts[0].t - motionStart).toBeLessThanOrEqual(100);
		}
	});

	it('still catches a slow lift and keeps its onset', () => {
		const b = new SignalBuilder(FAR, { noise: ANDROID_NOISE, seed: 3 });
		placeAndRest(b);
		const motionStart = b.now();
		b.moveTo(FAR, 700).hold(1000);

		const det = new MagnetDetector(detectorConfigFor('android'), FAR);
		const lifts = liftsOf(runDetector(det, b.samples()));
		expect(lifts).toHaveLength(1);
		expect(lifts[0].onset - motionStart).toBeLessThanOrEqual(120);
		expect(lifts[0].onset).toBeGreaterThanOrEqual(motionStart - 20);
	});

	it('confirms a lift off a weak plateau that settles in the far zone', () => {
		const weakNear = add(FAR, [0, 0, 165]);
		const b = new SignalBuilder(FAR, { noise: IOS_NOISE, seed: 5 });
		b.hold(1000).moveTo(weakNear, 300).hold(1000);
		b.moveTo(add(FAR, [0, 0, 70]), 100).hold(1000);

		const det = new MagnetDetector(detectorConfigFor('ios'), FAR);
		const events = runDetector(det, b.samples());
		expect(nearsOf(events)).toHaveLength(1);
		expect(liftsOf(events)).toHaveLength(1);
	});

	it('treats sliding or tipping the cube along the edge as a re-placement, not a lift', () => {
		const b = new SignalBuilder(FAR, { noise: ANDROID_NOISE, seed: 11 });
		placeAndRest(b);
		// 40 % weaker: the cube tipped but is still at the phone.
		b.moveTo(add(FAR, [-66, -282, 48]), 150).hold(1500);

		const det = new MagnetDetector(detectorConfigFor('android'), FAR);
		const events = runDetector(det, b.samples());
		expect(liftsOf(events)).toHaveLength(0);
		expect(nearsOf(events).filter((n) => n.replaced)).toHaveLength(1);
		expect(det.snapshot().phase).toBe('near');

		// And a real lift after that still works.
		const b2 = new SignalBuilder(FAR, { noise: ANDROID_NOISE, seed: 11 });
		placeAndRest(b2);
		b2.moveTo(add(FAR, [-66, -282, 48]), 150).hold(1500).moveTo(FAR, 90).hold(800);
		const det2 = new MagnetDetector(detectorConfigFor('android'), FAR);
		expect(liftsOf(runDetector(det2, b2.samples()))).toHaveLength(1);
	});

	it('rejects vibration and speaker spikes while the cube rests', () => {
		const b = new SignalBuilder(FAR, { noise: IOS_NOISE, seed: 13 });
		placeAndRest(b);
		b.spike([20, 0, 0], 30).hold(400).spike([0, -20, 0], 30).hold(400).spike([0, 0, 25], 40).hold(800);

		const det = new MagnetDetector(detectorConfigFor('ios'), FAR);
		const events = runDetector(det, b.samples());
		expect(liftsOf(events)).toHaveLength(0);
		expect(rejectsOf(events).every((r) => r.reason === 'spike')).toBe(true);
		expect(rejectsOf(events).length).toBeGreaterThanOrEqual(3);
		expect(det.snapshot().phase).toBe('near');
	});

	it('ignores triggers while muted but still backdates a lift that starts during the mute', () => {
		const b = new SignalBuilder(FAR, { noise: IOS_NOISE, seed: 17 });
		placeAndRest(b);
		const det = new MagnetDetector(detectorConfigFor('ios'), FAR);
		const before = runDetector(det, b.samples());
		expect(nearsOf(before)).toHaveLength(1);

		const muteFrom = b.now();
		det.mute(muteFrom + 120);
		const b2 = new SignalBuilder(NEAR, { noise: IOS_NOISE, seed: 18, t0: muteFrom });
		b2.spike([40, 0, 0], 40).hold(40); // own vibration inside the mute
		const liftStart = b2.now();
		b2.moveTo(FAR, 90).hold(800);

		const lifts = liftsOf(runDetector(det, b2.samples()));
		expect(lifts).toHaveLength(1);
		expect(Math.abs(lifts[0].onset - liftStart)).toBeLessThanOrEqual(20);
	});

	it('never trusts a static near reading at session start', () => {
		const b = new SignalBuilder(NEAR, { noise: IOS_NOISE, seed: 19 });
		b.hold(5000);
		const det = new MagnetDetector(detectorConfigFor('ios'), FAR);
		let events = runDetector(det, b.samples());
		expect(nearsOf(events)).toHaveLength(0);
		expect(det.snapshot().phase).toBe('unknown');
		expect(det.snapshot().hint).toBe('unknown');

		// Taking the cube away is not a lift (there was no trusted near), it just finds far.
		const b2 = new SignalBuilder(NEAR, { noise: IOS_NOISE, seed: 20, t0: b.now() });
		b2.moveTo(FAR, 90).hold(1000).moveTo(NEAR, 400).hold(1000).moveTo(FAR, 90).hold(800);
		events = runDetector(det, b2.samples());
		expect(liftsOf(events)).toHaveLength(1);
		expect(nearsOf(events)).toHaveLength(1);
	});

	it('stays unknown without a stored baseline until the user re-learns it', () => {
		const b = new SignalBuilder(FAR, { noise: IOS_NOISE, seed: 23 });
		b.hold(2000);
		const det = new MagnetDetector(detectorConfigFor('ios'));
		runDetector(det, b.samples());
		expect(det.snapshot().phase).toBe('unknown');

		const res = det.relearnFar();
		expect(res.ok).toBe(true);
		expect(res.events.some((e) => e.type === 'far_learned')).toBe(true);
		expect(det.snapshot().phase).toBe('far');
		expect(distVV(det.getFar() as Vec3, FAR)).toBeLessThan(1);
	});

	it('refuses to re-learn while the reading is moving', () => {
		const b = new SignalBuilder(FAR, { noise: IOS_NOISE, seed: 29 });
		b.hold(1000).moveTo(add(FAR, [0, 0, 60]), 800);
		const det = new MagnetDetector(detectorConfigFor('ios'));
		runDetector(det, b.samples());
		expect(det.relearnFar().ok).toBe(false);
	});

	it('keeps the far baseline within reach of its anchor when something creeps closer', () => {
		const b = new SignalBuilder(FAR, { noise: IOS_NOISE, seed: 31 });
		b.hold(1000);
		for (let step = 1; step <= 5; step++) {
			b.moveTo(add(FAR, [0, 0, 40 * step]), 300).hold(6000);
		}
		const det = new MagnetDetector(detectorConfigFor('ios'), FAR);
		const events = runDetector(det, b.samples());

		expect(distVV(det.getFar() as Vec3, FAR)).toBeLessThanOrEqual(80);
		expect(liftsOf(events)).toHaveLength(0);
	});

	it('follows a small permanent baseline shift (Fold nudge, flat rotation)', () => {
		const shifted = add(FAR, [30, -40, 0]); // 50 uT
		const b = new SignalBuilder(FAR, { noise: ANDROID_NOISE, seed: 37 });
		b.hold(1000).moveTo(shifted, 500).hold(6500);
		const det = new MagnetDetector(detectorConfigFor('android'), FAR);
		const events = runDetector(det, b.samples());

		expect(det.snapshot().phase).toBe('far');
		expect(events.some((e) => e.type === 'far_learned' && e.source === 'adopt')).toBe(true);
		expect(distVV(det.getFar() as Vec3, shifted)).toBeLessThan(2);
		expect(nearsOf(events)).toHaveLength(0);
	});

	it('does not read a phone rotation under a resting cube as a lift', () => {
		const b = new SignalBuilder(FAR, { noise: IOS_NOISE, seed: 41 });
		placeAndRest(b);
		b.moveTo(add(NEAR, [30, -45, 0]), 600).hold(1500);
		const det = new MagnetDetector(detectorConfigFor('ios'), FAR);
		const events = runDetector(det, b.samples());
		expect(liftsOf(events)).toHaveLength(0);
		expect(det.snapshot().phase).toBe('near');
	});

	it('handles delivery gaps and out-of-order samples without inventing lifts', () => {
		const b = new SignalBuilder(FAR, { noise: IOS_NOISE, seed: 43 });
		placeAndRest(b);
		b.gap(150).hold(800).gap(1500).hold(1500);
		const samples = b.samples();
		// Duplicate and out-of-order samples in the middle of the stream.
		const mid = Math.floor(samples.length / 2);
		samples.splice(mid, 0, { ...samples[mid - 5] }, { ...samples[mid - 1] });

		const det = new MagnetDetector(detectorConfigFor('ios'), FAR);
		const events = runDetector(det, samples);
		expect(liftsOf(events)).toHaveLength(0);
		expect(events.filter((e) => e.type === 'gap')).toHaveLength(2);
		// The long gap forgets the near plateau; the resting cube is not trusted again.
		expect(det.snapshot().phase).toBe('unknown');
	});

	it('forgets everything but the baseline on reset', () => {
		const b = new SignalBuilder(FAR, { noise: IOS_NOISE, seed: 47 });
		placeAndRest(b);
		const det = new MagnetDetector(detectorConfigFor('ios'), FAR);
		runDetector(det, b.samples());
		expect(det.snapshot().phase).toBe('near');

		det.reset();
		expect(det.snapshot().phase).toBe('unknown');
		expect(det.snapshot().nearSince).toBeNull();
		expect(distVV(det.getFar() as Vec3, FAR)).toBeLessThan(1);
	});
});
