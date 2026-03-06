export interface DailyGoal {
	cube_type: string;
	target: number;
	enabled: boolean;
}

export interface DailyGoalStorage {
	goals: DailyGoal[];
	reminder_enabled: boolean;
	last_reminder_time: number | null;
}

export interface GoalProgress {
	current: number;
	target: number;
	percentage: number;
	completed: boolean;
}
