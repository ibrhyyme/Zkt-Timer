import React, {useMemo} from 'react';
import Timer from './Timer';
import {useSettings} from '../../util/hooks/useSettings';
import {useActiveSessionId} from '../../util/hooks/useActiveSessionId';
import {useSolveDb} from '../../util/hooks/useSolveDb';
import {buildBucketFilter} from '../../db/solves/query';

export default function DefaultTimer() {
	const cubeType = useSettings('cube_type');
	const scrambleSubset = useSettings('scramble_subset');
	const sessionId = useActiveSessionId();

	useSolveDb();

	// Keyed on what the filter is actually made of. This component re-renders on every
	// solve DB change (useSolveDb above), and a fresh object each time handed the timer
	// page a new filter identity per saved solve, re-running every memo downstream that
	// keys on it (the history module's full-history PB scan among them).
	// The same bucket every other timer query uses (buildBucketFilter), and the one a solve is
	// written to: 2x2 > WCA Standard reads wca::222, where its solves are filed.
	const timerSolveData = useMemo(() => {
		const filter: Record<string, any> = {
			...buildBucketFilter({session_id: sessionId, cube_type: cubeType, scramble_subset: scrambleSubset}),
			from_timer: true,
		};

		return filter;
	}, [sessionId, cubeType, scrambleSubset]);

	return <Timer solvesFilter={timerSolveData} />;
}
