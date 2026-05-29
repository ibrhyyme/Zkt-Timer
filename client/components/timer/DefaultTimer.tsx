import React from 'react';
import Timer from './Timer';
import {useSettings} from '../../util/hooks/useSettings';
import {useSolveDb} from '../../util/hooks/useSolveDb';

export default function DefaultTimer() {
	const cubeType = useSettings('cube_type');
	const scrambleSubset = useSettings('scramble_subset');
	const sessionId = useSettings('session_id');

	useSolveDb();

	const timerSolveData: Record<string, any> = {
		session_id: sessionId,
		from_timer: true,
		cube_type: cubeType,
	};

	// cube_type='wca' can't exist without subset — user picks WCA and subset, always filter
	// For other cube_types, subset is optional — only filter if selected
	if (cubeType === 'wca' || scrambleSubset) {
		timerSolveData.scramble_subset = scrambleSubset || null;
	}

	return <Timer solvesFilter={timerSolveData} />;
}
