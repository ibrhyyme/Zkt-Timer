import React, { useContext } from 'react';
import { TimerModuleType } from './@types/enums';
import { TimerContext } from './Timer';
import History from '../modules/history/History';
import LastSolve from '../modules/last_solve/LastSolve';
import ScrambleVisual from '../modules/scramble/ScrambleVisual';
import TimeChart from '../modules/time_chart/TimeChart';
import TimeDistro from '../modules/time_distro/TimeDistro';
import SolvesPerDay from '../modules/solves_per_day/SolvesPerDay';
import QuickStats from '../modules/quick_stats/QuickStats';
import CrossSolverModule from '../modules/cross_solver/CrossSolverModule';
import PhaseAnalysis from '../modules/phase_analysis/PhaseAnalysis';
import LiveAnalysisSlot from './smart_cube/LiveAnalysisSlot';

// One place that answers "what does this module type render" and "what is it called".
//
// It used to live inside TimerModule as a map built on every render, which meant the
// mobile footer and the desktop tiles would have drifted apart the moment either grew a
// module. Both read from here instead.

export const MODULE_LABEL_KEYS: Partial<Record<TimerModuleType, string>> = {
	[TimerModuleType.HISTORY]: 'timer_modules.history',
	[TimerModuleType.CROSS_SOLVER]: 'timer_modules.cross_solver',
	[TimerModuleType.STATS]: 'timer_modules.stats',
	[TimerModuleType.LAST_SOLVE]: 'timer_modules.last_solve',
	[TimerModuleType.SCRAMBLE]: 'timer_modules.scramble',
	[TimerModuleType.CONSISTENCY]: 'timer_modules.consistency',
	[TimerModuleType.SOLVE_GRAPH]: 'timer_modules.solve_graph',
	[TimerModuleType.TIME_DISTRO]: 'timer_modules.time_distro',
	[TimerModuleType.PHASE_ANALYSIS]: 'timer_modules.phase_analysis',
	[TimerModuleType.LIVE_ANALYSIS]: 'timer_modules.live_analysis',
	[TimerModuleType.NONE]: 'timer_modules.none',
};

interface Props {
	moduleType: TimerModuleType;
	/** History only: arrow keys and delete act on the list. Off inside a tile that is being dragged. */
	hotKeysEnabled?: boolean;
}

/**
 * The body of one module. Reads what it needs from TimerContext, so a caller only has
 * to know which module it wants.
 */
export default function ModuleBody({ moduleType, hotKeysEnabled = true }: Props) {
	const context = useContext(TimerContext);
	const { scramble, originalScramble, cubeType, scrambleSubset, solvesFilter } = context;

	// A WCA session picks its puzzle from the subset (333, 444, sq1...), everything else
	// is the cube type itself.
	const visualCubeType = cubeType === 'wca' && scrambleSubset ? scrambleSubset : cubeType;

	switch (moduleType) {
		case TimerModuleType.HISTORY:
			return <History filterOptions={solvesFilter} hotKeysEnabled={hotKeysEnabled} />;
		case TimerModuleType.LAST_SOLVE:
			return <LastSolve filterOptions={solvesFilter} />;
		case TimerModuleType.STATS:
			return <QuickStats filterOptions={solvesFilter} />;
		case TimerModuleType.SCRAMBLE:
			return (
				<ScrambleVisual
					cubeType={visualCubeType}
					scramble={originalScramble || scramble}
					subset={scrambleSubset || undefined}
				/>
			);
		case TimerModuleType.SOLVE_GRAPH:
			return <TimeChart filterOptions={solvesFilter} />;
		case TimerModuleType.TIME_DISTRO:
			return <TimeDistro filterOptions={solvesFilter} />;
		case TimerModuleType.CONSISTENCY:
			return <SolvesPerDay filterOptions={solvesFilter} days={14} />;
		case TimerModuleType.CROSS_SOLVER:
			return <CrossSolverModule />;
		case TimerModuleType.PHASE_ANALYSIS:
			return <PhaseAnalysis filterOptions={solvesFilter} />;
		case TimerModuleType.LIVE_ANALYSIS:
			return <LiveAnalysisSlot />;
		default:
			return null;
	}
}
