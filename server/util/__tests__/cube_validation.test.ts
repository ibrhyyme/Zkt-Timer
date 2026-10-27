// Validation for My Cubes (server/util/cube_validation.ts). Everything a client sends about a
// cube or a calibration passes through here before it reaches a table.

import {
	brandFromBleName,
	calibrationErrorKey,
	calibrationText,
	checkCalibration,
	checkClientCubeId,
	checkCubeBrand,
	checkCubeCreate,
	checkCubeName,
	checkCubePuzzle,
	checkCubeUpdate,
	checkSmartCubeIdentity,
	clampSetAt,
	CUBE_BRAND_MAX,
	CUBE_ERROR_KEYS,
	CUBE_NAME_MAX,
	isDistinctiveBleName,
	smartCubeDefaultName,
} from '../cube_validation';
import {deriveThresholds} from '../../../shared/magnet_calibration';
import {SUPPORTED_SMART_CUBE_BRANDS} from '../../../client/components/timer/smart_cube/bluetooth/supported_cubes';

const NO_CUSTOM = new Set<string>();

describe('cube name and brand', () => {
	it('trims and collapses whitespace', () => {
		expect(checkCubeName('  GAN   12  UI ')).toEqual({ok: true, value: 'GAN 12 UI'});
	});

	it('refuses an empty, too long or non-string name', () => {
		expect(checkCubeName('   ').ok).toBe(false);
		expect(checkCubeName('x'.repeat(CUBE_NAME_MAX + 1)).ok).toBe(false);
		expect(checkCubeName('x'.repeat(CUBE_NAME_MAX)).ok).toBe(true);
		expect(checkCubeName(42).ok).toBe(false);
		expect(checkCubeName(undefined).ok).toBe(false);
	});

	it('treats a missing or empty brand as none, and bounds it', () => {
		expect(checkCubeBrand(undefined)).toEqual({ok: true, value: null});
		expect(checkCubeBrand(null)).toEqual({ok: true, value: null});
		expect(checkCubeBrand('  ')).toEqual({ok: true, value: null});
		expect(checkCubeBrand(' MoYu ')).toEqual({ok: true, value: 'MoYu'});
		expect(checkCubeBrand('x'.repeat(CUBE_BRAND_MAX + 1)).ok).toBe(false);
		expect(checkCubeBrand(5).ok).toBe(false);
	});
});

describe('puzzle key', () => {
	it('accepts built-in puzzles and the caller’s own custom types', () => {
		expect(checkCubePuzzle('333', NO_CUSTOM).ok).toBe(true);
		expect(checkCubePuzzle('pyram', NO_CUSTOM).ok).toBe(true);
		expect(checkCubePuzzle('my-type', new Set(['my-type'])).ok).toBe(true);
	});

	it('refuses timer-only buckets and someone else’s custom type', () => {
		for (const key of ['wca', '333cfop', '333roux', '444yau', 'other', '', 'someone-elses-type']) {
			expect(checkCubePuzzle(key, NO_CUSTOM)).toEqual({ok: false, error: 'puzzle'});
		}
		expect(checkCubePuzzle(null, NO_CUSTOM).ok).toBe(false);
	});
});

describe('client cube id', () => {
	it('is optional and must look like an id', () => {
		expect(checkClientCubeId(undefined)).toEqual({ok: true, value: null});
		expect(checkClientCubeId('')).toEqual({ok: true, value: null});
		expect(checkClientCubeId('6f1c2a7e-0b9d-4a51-9a35-1e0f4f6d2c11').ok).toBe(true);
		expect(checkClientCubeId('short').ok).toBe(false);
		expect(checkClientCubeId('has spaces in it').ok).toBe(false);
		expect(checkClientCubeId("x'; DROP TABLE cube; --").ok).toBe(false);
	});
});

describe('create and update', () => {
	it('builds the fields of a new cube', () => {
		expect(checkCubeCreate({puzzle: '222', name: ' YJ MGC ', brand: 'YJ', is_smart: 'yes'}, NO_CUSTOM)).toEqual({
			ok: true,
			value: {id: null, puzzle: '222', name: 'YJ MGC', brand: 'YJ', is_smart: false},
		});
	});

	it('reports the first broken field', () => {
		expect(checkCubeCreate({puzzle: 'wca', name: 'x'}, NO_CUSTOM)).toEqual({ok: false, error: 'puzzle'});
		expect(checkCubeCreate({puzzle: '333', name: ''}, NO_CUSTOM)).toEqual({ok: false, error: 'name'});
		expect(checkCubeCreate({puzzle: '333', name: 'a', id: 'bad id'}, NO_CUSTOM)).toEqual({ok: false, error: 'id'});
	});

	it('changes only what the update names and never the puzzle', () => {
		expect(checkCubeUpdate({name: 'New'})).toEqual({ok: true, value: {name: 'New'}});
		expect(checkCubeUpdate({brand: ''})).toEqual({ok: true, value: {brand: null}});
		expect(checkCubeUpdate({is_smart: true})).toEqual({ok: true, value: {is_smart: true}});
		expect(checkCubeUpdate({puzzle: '777'} as any)).toEqual({ok: true, value: {}});
		expect(checkCubeUpdate({name: ''}).ok).toBe(false);
	});
});

