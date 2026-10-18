// Validation for My Cubes (Cube.resolver.ts). Pure, no Prisma: the rules are unit tested
// without a database. Everything a client sends about a cube or a magnet calibration passes
// through here before it reaches a table.

import {isValidPuzzleKey} from '../../shared/cube_puzzle';
import {
	CalibrationMeasurementInput,
	CalibrationRejectReason,
	checkCalibrationMeasurement,
	CalibrationCheckResult,
} from '../../shared/magnet_calibration';
import {SUPPORTED_SMART_CUBE_BRANDS} from '../../client/components/timer/smart_cube/bluetooth/supported_cubes';

/** Cubes per account, archived ones included. Far beyond any real collection, small enough to list in one request. */
export const MAX_CUBES_PER_USER = 300;
export const CUBE_NAME_MAX = 40;
export const CUBE_BRAND_MAX = 30;
/** A client-made id (uuid). Generous, but bounded and free of anything that is not an id character. */
const CLIENT_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;
const PUZZLE_KEY_MAX = 64;
const BLE_ID_MAX = 128;
const BLE_NAME_MAX = 64;

/** i18n keys sent in `extensions.i18nKey`; the client shows the translated sentence. */
export const CUBE_ERROR_KEYS = {
	limit: 'cube_errors.limit_reached',
	name: 'cube_errors.name_invalid',
	brand: 'cube_errors.brand_invalid',
	puzzle: 'cube_errors.puzzle_invalid',
	id: 'cube_errors.not_found',
	notFound: 'cube_errors.not_found',
	archived: 'cube_errors.archived',
	wrongPuzzle: 'cube_errors.wrong_puzzle',
	proRequired: 'cube_errors.pro_required',
	calibrationDailyLimit: 'cube_errors.calibration_daily_limit',
	calibrationInvalid: 'cube_errors.calibration_invalid',
	calibrationTooWeak: 'cube_errors.calibration_too_weak',
	bleInvalid: 'cube_errors.ble_invalid',
} as const;

export type CubeErrorKey = keyof typeof CUBE_ERROR_KEYS;

export type Checked<T> = {ok: true; value: T; error?: undefined} | {ok: false; error: CubeErrorKey; value?: undefined};

function ok<T>(value: T): Checked<T> {
	return {ok: true, value};
}

function fail<T>(error: CubeErrorKey): Checked<T> {
	return {ok: false, error};
}

/** Trims and collapses inner whitespace runs, so "GAN   12" and "GAN 12" are one name. */
function cleanText(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	return value.replace(/\s+/g, ' ').trim();
}

/** Name: required, 1 to 40 characters after trimming. */
export function checkCubeName(value: unknown): Checked<string> {
	const name = cleanText(value);
	if (!name || name.length > CUBE_NAME_MAX) return fail('name');
	return ok(name);
}

/** Brand: optional, up to 30 characters; empty means no brand (null). */
export function checkCubeBrand(value: unknown): Checked<string | null> {
	if (value === undefined || value === null) return ok(null);
	const brand = cleanText(value);
	if (brand === null) return fail('brand');
	if (!brand) return ok(null);
	if (brand.length > CUBE_BRAND_MAX) return fail('brand');
	return ok(brand);
}

/** A built-in puzzle key or one of the caller's custom cube type ids. Timer-only types are refused. */
export function checkCubePuzzle(value: unknown, customTypeIds: ReadonlySet<string>): Checked<string> {
	if (typeof value !== 'string' || !value || value.length > PUZZLE_KEY_MAX) return fail('puzzle');
	if (!isValidPuzzleKey(value, customTypeIds)) return fail('puzzle');
	return ok(value);
}

/** A client-made cube id: absent (the server makes one) or an id-shaped string. */
export function checkClientCubeId(value: unknown): Checked<string | null> {
	if (value === undefined || value === null || value === '') return ok(null);
	if (typeof value !== 'string' || !CLIENT_ID_RE.test(value)) return fail('id');
	return ok(value);
}

export interface CubeCreateFields {
	id: string | null;
	puzzle: string;
	name: string;
	brand: string | null;
	is_smart: boolean;
}

