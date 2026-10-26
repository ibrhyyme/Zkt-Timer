/**
 * Best and worst averages carried over a new solve (average_cache.ts carryOverAppended).
 *
 * A solve that lands on the newest end of its list keeps the cached best / worst average
 * instead of dropping it, so the stats module does not slide a window over the whole
 * history after every solve. The carried value must equal what a full pass over the new
 * list gives, and anything that is not such an append must still drop the entry.
 */

import Loki from 'lokijs';

const db = new Loki('average_carry_over.test.db');
const solves = db.addCollection<any>('solves', { unique: ['id'], indices: ['cube_type', 'session_id'] });
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

import { getAverage } from '../average/average';
import { getAveragePB } from '../average/average_pb';
import { getAverageWorst } from '../average/average_worst';
import { fetchSolveCache, SolveCacheKey } from '../caching';
import { createSolveDb, updateSolveDb } from '../../../update';
import { fetchSolves, FilterSolvesOptions } from '../../../query';
import { getNumberToDecimalPoints } from '../../../../../util/time';

const BUCKET: FilterSolvesOptions = { cube_type: 'wca', scramble_subset: '333' };
const SESSION: FilterSolvesOptions = { cube_type: 'wca', session_id: 'sess' };
const COUNTS = [5, 12, 25];

let clock = 1_000;
let seed = 11;
const rnd = () => {
	seed = (seed * 16807) % 2147483647;
	return seed / 2147483647;
};

function solve(id: string, time: number, extra: Record<string, any> = {}) {
	clock += 1_000;
	return {
		id,
		time,
		raw_time: time < 0 ? 9 : time,
		dnf: time < 0,
		plus_two: false,
		from_timer: true,
		cube_type: 'wca',
		scramble_subset: '333',
		session_id: 'sess',
		cube_id: null,
		started_at: clock,
		ended_at: clock + 500,
		...extra,
	};
}

// A few repeated values on purpose, so equal averages (ties) happen; about 5% DNF.
function randomTime(): number {
	if (rnd() < 0.05) return -1;
	return [8.5, 9, 9.25, 10, 11.5][Math.floor(rnd() * 5)] + (rnd() < 0.5 ? 0 : Math.round(rnd() * 400) / 100);
}

// The cache keeps three decimals the way the app writes them (truncated, util/time.ts).
const round3 = (n: number) => getNumberToDecimalPoints(n, 3);

/** The full pass, written out independently: newest first, the newest window wins a tie. */
function bruteForce(filter: FilterSolvesOptions, count: number, better: (a: number, b: number) => boolean, mean = false) {
	const list = fetchSolves(filter);
	if (list.length < count) return null;
	let best: { time: number; ids: string[] } | null = null;
	for (let i = 0; i + count <= list.length; i++) {
		const window = list.slice(i, i + count);
		const avg = getAverage(window.slice(), false, mean);
		if (avg <= 0) continue;
		if (!best || better(avg, best.time)) best = { time: avg, ids: window.map((s: any) => s.id) };
	}
	return best;
}

const key = (
	type: 'avg_pb' | 'avg_worst',
	filterOptions: FilterSolvesOptions,
	averageCount: number,
	mean = false
): SolveCacheKey => ({
	type,
	filterOptions,
	averageCount,
	...(mean ? { mean: true as const } : {}),
});

// Every count as an average and as a mean of N (mo3 rides the same cache, keyed apart).
const VARIANTS: [number, boolean][] = [...COUNTS.map((n) => [n, false] as [number, boolean]), [3, true], [5, true], [12, true]];

function prime() {
	for (const filter of [BUCKET, SESSION]) {
		for (const [n, mean] of VARIANTS) {
			getAveragePB(filter, n, mean);
			getAverageWorst(filter, n, mean);
		}
	}
}

function expectMatchesFullPass() {
	for (const filter of [BUCKET, SESSION]) {
		for (const [n, mean] of VARIANTS) {
			for (const [type, better] of [
				['avg_pb', (a: number, b: number) => a < b],
				['avg_worst', (a: number, b: number) => a > b],
			] as const) {
				const expected = bruteForce(filter, n, better, mean);
				const cached = fetchSolveCache(key(type, filter, n, mean));
				if (!expected) {
					expect(cached).toBeNull();
					continue;
				}
				expect(cached).not.toBeNull();
				expect(cached.time).toBe(round3(expected.time));
				const ids = cached.solves.map((s: any) => s.id);
				// Two windows can differ only past the third decimal, which the cache rounds
				// away; then either window is a correct answer.
				if (JSON.stringify(ids) !== JSON.stringify(expected.ids)) {
					expect(round3(getAverage(cached.solves.slice(), false, mean))).toBe(round3(expected.time));
				}
			}
		}
	}
}

beforeEach(() => {
	solves.clear();
	cache.clear();
	clock = 1_000;
	seed = 11;
});

describe('best and worst averages over new solves', () => {
	it('carries the cached values over every appended solve, matching a full pass', async () => {
		for (let i = 0; i < 40; i++) solves.insert(solve(`seed-${i}`, randomTime()));
		prime();

		for (let i = 0; i < 160; i++) {
			await createSolveDb(solve(`new-${i}`, randomTime()) as any);
			// Not dropped: the entry is still there without a new full pass.
			expect(fetchSolveCache(key('avg_pb', BUCKET, 12))).not.toBeNull();
			expectMatchesFullPass();
		}
	});

	it('takes the new window when it ties the cached best, like the full pass', async () => {
		for (let i = 0; i < 10; i++) solves.insert(solve(`seed-${i}`, 10));
		prime();
		await createSolveDb(solve('tie', 10) as any);

		const best = fetchSolveCache(key('avg_pb', BUCKET, 5));
		expect(best.solves[0].id).toBe('tie');
		expectMatchesFullPass();
	});

	it('drops the cache for a solve that is not the newest of its list', async () => {
		for (let i = 0; i < 20; i++) solves.insert(solve(`seed-${i}`, 10 + i / 10));
		prime();

		// An older solve arriving now (an import, a solve synced from another device).
		await createSolveDb(solve('old', 5, { started_at: 10, ended_at: 20 }) as any);

		expect(fetchSolveCache(key('avg_pb', BUCKET, 5))).toBeNull();
		expect(fetchSolveCache(key('avg_worst', BUCKET, 5))).toBeNull();
		prime();
		expectMatchesFullPass();
	});

	it('keeps an average and a mean of the same count apart', async () => {
		for (let i = 0; i < 12; i++) solves.insert(solve(`seed-${i}`, i === 3 ? 20 : 10 + i / 10));
		prime();

		// The 20 is trimmed from an ao5 but counts in a mo5, so the worst windows differ.
		const ao5 = fetchSolveCache(key('avg_worst', BUCKET, 5));
		const mo5 = fetchSolveCache(key('avg_worst', BUCKET, 5, true));
		expect(mo5.time).toBeGreaterThan(ao5.time);
		expectMatchesFullPass();
	});

	it('drops the cache when a solve changes instead of being added', async () => {
		for (let i = 0; i < 20; i++) solves.insert(solve(`seed-${i}`, 10 + i / 10));
		prime();

		const target = solves.findOne({ id: 'seed-19' });
		await updateSolveDb(target, { plus_two: true, time: target.raw_time + 2 });

		expect(fetchSolveCache(key('avg_pb', BUCKET, 5))).toBeNull();
		prime();
		expectMatchesFullPass();
	});
});
