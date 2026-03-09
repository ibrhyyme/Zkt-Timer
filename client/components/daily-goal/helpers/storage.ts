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
	syncGoalToServer(cubeType, target, existingIndex >= 0 ? storage.goals[existingIndex].enabled : true);
}

export function removeGoalForCubeType(cubeType: string): void {
	const storage = getDailyGoalStorage();
	storage.goals = storage.goals.filter((g) => g.cube_type !== cubeType);
	setDailyGoalStorage(storage);
	emitEvent('dailyGoalUpdatedEvent');
	removeGoalFromServer(cubeType);
}

export function toggleGoalEnabled(cubeType: string): void {
	const storage = getDailyGoalStorage();
	const goal = storage.goals.find((g) => g.cube_type === cubeType);
	if (goal) {
		goal.enabled = !goal.enabled;
		setDailyGoalStorage(storage);
		emitEvent('dailyGoalUpdatedEvent');
		syncGoalToServer(cubeType, goal.target, goal.enabled);
	}
}

export function setReminderEnabled(enabled: boolean): void {
	const storage = getDailyGoalStorage();
	storage.reminder_enabled = enabled;
	setDailyGoalStorage(storage);
}

// --- Server sync (fire-and-forget) ---

function syncGoalToServer(cubeType: string, target: number, enabled: boolean): void {
	const me = getMe();
	if (!me) return;

	const mutation = gql`
		mutation SetDailyGoal($input: SetDailyGoalInput!) {
			setDailyGoal(input: $input) {
				id
				cube_type
				target
				enabled
			}
		}
	`;

	gqlMutate(mutation, {input: {cube_type: cubeType, target, enabled}}).catch((e) => {
		console.error('Failed to sync daily goal to server', e);
	});
}

function removeGoalFromServer(cubeType: string): void {
	const me = getMe();
	if (!me) return;

	const mutation = gql`
		mutation RemoveDailyGoal($cubeType: String!) {
			removeDailyGoal(cubeType: $cubeType)
		}
	`;

	gqlMutate(mutation, {cubeType}).catch((e) => {
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
				target
				enabled
			}
		}
	`;

	try {
		const res = await gqlQuery<{dailyGoals: Array<{id: string; cube_type: string; target: number; enabled: boolean}>}>(query);
		const serverGoals = res.data.dailyGoals;
		const storage = getDailyGoalStorage();

		if (serverGoals.length === 0 && storage.goals.length > 0) {
			// Migration: localStorage'da goal var ama server bos → push et
			for (const goal of storage.goals) {
				syncGoalToServer(goal.cube_type, goal.target, goal.enabled);
			}
		} else if (serverGoals.length > 0) {
			// Server'dan gelen goals ile localStorage'i guncelle
			storage.goals = serverGoals.map((g) => ({
				cube_type: g.cube_type,
				target: g.target,
				enabled: g.enabled,
			}));
			setDailyGoalStorage(storage);
			emitEvent('dailyGoalUpdatedEvent');
		}
	} catch (e) {
		console.error('Failed to sync daily goals from server', e);
	}
}