export function checkCubeCreate(
	input: {id?: unknown; puzzle?: unknown; name?: unknown; brand?: unknown; is_smart?: unknown},
	customTypeIds: ReadonlySet<string>
): Checked<CubeCreateFields> {
	const id = checkClientCubeId(input.id);
	if (id.ok === false) return fail(id.error);
	const puzzle = checkCubePuzzle(input.puzzle, customTypeIds);
	if (puzzle.ok === false) return fail(puzzle.error);
	const name = checkCubeName(input.name);
	if (name.ok === false) return fail(name.error);
	const brand = checkCubeBrand(input.brand);
	if (brand.ok === false) return fail(brand.error);
	return ok({id: id.value, puzzle: puzzle.value, name: name.value, brand: brand.value, is_smart: input.is_smart === true});
}

export interface CubeUpdateFields {
	name?: string;
	brand?: string | null;
	is_smart?: boolean;
}

/** Only the fields present are changed. `puzzle` is never accepted here: linked solves belong to it. */
export function checkCubeUpdate(input: {name?: unknown; brand?: unknown; is_smart?: unknown}): Checked<CubeUpdateFields> {
	const out: CubeUpdateFields = {};
	if (input.name !== undefined && input.name !== null) {
		const name = checkCubeName(input.name);
		if (name.ok === false) return fail(name.error);
		out.name = name.value;
	}
	if (input.brand !== undefined) {
		const brand = checkCubeBrand(input.brand);
		if (brand.ok === false) return fail(brand.error);
		out.brand = brand.value;
	}
	if (typeof input.is_smart === 'boolean') out.is_smart = input.is_smart;
	return ok(out);
}

export interface SmartCubeIdentity {
	bleDeviceId: string;
	bleName: string | null;
}

export function checkSmartCubeIdentity(bleDeviceId: unknown, bleName: unknown): Checked<SmartCubeIdentity> {
	const id = typeof bleDeviceId === 'string' ? bleDeviceId.trim() : '';
	if (!id || id.length > BLE_ID_MAX) return fail('bleInvalid');
	const name = cleanText(bleName);
	return ok({bleDeviceId: id, bleName: name ? name.slice(0, BLE_NAME_MAX) : null});
}

/**
 * Whether an advertised BLE name identifies one physical cube. Names that end in a 4-digit
 * hex serial ("GANi3_F568") do; bare model names ("MHC", "GoCube") are shared by every cube
 * of that model. Only the first kind may move a cube to a new BLE id (iOS reinstall, web).
 * The migration (scripts/migrations/cubes-from-smart-devices.sql) uses the same rule.
 */
export function isDistinctiveBleName(name: string | null | undefined): boolean {
	return !!name && /[0-9A-Fa-f]{4}$/.test(name);
}

/** Brand of a smart cube from its advertised name, from the scanner's own prefix table. */
export function brandFromBleName(name: string | null | undefined): string | null {
	if (!name) return null;
	for (const entry of SUPPORTED_SMART_CUBE_BRANDS) {
		if (entry.prefixes.some((prefix) => name.startsWith(prefix))) return entry.brand.slice(0, CUBE_BRAND_MAX);
	}
	return null;
}

/** Display name of a newly registered smart cube: its BLE name, or a neutral fallback. */
export function smartCubeDefaultName(name: string | null | undefined): string {
	const cleaned = cleanText(name);
	return (cleaned || 'Smart Cube').slice(0, CUBE_NAME_MAX);
}

/** A main choice time from the client: valid, and never later than now (a fast clock must not win for ever). */
export function clampSetAt(value: unknown, now: number = Date.now()): Date | null {
	const date = value instanceof Date ? value : typeof value === 'string' || typeof value === 'number' ? new Date(value) : null;
	if (!date || !Number.isFinite(date.getTime())) return null;
	return date.getTime() > now ? new Date(now) : date;
}

/** Which sentence the client shows for a refused calibration. */
export function calibrationErrorKey(reason: CalibrationRejectReason): CubeErrorKey {
	return reason === 'too_weak' ? 'calibrationTooWeak' : 'calibrationInvalid';
}

/** Database free part of the calibration check (shared/magnet_calibration.ts); the resolver adds ownership, the daily limit and recency. */
export function checkCalibration(input: CalibrationMeasurementInput, now: number = Date.now()): CalibrationCheckResult {
	return checkCalibrationMeasurement(input, now);
}

/** Optional text columns of a calibration row, trimmed and bounded. */
export function calibrationText(value: unknown, max: number): string | null {
	const cleaned = cleanText(value);
	return cleaned ? cleaned.slice(0, max) : null;
}
