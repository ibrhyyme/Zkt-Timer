/**
 * The timer's view bucket has to be the bucket its solves are written to. sanitizeSolve files
 * a WCA event's default bucket under wca::<event>; a view still on the standalone duplicate
 * (2x2 > WCA Standard, picked from the menu or with Alt+2) used to show none of its own solves.
 */

jest.mock('../init', () => ({ getSolveDb: () => null }));
jest.mock('../../lokijs', () => ({}));
jest.mock('../../../util/cubes/util', () => ({ getCubeTypeInfoById: () => null }));

import { buildBucketFilter } from '../query';
import { sanitizeSolve } from '../../../../shared/solve';

const S = 'session-1';

describe('buildBucketFilter', () => {
	it.each(['222', '444', '555', '666', '777', 'pyram', 'skewb', 'sq1', 'clock', 'minx'])(
		'reads %s with its default subset from the canonical WCA bucket',
		(event) => {
			for (const subset of ['', null, undefined, event]) {
				expect(buildBucketFilter({ session_id: S, cube_type: event, scramble_subset: subset })).toEqual({
					session_id: S,
					cube_type: 'wca',
					scramble_subset: event,
				});
			}
		}
	);

	it('is where a solve made from that selection is written', () => {
		const saved = sanitizeSolve({ cube_type: '222', scramble_subset: null } as any);
		const filter = buildBucketFilter({ session_id: S, cube_type: '222', scramble_subset: '' });
		expect({ cube_type: saved.cube_type, scramble_subset: saved.scramble_subset }).toEqual({
			cube_type: filter.cube_type,
			scramble_subset: filter.scramble_subset,
		});
	});

	it('keeps real subsets of a standalone type where they are', () => {
		expect(buildBucketFilter({ session_id: S, cube_type: '222', scramble_subset: '222eg' })).toEqual({
			session_id: S,
			cube_type: '222',
			scramble_subset: '222eg',
		});
		expect(buildBucketFilter({ session_id: S, cube_type: '333', scramble_subset: '333o' })).toEqual({
			session_id: S,
			cube_type: '333',
			scramble_subset: '333o',
		});
	});

	it('leaves WCA buckets and subset-less practice types as they were', () => {
		expect(buildBucketFilter({ session_id: S, cube_type: 'wca', scramble_subset: '222' })).toEqual({
			session_id: S,
			cube_type: 'wca',
			scramble_subset: '222',
		});
		expect(buildBucketFilter({ session_id: S, cube_type: '444yau', scramble_subset: null })).toEqual({
			session_id: S,
			cube_type: '444yau',
		});
	});
});
