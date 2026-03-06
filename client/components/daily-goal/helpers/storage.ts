import {getMe} from '../../store';
import {DailyGoal, DailyGoalStorage} from '../@types/interfaces';
import {emitEvent} from '../../../util/event_handler';

const STORAGE_KEY = 'daily_goals';

const DEFAULT_STORAGE: DailyGoalStorage = {
	goals: [],
	reminder_enabled: false,
	last_reminder_time: null,
};

function getStorageKey(): string {
	const me = getMe();
	const userId = me?.id || 'demo';
	return `${STORAGE_KEY}_${userId}`;
}

export function getDailyGoalStorage(): DailyGoalStorage {
	if (typeof window === 'undefined') return DEFAULT_STORAGE;

	try {
		const raw = localStorage.getItem(getStorageKey());
		if (!raw) return DEFAULT_STORAGE;
		return JSON.parse(raw);
	} catch {
		return DEFAULT_STORAGE;
	}
}

export function setDailyGoalStorage(data: DailyGoalStorage): void {
	if (typeof window === 'undefined') return;
	localStorage.setItem(getStorageKey(), JSON.stringify(data));
}

export function getGoalForCubeType(cubeType: string): DailyGoal | null {
	const storage = getDailyGoalStorage();
	return storage.goals.find((g) => g.cube_type === cubeType) || null;
}

export function setGoalForCubeType(cubeType: string, target: number): void {
	const storage = getDailyGoalStorage();
	const existingIndex = storage.goals.findIndex((g) => g.cube_type === cubeType);

	if (existingIndex >= 0) {
		storage.goals[existingIndex].target = target;
	} else {
		storage.goals.push({cube_type: cubeType, target, enabled: true});
	}

	setDailyGoalStorage(storage);
	emitEvent('dailyGoalUpdatedEvent');
}

export function removeGoalForCubeType(cubeType: string): void {
	const storage = getDailyGoalStorage();
	storage.goals = storage.goals.filter((g) => g.cube_type !== cubeType);
	setDailyGoalStorage(storage);
	emitEvent('dailyGoalUpdatedEvent');
}

export function toggleGoalEnabled(cubeType: string): void {
	const storage = getDailyGoalStorage();
	const goal = storage.goals.find((g) => g.cube_type === cubeType);
	if (goal) {
		goal.enabled = !goal.enabled;
		setDailyGoalStorage(storage);
		emitEvent('dailyGoalUpdatedEvent');
	}
}

export function setReminderEnabled(enabled: boolean): void {
	const storage = getDailyGoalStorage();
	storage.reminder_enabled = enabled;
	setDailyGoalStorage(storage);
}
