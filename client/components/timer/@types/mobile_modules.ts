import { TimerModuleType } from './enums';

// Module types available on mobile.
// Last Solve -> already shown in Solves
// Consistency, Statistics -> already in StatsBar and Stats page
// None -> user must select something
export const MOBILE_MODULE_OPTIONS: TimerModuleType[] = [
	TimerModuleType.HISTORY,
	TimerModuleType.SCRAMBLE,
	TimerModuleType.CROSS_SOLVER,
	TimerModuleType.SOLVE_GRAPH,
	TimerModuleType.TIME_DISTRO,
	TimerModuleType.PHASE_ANALYSIS,
];
