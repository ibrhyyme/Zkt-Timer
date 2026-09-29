import type { MagnetSamplesPayload, Vec3 } from '../types';
import { RESUME_TRUST_MS } from '../config';
import { SignalBuilder, IOS_NOISE, add } from '../testing/synth';
import { toBatches } from '../testing/load_fixture';

const FAR: Vec3 = [-120, 70, -150];
const NEAR: Vec3 = add(FAR, [-110, -470, 80]);

interface Harness {
	service: typeof import('../service').magnetService;
	plugin: {
		start: jest.Mock;
		stop: jest.Mock;
		emit: (payload: MagnetSamplesPayload) => void;
	};
	setVisible: (visible: boolean) => void;
}

function loadService(): Harness {
	let handler: ((p: MagnetSamplesPayload) => void) | null = null;
	let visible = true;
	let visibilityCb: ((v: boolean) => void) | null = null;
	const start = jest.fn(async () => true);
	const stop = jest.fn(async () => undefined);

	let service: Harness['service'];
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
			isAppVisible: () => visible,
			onVisibilityChange: (cb: (v: boolean) => void) => {
				visibilityCb = cb;
				return () => undefined;
			},
		}));
		jest.doMock('../settings', () => ({
			getStoredFar: () => FAR,
			setStoredFar: jest.fn(),
		}));
		service = require('../service').magnetService;
	});

	return {
		service,
		plugin: {
			start,
			stop,
			emit: (payload) => handler?.(payload),
		},
		setVisible: (v) => {
			visible = v;
			visibilityCb?.(v);
		},
	};
}

async function settle() {
	// The service serialises start/stop through a promise chain.
	for (let i = 0; i < 10; i++) await Promise.resolve();
}

function toPayload(samples: { t: number; x: number; y: number; z: number }[]): MagnetSamplesPayload {
	const d: number[] = [];
	for (const s of samples) d.push(s.t, s.x, s.y, s.z);
	return { v: 1, clk: 'uptime', d };
}

