import 'reflect-metadata';

// Cube.resolver against a small in-memory stand-in for the three cube tables: the rules that
// need a database (ownership, newer choice wins, Pro gate, daily limit) without one.

jest.mock('../../services/logger', () => ({logger: {warn: jest.fn(), info: jest.fn(), error: jest.fn()}}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const {CubeResolver, canCalibrate} = require('../Cube.resolver');
import {deriveThresholds} from '../../../shared/magnet_calibration';

const ME = 'user-me';

function pick(row: any, select: any) {
	if (!select) return {...row};
	const out: any = {};
	for (const key of Object.keys(select)) if (key in row) out[key] = row[key];
	return out;
}

function makeDb() {
	const cubes: any[] = [];
	const mains: any[] = [];
	const calibrations: any[] = [];
	const solves: any[] = [];
	const smartDevices: any[] = [];

	const matchCube = (where: any) => (c: any) =>
		(!where.id || c.id === where.id) && (!where.user_id || c.user_id === where.user_id);

	const prisma: any = {
		cube: {
			findFirst: jest.fn(async ({where, select}: any) => {
				const found = cubes.find(matchCube(where));
				if (!found) return null;
				const out = pick(found, select);
				if (select?.calibrations) out.calibrations = calibrations.filter((k) => k.cube_id === found.id);
				return out;
			}),
			findUnique: jest.fn(async ({where, select}: any) => {
				const found = cubes.find((c) => c.id === where.id);
				return found ? pick(found, select) : null;
			}),
			findMany: jest.fn(async () => []),
			count: jest.fn(async ({where}: any) => cubes.filter((c) => c.user_id === where.user_id).length),
			create: jest.fn(async ({data, select}: any) => {
				const row = {
					id: data.id || `cube-${cubes.length + 1}`,
					brand: null,
					is_smart: false,
					ble_device_id: null,
					ble_name: null,
					legacy_smart_device_ids: [],
					archived_at: null,
					created_at: new Date(),
					updated_at: new Date(),
					...data,
				};
				cubes.push(row);
				return pick(row, select);
			}),
			update: jest.fn(async ({where, data}: any) => {
				const row = cubes.find((c) => c.id === where.id);
				Object.assign(row, data);
				return row;
			}),
			delete: jest.fn(async ({where}: any) => {
				const i = cubes.findIndex((c) => c.id === where.id);
				const [row] = cubes.splice(i, 1);
				return row;
			}),
		},
		cubeMain: {
			findUnique: jest.fn(async ({where}: any) => {
				const {user_id, puzzle} = where.user_id_puzzle;
				const found = mains.find((m) => m.user_id === user_id && m.puzzle === puzzle);
				return found ? {puzzle: found.puzzle, cube_id: found.cube_id, set_at: found.set_at} : null;
			}),
			findMany: jest.fn(async () => mains),
			create: jest.fn(async ({data}: any) => {
				mains.push({...data});
				return data;
			}),
			upsert: jest.fn(async ({where, create, update}: any) => {
				const {user_id, puzzle} = where.user_id_puzzle;
				const found = mains.find((m) => m.user_id === user_id && m.puzzle === puzzle);
				if (found) Object.assign(found, update);
				else mains.push({...create});
				const row = found || create;
				return {puzzle: row.puzzle, cube_id: row.cube_id, set_at: row.set_at};
			}),
			deleteMany: jest.fn(async ({where}: any) => {
				for (let i = mains.length - 1; i >= 0; i--) {
					const m = mains[i];
					if (m.user_id === where.user_id && (!where.puzzle || m.puzzle === where.puzzle) && (!where.cube_id || m.cube_id === where.cube_id)) {
						mains.splice(i, 1);
					}
				}
				return {count: 1};
			}),
		},
		cubeCalibration: {
			findUnique: jest.fn(async ({where}: any) => {
				const k = where.cube_id_platform_device_model;
				return calibrations.find((c) => c.cube_id === k.cube_id && c.platform === k.platform && c.device_model === k.device_model) || null;
			}),
			count: jest.fn(async () => 0),
			upsert: jest.fn(async ({where, create, update}: any) => {
				const k = where.cube_id_platform_device_model;
				const found = calibrations.find((c) => c.cube_id === k.cube_id && c.platform === k.platform && c.device_model === k.device_model);
				if (found) {
					Object.assign(found, update, {updated_at: new Date()});
					return found;
				}
				const row = {id: `cal-${calibrations.length + 1}`, ...create, created_at: new Date(), updated_at: new Date()};
				calibrations.push(row);
				return row;
			}),
			deleteMany: jest.fn(async ({where}: any) => {
				const i = calibrations.findIndex((c) => c.id === where.id && c.user_id === where.user_id);
				if (i < 0) return {count: 0};
				calibrations.splice(i, 1);
				return {count: 1};
			}),
		},
		solve: {
			groupBy: jest.fn(async () => []),
			updateMany: jest.fn(async ({where, data}: any) => {
				for (const s of solves) if (s.user_id === where.user_id && s.cube_id === where.cube_id) Object.assign(s, data);
				return {count: 0};
			}),
		},
		smartDevice: {
			deleteMany: jest.fn(async ({where}: any) => {
				for (let i = smartDevices.length - 1; i >= 0; i--) {
					if (smartDevices[i].user_id === where.user_id && where.id.in.includes(smartDevices[i].id)) smartDevices.splice(i, 1);
				}
				return {count: 0};
			}),
		},
		customCubeType: {findMany: jest.fn(async () => [])},
		$transaction: jest.fn(async (ops: any[]) => Promise.all(ops)),
	};

	return {prisma, cubes, mains, calibrations, solves, smartDevices};
}

function ctx(db: ReturnType<typeof makeDb>, user: any = {id: ME, is_pro: true}) {
	return {user, prisma: db.prisma} as any;
}

const resolver = new CubeResolver();

describe('createCube', () => {
	it('makes the first cube of a puzzle its main, not the second', async () => {
		const db = makeDb();
		const first = await resolver.createCube(ctx(db), {puzzle: '333', name: 'GAN 12'});
		await resolver.createCube(ctx(db), {puzzle: '333', name: 'MoYu'});
		expect(db.mains).toEqual([expect.objectContaining({user_id: ME, puzzle: '333', cube_id: first.id})]);
	});

	it('gives the automatic main an old set_at, so a person’s choice on a slow clock still wins', async () => {
		const db = makeDb();
		const a = await resolver.createCube(ctx(db), {puzzle: '333', name: 'A'});
		const b = await resolver.createCube(ctx(db), {puzzle: '333', name: 'B'});
		const result = await resolver.setMainCube(ctx(db), '333', new Date(Date.now() - 10 * 60_000), b.id);
		expect(result.cube_id).toBe(b.id);
		expect(a.id).not.toBe(b.id);
	});

	it('the form box makes a later cube main at the time it was chosen', async () => {
		const db = makeDb();
		await resolver.createCube(ctx(db), {puzzle: '333', name: 'A'});
		const chosenAt = new Date(Date.now() - 5000);
		const b = await resolver.createCube(ctx(db), {puzzle: '333', name: 'B', make_main: true, set_at: chosenAt});
		expect(db.mains[0]).toMatchObject({cube_id: b.id, set_at: chosenAt});
	});

	it('is idempotent on a client id sent twice', async () => {
		const db = makeDb();
		const id = '6f1c2a7e-0b9d-4a51-9a35-1e0f4f6d2c11';
		await resolver.createCube(ctx(db), {id, puzzle: '222', name: 'YJ'});
		await resolver.createCube(ctx(db), {id, puzzle: '222', name: 'YJ'});
		expect(db.cubes).toHaveLength(1);
	});

	it('refuses a timer-only bucket as a puzzle, with an i18n key', async () => {
		const db = makeDb();
		await expect(resolver.createCube(ctx(db), {puzzle: '333cfop', name: 'x'})).rejects.toMatchObject({
			extensions: expect.objectContaining({i18nKey: 'cube_errors.puzzle_invalid'}),
		});
	});
});

describe('setMainCube', () => {
	it('keeps the newer choice: an older set_at from an offline phone changes nothing', async () => {
		const db = makeDb();
		const a = await resolver.createCube(ctx(db), {puzzle: '333', name: 'A'});
		const b = await resolver.createCube(ctx(db), {puzzle: '333', name: 'B'});

		const newer = new Date(Date.now() - 1000);
		await resolver.setMainCube(ctx(db), '333', newer, b.id);
		const result = await resolver.setMainCube(ctx(db), '333', new Date(Date.now() - 60_000), a.id);

		expect(result.cube_id).toBe(b.id);
		expect(db.mains[0].cube_id).toBe(b.id);
	});

	it('refuses a cube of another puzzle and an archived cube', async () => {
		const db = makeDb();
		const two = await resolver.createCube(ctx(db), {puzzle: '222', name: 'YJ'});
		await expect(resolver.setMainCube(ctx(db), '333', new Date(Date.now() + 5000), two.id)).rejects.toMatchObject({
			extensions: expect.objectContaining({i18nKey: 'cube_errors.wrong_puzzle'}),
		});
		await resolver.setCubeArchived(ctx(db), two.id, true);
		await expect(resolver.setMainCube(ctx(db), '222', new Date(Date.now() + 10_000), two.id)).rejects.toMatchObject({
			extensions: expect.objectContaining({i18nKey: 'cube_errors.archived'}),
		});
	});

	it("refuses someone else's cube", async () => {
		const db = makeDb();
		const theirs = await resolver.createCube(ctx(db, {id: 'user-other'}), {puzzle: '333', name: 'Theirs'});
		await expect(resolver.setMainCube(ctx(db), '333', new Date(), theirs.id)).rejects.toMatchObject({
			extensions: expect.objectContaining({i18nKey: 'cube_errors.not_found'}),
		});
	});

	it('null removes the main', async () => {
		const db = makeDb();
		await resolver.createCube(ctx(db), {puzzle: '333', name: 'A'});
		const result = await resolver.setMainCube(ctx(db), '333', new Date(Date.now() + 1000), null);
		expect(result.cube_id).toBeNull();
		expect(db.mains).toHaveLength(0);
	});
});

describe('archive and delete', () => {
	it('archiving a main cube leaves the puzzle without a main', async () => {
		const db = makeDb();
		const a = await resolver.createCube(ctx(db), {puzzle: '333', name: 'A'});
		await resolver.setCubeArchived(ctx(db), a.id, true);
		expect(db.mains).toHaveLength(0);
		expect(db.cubes[0].archived_at).toBeInstanceOf(Date);
	});

	it('deleting unlinks its solves and removes the smart device rows it came from', async () => {
		const db = makeDb();
		db.cubes.push({id: 'sd-1', user_id: ME, puzzle: '333', name: 'GAN', legacy_smart_device_ids: ['sd-1', 'sd-2']});
		db.smartDevices.push({id: 'sd-1', user_id: ME}, {id: 'sd-2', user_id: ME}, {id: 'sd-3', user_id: 'user-other'});
		db.solves.push({id: 's-1', user_id: ME, cube_id: 'sd-1'});

		expect(await resolver.deleteCube(ctx(db), 'sd-1')).toBe(true);
		expect(db.cubes).toHaveLength(0);
		expect(db.solves[0].cube_id).toBeNull();
		expect(db.smartDevices.map((d) => d.id)).toEqual(['sd-3']);
	});
});

describe('saveCubeCalibration', () => {
	function input(cubeId: string, measuredAt: Date) {
		const raw = {peak: 900, rest: 480, noise: 1};
		const t = deriveThresholds(raw, 'android');
		return {
			cube_id: cubeId,
			platform: 'android',
			device_model: 'samsung SM-F956B',
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
			measured_at: measuredAt,
		};
	}

	const OLD_ENV = process.env.PRO_ENABLED;
	beforeAll(() => {
		process.env.PRO_ENABLED = 'true';
	});
	afterAll(() => {
		process.env.PRO_ENABLED = OLD_ENV;
	});

	it('is Pro, Premium or admin only', () => {
		expect(canCalibrate({id: ME, is_pro: true})).toBe(true);
		expect(canCalibrate({id: ME, is_pro: false, is_premium: true})).toBe(true);
		expect(canCalibrate({id: ME, is_pro: false, admin: true})).toBe(true);
		expect(canCalibrate({id: ME, is_pro: false})).toBe(false);
	});

	it('refuses a Basic account', async () => {
		const db = makeDb();
		const cube = await resolver.createCube(ctx(db), {puzzle: '333', name: 'A'});
		await expect(resolver.saveCubeCalibration(ctx(db, {id: ME, is_pro: false}), input(cube.id, new Date()))).rejects.toMatchObject({
			extensions: expect.objectContaining({i18nKey: 'cube_errors.pro_required'}),
		});
	});

	it('stores a measurement and lets only a newer one replace it', async () => {
		const db = makeDb();
		const cube = await resolver.createCube(ctx(db), {puzzle: '333', name: 'A'});
		const t1 = new Date(Date.now() - 60_000);
		await resolver.saveCubeCalibration(ctx(db), input(cube.id, t1));
		const older = {...input(cube.id, new Date(Date.now() - 120_000)), peak_ut: 1000};
		const kept = await resolver.saveCubeCalibration(ctx(db), older);

		expect(db.calibrations).toHaveLength(1);
		expect(kept.peak_ut).toBe(900);
		expect(db.calibrations[0].measured_at).toEqual(t1);
	});

	it('refuses a forged threshold with the reason', async () => {
		const db = makeDb();
		const cube = await resolver.createCube(ctx(db), {puzzle: '333', name: 'A'});
		await expect(
			resolver.saveCubeCalibration(ctx(db), {...input(cube.id, new Date()), near_min_ut: 20})
		).rejects.toMatchObject({extensions: expect.objectContaining({i18nKey: 'cube_errors.calibration_invalid', reason: 'thresholds'})});
	});

	it("cannot write onto someone else's cube", async () => {
		const db = makeDb();
		const theirs = await resolver.createCube(ctx(db, {id: 'user-other'}), {puzzle: '333', name: 'Theirs'});
		await expect(resolver.saveCubeCalibration(ctx(db), input(theirs.id, new Date()))).rejects.toMatchObject({
			extensions: expect.objectContaining({i18nKey: 'cube_errors.not_found'}),
		});
	});
});
