import { v4 as uuid } from 'uuid';
import { createSolveDb } from '../../../db/solves/update';
import { ITimerContext } from '../Timer';
import { emitEvent } from '../../../util/event_handler';
import { setTimerParam } from './params';
import { Solve, SolveInput } from '../../../../server/schemas/Solve.schema';
import { requestInAppReview } from '../../../util/native-plugins';
import { normalizeWcaEventBucket } from '../../../../shared/solve';

export function saveSolve(
	context: ITimerContext,
	time: number,
	scramble: string,
	startedAt: number,
	endedAt: number,
	dnf = false,
	plusTwo = false,
	overrides: Partial<SolveInput> = {}
) {
	const { onSolve, addTwoToSolve, cubeType, scrambleSubset, dnfTime } = context;

	dnf = dnf || dnfTime;
	plusTwo = dnf ? false : (plusTwo || (addTwoToSolve && !dnfTime));

	time /= 1000;
	const finalTime = dnf ? -1 : time + (plusTwo ? 2 : 0);

	// For cube_type='wca', subset is required (cube-subset-bucket rule); if empty, defaults to '333'.
	// normalizeWcaEventBucket then collapses any standalone WCA-event bucket (333::null, 333::333)
	// onto the canonical wca::<event> bucket so the timer never writes the duplicate "3x3" box.
	const rawSubset = cubeType === 'wca' ? (scrambleSubset || '333') : (scrambleSubset || null);
	const bucket = normalizeWcaEventBucket(cubeType, rawSubset);

	const solveObject: Solve = {
		scramble,
		started_at: new Date(startedAt).getTime(),
		ended_at: new Date(endedAt).getTime(),
		time: finalTime,
		raw_time: Math.max(time, 0),
		cube_type: bucket.cube_type,
		scramble_subset: bucket.scramble_subset,
		id: uuid(),
		dnf: dnf || false,
		plus_two: !!plusTwo,
		...context.solvesFilter,
		...context.solvesSaveOverride,
		...overrides,
	} as Solve;

	if (onSolve) {
		onSolve(solveObject);
	} else {
		createSolveDb(solveObject);
	}

	const newCount = context.sessionSolveCount + 1;
	setTimerParam('sessionSolveCount', newCount);
	emitEvent('solveSavedEvent', solveObject);

	// Request review every 50 solves (once per session, plugin controls it)
	if (newCount === 50) {
		requestInAppReview();
	}
}
