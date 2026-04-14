import {gql} from '@apollo/client';
import {getMe} from '../../store';
import {DailyGoal, DailyGoalStorage} from '../@types/interfaces';
import {emitEvent} from '../../../util/event_handler';
import {gqlMutate, gqlQuery} from '../../api';

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

function sameGoal(a: Pick<DailyGoal, 'cube_type' | 'scramble_subset'>, cubeType: string, subset?: string | null): boolean {
	return a.cube_type === cubeType && (a.scramble_subset ?? null) === (subset ?? null);
}

export function getGoalForCubeType(cubeType: string, scrambleSubset?: string | null): DailyGoal | null {
	const storage = getDailyGoalStorage();
	return storage.goals.find((g) => sameGoal(g, cubeType, scrambleSubset)) || null;
}

export function setGoalForCubeType(cubeType: string, target: number, scrambleSubset?: string | null): void {
	const storage = getDailyGoalStorage();
	const existingIndex = storage.goals.findIndex((g) => sameGoal(g, cubeType, scrambleSubset));

	if (existingIndex >= 0) {
		storage.goals[existingIndex].target = target;
	} else {
		storage.goals.push({cube_type: cubeType, scramble_subset: scrambleSubset ?? null, target, enabled: true});
	}

	setDailyGoalStorage(storage);
	emitEvent('dailyGoalUpdatedEvent');
	syncGoalToServer(cubeType, target, existingIndex >= 0 ? storage.goals[existingIndex].enabled : true, scrambleSubset);
}

export function removeGoalForCubeType(cubeType: string, scrambleSubset?: string | null): void {
	const storage = getDailyGoalStorage();
	storage.goals = storage.goals.filter((g) => !sameGoal(g, cubeType, scrambleSubset));
	setDailyGoalStorage(storage);
	emitEvent('dailyGoalUpdatedEvent');
	removeGoalFromServer(cubeType, scrambleSubset);
}

export function toggleGoalEnabled(cubeType: string, scrambleSubset?: string | null): void {
	const storage = getDailyGoalStorage();
	const goal = storage.goals.find((g) => sameGoal(g, cubeType, scrambleSubset));
	if (goal) {
		goal.enabled = !goal.enabled;
		setDailyGoalStorage(storage);
		emitEvent('dailyGoalUpdatedEvent');
		syncGoalToServer(cubeType, goal.target, goal.enabled, scrambleSubset);
	}
}

export function setReminderEnabled(enabled: boolean): void {
	const storage = getDailyGoalStorage();
	storage.reminder_enabled = enabled;
	setDailyGoalStorage(storage);
	syncReminderToServer(enabled);
}

// --- Server sync (fire-and-forget) ---

function syncGoalToServer(cubeType: string, target: number, enabled: boolean, scrambleSubset?: string | null): void {
	const me = getMe();
	if (!me) return;

	const mutation = gql`
		mutation SetDailyGoal($input: SetDailyGoalInput!) {
			setDailyGoal(input: $input) {
				id
				cube_type
				scramble_subset
				target
				enabled
			}
		}
	`;

	gqlMutate(mutation, {
		input: {
			cube_type: cubeType,
			scramble_subset: scrambleSubset ?? null,
			target,
			enabled,
		},
	}).catch((e) => {
		console.error('Failed to sync daily goal to server', e);
	});
}

function syncReminderToServer(enabled: boolean): void {
	const me = getMe();
	if (!me) return;

	const mutation = gql`
		mutation SetDailyGoalReminder($enabled: Boolean!) {
			setDailyGoalReminder(enabled: $enabled) {
				enabled
			}
		}
	`;

	gqlMutate(mutation, {enabled}).catch((e) => {
		console.error('Failed to sync reminder setting to server', e);
	});
}

function removeGoalFromServer(cubeType: string, scrambleSubset?: string | null): void {
	const me = getMe();
	if (!me) return;

	const mutation = gql`
		mutation RemoveDailyGoal($cubeType: String!, $scrambleSubset: String) {
			removeDailyGoal(cubeType: $cubeType, scrambleSubset: $scrambleSubset)
		}
	`;

	gqlMutate(mutation, {cubeType, scrambleSubset: scrambleSubset ?? null}).catch((e) => {
		console.error('Failed to remove daily goal from server', e);
	});
}

export async function syncDailyGoalsFromServer(): Promise<void> {
	const me = getMe();
	if (!me) return;

	const query = gql`
		query DailyGoals {
			dailyGoals {
				id
				cube_type
				scramble_subset
				target
				enabled
			}
			dailyGoalReminderStatus {
				enabled
			}
		}
	`;

	try {
		const res = await gqlQuery<{
			dailyGoals: Array<{id: string; cube_type: string; scramble_subset?: string | null; target: number; enabled: boolean}>;
			dailyGoalReminderStatus: {enabled: boolean};
		}>(query);
		const serverGoals = res.data.dailyGoals;
		const storage = getDailyGoalStorage();

		// Reminder durumunu server'dan al
		storage.reminder_enabled = res.data.dailyGoalReminderStatus.enabled;

		if (serverGoals.length === 0 && storage.goals.length > 0) {
			// Migration: localStorage'da goal var ama server bos → push et
			for (const goal of storage.goals) {
				syncGoalToServer(goal.cube_type, goal.target, goal.enabled, goal.scramble_subset);
			}
			// localStorage'daki reminder_enabled'i da server'a push et
			if (storage.reminder_enabled) {
				syncReminderToServer(true);
			}
		} else if (serverGoals.length > 0) {
			// Server'dan gelen goals ile localStorage'i guncelle
			storage.goals = serverGoals.map((g) => ({
				cube_type: g.cube_type,
				scramble_subset: g.scramble_subset ?? null,
				target: g.target,
				enabled: g.enabled,
			}));
		}

		setDailyGoalStorage(storage);
		emitEvent('dailyGoalUpdatedEvent');
	} catch (e) {
		console.error('Failed to sync daily goals from server', e);
	}
}
