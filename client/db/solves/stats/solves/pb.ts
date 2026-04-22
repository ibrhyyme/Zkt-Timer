import {emitEvent} from '../../../../util/event_handler';
import jsonStr from 'json-stable-stringify';
import {Solve} from '../../../../../server/schemas/Solve.schema';
import {checkForAveragePBUpdate} from './cache/average_cache';
import {checkForSinglePB} from './cache/single_cache';

export function checkForPB(solve: Solve, isNew: boolean) {
	const updatedSinglePbs = checkForSinglePB(solve);
	const updatedAvgPbs = checkForAveragePBUpdate(solve, isNew);

	// Disqualify items that don't qualify for confetti
	if (!solve.from_timer || !isNew) {
			return;
	}

	const cubeType = solve.cube_type;
	const scrambleSubset = solve.scramble_subset ?? null;

	// We only want PBs that are for this cube type + subset combination
	const pbFilter = jsonStr({
		cube_type: cubeType,
		scramble_subset: scrambleSubset,
		from_timer: true,
	});

	const isAvgPb = updatedAvgPbs.some((pb) => jsonStr(pb.filterOptions) === pbFilter);
	const isSinglePb = updatedSinglePbs.some((pb) => jsonStr(pb.filterOptions) === pbFilter);


	if (isSinglePb && isAvgPb) {
		emitEvent('singleAndAvgPbEvent', { cubeType, scrambleSubset });
	} else if (isSinglePb) {
		emitEvent('singlePbEvent', { cubeType, scrambleSubset });
	} else if (isAvgPb) {
		emitEvent('avgPbEvent', { cubeType, scrambleSubset });
	}
}
