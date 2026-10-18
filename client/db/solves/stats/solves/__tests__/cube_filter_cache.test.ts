/**
 * Stat caches under the Cube filter (design magnet-cubes 8.3).
 *
 * The Stats page caches PBs and averages keyed by the whole filter object, and invalidation
 * matches cache entries on cube_type / scramble_subset / session_id. A filter that also carries
 * cube_id has to be cleared by the same paths:
 *   (a) a new solve made with the cube drops that cube's filtered PB / average caches;
 *   (b) moving a solve to another cube on the solve card drops both cubes' filtered caches.
 */

import Loki from 'lokijs';

const db = new Loki('cube_filter_cache.test.db');
const solves = db.addCollection<any>('solves', { unique: ['id'], indices: ['cube_type', 'cube_id'] });
const cache = db.addCollection<any>('solve_cache');

jest.mock('../../../init', () => ({ getSolveDb: () => solves, getSolveCacheDb: () => cache }));
jest.mock('../../../../../util/cubes/util', () => ({ getCubeTypeInfoById: jest.fn() }));
jest.mock('../../../../../util/event_handler', () => ({ emitEvent: jest.fn() }));
jest.mock('../../../../../components/api', () => ({ gqlMutate: jest.fn() }));
jest.mock('../../../../../components/store', () => ({ getStore: () => null }));
jest.mock('../../../../../actions/general', () => ({ openModal: jest.fn() }));
jest.mock('../../../../../components/common/confirm_modal/ConfirmModal', () => () => null);
jest.mock('../../../../persist', () => ({ requestPersist: jest.fn(() => Promise.resolve()) }));
jest.mock('../../../../settings/query', () => ({ getSetting: jest.fn(() => false) }));
jest.mock('../../../../../components/timer/helpers/params', () => ({ setTimerParam: jest.fn() }));
jest.mock('../../../../../util/offline-queue', () => ({
	addToQueue: jest.fn(() => Promise.resolve(null)),
	releaseInFlight: jest.fn(),
	removeFromQueue: jest.fn(() => Promise.resolve()),
}));
jest.mock('../../../../../util/toast', () => ({ toastInfo: jest.fn() }));
jest.mock('../../../../../i18n/i18n', () => ({ __esModule: true, default: { t: (k: string) => k } }));
jest.mock('../../../solve-input', () => ({
	pickFields: jest.fn((v) => v),
	SOLVE_INPUT_FIELDS: [],
	toCreateSolveInput: jest.fn((v) => v),
	toSolveInput: jest.fn((v) => v),
}));
jest.mock('../../../apply-created', () => ({ applyCreatedSolve: jest.fn(), CREATED_SOLVE_SELECTION: 'id' }));
jest.mock('../../../../../util/offline-replay', () => ({
	classifyReplayError: jest.fn(),
	raceTimeout: jest.fn((p) => p),
	SaveTimeoutError: class extends Error {},
}));
jest.mock('../../../../../util/offline-sync', () => ({ requestQueueFlush: jest.fn() }));
jest.mock('../../../../../lib/sync-gate', () => ({ canWriteSync: () => false, canReadSync: () => false }));
jest.mock('../../../../../util/anon-mode', () => ({ syncAnonSolveCount: jest.fn() }));
jest.mock('../../../../../util/solve-tombstones', () => ({ addSolveTombstones: jest.fn() }));
jest.mock('../../../../../components/daily-goal/helpers/deleted-solves', () => ({ recordDeletedSolves: jest.fn() }));
jest.mock('../../../../lokijs', () => ({ stripLokiJsMetadata: (row: any) => row }));
jest.mock('../../../local-analysis', () => ({ scheduleLocalStepRows: jest.fn() }));

import { getSinglePB } from '../single/single_pb';
import { getCurrentAverage } from '../average/average';
import { getAveragePB } from '../average/average_pb';
import { fetchSolveCache, SolveCacheKey } from '../caching';
import { createSolveDb, updateSolveDb } from '../../../update';

let clock = 1_000;

function solve(id: string, time: number, cubeId: string | null, extra: Record<string, any> = {}) {
	clock += 1_000;
	return {
		id,
		time,
		raw_time: time,
		dnf: false,
		plus_two: false,
		from_timer: true,
		// The canonical 3x3 bucket (sanitizeSolve moves a bare '333' here)
		cube_type: 'wca',
		scramble_subset: '333',
		session_id: 'sess',
		cube_id: cubeId,
		started_at: clock,
		ended_at: clock + 500,
		...extra,
	};
}

