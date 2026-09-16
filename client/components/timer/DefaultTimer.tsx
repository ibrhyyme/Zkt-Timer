import React, {useMemo} from 'react';
import Timer from './Timer';
import {useSettings} from '../../util/hooks/useSettings';
import {useSolveDb} from '../../util/hooks/useSolveDb';

export default function DefaultTimer() {
	const cubeType = useSettings('cube_type');
	const scrambleSubset = useSettings('scramble_subset');
	const sessionId = useSettings('session_id');

	useSolveDb();

	// Keyed on what the filter is actually made of. This component re-renders on every
	// solve DB change (useSolveDb above), and a fresh object each time handed the timer
	// page a new filter identity per saved solve, re-running every memo downstream that
	// keys on it (the history module's full-history PB scan among them).
	const timerSolveData = useMemo(() => {
		const filter: Record<string, any> = {
			session_id: sessionId,
			from_timer: true,
			cube_type: cubeType,
		};

		// cube_type='wca' can't exist without subset — user picks WCA and subset, always filter
		// For other cube_types, subset is optional — only filter if selected
		if (cubeType === 'wca' || scrambleSubset) {
			filter.scramble_subset = scrambleSubset || null;
		}

		return filter;
	}, [sessionId, cubeType, scrambleSubset]);

	return <Timer solvesFilter={timerSolveData} />;
}
