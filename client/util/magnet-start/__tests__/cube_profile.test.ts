// Which cube and thresholds the Magnet Timer runs with (design 4.7, 5.6, 6.3, 9.1). Calibration
// is mandatory for every cube, 3x3 included (owner decision 2026-10-05).
import type { CubeState, LocalCalibration, LocalCube, PendingCalibration } from '../../../lib/cubes/active_cube';
import { liveBarScaleUt, resolveMagnetProfile, ResolveProfileInput, sameMagnetProfile } from '../cube_profile';
import { fallbackCalibrationCopies, modelKeyFromInfo, screenModelKey } from '../device_model';

function cube(id: string, puzzle: string, extra: Partial<LocalCube> = {}): LocalCube {
	return {
		id,
		puzzle,
		name: `Cube ${id}`,
		brand: null,
		is_smart: false,
		ble_device_id: null,
		ble_name: null,
		legacy_smart_device_ids: [],
		archived_at: null,
		created_at: 1,
		updated_at: 1,
		solve_count: 0,
		first_used_at: null,
		last_used_at: null,
		calibrations: [],
		...extra,
	};
}

function calibration(cubeId: string, model: string, extra: Partial<LocalCalibration> = {}): LocalCalibration {
	return {
		id: `cal-${cubeId}-${model}`,
		cube_id: cubeId,
		platform: 'android',
		device_model: model,
		os_version: null,
		app_version: null,
		sensor_name: null,
		peak_ut: 900,
		rest_ut: 500,
		noise_ut: 1.4,
		near_min_ut: 150,
		far_max_ut: 80,
		quality: 'ok',
		sample_count: 900,
		sweep_ms: 9000,
		rate_hz: 100,
		algo_version: 1,
		measured_at: 1000,
		...extra,
	};
}

const MODEL = 'samsung SM-F956B';
const BUCKET_333 = { cube_type: 'wca', scramble_subset: '333' };

function input(
	cubes: LocalCube[],
	mains: CubeState['mains'] = {},
	extra: Partial<ResolveProfileInput> & { pending?: PendingCalibration[] } = {}
): ResolveProfileInput {
	return {
		state: { cubes, mains, pendingCalibrations: extra.pending || [], userId: 'u1', fetchedAt: 1 },
		bucket: extra.bucket || BUCKET_333,
		platform: extra.platform === undefined ? 'android' : extra.platform,
		deviceModel: 'deviceModel' in extra ? extra.deviceModel : MODEL,
	};
}

describe('resolveMagnetProfile', () => {
	it('walks the guide states in order: no cubes, none of this puzzle, no main, no calibration', () => {
		expect(resolveMagnetProfile(input([])).status).toBe('no_cubes');
		expect(resolveMagnetProfile(input([cube('a', '222')])).status).toBe('no_puzzle_cube');
		expect(resolveMagnetProfile(input([cube('a', '333')])).status).toBe('no_main');
		const p = resolveMagnetProfile(input([cube('a', '333')], { '333': { cube_id: 'a', set_at: 1 } }));
		expect(p.status).toBe('no_calibration');
		expect(p.cubeId).toBe('a');
		expect(p.deviceModel).toBe(MODEL);
	});

	it('a 3x3 without a calibration on this phone model does not run on default thresholds', () => {
		const other = cube('a', '333', { calibrations: [calibration('a', 'Google Pixel 8')] });
		const p = resolveMagnetProfile(input([other], { '333': { cube_id: 'a', set_at: 1 } }));
		expect(p.status).toBe('no_calibration');
		expect(p.nearMin).toBeNull();
	});

	it('derives the thresholds from the raw values with the current formula, not the stored ones', () => {
		const c = cube('a', '333', { calibrations: [calibration('a', MODEL, { rest_ut: 200, near_min_ut: 999, far_max_ut: 999 })] });
		const p = resolveMagnetProfile(input([c], { '333': { cube_id: 'a', set_at: 1 } }));
		expect(p.status).toBe('ready');
		expect(p.nearMin).toBeCloseTo(70, 6);
		expect(p.farMax).toBeCloseTo(38.5, 6);
		expect(p.quality).toBe('weak');
		expect(p.restUt).toBe(200);
		expect(p.cubeName).toBe('Cube a');
	});

	it('every bucket of the puzzle uses the same cube (PLL subset, Roux)', () => {
		const c = cube('a', '333', { calibrations: [calibration('a', MODEL)] });
		const mains = { '333': { cube_id: 'a', set_at: 1 } };
		expect(resolveMagnetProfile(input([c], mains, { bucket: { cube_type: '333cfop', scramble_subset: 'pll' } })).status).toBe('ready');
		expect(resolveMagnetProfile(input([c], mains, { bucket: { cube_type: '333roux', scramble_subset: null } })).cubeId).toBe('a');
	});

	it('a stored measurement the current formula fails asks for a new one', () => {
		const c = cube('a', '333', { calibrations: [calibration('a', MODEL, { rest_ut: 20, peak_ut: 40 })] });
		const p = resolveMagnetProfile(input([c], { '333': { cube_id: 'a', set_at: 1 } }));
		expect(p.status).toBe('no_calibration');
		expect(p.recalibrate).toBe(true);
	});

	it('a measurement waiting for upload is used at once', () => {
		const c = cube('a', '333');
		const { id, pending, ...row } = calibration('a', MODEL, { measured_at: 5000 });
		const p = resolveMagnetProfile(input([c], { '333': { cube_id: 'a', set_at: 1 } }, { pending: [row] }));
		expect(p.status).toBe('ready');
		expect(p.pending).toBe(true);
	});

	it('loading while the store or the model key is not known, no card for a puzzle-less bucket', () => {
		const loading = input([]);
		loading.state.fetchedAt = null;
		expect(resolveMagnetProfile(loading).status).toBe('loading');
		const c = cube('a', '333');
		expect(resolveMagnetProfile(input([c], { '333': { cube_id: 'a', set_at: 1 } }, { deviceModel: undefined })).status).toBe('loading');
		expect(resolveMagnetProfile(input([c], {}, { bucket: { cube_type: 'other', scramble_subset: null } })).status).toBe('no_puzzle');
	});

	it('sameMagnetProfile compares field by field', () => {
		const c = cube('a', '333', { calibrations: [calibration('a', MODEL)] });
		const a = resolveMagnetProfile(input([c], { '333': { cube_id: 'a', set_at: 1 } }));
		const b = resolveMagnetProfile(input([c], { '333': { cube_id: 'a', set_at: 1 } }));
		expect(a).not.toBe(b);
		expect(sameMagnetProfile(a, b)).toBe(true);
		expect(sameMagnetProfile(a, { ...b, nearMin: 100 })).toBe(false);
		expect(sameMagnetProfile(null, b)).toBe(false);
	});
});

