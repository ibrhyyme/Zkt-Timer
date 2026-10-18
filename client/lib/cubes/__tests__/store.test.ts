/**
 * Store rules that are not pure functions: per-account local copy, main choices across the
 * request round trip, the server's main rules mirrored after a cube mutation.
 */

const storage = new Map<string, string>();
let me: { id: string } | null = { id: 'u1' };

(global as any).window = {
	localStorage: {
		getItem: (key: string) => (storage.has(key) ? storage.get(key) : null),
		setItem: (key: string, value: string) => storage.set(key, String(value)),
		removeItem: (key: string) => storage.delete(key),
	},
};

jest.mock('../../../components/store', () => ({
	getStore: () => ({ getState: () => ({ account: { me } }) }),
}));
jest.mock('../../../util/event_handler', () => ({ emitEvent: jest.fn() }));

import {
	addPendingCalibration,
	applyServerCubeState,
	dropPendingMain,
	getCubeState,
	removeCube,
	resetCubeStore,
	resolveCalibrationSent,
	resolveMainSent,
	setMainLocal,
	upsertCube,
} from '../store';
import { AUTO_MAIN_SET_AT_MS, calibrationFor, PendingCalibration } from '../active_cube';

const cubeRow = (id: string, puzzle = '333', extra: Record<string, any> = {}) => ({ id, puzzle, name: id, calibrations: [], ...extra });

function pending(measuredAt: number): PendingCalibration {
	return {
		cube_id: 'a',
		platform: 'android',
		device_model: 'samsung SM-F956B',
		os_version: null,
		app_version: null,
		sensor_name: null,
		peak_ut: 900,
		rest_ut: 500,
		noise_ut: 4,
		near_min_ut: 150,
		far_max_ut: 80,
		quality: 'ok',
		sample_count: 300,
		sweep_ms: 4000,
		rate_hz: 100,
		algo_version: 1,
		measured_at: measuredAt,
	};
}

beforeEach(() => {
	storage.clear();
	me = { id: 'u1' };
	resetCubeStore();
});

