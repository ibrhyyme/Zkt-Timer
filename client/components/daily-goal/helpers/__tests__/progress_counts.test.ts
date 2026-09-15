/**
 * Today's goal count: timer solves from the solve DB, plus room solves and deleted
 * solves, each only while its own toggle is on. Both toggles default to off, which has
 * to leave the count exactly what it was before either existed.
 */

let mockStorage: any;
let mockTimerCount = 0;
let mockRoomCount = 0;
let mockDeletedCount = 0;

jest.mock('../../../../db/solves/query', () => ({
	fetchSolveCount: jest.fn(() => mockTimerCount),
}));
jest.mock('../storage', () => ({
	getDailyGoalStorage: () => mockStorage,
	getGoalForCubeType: () => mockStorage.goals[0] || null,
}));
jest.mock('../room-solves', () => ({
	getRoomCountForBucketToday: jest.fn(() => mockRoomCount),
}));
jest.mock('../deleted-solves', () => ({
	getDeletedCountForBucketToday: jest.fn(() => mockDeletedCount),
}));

import {getDailyGoalProgress, getTodaysSolveCount} from '../progress';
import {getDeletedCountForBucketToday} from '../deleted-solves';

beforeEach(() => {
	jest.clearAllMocks();
	mockTimerCount = 7;
	mockRoomCount = 2;
	mockDeletedCount = 3;
	mockStorage = {
		goals: [{cube_type: '333', scramble_subset: null, target: 10, enabled: true}],
		reminder_enabled: false,
		last_reminder_time: null,
		count_room_solves: false,
		count_deleted_solves: false,
	};
});

describe('getTodaysSolveCount', () => {
	it('counts only timer solves with both toggles off', () => {
		expect(getTodaysSolveCount('333', null)).toBe(7);
		expect(getDeletedCountForBucketToday).not.toHaveBeenCalled();
	});

	it('treats storage written before the deleted toggle existed as off', () => {
		delete mockStorage.count_deleted_solves;
		expect(getTodaysSolveCount('333', null)).toBe(7);
	});

	it('adds deleted solves when that toggle is on', () => {
		mockStorage.count_deleted_solves = true;
		expect(getTodaysSolveCount('333', null)).toBe(10);
		expect(getDeletedCountForBucketToday).toHaveBeenCalledWith('333', null);
	});

	it('adds room and deleted solves together when both are on', () => {
		mockStorage.count_room_solves = true;
		mockStorage.count_deleted_solves = true;
		expect(getTodaysSolveCount('333', null)).toBe(12);
	});
});

describe('getDailyGoalProgress', () => {
	it('lets deleted solves complete the goal', () => {
		expect(getDailyGoalProgress('333', null)).toMatchObject({current: 7, completed: false});

		mockStorage.count_deleted_solves = true;
		expect(getDailyGoalProgress('333', null)).toMatchObject({current: 10, percentage: 100, completed: true});
	});
});
