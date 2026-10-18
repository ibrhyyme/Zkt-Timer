/**
 * Room solves and the deleted tally carry no cube, so a Cube filter must not add them to the
 * activity heatmap or the solves-per-day bars (design magnet-cubes 8.3).
 */

jest.mock('../../../daily-goal/helpers/storage', () => ({
	getDailyGoalStorage: () => ({ count_room_solves: true, count_deleted_solves: true }),
}));
jest.mock('../../../daily-goal/helpers/room-solves', () => ({
	getRoomDailyCounts: () => new Map([['2026-10-7', 3]]),
}));
jest.mock('../../../daily-goal/helpers/deleted-solves', () => ({
	getDeletedDailyCounts: () => new Map([['2026-10-7', 2]]),
}));

import { getExtraDailyCounts } from '../../../daily-goal/helpers/extra-daily-counts';

describe('getExtraDailyCounts under the Cube filter', () => {
	it('adds room and deleted solves without a cube filter', () => {
		expect(getExtraDailyCounts({ cube_type: 'wca', scramble_subset: '333' })?.get('2026-10-7')).toBe(5);
	});

	it('adds nothing once a cube is picked', () => {
		expect(getExtraDailyCounts({ cube_type: 'wca', scramble_subset: '333', cube_id: 'A' })).toBeUndefined();
		expect(getExtraDailyCounts({ from_timer: true, cube_id: 'A' })).toBeUndefined();
	});
});