describe('cube store', () => {
	it('is empty for visitors and keeps each account apart', () => {
		me = null;
		expect(getCubeState().userId).toBeNull();
		expect(setMainLocal('333', 'a')).toBeNull();

		me = { id: 'u1' };
		applyServerCubeState('u1', [cubeRow('a')], [{ puzzle: '333', cube_id: 'a', set_at: '2026-10-01T00:00:00Z' }]);
		expect(getCubeState().cubes).toHaveLength(1);

		me = { id: 'u2' };
		expect(getCubeState().userId).toBe('u2');
		expect(getCubeState().cubes).toHaveLength(0);

		// Back to the first account: read from its local copy.
		me = { id: 'u1' };
		const back = getCubeState();
		expect(back.cubes.map((c) => c.id)).toEqual(['a']);
		expect(back.mains['333'].cube_id).toBe('a');
		expect(back.fetchedAt).not.toBeNull();
	});

	it('ignores a server read that arrives after the account changed', () => {
		getCubeState();
		me = { id: 'u2' };
		applyServerCubeState('u1', [cubeRow('a')], []);
		expect(getCubeState().cubes).toHaveLength(0);
	});

	it('keeps an offline main choice across a server read and confirms it after the send', () => {
		applyServerCubeState('u1', [cubeRow('a'), cubeRow('b')], [{ puzzle: '333', cube_id: 'a', set_at: new Date(1000).toISOString() }]);
		const entry = setMainLocal('333', 'b', 5000);
		expect(entry).toEqual({ cube_id: 'b', set_at: 5000, pending: true });

		applyServerCubeState('u1', [cubeRow('a'), cubeRow('b')], [{ puzzle: '333', cube_id: 'a', set_at: new Date(1000).toISOString() }]);
		expect(getCubeState().mains['333']).toEqual({ cube_id: 'b', set_at: 5000, pending: true });

		// The server clamped a clock that ran ahead: the answer still confirms what was sent.
		resolveMainSent('333', 5000, { cube_id: 'b', set_at: new Date(4000).toISOString() });
		expect(getCubeState().mains['333']).toEqual({ cube_id: 'b', set_at: 4000 });
	});

	it('does not let an answer overwrite a newer choice made while the request was out', () => {
		applyServerCubeState('u1', [cubeRow('a'), cubeRow('b')], []);
		setMainLocal('333', 'a', 1000);
		setMainLocal('333', 'b', 2000);
		resolveMainSent('333', 1000, { cube_id: 'a', set_at: new Date(1000).toISOString() });
		expect(getCubeState().mains['333']).toEqual({ cube_id: 'b', set_at: 2000, pending: true });
	});

	it('orders two choices in the same millisecond', () => {
		applyServerCubeState('u1', [cubeRow('a'), cubeRow('b')], []);
		const first = setMainLocal('333', 'a', 1000);
		const second = setMainLocal('333', 'b', 1000);
		expect(second.set_at).toBeGreaterThan(first.set_at);
	});

	it('forgets a refused choice', () => {
		applyServerCubeState('u1', [cubeRow('a')], []);
		setMainLocal('333', 'a', 1000);
		dropPendingMain('333', 1000);
		expect(getCubeState().mains['333']).toBeUndefined();
	});

	it('makes the first active cube of a puzzle its main, as the server does', () => {
		upsertCube(cubeRow('a', '222'));
		expect(getCubeState().mains['222']).toEqual({ cube_id: 'a', set_at: AUTO_MAIN_SET_AT_MS });
		upsertCube(cubeRow('b', '222'));
		expect(getCubeState().mains['222'].cube_id).toBe('a');
		const chosenAt = Date.parse('2026-10-05T12:00:00Z');
		upsertCube(cubeRow('c', '222'), { chosenMainAt: chosenAt });
		expect(getCubeState().mains['222']).toEqual({ cube_id: 'c', set_at: chosenAt });
	});

	it('clears the main of an archived or deleted cube and keeps known calibrations on an edit', () => {
		applyServerCubeState('u1', [cubeRow('a', '333', { calibrations: [{ ...pending(1), id: 'cal' }] })], [
			{ puzzle: '333', cube_id: 'a', set_at: new Date(1000).toISOString() },
		]);
		upsertCube({ id: 'a', puzzle: '333', name: 'Renamed' });
		expect(getCubeState().cubes[0].name).toBe('Renamed');
		expect(getCubeState().cubes[0].calibrations).toHaveLength(1);

		upsertCube({ id: 'a', puzzle: '333', name: 'Renamed', archived_at: '2026-10-05T00:00:00Z' });
		expect(getCubeState().mains['333']).toBeUndefined();

		upsertCube(cubeRow('b'), { chosenMainAt: Date.parse('2026-10-05T12:00:00Z') });
		expect(getCubeState().mains['333'].cube_id).toBe('b');
		removeCube('b');
		expect(getCubeState().mains['333']).toBeUndefined();
		expect(getCubeState().cubes.map((c) => c.id)).toEqual(['a']);
	});

	it('uses a pending calibration at once and swaps it for the server row after the upload', () => {
		applyServerCubeState('u1', [cubeRow('a')], []);
		addPendingCalibration(pending(2000));
		// An older measurement does not replace a newer pending one.
		addPendingCalibration(pending(1000));
		expect(getCubeState().pendingCalibrations.map((c) => c.measured_at)).toEqual([2000]);
		expect(calibrationFor(getCubeState(), 'a', 'android', 'samsung SM-F956B')?.pending).toBe(true);

		resolveCalibrationSent(pending(2000), { ...pending(2000), id: 'row', measured_at: new Date(2000).toISOString() });
		const s = getCubeState();
		expect(s.pendingCalibrations).toHaveLength(0);
		expect(calibrationFor(s, 'a', 'android', 'samsung SM-F956B')?.id).toBe('row');
	});

	it('survives a broken local copy', () => {
		storage.set('zkt_cubes:u3', '{not json');
		me = { id: 'u3' };
		expect(getCubeState().cubes).toEqual([]);
		storage.set('zkt_cubes:u4', JSON.stringify({ v: 99, cubes: [cubeRow('x')] }));
		me = { id: 'u4' };
		expect(getCubeState().cubes).toEqual([]);
	});
});
