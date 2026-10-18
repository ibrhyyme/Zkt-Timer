// Calibration measurement (design 5.7, 6.1, 6.5, 6.7) on synthetic streams: the running
// median peak, the rest plateau, and the rejections (slow sensor, phone not steady, no sweep,
// too weak, phone moved).
import { checkCalibrationMeasurement } from '../../../../shared/magnet_calibration';
import { buildCalibrationRow, CalibrationMeter, CalibrationProgress } from '../calibration';
import { add, ANDROID_NOISE, IOS_NOISE, SignalBuilder } from '../testing/synth';
import type { MagnetPlatform, Vec3 } from '../types';

const FAR: Vec3 = [-120, 70, -150];

/** Feeds the samples emitted since the last call in 50 ms batches, like the native stream. */
function feeder(meter: CalibrationMeter, b: SignalBuilder) {
	let fed = 0;
	let last: CalibrationProgress = meter.progress();
	return (): CalibrationProgress => {
		const all = b.samples();
		const fresh = all.slice(fed);
		fed = all.length;
		for (let i = 0; i < fresh.length; i += 5) last = meter.push(fresh.slice(i, i + 5));
		return last;
	};
}

function setup(platform: MagnetPlatform = 'ios', opts: { rateHz?: number; seed?: number } = {}) {
	const b = new SignalBuilder(FAR, {
		noise: platform === 'ios' ? IOS_NOISE : ANDROID_NOISE,
		seed: opts.seed ?? 3,
		rateHz: opts.rateHz,
	});
	const meter = new CalibrationMeter(platform, { knownFar: FAR });
	return { b, meter, feed: feeder(meter, b) };
}

/** Moves the cube around the camera for `ms`: several approaches up to `peak` uT. */
function sweep(b: SignalBuilder, peak: number, ms: number): void {
	const passes = Math.max(1, Math.round(ms / 1000));
	const each = ms / passes;
	for (let i = 0; i < passes; i++) {
		const reach = peak * (0.5 + (0.5 * (i + 1)) / passes);
		b.moveTo(add(FAR, [reach * 0.6, -reach * 0.3, reach * 0.74]), each * 0.4);
		b.hold(each * 0.1);
		b.moveTo(add(FAR, [20, 10, 5]), each * 0.5);
	}
}

function toRest(b: SignalBuilder, rest: number): void {
	b.moveTo(add(FAR, [0, 0, rest]), 400).hold(2000);
}