describe('magnet service', () => {
	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('runs one native stream for any number of holders', async () => {
		const h = loadService();
		const releaseSolve = h.service.acquire('solve');
		const releaseTest = h.service.acquire('test');
		await settle();
		expect(h.plugin.start).toHaveBeenCalledTimes(1);
		expect(h.service.isTestMode()).toBe(true);

		releaseTest();
		releaseTest(); // idempotent
		await settle();
		expect(h.plugin.stop).not.toHaveBeenCalled();
		expect(h.service.isTestMode()).toBe(false);

		releaseSolve();
		await settle();
		expect(h.plugin.stop).toHaveBeenCalledTimes(1);
		expect(h.service.isRunning()).toBe(false);
	});

	it('ends a fast acquire / release / acquire with exactly one running stream', async () => {
		const h = loadService();
		const r1 = h.service.acquire('solve');
		r1();
		h.service.acquire('solve');
		await settle();
		expect(h.service.isRunning()).toBe(true);
		expect(h.plugin.start.mock.calls.length - h.plugin.stop.mock.calls.length).toBe(1);
	});

	it('stops while the page is hidden and starts again when it is back', async () => {
		const h = loadService();
		h.service.acquire('solve');
		await settle();
		expect(h.service.isRunning()).toBe(true);

		h.setVisible(false);
		await settle();
		expect(h.service.isRunning()).toBe(false);

		h.setVisible(true);
		await settle();
		expect(h.service.isRunning()).toBe(true);
		expect(h.plugin.start).toHaveBeenCalledTimes(2);
	});

	it('only arms a placement after the cube was away long enough, and passes that to the lift', async () => {
		const h = loadService();
		const batches: any[] = [];
		h.service.subscribe((b) => batches.push(b));
		h.service.acquire('solve');
		await settle();

		const t0 = Date.now();
		// Placed 1 s after the stream started: not armed.
		const b1 = new SignalBuilder(FAR, { noise: IOS_NOISE, seed: 3, t0 });
		b1.hold(1000).moveTo(NEAR, 300).hold(800).moveTo(FAR, 90).hold(500);
		// Away for 4 s, placed again: armed.
		b1.hold(4000).moveTo(NEAR, 300).hold(800).moveTo(FAR, 90).hold(500);
		for (const batch of toBatches(b1.samples())) h.plugin.emit(toPayload(batch));

		const lifts = batches.flatMap((b) => b.lifts);
		expect(lifts).toHaveLength(2);
		expect(lifts[0].armed).toBe(false);
		expect(lifts[1].armed).toBe(true);
	});

	it('forgets arming after a disarm', async () => {
		const h = loadService();
		const batches: any[] = [];
		h.service.subscribe((b) => batches.push(b));
		h.service.acquire('solve');
		await settle();

		const t0 = Date.now();
		const b1 = new SignalBuilder(FAR, { noise: IOS_NOISE, seed: 5, t0 });
		b1.hold(4000).moveTo(NEAR, 300).hold(800);
		for (const batch of toBatches(b1.samples())) h.plugin.emit(toPayload(batch));
		expect(batches[batches.length - 1].armed).toBe(true);

		h.service.disarm('test');
		const b2 = new SignalBuilder(NEAR, { noise: IOS_NOISE, seed: 6, t0: b1.now() });
		b2.hold(200).moveTo(FAR, 90).hold(300);
		for (const batch of toBatches(b2.samples())) h.plugin.emit(toPayload(batch));

		const lifts = batches.flatMap((b) => b.lifts);
		expect(lifts).toHaveLength(1);
		expect(lifts[0].armed).toBe(false);
	});

	it('keeps detecting lifts after the stream restarts between solves', async () => {
		const h = loadService();
		const batches: any[] = [];
		h.service.subscribe((b) => batches.push(b));

		// Solve 1: stream runs while idle, a lift is detected.
		let release = h.service.acquire('solve');
		await settle();
		const s1 = new SignalBuilder(FAR, { noise: IOS_NOISE, seed: 61, t0: Date.now() });
		s1.hold(4000).moveTo(NEAR, 300).hold(800).moveTo(FAR, 90).hold(300);
		for (const batch of toBatches(s1.samples())) h.plugin.emit(toPayload(batch));

		// The solve runs: the hook releases, the stream stops, then restarts afterwards.
		release();
		await settle();
		const restartAt = Date.now() + 60_000;
		jest.spyOn(Date, 'now').mockReturnValue(restartAt);
		release = h.service.acquire('solve');
		await settle();

		const s2 = new SignalBuilder(FAR, { noise: IOS_NOISE, seed: 62, t0: restartAt });
		s2.hold(4000).moveTo(NEAR, 300).hold(800).moveTo(FAR, 90).hold(300);
		for (const batch of toBatches(s2.samples())) h.plugin.emit(toPayload(batch));

		const events = batches.flatMap((b) => b.events);
		expect(events.some((e) => e.type === 'unsupported')).toBe(false);
		expect(batches.flatMap((b) => b.lifts)).toHaveLength(2);
		release();
	});

	// Runs one far rest, pauses the stream for a solve (as the hook does), and resumes it
	// `pauseMs` later with the cube resting at the hot spot.
	async function solveThenResumeOnCube(h: Harness, pauseMs: number, between?: () => void) {
		const batches: any[] = [];
		h.service.subscribe((b) => batches.push(b));
		let release = h.service.acquire('solve');
		await settle();
		const s1 = new SignalBuilder(FAR, { noise: IOS_NOISE, seed: 71, t0: Date.now() });
		s1.hold(1000);
		for (const batch of toBatches(s1.samples())) h.plugin.emit(toPayload(batch));
		expect(h.service.getSnapshot()?.phase).toBe('far');

		h.service.pauseForSolve();
		release();
		await settle();
		between?.();
		const restartAt = Date.now() + pauseMs;
		jest.spyOn(Date, 'now').mockReturnValue(restartAt);
		release = h.service.acquire('solve');
		await settle();
		batches.length = 0;
		return { batches, restartAt, release };
	}

	it('reads a cube dropped at the hot spot during the solve as resting, never armed', async () => {
		const h = loadService();
		const { batches, restartAt } = await solveThenResumeOnCube(h, 20_000);

		// Resting, picked up to scramble, away 4 s, placed again, lifted.
		const s2 = new SignalBuilder(NEAR, { noise: IOS_NOISE, seed: 72, t0: restartAt });
		s2.hold(1500).moveTo(FAR, 90).hold(4000).moveTo(NEAR, 300).hold(800).moveTo(FAR, 90).hold(300);
		for (const batch of toBatches(s2.samples())) h.plugin.emit(toPayload(batch));

		const events = batches.flatMap((b) => b.events);
		expect(events.some((e) => e.type === 'hint' && e.hint === 'unknown')).toBe(false);
		const firstNear = batches.findIndex((b) => b.events.some((e: any) => e.type === 'near'));
		expect(batches[firstNear].events.find((e: any) => e.type === 'near').resumed).toBe(true);
		expect(batches[firstNear]).toMatchObject({ resting: true, armed: false });

		const lifts = batches.flatMap((b) => b.lifts);
		expect(lifts).toHaveLength(2);
		expect(lifts[0].armed).toBe(false);
		expect(lifts[1].armed).toBe(true);
		expect(batches[batches.length - 1].resting).toBe(false);
	});

	it('stays silent for a cube dropped just off the hot spot, and arms normally afterwards', async () => {
		const h = loadService();
		const { batches, restartAt } = await solveThenResumeOnCube(h, 20_000);
		const offSpot = add(FAR, [0, 110, 0]);
		const s2 = new SignalBuilder(offSpot, { noise: IOS_NOISE, seed: 75, t0: restartAt });
		s2.hold(1500);
		for (const batch of toBatches(s2.samples())) h.plugin.emit(toPayload(batch));
		expect(batches[batches.length - 1]).toMatchObject({ resting: true, armed: false });
		expect(batches.flatMap((b) => b.events).some((e) => e.type === 'hint')).toBe(false);

		const s3 = new SignalBuilder(offSpot, { noise: IOS_NOISE, seed: 76, t0: s2.now() });
		s3.moveTo(FAR, 90).hold(4000).moveTo(NEAR, 300).hold(800).moveTo(FAR, 90).hold(300);
		for (const batch of toBatches(s3.samples())) h.plugin.emit(toPayload(batch));
		const lifts = batches.flatMap((b) => b.lifts);
		expect(lifts).toHaveLength(1);
		expect(lifts[0].armed).toBe(true);
	});

	it('does not vouch for the baseline after a pause longer than RESUME_TRUST_MS', async () => {
		const h = loadService();
		const { batches, restartAt } = await solveThenResumeOnCube(h, RESUME_TRUST_MS + 1000);
		const s2 = new SignalBuilder(NEAR, { noise: IOS_NOISE, seed: 73, t0: restartAt });
		s2.hold(1500);
		for (const batch of toBatches(s2.samples())) h.plugin.emit(toPayload(batch));

		const events = batches.flatMap((b) => b.events);
		expect(events.some((e) => e.type === 'near')).toBe(false);
		expect(events.some((e) => e.type === 'hint' && e.hint === 'unknown')).toBe(true);
	});

	it('does not vouch for the baseline once the app went to the background mid-solve', async () => {
		const h = loadService();
		const { batches, restartAt } = await solveThenResumeOnCube(h, 20_000, () => {
			h.setVisible(false);
			h.setVisible(true);
		});
		const s2 = new SignalBuilder(NEAR, { noise: IOS_NOISE, seed: 74, t0: restartAt });
		s2.hold(1500);
		for (const batch of toBatches(s2.samples())) h.plugin.emit(toPayload(batch));

		expect(batches.flatMap((b) => b.events).some((e) => e.type === 'near')).toBe(false);
	});

	it('drops samples queued from before the stream restart', async () => {
		const h = loadService();
		const batches: any[] = [];
		h.service.subscribe((b) => batches.push(b));
		h.service.acquire('solve');
		await settle();

		const old = new SignalBuilder(FAR, { noise: IOS_NOISE, seed: 7, t0: Date.now() - 10_000 });
		old.hold(500);
		h.plugin.emit(toPayload(old.samples()));
		expect(batches).toHaveLength(0);
	});
});

