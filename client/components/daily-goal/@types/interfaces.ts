export interface DailyGoal {
	cube_type: string;
	scramble_subset?: string | null;
	target: number;
	enabled: boolean;
}

export interface DailyGoalStorage {
	goals: DailyGoal[];
	reminder_enabled: boolean;
	last_reminder_time: number | null;
	// When true, Friendly Room solves count toward daily goals + activity heatmap.
	count_room_solves: boolean;
}

export interface GoalProgress {
	current: number;
	target: number;
	percentage: number;
	completed: boolean;
}
