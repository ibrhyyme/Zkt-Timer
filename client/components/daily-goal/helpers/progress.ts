import {fetchSolveCount} from '../../../db/solves/query';
import {GoalProgress} from '../@types/interfaces';
import {getGoalForCubeType, getDailyGoalStorage} from './storage';
import {getRoomCountForBucketToday} from './room-solves';

export function getTodaysSolveCount(cubeType: string, scrambleSubset?: string | null): number {
	const today = new Date();
	today.setHours(0, 0, 0, 0);

	const timerCount = fetchSolveCount({
		cube_type: cubeType,
		scramble_subset: scrambleSubset ?? null,
		from_timer: true,
		started_at: {$gte: today.getTime()},
	});

	// Add Friendly Room solves (DNF excluded server-side) when the user opted in.
	if (getDailyGoalStorage().count_room_solves) {
		return timerCount + getRoomCountForBucketToday(cubeType, scrambleSubset);
	}

	return timerCount;
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
