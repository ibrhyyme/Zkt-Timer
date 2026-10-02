let mockStudyOpen = true;
let mockServerEnabled = true;

jest.mock('../../../components/api', () => ({
	gqlMutate: jest.fn(async () => ({ data: { recordMagnetTelemetry: { accepted: 1, enabled: mockServerEnabled } } })),
}));
jest.mock('../../../@types/generated/graphql', () => ({ RecordMagnetTelemetryDocument: 'RecordMagnetTelemetry' }));
jest.mock('../../hooks/useSiteConfig', () => ({
	getLastKnownSiteConfig: () => ({ magnet_telemetry_enabled: mockStudyOpen }),
}));
jest.mock('../../device-info', () => ({
	getDeviceInfo: async () => ({ manufacturer: 'samsung', model: 'SM-F956B', osVersion: '16', otaBundle: '1.0.1790701663' }),
}));

import { gqlMutate } from '../../../components/api';
import {
	getMagnetTelemetryBufferForTests,
	magnetTelemetry,
	resetMagnetTelemetryForTests,
} from '../telemetry';
import type { CapturedWindow } from '../debug_log';

const mutate = gqlMutate as jest.Mock;

// node env: a minimal window with localStorage for the per-phone baseline counter.
const store = new Map<string, string>();
beforeAll(() => {
	(global as any).window = {
		localStorage: {
			getItem: (k: string) => (store.has(k) ? store.get(k) : null),
			setItem: (k: string, v: string) => store.set(k, String(v)),
		},
	};
});
afterAll(() => {
	delete (global as any).window;
});

beforeEach(() => {
	(jest.useFakeTimers as unknown as (config: { legacyFakeTimers: boolean }) => void)({ legacyFakeTimers: true });
	mockStudyOpen = true;
	mockServerEnabled = true;
	store.clear();
	mutate.mockClear();
	resetMagnetTelemetryForTests();
	magnetTelemetry.begin('android', { version: 1, available: true, uncalibrated: true, name: 'AK09918 Magnetometer-Uncalibrated' });
});

afterEach(() => {
	jest.useRealTimers();
});

async function settle() {
	// The flush awaits a dynamic import and the device snapshot before the mutation.
	for (let i = 0; i < 50; i++) await Promise.resolve();
}

function fakeWindow(): CapturedWindow {
	return {
		v: 1,
		kind: 'magnet-fixture',
		platform: 'android',
		source: 'Zkt Timer admin field log',
		note: 'lift',
		far: [1, 2, 3],
		labels: { lifts: [] },
		d: [0, 1, 2, 3],
	};
}

const lift = { onset: 1000, nearSince: 0, delta: 212, sigma: 1.4, latencyMs: 110 };