describe('smart cubes', () => {
	it('needs a BLE id and bounds the name', () => {
		expect(checkSmartCubeIdentity(' AA:BB ', ' GANi3_F568 ')).toEqual({
			ok: true,
			value: {bleDeviceId: 'AA:BB', bleName: 'GANi3_F568'},
		});
		expect(checkSmartCubeIdentity('', 'GAN').ok).toBe(false);
		expect(checkSmartCubeIdentity('x'.repeat(200), 'GAN').ok).toBe(false);
		expect(checkSmartCubeIdentity('AA', null)).toEqual({ok: true, value: {bleDeviceId: 'AA', bleName: null}});
	});

	it('only a name with a serial identifies one physical cube', () => {
		expect(isDistinctiveBleName('GANi3_F568')).toBe(true);
		expect(isDistinctiveBleName('QY-QYSC-S-1A2B')).toBe(true);
		expect(isDistinctiveBleName('MHC')).toBe(false);
		expect(isDistinctiveBleName('GoCube')).toBe(false);
		expect(isDistinctiveBleName(null)).toBe(false);
	});

	it('takes the brand from the scanner prefix table, for every brand in it', () => {
		for (const entry of SUPPORTED_SMART_CUBE_BRANDS) {
			for (const prefix of entry.prefixes) {
				expect(brandFromBleName(`${prefix}_1234`)).toBe(entry.brand);
			}
		}
		expect(brandFromBleName('Unknown cube')).toBeNull();
		expect(brandFromBleName(null)).toBeNull();
	});

	it('names a new smart cube after its BLE name', () => {
		expect(smartCubeDefaultName(' GANi3_F568 ')).toBe('GANi3_F568');
		expect(smartCubeDefaultName('')).toBe('Smart Cube');
		expect(smartCubeDefaultName('x'.repeat(100))).toHaveLength(CUBE_NAME_MAX);
	});
});

describe('main choice time', () => {
	const now = Date.parse('2026-10-06T12:00:00Z');

	it('accepts a past time and pulls a future one back to now', () => {
		expect(clampSetAt('2026-10-06T11:00:00Z', now)?.toISOString()).toBe('2026-10-06T11:00:00.000Z');
		expect(clampSetAt(new Date(now + 3600_000), now)?.getTime()).toBe(now);
	});

	it('refuses garbage', () => {
		expect(clampSetAt('not a date', now)).toBeNull();
		expect(clampSetAt(undefined, now)).toBeNull();
		expect(clampSetAt({}, now)).toBeNull();
	});
});

describe('calibration', () => {
	const now = Date.parse('2026-10-06T12:00:00Z');

	function upload(overrides: Record<string, unknown> = {}) {
		const raw = {peak: 900, rest: 480, noise: 1};
		const t = deriveThresholds(raw, 'ios');
		return {
			platform: 'ios',
			device_model: ' Apple iPhone16,1 ',
			peak_ut: raw.peak,
			rest_ut: raw.rest,
			noise_ut: raw.noise,
			near_min_ut: t.nearMin,
			far_max_ut: t.farMax,
			quality: t.quality,
			sample_count: 900,
			sweep_ms: 9000,
			rate_hz: 100,
			algo_version: 1,
			measured_at: new Date(now - 60_000),
			...overrides,
		} as any;
	}

	it('accepts a real measurement and trims the model', () => {
		const result = checkCalibration(upload(), now);
		expect(result.ok).toBe(true);
		expect(result.ok && result.deviceModel).toBe('Apple iPhone16,1');
	});

	it('refuses forged thresholds and a cube too weak to use', () => {
		expect(checkCalibration(upload({near_min_ut: 30}), now)).toEqual({ok: false, reason: 'thresholds'});
		const weak = upload({peak_ut: 40, rest_ut: 30, noise_ut: 1, near_min_ut: 30, far_max_ut: 16.5, quality: 'weak'});
		expect(checkCalibration(weak, now)).toEqual({ok: false, reason: 'too_weak'});
	});

	it('maps a refusal to the sentence the client shows', () => {
		expect(CUBE_ERROR_KEYS[calibrationErrorKey('too_weak')]).toBe('cube_errors.calibration_too_weak');
		expect(CUBE_ERROR_KEYS[calibrationErrorKey('thresholds')]).toBe('cube_errors.calibration_invalid');
		expect(CUBE_ERROR_KEYS[calibrationErrorKey('measured_at')]).toBe('cube_errors.calibration_invalid');
	});

	it('bounds the optional text columns', () => {
		expect(calibrationText('  1.2.3  ', 32)).toBe('1.2.3');
		expect(calibrationText('', 32)).toBeNull();
		expect(calibrationText(7, 32)).toBeNull();
		expect(calibrationText('x'.repeat(100), 32)).toHaveLength(32);
	});
});

describe('error keys', () => {
	it('all live in the cube_errors namespace', () => {
		for (const key of Object.values(CUBE_ERROR_KEYS)) {
			expect(key).toMatch(/^cube_errors\.[a-z_]+$/);
		}
	});
});
