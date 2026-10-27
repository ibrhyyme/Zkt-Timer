import {
	applySampleQuota,
	MAX_EVENTS_PER_CALL,
	MAX_SAMPLE_NUMBERS,
	parseSampleWindow,
	sanitizeMagnetTelemetry,
} from '../magnet_telemetry';

function window(samples = 50, extra: Record<string, unknown> = {}) {
	const d: number[] = [];
	for (let i = 0; i < samples; i++) d.push(i * 10, 30.1, -360.2, -740.3);
	return JSON.stringify({
		v: 1,
		kind: 'magnet-fixture',
		platform: 'ios',
		source: 'Zkt Timer admin field log',
		note: 'lift',
		far: [35.2, -366.8, -742.8],
		labels: {lifts: [{onsetRef: 300, farAt: 380, nearDelta: 334.7, noiseMax: 0.4}]},
		d,
		...extra,
	});
}

const lift = {
	platform: 'android',
	device_model: 'samsung SM-F956B',
	event_type: 'lift',
	detail: 'startTimer',
	delta_ut: 212.44,
	latency_ms: 110.4,
	rest_ms: 1120,
	sigma: 1.44,
	reversed: true,
	app_version: '1.0.1790701663',
};

describe('sanitizeMagnetTelemetry', () => {
	it('keeps a well-formed row and attaches the user', () => {
		const [row] = sanitizeMagnetTelemetry([lift], 'user-1');
		expect(row).toMatchObject({
			user_id: 'user-1',
			platform: 'android',
			device_model: 'samsung SM-F956B',
			event_type: 'lift',
			detail: 'startTimer',
			delta_ut: 212.4,
			latency_ms: 110,
			rest_ms: 1120,
			reversed: true,
		});
		expect(row.samples).toBeUndefined();
	});

	it('drops unknown event types and platforms', () => {
		const rows = sanitizeMagnetTelemetry(
			[
				{...lift, event_type: 'solve'},
				{...lift, platform: 'web'},
				{...lift, event_type: null},
				null as any,
			],
			'u'
		);
		expect(rows).toHaveLength(0);
	});

	it('clamps numbers and trims text instead of rejecting the row', () => {
		const [row] = sanitizeMagnetTelemetry(
			[
				{
					...lift,
					device_model: '   ',
					detail: 'x'.repeat(200),
					delta_ut: 1e9,
					latency_ms: -40,
					sigma: Number.NaN,
					reversed: 'yes' as any,
				},
			],
			'u'
		);
		expect(row.device_model).toBe('unknown');
		expect(row.detail).toHaveLength(48);
		expect(row.delta_ut).toBe(20000);
		expect(row.latency_ms).toBe(0);
		expect(row.sigma).toBeNull();
		expect(row.reversed).toBe(false);
	});

	it('takes at most one flush worth of events', () => {
		const many = Array.from({length: MAX_EVENTS_PER_CALL + 25}, () => ({...lift}));
		expect(sanitizeMagnetTelemetry(many, 'u')).toHaveLength(MAX_EVENTS_PER_CALL);
	});

	it('stores only the fixture fields of a raw window', () => {
		const [row] = sanitizeMagnetTelemetry([{...lift, samples: window(50, {secret: 'x'})}], 'u');
		expect(row.samples).toBeDefined();
		expect(Object.keys(row.samples as object).sort()).toEqual(['d', 'far', 'kind', 'labels', 'note', 'platform', 'v']);
		expect(row.samples!.d).toHaveLength(200);
		expect(row.samples!.labels.lifts[0].nearDelta).toBe(334.7);
	});
});

describe('parseSampleWindow', () => {
	it('rejects anything that is not a fixture-shaped window', () => {
		expect(parseSampleWindow('not json')).toBeNull();
		expect(parseSampleWindow(JSON.stringify({v: 2, kind: 'magnet-fixture', d: [1, 2, 3, 4]}))).toBeNull();
		expect(parseSampleWindow(window(5))).toBeNull(); // too short to replay
		expect(parseSampleWindow(window(50, {d: Array(42).fill(1)}))).toBeNull(); // not t,x,y,z quadruples
		expect(parseSampleWindow(window(50, {d: [...Array(43).fill(1), 'x']}))).toBeNull(); // not all numbers
		expect(parseSampleWindow(window(MAX_SAMPLE_NUMBERS / 4 + 1))).toBeNull();
		expect(parseSampleWindow(123)).toBeNull();
	});

	it('keeps far only when it is a vector', () => {
		expect(parseSampleWindow(window(50, {far: [1, 2]}))!.far).toBeNull();
		expect(parseSampleWindow(window(50))!.far).toEqual([35.2, -366.8, -742.8]);
	});
});

describe('applySampleQuota', () => {
	it('strips windows beyond the remaining daily budget and keeps the rows', () => {
		const rows = sanitizeMagnetTelemetry(
			[
				{...lift, samples: window()},
				{...lift, samples: window()},
				{...lift},
				{...lift, samples: window()},
			],
			'u'
		);
		const limited = applySampleQuota(rows, 1);
		expect(limited).toHaveLength(4);
		expect(limited.filter((r) => r.samples)).toHaveLength(1);
		expect(limited[0].samples).toBeDefined();
		expect(applySampleQuota(rows, -3).filter((r) => r.samples)).toHaveLength(0);
	});
});