describe('liveBarScaleUt (design 5.8)', () => {
	it('the rest value fills 80 % of the bar, never less than twice the ready line', () => {
		expect(liveBarScaleUt({ nearMin: 150, restUt: 500, peakUt: 3000 })).toBe(625);
		expect(liveBarScaleUt({ nearMin: 70, restUt: 100, peakUt: 300 })).toBe(140);
	});

	it('without a rest value: 1.25 x peak, capped at 4 x the ready line', () => {
		expect(liveBarScaleUt({ nearMin: 150, restUt: null, peakUt: 3000 })).toBe(600);
		expect(liveBarScaleUt({ nearMin: 100, restUt: null, peakUt: 240 })).toBe(300);
		expect(liveBarScaleUt({ nearMin: null, restUt: 500, peakUt: 900 })).toBeNull();
	});
});

describe('device model key (design 9.1)', () => {
	it('uses "<manufacturer> <model>" like the telemetry study always did', () => {
		expect(modelKeyFromInfo('android', { manufacturer: 'samsung', model: 'SM-F956B' })).toBe('samsung SM-F956B');
		expect(modelKeyFromInfo('ios', { manufacturer: 'Apple', model: 'iPhone16,1' })).toBe('Apple iPhone16,1');
	});

	it('refuses a model that would merge every iPhone into one key', () => {
		expect(modelKeyFromInfo('ios', { manufacturer: 'Apple', model: 'iPhone' })).toBeNull();
		expect(modelKeyFromInfo('ios', { model: 'unknown' })).toBeNull();
		expect(modelKeyFromInfo('android', {})).toBeNull();
		expect(modelKeyFromInfo('ios', null)).toBeNull();
	});

	it('screen fallback is orientation independent and within the server length', () => {
		const portrait = screenModelKey('ios', 'whatever', { width: 393, height: 852, dpr: 3 });
		expect(portrait).toBe('Apple screen-393x852@3');
		expect(screenModelKey('ios', null, { width: 852, height: 393, dpr: 3 })).toBe(portrait);
		expect(screenModelKey('android', 'x'.repeat(200), { width: 1, height: 1, dpr: 1 }).length).toBeLessThanOrEqual(80);
	});

	it('copies fallback-key calibrations to the real key once, keeping measured_at', () => {
		const FALLBACK = 'Apple screen-393x852@3';
		const REAL = 'Apple iPhone16,1';
		const ios = (cubeId: string, model: string, measuredAt: number) =>
			calibration(cubeId, model, { platform: 'ios', measured_at: measuredAt, noise_ut: 0.3 });
		const state: CubeState = {
			cubes: [
				cube('a', '333', { calibrations: [ios('a', FALLBACK, 1000)] }),
				cube('b', '222', { calibrations: [ios('b', FALLBACK, 1000), ios('b', REAL, 2000)] }),
				cube('c', '444', { calibrations: [ios('c', FALLBACK, 3000), ios('c', REAL, 2000)] }),
			],
			mains: {},
			pendingCalibrations: [],
		};
		const copies = fallbackCalibrationCopies(state, 'ios', FALLBACK, REAL);
		expect(copies.map((row) => row.cube_id)).toEqual(['a', 'c']);
		expect(copies[0]).toMatchObject({ device_model: REAL, measured_at: 1000, platform: 'ios' });
		expect(copies[0]).not.toHaveProperty('id');

		// Once they wait for upload, nothing is copied again.
		const after: CubeState = { ...state, pendingCalibrations: copies };
		expect(fallbackCalibrationCopies(after, 'ios', FALLBACK, REAL)).toEqual([]);
		expect(fallbackCalibrationCopies(state, 'ios', REAL, REAL)).toEqual([]);
	});
});
