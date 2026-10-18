import {
	activeCubeFor,
	AUTO_MAIN_SET_AT_MS,
	calibrationFor,
	CubeState,
	cubesForPuzzle,
	legacySmartDeviceMap,
	LocalCube,
	mainCubeFor,
	mergeMains,
	normalizeCube,
	PendingCalibration,
	prunePendingCalibrations,
} from '../active_cube';

function cube(id: string, puzzle: string, extra: Partial<LocalCube> = {}): LocalCube {
	return {
		id,
		puzzle,
		name: id,
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

function state(cubes: LocalCube[], mains: CubeState['mains'] = {}, pendingCalibrations: PendingCalibration[] = []): CubeState {
	return { cubes, mains, pendingCalibrations };
}

function pendingCal(cubeId: string, measuredAt: number, extra: Partial<PendingCalibration> = {}): PendingCalibration {
	return {
		cube_id: cubeId,
		platform: 'ios',
		device_model: 'Apple iPhone16,1',
		os_version: null,
		app_version: null,
		sensor_name: null,
		peak_ut: 900,
		rest_ut: 480,
		noise_ut: 1,
		near_min_ut: 150,
		far_max_ut: 80,
		quality: 'ok',
		sample_count: 300,
		sweep_ms: 4000,
		rate_hz: 100,
		algo_version: 1,
		measured_at: measuredAt,
		...extra,
	};
}

describe('mergeMains', () => {
	it('takes the server rows when nothing is pending', () => {
		const merged = mergeMains({}, [
			{ puzzle: '333', cube_id: 'a', set_at: '2026-10-01T10:00:00.000Z' },
			{ puzzle: '222', cube_id: 'b', set_at: '2026-10-02T10:00:00.000Z' },
		]);
		expect(merged).toEqual({
			'333': { cube_id: 'a', set_at: Date.parse('2026-10-01T10:00:00.000Z') },
			'222': { cube_id: 'b', set_at: Date.parse('2026-10-02T10:00:00.000Z') },
		});
	});

	it('keeps a pending local choice that is newer than the server row (made offline)', () => {
		const server = [{ puzzle: '333', cube_id: 'a', set_at: new Date(1000).toISOString() }];
		const merged = mergeMains({ '333': { cube_id: 'b', set_at: 2000, pending: true } }, server);
		expect(merged['333']).toEqual({ cube_id: 'b', set_at: 2000, pending: true });
	});

	it('lets a later choice from another device win over an older pending one', () => {
		const server = [{ puzzle: '333', cube_id: 'a', set_at: new Date(3000).toISOString() }];
		const merged = mergeMains({ '333': { cube_id: 'b', set_at: 2000, pending: true } }, server);
		expect(merged['333']).toEqual({ cube_id: 'a', set_at: 3000 });
	});

	it('drops a confirmed local entry the server no longer has (archived or deleted main)', () => {
		const merged = mergeMains({ '333': { cube_id: 'a', set_at: 1000 } }, []);
		expect(merged['333']).toBeUndefined();
	});

	it('keeps a pending "no cube" choice when the server has no row', () => {
		const merged = mergeMains({ '444': { cube_id: null, set_at: 5000, pending: true } }, []);
		expect(merged['444']).toEqual({ cube_id: null, set_at: 5000, pending: true });
	});

	it('skips rows without a puzzle and reads a missing set_at as the automatic time', () => {
		const merged = mergeMains({}, [null, { puzzle: null, cube_id: 'x' }, { puzzle: '555', cube_id: 'c' }]);
		expect(merged).toEqual({ '555': { cube_id: 'c', set_at: AUTO_MAIN_SET_AT_MS } });
	});
});

describe('activeCubeFor', () => {
	const gan = cube('gan', '333');
	const yj = cube('yj', '222');
	const s = state([gan, yj], { '333': { cube_id: 'gan', set_at: 1 }, '222': { cube_id: 'yj', set_at: 1 } });

	it('maps every bucket of a puzzle to its main (K-3: subsets and methods included)', () => {
		expect(activeCubeFor({ cube_type: 'wca', scramble_subset: '333' }, s)?.id).toBe('gan');
		expect(activeCubeFor({ cube_type: '333cfop', scramble_subset: 'pll' }, s)?.id).toBe('gan');
		expect(activeCubeFor({ cube_type: '333roux', scramble_subset: null }, s)?.id).toBe('gan');
		expect(activeCubeFor({ cube_type: 'wca', scramble_subset: '333oh' }, s)?.id).toBe('gan');
		expect(activeCubeFor({ cube_type: 'wca', scramble_subset: '222' }, s)?.id).toBe('yj');
	});

	it('never offers a cube of another puzzle (S-3)', () => {
		expect(activeCubeFor({ cube_type: 'wca', scramble_subset: '777' }, s)).toBeNull();
		expect(activeCubeFor({ cube_type: '444yau', scramble_subset: null }, s)).toBeNull();
	});

	it('is null for buckets without a physical puzzle', () => {
		expect(activeCubeFor({ cube_type: 'other', scramble_subset: null }, s)).toBeNull();
		expect(activeCubeFor({ cube_type: 'wca', scramble_subset: null }, s)).toBeNull();
		expect(activeCubeFor(null, s)).toBeNull();
	});

	it('ignores a main that is archived, deleted, cleared or of the wrong puzzle', () => {
		expect(activeCubeFor({ cube_type: 'wca', scramble_subset: '333' }, state([cube('gan', '333', { archived_at: 5 })], { '333': { cube_id: 'gan', set_at: 1 } }))).toBeNull();
		expect(activeCubeFor({ cube_type: 'wca', scramble_subset: '333' }, state([], { '333': { cube_id: 'gan', set_at: 1 } }))).toBeNull();
		expect(activeCubeFor({ cube_type: 'wca', scramble_subset: '333' }, state([gan], { '333': { cube_id: null, set_at: 1 } }))).toBeNull();
		expect(activeCubeFor({ cube_type: 'wca', scramble_subset: '333' }, state([yj], { '333': { cube_id: 'yj', set_at: 1 } }))).toBeNull();
	});

	it('treats a custom cube type as its own puzzle', () => {
		const custom = cube('mine', 'custom-uuid');
		const s2 = state([custom], { 'custom-uuid': { cube_id: 'mine', set_at: 1 } });
		expect(activeCubeFor({ cube_type: 'custom-uuid', scramble_subset: null }, s2)?.id).toBe('mine');
	});
});

describe('cubesForPuzzle', () => {
	const cubes = [
		cube('b', '333', { name: 'MoYu RS3M', solve_count: 310, last_used_at: 3000 }),
		cube('a', '333', { name: 'GAN 12', solve_count: 1204, last_used_at: 5000 }),
		cube('c', '333', { name: 'GAN 13', solve_count: 0, last_used_at: null }),
		cube('d', '333', { name: 'Archived', solve_count: 50, last_used_at: 9000, archived_at: 10 }),
		cube('e', '222', { name: 'YJ', solve_count: 88, last_used_at: 8000 }),
		cube('f', '333', { name: 'Angstrom', solve_count: 5, last_used_at: 3000 }),
	];

	it('default: main first, then last used, then name; archived and other puzzles left out', () => {
		const s = state(cubes, { '333': { cube_id: 'c', set_at: 1 } });
		expect(cubesForPuzzle('333', s).map((c) => c.id)).toEqual(['c', 'a', 'f', 'b']);
	});

	it('default without a main is last used, then name', () => {
		expect(cubesForPuzzle('333', state(cubes)).map((c) => c.id)).toEqual(['a', 'f', 'b', 'c']);
	});

	it('solve_count and name sorts do not lift the main', () => {
		const s = state(cubes, { '333': { cube_id: 'c', set_at: 1 } });
		expect(cubesForPuzzle('333', s, 'solve_count').map((c) => c.id)).toEqual(['a', 'b', 'f', 'c']);
		expect(cubesForPuzzle('333', s, 'name').map((c) => c.id)).toEqual(['f', 'a', 'c', 'b']);
		expect(cubesForPuzzle('333', s, 'last_used').map((c) => c.id)).toEqual(['a', 'f', 'b', 'c']);
	});

	it('sorts names with numbers naturally', () => {
		const s = state([cube('x', '333', { name: 'Cube 10' }), cube('y', '333', { name: 'Cube 9' })]);
		expect(cubesForPuzzle('333', s, 'name').map((c) => c.name)).toEqual(['Cube 9', 'Cube 10']);
	});

	it('includes archived cubes on request', () => {
		expect(cubesForPuzzle('333', state(cubes), 'last_used', { includeArchived: true })[0].id).toBe('d');
	});

	it('does not reorder the stored list', () => {
		const s = state([...cubes]);
		cubesForPuzzle('333', s, 'name');
		expect(s.cubes.map((c) => c.id)).toEqual(cubes.map((c) => c.id));
	});

	it('is empty without a puzzle', () => {
		expect(cubesForPuzzle(null, state(cubes))).toEqual([]);
	});
});

describe('mainCubeFor', () => {
	it('returns the main cube of a puzzle', () => {
		expect(mainCubeFor('333', state([cube('a', '333')], { '333': { cube_id: 'a', set_at: 1 } }))?.id).toBe('a');
		expect(mainCubeFor('222', state([cube('a', '333')], { '333': { cube_id: 'a', set_at: 1 } }))).toBeNull();
	});
});

describe('legacySmartDeviceMap', () => {
	it('maps the cube id and every legacy smart device id of smart cubes', () => {
		const map = legacySmartDeviceMap([
			cube('dev1', '333', { is_smart: true, legacy_smart_device_ids: ['dev1', 'dev1-dup'] }),
			cube('new-smart', '333', { is_smart: true }),
			cube('plain', '333'),
		]);
		expect(map.get('dev1')?.id).toBe('dev1');
		expect(map.get('dev1-dup')?.id).toBe('dev1');
		expect(map.get('new-smart')?.id).toBe('new-smart');
		expect(map.has('plain')).toBe(false);
	});
});

describe('calibrationFor and pending measurements', () => {
	const stored = {
		...pendingCal('a', 1000),
		id: 'row-1',
	};

	it('uses a newer pending measurement at once', () => {
		const s = state([cube('a', '333', { calibrations: [stored] })], {}, [pendingCal('a', 2000, { rest_ut: 300 })]);
		const found = calibrationFor(s, 'a', 'ios', 'Apple iPhone16,1');
		expect(found?.pending).toBe(true);
		expect(found?.rest_ut).toBe(300);
		expect(found?.id).toBeNull();
	});

	it('prefers the stored row when it is newer, and matches the phone model exactly', () => {
		const s = state([cube('a', '333', { calibrations: [{ ...stored, measured_at: 3000 }] })], {}, [pendingCal('a', 2000)]);
		expect(calibrationFor(s, 'a', 'ios', 'Apple iPhone16,1')?.id).toBe('row-1');
		expect(calibrationFor(s, 'a', 'ios', 'Apple iPhone15,2')).toBeNull();
		expect(calibrationFor(s, 'a', 'android', 'Apple iPhone16,1')).toBeNull();
		expect(calibrationFor(s, null, 'ios', 'Apple iPhone16,1')).toBeNull();
	});

	it('prunes pending measurements the server caught up with or whose cube is gone', () => {
		const cubes = [cube('a', '333', { calibrations: [{ ...stored, measured_at: 3000 }] }), cube('b', '222')];
		const kept = prunePendingCalibrations([pendingCal('a', 2000), pendingCal('a', 4000), pendingCal('b', 1), pendingCal('gone', 1)], cubes);
		expect(kept.map((c) => `${c.cube_id}:${c.measured_at}`)).toEqual(['a:4000', 'b:1']);
	});
});

describe('normalizeCube', () => {
	it('turns GraphQL dates into epoch ms and drops null calibrations', () => {
		const cubeRow = normalizeCube({
			__typename: 'Cube',
			id: 'a',
			puzzle: '333',
			name: 'GAN',
			is_smart: null,
			archived_at: null,
			last_used_at: '2026-10-05T12:00:00.000Z',
			legacy_smart_device_ids: ['x', null, ''],
			calibrations: [null, { cube_id: 'a', platform: 'ios', device_model: 'm', measured_at: '2026-10-01T00:00:00.000Z', peak_ut: 1 }],
		});
		expect(cubeRow?.last_used_at).toBe(Date.parse('2026-10-05T12:00:00.000Z'));
		expect(cubeRow?.is_smart).toBe(false);
		expect(cubeRow?.legacy_smart_device_ids).toEqual(['x']);
		expect(cubeRow?.calibrations).toHaveLength(1);
		expect(cubeRow?.calibrations[0].measured_at).toBe(Date.parse('2026-10-01T00:00:00.000Z'));
	});

	it('rejects rows without id or puzzle', () => {
		expect(normalizeCube({ id: 'a' })).toBeNull();
		expect(normalizeCube(null)).toBeNull();
	});
});
