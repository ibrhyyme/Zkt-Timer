// The service side of My Cubes (design 4.7, 5.7): calibrate holds, the raw sample channel and
// the per-cube thresholds.
import type { MagnetSamplesPayload, Vec3 } from '../types';
import { SignalBuilder, IOS_NOISE, add } from '../testing/synth';
import { toBatches } from '../testing/load_fixture';

const FAR: Vec3 = [-120, 70, -150];
const NEAR: Vec3 = add(FAR, [-110, -470, 80]);

function loadService() {
	let handler: ((p: MagnetSamplesPayload) => void) | null = null;
	const start = jest.fn(async () => true);
	const stop = jest.fn(async () => undefined);
	let service: typeof import('../service').magnetService;
	jest.isolateModules(() => {
		jest.doMock('../plugin', () => ({
			magnetPlatform: () => 'ios',
			probeMagnetDetector: async () => ({ version: 1, available: true, uncalibrated: true }),
			setMagnetSamplesHandler: (h: any) => {
				handler = h;
			},
			startMagnetStream: start,
			stopMagnetStream: stop,
		}));
		jest.doMock('../../app-visibility', () => ({
			isAppVisible: () => true,
			onVisibilityChange: () => () => undefined,
		}));
		jest.doMock('../settings', () => ({
			getStoredFar: () => FAR,
			setStoredFar: jest.fn(),
		}));
		service = require('../service').magnetService;
	});
	const emit = (samples: { t: number; x: number; y: number; z: number }[]) => {
		for (const batch of toBatches(samples)) {
			const d: number[] = [];
			for (const s of batch) d.push(s.t, s.x, s.y, s.z);
			handler?.({ v: 1, clk: 'uptime', d });
		}
	};
	return { service, start, stop, emit };
}

async function settle() {
	for (let i = 0; i < 10; i++) await Promise.resolve();
}

const PROFILE = { cubeId: 'c1', puzzle: '222', nearMin: 70, farMax: 38.5 };

describe('magnet service: calibrate hold and cube profile', () => {
	it('a calibrate hold alone runs the stream, in test mode, and hands out the raw samples', async () => {
		const h = loadService();
		const batches: any[] = [];
		const raw: number[] = [];
		h.service.subscribe((b) => batches.push(b));
		h.service.subscribeSamples((samples) => raw.push(samples.length));
		const release = h.service.acquire('calibrate');
		await settle();
		expect(h.start).toHaveBeenCalledTimes(1);
		expect(h.service.isCalibrating()).toBe(true);
		expect(h.service.isTestMode()).toBe(true);

		const b = new SignalBuilder(FAR, { noise: IOS_NOISE, seed: 2, t0: Date.now() });
		b.hold(4000).moveTo(NEAR, 300).hold(800).moveTo(FAR, 90).hold(500);
		h.emit(b.samples());
		expect(raw.reduce((a, n) => a + n, 0)).toBe(b.samples().length);
		expect(batches.every((x) => x.testMode)).toBe(true);

		release();
		await settle();
		expect(h.stop).toHaveBeenCalledTimes(1);
		expect(h.service.isCalibrating()).toBe(false);
	});

	it('runs the detector with the cube thresholds and keeps the far baseline', async () => {
		const h = loadService();
		h.service.setCubeProfile(PROFILE);
		h.service.acquire('solve');
		await settle();
		expect(h.service.getCubeProfile()).toEqual(PROFILE);

		// A weak cube (200 uT at rest) becomes near with its own 70 uT line.
		const weakNear = add(FAR, [0, -200, 0]);
		const b = new SignalBuilder(FAR, { noise: IOS_NOISE, seed: 4, t0: Date.now() });
		b.hold(1000).moveTo(weakNear, 300).hold(800);
		h.emit(b.samples());
		expect(h.service.getSnapshot()?.phase).toBe('near');
		const far = h.service.getSnapshot()?.far as Vec3;
		// The stored baseline, followed only by noise-level tracking.
		expect(Math.hypot(far[0] - FAR[0], far[1] - FAR[1], far[2] - FAR[2])).toBeLessThan(1);
	});

	it('waits for the cube to leave before switching thresholds', async () => {
		const h = loadService();
		h.service.acquire('solve');
		await settle();
		const b = new SignalBuilder(FAR, { noise: IOS_NOISE, seed: 6, t0: Date.now() });
		b.hold(1000).moveTo(NEAR, 300).hold(800);
		h.emit(b.samples());
		expect(h.service.getSnapshot()?.phase).toBe('near');

		h.service.setCubeProfile(PROFILE);
		// Still the placement it saw: a new detector now would read the cube as an unknown baseline.
		expect(h.service.getCubeProfile()).toBeNull();
		expect(h.service.getSnapshot()?.phase).toBe('near');

		const away = new SignalBuilder(NEAR, { noise: IOS_NOISE, seed: 7, t0: b.now() });
		away.moveTo(FAR, 90).hold(600);
		h.emit(away.samples());
		expect(h.service.getCubeProfile()).toEqual(PROFILE);
		expect(h.service.getSnapshot()?.far).not.toBeNull();
	});

	it('null profile goes back to the bench thresholds', async () => {
		const h = loadService();
		h.service.setCubeProfile(PROFILE);
		h.service.setCubeProfile(null);
		h.service.acquire('test');
		await settle();
		expect(h.service.getCubeProfile()).toBeNull();
	});
});
