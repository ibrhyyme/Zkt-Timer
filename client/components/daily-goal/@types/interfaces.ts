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
	// When true, solves made and then deleted keep counting toward daily goals + activity
	// heatmap (helpers/deleted-solves.ts). Device-local: there is no server column for it.
	// Storage written before it existed lacks it, which reads as off.
	count_deleted_solves: boolean;
}

export interface GoalProgress {
	current: number;
	target: number;
	percentage: number;
	completed: boolean;
}
