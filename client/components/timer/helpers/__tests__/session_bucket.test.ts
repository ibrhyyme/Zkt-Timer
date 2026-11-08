/**
 * The timer's bucket follows its session. The session pick in the timer header is in memory
 * only, the bucket is a stored setting: a relaunch used to open the 3x3 main session with
 * the 4x4 picked for another session still selected.
 */

type TestSolve = { session_id: string; cube_type: string; scramble_subset: string | null; from_timer: boolean };

const mockSettings: Record<string, any> = {};
let mockSolves: TestSolve[] = [];

jest.mock('../../../../db/settings/query', () => ({ getSetting: (key: string) => mockSettings[key] }));
jest.mock('../../../../db/settings/update', () => ({
	setSettings: jest.fn((payload: Record<string, any>) => {
		Object.assign(mockSettings, payload);
		return Promise.resolve();
	}),
}));
jest.mock('../../../../db/solves/query', () => ({
	buildBucketFilter: (p: { session_id: string; cube_type: string; scramble_subset?: string | null }) => ({
		session_id: p.session_id,
		cube_type: p.cube_type,
		scramble_subset: p.scramble_subset ?? null,
	}),
	fetchLastSolve: (filter: Record<string, any>) =>
		[...mockSolves].reverse().find((s) => Object.keys(filter).every((k) => (s as any)[k] === filter[k])) ?? null,
	fetchLastBucketForSession: (id: string) => {
		const last = [...mockSolves].reverse().find((s) => s.session_id === id);
		return last ? { cube_type: last.cube_type, scramble_subset: last.scramble_subset } : null;
	},
}));
jest.mock('../../../../util/cubes/util', () => ({
	getCubeTypeInfoById: (id: string) => (['wca', '333', '333cfop'].includes(id) ? { id } : null),
}));
jest.mock('../scramble', () => ({ generateTimerScramble: jest.fn(() => Promise.resolve('R U')) }));
jest.mock('../params', () => ({ setTimerParam: jest.fn(), setTimerParams: jest.fn() }));

import { setSettings } from '../../../../db/settings/update';
import { generateTimerScramble } from '../scramble';
import { setTimerParam } from '../params';
import { applyTimerBucket, followSessionBucket, markBucketSession } from '../session_bucket';

function solve(session_id: string, cube_type: string, scramble_subset: string | null): TestSolve {
	return { session_id, cube_type, scramble_subset, from_timer: true };
}

function select(cube_type: string, scramble_subset: string | null) {
	mockSettings.cube_type = cube_type;
	mockSettings.scramble_subset = scramble_subset;
}

beforeEach(() => {
	jest.clearAllMocks();
	markBucketSession(null);
	select('wca', '333');
	mockSettings.scramble_top_color = null;
	mockSolves = [solve('main', 'wca', '333'), solve('big', 'wca', '444')];
});

describe('followSessionBucket', () => {
	it('moves a bucket left over from another session to the session the timer opens on', () => {
		// Last switched to the 4x4 session, then relaunched: the timer is back on the 3x3 main one
		select('wca', '444');

		expect(followSessionBucket('main')).toBe(true);
		expect(mockSettings.cube_type).toBe('wca');
		expect(mockSettings.scramble_subset).toBe('333');
		expect(setSettings).toHaveBeenCalledTimes(1);
		expect(setSettings).toHaveBeenCalledWith({ scramble_subset: '333' });
		expect(generateTimerScramble).toHaveBeenCalledWith('wca', '333', null);
		expect(setTimerParam).toHaveBeenCalledWith('scrambleSubset', '333');
	});

	it('keeps a selection the session has timer solves in', () => {
		mockSolves.push(solve('main', 'wca', '444'), solve('main', 'wca', '333'));
		select('wca', '444');

		expect(followSessionBucket('main')).toBe(false);
		expect(mockSettings.scramble_subset).toBe('444');
		expect(setSettings).not.toHaveBeenCalled();
	});

	it('does not count solves that did not come from the timer', () => {
		mockSolves.push({ ...solve('main', 'wca', '444'), from_timer: false }, solve('main', 'wca', '333'));
		select('wca', '444');

		expect(followSessionBucket('main')).toBe(true);
		expect(mockSettings.scramble_subset).toBe('333');
	});

	it('leaves the selection alone in an empty session', () => {
		select('wca', '444');

		expect(followSessionBucket('fresh')).toBe(false);
		expect(mockSettings.scramble_subset).toBe('444');
		expect(setSettings).not.toHaveBeenCalled();
	});

	it('checks a session once, so a cube type picked in it survives moving between pages', () => {
		select('wca', '444');
		followSessionBucket('main');

		// Picked 4x4 in the main session without solving yet, went to Stats and came back
		select('wca', '444');
		expect(followSessionBucket('main')).toBe(false);
		expect(mockSettings.scramble_subset).toBe('444');
	});

	it('follows a main session changed on the Sessions page', () => {
		followSessionBucket('main');

		// "Make current" on the 4x4 session while 3x3 is selected
		expect(followSessionBucket('big')).toBe(true);
		expect(mockSettings.scramble_subset).toBe('444');
	});

	it('does not second-guess a session the timer header switched to', () => {
		markBucketSession('big');
		// A cube type picked in it afterwards that the session has no solves in yet
		select('333cfop', null);

		expect(followSessionBucket('big')).toBe(false);
		expect(mockSettings.cube_type).toBe('333cfop');
	});

	it('does not open the timer on a cube type that no longer exists', () => {
		mockSolves.push(solve('main', 'deleted-custom', null));
		select('wca', '444');

		expect(followSessionBucket('main')).toBe(false);
		expect(mockSettings.cube_type).toBe('wca');
		expect(setSettings).not.toHaveBeenCalled();
	});

	it('does nothing without a session', () => {
		expect(followSessionBucket(null)).toBe(false);
	});
});

describe('applyTimerBucket', () => {
	it('writes nothing when the bucket is already selected', () => {
		expect(applyTimerBucket('wca', '333')).toBe(false);
		expect(setSettings).not.toHaveBeenCalled();
		expect(generateTimerScramble).not.toHaveBeenCalled();
	});

	it('writes cube type and subset in one go', () => {
		expect(applyTimerBucket('333cfop', 'pll')).toBe(true);
		expect(setSettings).toHaveBeenCalledTimes(1);
		expect(setSettings).toHaveBeenCalledWith({ cube_type: '333cfop', scramble_subset: 'pll' });
	});

	it('treats a stored undefined subset as no subset', () => {
		select('333', undefined as any);
		expect(applyTimerBucket('333', null)).toBe(false);
	});
});
