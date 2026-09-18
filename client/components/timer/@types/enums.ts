export enum TimerModuleType {
	HISTORY = 'history',
	LAST_SOLVE = 'last_solve',
	TRAINER_ALGO = 'trainer_algo',
	STATS = 'stats',
	SESSION_STATS = 'session_stats',
	SCRAMBLE = 'scramble',
	SOLVE_GRAPH = 'solve_graph',
	TIME_DISTRO = 'time_distro',
	CONSISTENCY = 'consistency',
	CHAT = 'chat',
	CROSS_SOLVER = 'cross_solver',
	PHASE_ANALYSIS = 'phase_analysis',
	/**
	 * The smart cube's live phase ladder. A module that holds a place for it rather than
	 * drawing it: SmartCube owns the analysis state and renders into this slot, because
	 * that state (the cube's start state, the move stream) has no business being lifted
	 * out of the component that produces it.
	 */
	LIVE_ANALYSIS = 'live_analysis',
	NONE = 'none',
}

export type TimerModuleDropdownOptions = {
	label: string;
	value: TimerModuleType;
};