describe('CalibrationMeter', () => {
	it('measures F, sigma, the median peak and the rest value, and the result passes the server check', () => {
		const { b, meter, feed } = setup('ios');
		b.hold(2000);
		let p = feed();
		expect(p.steady).toBe(true);
		expect(p.cubeAway).toBe(true);
		expect(p.canStart).toBe(true);
		expect(meter.start()).toBe(true);

		sweep(b, 700, 7000);
		// A single-sample jump (the cube knocking the camera bump) is not the peak.
		b.spike([0, 0, 3000], 10);
		b.hold(200);
		p = feed();
		expect(p.step).toBe('sweep');
		expect(p.canFinish).toBe(true);
		expect(p.peak as number).toBeGreaterThan(650);
		expect(p.peak as number).toBeLessThan(720);
		expect(meter.finish()).toBe(true);

		toRest(b, 500);
		p = feed();
		expect(p.step).toBe('away');
		expect(p.rest as number).toBeCloseTo(500, -1);

		b.moveTo(FAR, 400).hold(1500);
		p = feed();
		expect(p.step).toBe('done');

		const m = meter.result();
		expect(m).not.toBeNull();
		expect(m.rest_ut).toBeCloseTo(500, -1);
		expect(m.peak_ut).toBeGreaterThan(650);
		expect(m.noise_ut).toBeLessThan(1);
		expect(m.near_min_ut).toBe(150);
		expect(m.far_max_ut).toBe(80);
		expect(m.quality).toBe('ok');
		expect(m.rate_hz).toBeCloseTo(100, 0);
		expect(m.sample_count).toBeGreaterThanOrEqual(300);
		expect(m.noisy).toBe(false);

		const row = buildCalibrationRow(m, { cubeId: 'c1', deviceModel: 'iPhone16,1', appVersion: '2.0.5' });
		expect(row).toMatchObject({ cube_id: 'c1', platform: 'ios', device_model: 'iPhone16,1', rest_ut: m.rest_ut });
		const check = checkCalibrationMeasurement(row, m.measured_at);
		expect(check.ok).toBe(true);
	});

	it('a weak cube is saved as weak with lower thresholds', () => {
		const { b, meter, feed } = setup('android');
		b.hold(2000);
		feed();
		expect(meter.start()).toBe(true);
		sweep(b, 260, 7000);
		feed();
		expect(meter.finish()).toBe(true);
		toRest(b, 200);
		b.moveTo(FAR, 400).hold(1500);
		const p = feed();
		expect(p.step).toBe('done');
		const m = meter.result();
		expect(m.quality).toBe('weak');
		expect(m.near_min_ut).toBeCloseTo(70, -1);
		expect(checkCalibrationMeasurement(buildCalibrationRow(m, { cubeId: 'c', deviceModel: 'samsung SM-F956B' }), m.measured_at).ok).toBe(
			true
		);
	});

	it('takes the rest value as the peak when the sweep never reached the resting spot', () => {
		const { b, meter, feed } = setup('ios');
		b.hold(2000);
		feed();
		meter.start();
		sweep(b, 300, 7000);
		feed();
		expect(meter.finish()).toBe(true);
		toRest(b, 450);
		b.moveTo(FAR, 400).hold(1500);
		feed();
		const m = meter.result();
		expect(m.peak_ut).toBe(m.rest_ut);
	});

	it('does not start while the phone is moving, and says so after the step 1 timeout', () => {
		const { b, meter, feed } = setup('ios');
		for (let i = 0; i < 90; i++) b.moveTo(add(FAR, i % 2 ? [25, -20, 10] : [-20, 25, -15]), 250);
		const p = feed();
		expect(p.steady).toBe(false);
		expect(p.canStart).toBe(false);
		expect(p.issue).toBe('moving');
		expect(meter.start()).toBe(false);

		b.moveTo(FAR, 300).hold(2000);
		const q = feed();
		expect(q.issue).toBeNull();
		expect(q.canStart).toBe(true);
	});

	it('step 1 notices the cube near the phone against the known baseline', () => {
		const { b, feed } = setup('ios');
		b.moveTo(add(FAR, [0, 0, 300]), 200).hold(2000);
		const p = feed();
		expect(p.steady).toBe(true);
		expect(p.cubeAway).toBe(false);
	});

	it('refuses to finish before the minimum sweep, and without reaching the camera', () => {
		const { b, meter, feed } = setup('ios');
		b.hold(2000);
		feed();
		meter.start();
		sweep(b, 400, 3000);
		feed();
		expect(meter.finish()).toBe(false);
		expect(meter.progress().step).toBe('sweep');

		const weak = setup('ios', { seed: 4 });
		weak.b.hold(2000);
		weak.feed();
		weak.meter.start();
		sweep(weak.b, 40, 7000); // under 2 x the 30 uT iOS floor
		weak.feed();
		expect(weak.meter.finish()).toBe(false);
		expect(weak.meter.progress().issue).toBe('no_sweep');
		expect(weak.meter.progress().step).toBe('sweep');
	});

	it('the peak settles after 3 s without growth (the "Done" hint)', () => {
		const { b, meter, feed } = setup('ios');
		b.hold(2000);
		feed();
		meter.start();
		b.moveTo(add(FAR, [0, 0, 600]), 400).moveTo(FAR, 400);
		expect(feed().settled).toBe(false);
		b.hold(3200);
		expect(feed().settled).toBe(true);
	});

	it('a cube too weak where it rests is not saved', () => {
		const { b, meter, feed } = setup('ios');
		b.hold(2000);
		feed();
		meter.start();
		sweep(b, 400, 7000);
		feed();
		meter.finish();
		toRest(b, 30); // under 1.5 x the 30 uT floor
		const p = feed();
		expect(p.step).toBe('failed');
		expect(p.failure).toBe('too_weak');
		expect(meter.result()).toBeNull();
	});

	it('the phone moved: the field settles off the baseline with the cube away', () => {
		const { b, meter, feed } = setup('ios');
		b.hold(2000);
		feed();
		meter.start();
		sweep(b, 700, 7000);
		feed();
		meter.finish();
		toRest(b, 500);
		feed();
		// The cube is taken away, but the baseline moved 60 uT (over half of farMax 80).
		b.moveTo(add(FAR, [60, 0, 0]), 400).hold(2000);
		let p = feed();
		expect(p.step).toBe('away');
		expect(p.issue).toBe('not_back');
		b.hold(4000);
		p = feed();
		expect(p.step).toBe('failed');
		expect(p.failure).toBe('phone_moved');
		expect(meter.result()).toBeNull();
	});

	it('a sensor under 40 Hz ends the flow', () => {
		const { b, feed } = setup('android', { rateHz: 25 });
		b.hold(3000);
		const p = feed();
		expect(p.step).toBe('failed');
		expect(p.failure).toBe('rate');
		expect(p.canStart).toBe(false);
	});

	it.each([
		['ios', 4],
		['android', 8],
	] as [MagnetPlatform, number][])(
		'%s: a baseline noisier than the plateau band does not start and says "noisy", not "moving"',
		(platform, axisNoise) => {
			// Over 3 x the expected noise cannot sit inside the plateau band, so the detector could
			// not run on this phone either: the flow waits in step 1 with the noise message.
			const b = new SignalBuilder(FAR, { noise: axisNoise, seed: 7 });
			const meter = new CalibrationMeter(platform, { knownFar: FAR });
			const feed = feeder(meter, b);
			b.hold(2000);
			const p = feed();
			expect(p.steady).toBe(false);
			expect(p.canStart).toBe(false);
			expect(p.issue).toBe('noisy');
		}
	);
});