/** The Stats page's filter for the 3x3 bucket narrowed to one cube. */
function cubeFilter(cubeId: string) {
	return { from_timer: true, cube_type: 'wca', scramble_subset: '333', cube_id: cubeId };
}

function cached(type: SolveCacheKey['type'], cubeId: string, averageCount?: number) {
	const key: SolveCacheKey = { type, filterOptions: cubeFilter(cubeId) };
	if (averageCount !== undefined) key.averageCount = averageCount;
	return fetchSolveCache(key);
}

beforeEach(() => {
	solves.clear();
	cache.clear();
	clock = 1_000;
	// Cube A: 10, 11, 12. Cube B: 20, 21, 22. One cubeless solve: 5 (must never leak in).
	for (const row of [
		solve('a1', 10, 'A'),
		solve('a2', 11, 'A'),
		solve('a3', 12, 'A'),
		solve('b1', 20, 'B'),
		solve('b2', 21, 'B'),
		solve('b3', 22, 'B'),
		solve('none', 5, null),
	]) {
		solves.insert(row);
	}
});

describe('cube-filtered stats read only that cube', () => {
	it('computes PB and averages from the cube solves alone', () => {
		expect(getSinglePB(cubeFilter('A')).time).toBe(10);
		expect(getSinglePB(cubeFilter('B')).time).toBe(20);
		expect(getCurrentAverage(cubeFilter('B'), 3).time).toBe(21);
	});
});

describe('(a) a new solve with the cube clears its filtered caches', () => {
	it('drops the single PB and refreshes the average PB and current average of that cube', async () => {
		getSinglePB(cubeFilter('A'));
		getAveragePB(cubeFilter('A'), 3);
		getCurrentAverage(cubeFilter('A'), 3);
		expect(cached('single_pb', 'A')).not.toBeNull();
		expect(cached('avg_pb', 'A', 3)).not.toBeNull();
		expect(cached('avg_current', 'A', 3)).not.toBeNull();

		await createSolveDb(solve('a4', 8, 'A') as any);

		expect(cached('single_pb', 'A')).toBeNull();
		// Carried over the appended solve rather than dropped (average_cache.ts), and already
		// holding the new window: 11, 12, 8 beats 10, 11, 12.
		expect(cached('avg_pb', 'A', 3)?.time).toBeCloseTo((11 + 12 + 8) / 3, 2);
		expect(cached('avg_pb', 'A', 3)?.solveIds.has('a4')).toBe(true);
		// The PB check re-reads the current average to compare, so it is cached again, fresh
		expect(cached('avg_current', 'A', 3)?.solveIds.has('a4')).toBe(true);
		expect(getSinglePB(cubeFilter('A')).time).toBe(8);
		// Last three of A: 11, 12, 8
		expect(getCurrentAverage(cubeFilter('A'), 3).time).toBeCloseTo((11 + 12 + 8) / 3, 2);
	});

	it('leaves another cube PB as it was', async () => {
		getSinglePB(cubeFilter('B'));

		await createSolveDb(solve('a4', 8, 'A') as any);

		expect(getSinglePB(cubeFilter('B')).time).toBe(20);
	});
});

describe('(b) moving a solve to another cube clears both cubes', () => {
	it('recomputes the PB and current average of the old and the new cube', async () => {
		getSinglePB(cubeFilter('A'));
		getSinglePB(cubeFilter('B'));
		getCurrentAverage(cubeFilter('A'), 3);
		getCurrentAverage(cubeFilter('B'), 3);

		// a1 (10) was made with B after all
		const stored = solves.findOne({ id: 'a1' });
		await updateSolveDb(stored, { cube_id: 'B' });

		expect(getSinglePB(cubeFilter('A')).time).toBe(11);
		expect(getSinglePB(cubeFilter('B')).time).toBe(10);
		// A has two solves left: no average of 3
		expect(getCurrentAverage(cubeFilter('A'), 3)).toBeNull();
		// Every solve of B, the moved one included
		expect(getCurrentAverage(cubeFilter('B'), -1).time).toBeCloseTo((20 + 21 + 22 + 10) / 4, 2);
	});

	it('does nothing extra when the cube did not change', async () => {
		getSinglePB(cubeFilter('B'));
		const stored = solves.findOne({ id: 'a2' });
		await updateSolveDb(stored, { cube_id: 'A' });
		expect(cached('single_pb', 'B')).not.toBeNull();
	});
});