describe('magnet plugin probe', () => {
	beforeEach(() => {
		// The service suite above replaced the plugin module; test the real one here.
		jest.dontMock('../plugin');
	});

	it('treats a probe that never settles (old iOS binary) as unavailable', async () => {
		// Modern fake timers try to replace the read-only global `performance` on this Node;
		// same workaround as connection_manager.test.ts.
		(jest.useFakeTimers as unknown as (config: { legacyFakeTimers: boolean }) => void)({ legacyFakeTimers: true });
		let probe: typeof import('../plugin').probeMagnetDetector;
		jest.isolateModules(() => {
			jest.doMock('../../platform', () => ({ isNative: () => true }));
			jest.doMock('@capacitor/core', () => ({
				Capacitor: { getPlatform: () => 'ios', isPluginAvailable: () => true },
				registerPlugin: () => ({
					getCapabilities: () => new Promise(() => undefined),
					addListener: jest.fn(),
				}),
			}));
			probe = require('../plugin').probeMagnetDetector;
		});
		const result = probe();
		jest.advanceTimersByTime(1600);
		await expect(result).resolves.toBeNull();
		jest.useRealTimers();
	});

	it('adds the samples listener once, however often it is probed', async () => {
		const addListener = jest.fn(async () => ({ remove: async () => undefined }));
		let probe: typeof import('../plugin').probeMagnetDetector;
		jest.isolateModules(() => {
			jest.doMock('../../platform', () => ({ isNative: () => true }));
			jest.doMock('@capacitor/core', () => ({
				Capacitor: { getPlatform: () => 'android', isPluginAvailable: () => true },
				registerPlugin: () => ({
					getCapabilities: async () => ({ version: 1, available: true, uncalibrated: true }),
					addListener,
				}),
			}));
			probe = require('../plugin').probeMagnetDetector;
		});
		const [a, b] = await Promise.all([probe(), probe()]);
		await probe();
		expect(a).toEqual(b);
		expect(a?.available).toBe(true);
		expect(addListener).toHaveBeenCalledTimes(1);
	});

	it('reports a device without the uncalibrated sensor as unavailable without listening', async () => {
		const addListener = jest.fn();
		let probe: typeof import('../plugin').probeMagnetDetector;
		jest.isolateModules(() => {
			jest.doMock('../../platform', () => ({ isNative: () => true }));
			jest.doMock('@capacitor/core', () => ({
				Capacitor: { getPlatform: () => 'android', isPluginAvailable: () => true },
				registerPlugin: () => ({
					getCapabilities: async () => ({ version: 1, available: false, uncalibrated: false }),
					addListener,
				}),
			}));
			probe = require('../plugin').probeMagnetDetector;
		});
		const caps = await probe();
		expect(caps?.available).toBe(false);
		expect(addListener).not.toHaveBeenCalled();
	});
});