describe('magnet telemetry', () => {
	it('sends nothing while the study is closed', async () => {
		mockStudyOpen = false;
		magnetTelemetry.record({ event_type: 'near', delta_ut: 300 });
		jest.advanceTimersByTime(120_000);
		await settle();
		expect(getMagnetTelemetryBufferForTests()).toHaveLength(0);
		expect(mutate).not.toHaveBeenCalled();
	});

	it('batches rows and flushes after a minute with the phone fields filled in', async () => {
		magnetTelemetry.record({ event_type: 'near', delta_ut: 300, approach_ms: 1700 });
		magnetTelemetry.record({ event_type: 'far_learned', detail: 'adopt', delta_ut: 24 });
		expect(mutate).not.toHaveBeenCalled();

		jest.advanceTimersByTime(60_000);
		await settle();
		expect(mutate).toHaveBeenCalledTimes(1);
		const { events } = mutate.mock.calls[0][1];
		expect(events).toHaveLength(2);
		expect(events[0]).toMatchObject({
			platform: 'android',
			device_model: 'samsung SM-F956B',
			os_version: '16',
			sensor_name: 'AK09918 Magnetometer-Uncalibrated',
			app_version: '1.0.1790701663',
			event_type: 'near',
			delta_ut: 300,
			approach_ms: 1700,
			reversed: false,
		});
	});

	it('flushes at 20 ready rows without waiting for the timer', async () => {
		for (let i = 0; i < 20; i++) magnetTelemetry.record({ event_type: 'near', delta_ut: 200 + i });
		await settle();
		expect(mutate).toHaveBeenCalledTimes(1);
		expect(mutate.mock.calls[0][1].events).toHaveLength(20);
	});

	it('stops collecting for the session once the server says the study is closed', async () => {
		mockServerEnabled = false;
		magnetTelemetry.record({ event_type: 'near', delta_ut: 300 });
		jest.advanceTimersByTime(60_000);
		await settle();
		expect(mutate).toHaveBeenCalledTimes(1);

		magnetTelemetry.record({ event_type: 'near', delta_ut: 310 });
		jest.advanceTimersByTime(120_000);
		await settle();
		expect(mutate).toHaveBeenCalledTimes(1);
		expect(getMagnetTelemetryBufferForTests()).toHaveLength(0);
	});

	it('caps the chatty kinds per session', async () => {
		for (let i = 0; i < 50; i++) magnetTelemetry.record({ event_type: 'touch_ignored', detail: 'after_magnet' });
		jest.advanceTimersByTime(120_000);
		await settle();
		const sent = mutate.mock.calls.flatMap((call) => call[1].events);
		expect(sent).toHaveLength(20);
	});

	it('attaches the raw window to the first three started lifts of a phone, then stops', async () => {
		for (let i = 0; i < 4; i++) {
			const onset = 1000 * (i + 1);
			magnetTelemetry.recordLift({ ...lift, onset }, 'startTimer');
			magnetTelemetry.onWindow(fakeWindow(), `lift@${onset}`);
		}
		jest.advanceTimersByTime(60_000);
		await settle();
		const { events } = mutate.mock.calls[0][1];
		expect(events).toHaveLength(4);
		expect(events.filter((e: any) => e.samples)).toHaveLength(3);
		expect(events[0]).toMatchObject({ event_type: 'lift', detail: 'startTimer', rest_ms: 1000, latency_ms: 110 });
		expect(JSON.parse(events[0].samples).kind).toBe('magnet-fixture');
	});

	it('always wants the window of a refused lift, and takes one that arrived first', async () => {
		store.set('zkt_magnet_telemetry_lift_samples', '3');
		magnetTelemetry.onWindow(fakeWindow(), 'lift@5000');
		magnetTelemetry.recordLift({ ...lift, onset: 5000 }, 'none:not_armed');
		magnetTelemetry.recordLift({ ...lift, onset: 6000 }, 'startTimer');
		jest.advanceTimersByTime(60_000);
		await settle();
		const { events } = mutate.mock.calls[0][1];
		expect(events[0].samples).toBeDefined();
		expect(events[1].samples).toBeUndefined();
	});

	it('sends a row without its window when the window never comes', async () => {
		// Legacy fake timers leave Date alone; the wait for the window is measured on it.
		let now = 1_000_000;
		const clock = jest.spyOn(Date, 'now').mockImplementation(() => now);
		magnetTelemetry.record({ event_type: 'reject', detail: 'spike', delta_ut: 12 }, { key: 'reject@1', want: true });
		now += 61_000;
		jest.advanceTimersByTime(60_000);
		await settle();
		clock.mockRestore();
		const { events } = mutate.mock.calls[0][1];
		expect(events).toHaveLength(1);
		expect(events[0].samples).toBeUndefined();
	});

	it('measures the approach from the "move closer" hint to the placement', () => {
		magnetTelemetry.noteHint('closer', 100);
		magnetTelemetry.noteHint('none', 4100);
		expect(magnetTelemetry.takeApproach(4100)).toBe(4000);

		// The cube went away in between: the approach starts over at the next "closer".
		magnetTelemetry.noteHint('closer', 5000);
		magnetTelemetry.noteHint('none', 5500);
		magnetTelemetry.noteHint('closer', 9000);
		magnetTelemetry.noteHint('none', 9300);
		expect(magnetTelemetry.takeApproach(9300)).toBe(300);

		// Straight from far to the hot spot: no approach.
		expect(magnetTelemetry.takeApproach(12000)).toBeNull();
	});

	it('reports the phone once per session', () => {
		magnetTelemetry.reportDevice(null, null);
		magnetTelemetry.reportDevice(99.5, 1.4);
		magnetTelemetry.reportDevice(99.5, 1.4);
		const rows = getMagnetTelemetryBufferForTests();
		expect(rows).toHaveLength(1);
		expect(rows[0].row).toMatchObject({ event_type: 'device', rate_hz: 99.5 });
	});
});
