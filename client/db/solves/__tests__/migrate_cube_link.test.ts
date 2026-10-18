/**
 * Local backfill of solve.cube_id (design 4.5): the same link the migration SQL makes on the
 * server, for rows a device already holds.
 */

import Loki from 'lokijs';

const db = new Loki('migrate_cube_link.test.db');
const solves = db.addCollection<any>('solves');

jest.mock('../init', () => ({ getSolveDb: () => solves }));
jest.mock('../../persist', () => ({ requestPersist: jest.fn(() => Promise.resolve()) }));
jest.mock('../../../util/event_handler', () => ({ emitEvent: jest.fn() }));
jest.mock('../../../lib/cubes/store', () => ({ getCubeState: jest.fn() }));

import { cubeLinkSignature, linkLocalSolvesToCubes, unlinkLocalSolvesFromCube } from '../migrate_cube_link';
import { LocalCube } from '../../../lib/cubes/active_cube';

function cube(id: string, extra: Partial<LocalCube> = {}): LocalCube {
	return {
		id,
		puzzle: '333',
		name: id,
		brand: 'GAN',
		is_smart: true,
		ble_device_id: null,
		ble_name: null,
		legacy_smart_device_ids: [id],
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

const cubeOf = (id: string) => solves.findOne({ id })?.cube_id ?? null;

beforeEach(() => {
	solves.clear();
});

describe('linkLocalSolvesToCubes', () => {
	const cubes = [cube('dev1', { legacy_smart_device_ids: ['dev1', 'dev1-dup'] }), cube('dev2')];

	it('links 3x3 smart solves through the cube id and its legacy ids', () => {
		solves.insert({ id: 's1', smart_device_id: 'dev1', cube_type: 'wca', scramble_subset: '333' });
		solves.insert({ id: 's2', smart_device_id: 'dev1-dup', cube_type: '333cfop', scramble_subset: 'pll' });
		solves.insert({ id: 's3', smart_device_id: 'dev2', cube_type: '333', scramble_subset: null });

		expect(linkLocalSolvesToCubes(cubes)).toBe(3);
		expect(cubeOf('s1')).toBe('dev1');
		expect(cubeOf('s2')).toBe('dev1');
		expect(cubeOf('s3')).toBe('dev2');
	});

	it('leaves other puzzles, trainer solves, unknown devices and linked rows alone', () => {
		solves.insert({ id: 'p', smart_device_id: 'dev1', cube_type: 'wca', scramble_subset: '222' });
		solves.insert({ id: 't', smart_device_id: 'dev1', cube_type: 'wca', scramble_subset: '333', trainer_name: 'PLL' });
		solves.insert({ id: 'u', smart_device_id: 'someone-else', cube_type: 'wca', scramble_subset: '333' });
		solves.insert({ id: 'l', smart_device_id: 'dev1', cube_type: 'wca', scramble_subset: '333', cube_id: 'chosen' });
		solves.insert({ id: 'n', cube_type: 'wca', scramble_subset: '333' });

		expect(linkLocalSolvesToCubes(cubes)).toBe(0);
		expect(cubeOf('p')).toBeNull();
		expect(cubeOf('t')).toBeNull();
		expect(cubeOf('u')).toBeNull();
		expect(cubeOf('l')).toBe('chosen');
		expect(cubeOf('n')).toBeNull();
	});

	it('is idempotent', () => {
		solves.insert({ id: 's1', smart_device_id: 'dev1', cube_type: 'wca', scramble_subset: '333' });
		expect(linkLocalSolvesToCubes(cubes)).toBe(1);
		expect(linkLocalSolvesToCubes(cubes)).toBe(0);
	});

	it('does nothing without smart cubes', () => {
		solves.insert({ id: 's1', smart_device_id: 'dev1', cube_type: 'wca', scramble_subset: '333' });
		expect(linkLocalSolvesToCubes([cube('plain', { is_smart: false, legacy_smart_device_ids: [] })])).toBe(0);
	});
});

describe('unlinkLocalSolvesFromCube', () => {
	it('clears the link of a deleted cube only', () => {
		solves.insert({ id: 'a', cube_id: 'gone' });
		solves.insert({ id: 'b', cube_id: 'kept' });
		expect(unlinkLocalSolvesFromCube('gone')).toBe(1);
		expect(cubeOf('a')).toBeNull();
		expect(cubeOf('b')).toBe('kept');
	});
});

describe('cubeLinkSignature', () => {
	it('changes when the mapping changes and not when cube order does', () => {
		const a = cube('dev1');
		const b = cube('dev2');
		expect(cubeLinkSignature([a, b])).toBe(cubeLinkSignature([b, a]));
		expect(cubeLinkSignature([a])).not.toBe(cubeLinkSignature([a, b]));
		expect(cubeLinkSignature([cube('dev1', { legacy_smart_device_ids: ['dev1', 'x'] })])).not.toBe(cubeLinkSignature([a]));
	});
});
