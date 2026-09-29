/**
 * The FTO "Random State" card counted 7 solves while its stats page and the solves list
 * found none: the picker names a default subset '' and every solve filter now stores and
 * queries it as null, so a row that still holds '' would drop out of its own bucket.
 */

import Loki from 'lokijs';

const db = new Loki('migrate_wca_subset.test.db');
const solves = db.addCollection<any>('solves');

jest.mock('../init', () => ({getSolveDb: () => solves}));
jest.mock('../../settings/query', () => ({getSetting: jest.fn()}));
jest.mock('../../settings/update', () => ({setCubeType: jest.fn(), setScrambleSubset: jest.fn()}));

import {migrateLokiSolvesToWcaSubset} from '../migrate_wca_subset';

function bucketOf(id: string) {
	const row = solves.findOne({id});
	return {cube_type: row.cube_type, scramble_subset: row.scramble_subset};
}

beforeEach(() => {
	solves.clear();
});

describe('migrateLokiSolvesToWcaSubset, empty subset phase', () => {
	it('stores a non-WCA default subset as null', () => {
		solves.insert({id: 'fto', cube_type: 'fto', scramble_subset: ''});
		solves.insert({id: 'yau', cube_type: '444yau', scramble_subset: ''});

		migrateLokiSolvesToWcaSubset();

		expect(bucketOf('fto')).toEqual({cube_type: 'fto', scramble_subset: null});
		expect(bucketOf('yau')).toEqual({cube_type: '444yau', scramble_subset: null});
	});

	it('moves a legacy WCA-event row to its wca bucket in the same pass', () => {
		solves.insert({id: 'legacy', cube_type: '777', scramble_subset: ''});

		migrateLokiSolvesToWcaSubset();

		expect(bucketOf('legacy')).toEqual({cube_type: 'wca', scramble_subset: '777'});
	});

	it('gives a wca row its required subset instead of null', () => {
		solves.insert({id: 'wca', cube_type: 'wca', scramble_subset: ''});

		migrateLokiSolvesToWcaSubset();

		expect(bucketOf('wca')).toEqual({cube_type: 'wca', scramble_subset: '333'});
	});

	it('leaves real subsets and null alone and is idempotent', () => {
		solves.insert({id: 'move', cube_type: 'fto', scramble_subset: 'fto'});
		solves.insert({id: 'null', cube_type: 'fto', scramble_subset: null});

		expect(migrateLokiSolvesToWcaSubset()).toBe(0);
		expect(bucketOf('move')).toEqual({cube_type: 'fto', scramble_subset: 'fto'});
		expect(bucketOf('null')).toEqual({cube_type: 'fto', scramble_subset: null});
	});
});
