import {fetchSolveCount} from '../../../db/solves/query';
import {GoalProgress} from '../@types/interfaces';
import {getGoalForCubeType, getDailyGoalStorage} from './storage';
import {getRoomCountForBucketToday} from './room-solves';
import {getDeletedCountForBucketToday} from './deleted-solves';

export function getTodaysSolveCount(cubeType: string, scrambleSubset?: string | null): number {
	const today = new Date();
	today.setHours(0, 0, 0, 0);

	const timerCount = fetchSolveCount({
		cube_type: cubeType,
		scramble_subset: scrambleSubset ?? null,
		from_timer: true,
		started_at: {$gte: today.getTime()},
	});

	const storage = getDailyGoalStorage();
	let count = timerCount;

	// Add Friendly Room solves (DNF excluded server-side) when the user opted in.
	if (storage.count_room_solves) {
		count += getRoomCountForBucketToday(cubeType, scrambleSubset);
	}

	// And today's solves that were deleted since, when the user opted in to those. The
	// query above no longer finds them, so the two never count the same solve.
	if (storage.count_deleted_solves) {
		count += getDeletedCountForBucketToday(cubeType, scrambleSubset);
	}

	return count;
}

export function getDailyGoalProgress(cubeType: string, scrambleSubset?: string | null): GoalProgress | null {
	const goal = getGoalForCubeType(cubeType, scrambleSubset);
	if (!goal || !goal.enabled) return null;

	const current = getTodaysSolveCount(cubeType, scrambleSubset);
	const percentage = Math.min(100, Math.round((current / goal.target) * 100));

	return {
		current,
		target: goal.target,
		percentage,
		completed: current >= goal.target,
	};
}
