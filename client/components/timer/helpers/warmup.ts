import { createSolveDb } from '../../../db/solves/update';
import { buildBucketFilter, fetchLastSolve } from '../../../db/solves/query';
import { getSetting } from '../../../db/settings/query';
import { getActiveSessionId } from '../../../db/sessions/active';
import { getSinglePB } from '../../../db/solves/stats/solves/single/single_pb';
import { noteCubeSolve } from '../../../lib/cubes/store';
import {
	getWarmupState,
	isWarmupActive,
	startWarmup,
	stopWarmup,
	takeLastWarmupSolve,
	warmupIdleExpired,
} from '../../../lib/warmup/store';
import { hapticImpact } from '../../../util/native-plugins';
import type { Solve } from '../../../../server/schemas/Solve.schema';
import { getTimerStore } from '../../../util/store/getTimer';
import { setTimerParam } from './params';

/** A solve is under way or about to start: the mode must not change under it. */
function timerBusy(): boolean {
	return !!(
		getTimerStore('timeStartedAt') ||
		getTimerStore('inInspection') ||
		getTimerStore('spaceTimerStarted') ||
		getTimerStore('virtualArmed')
	);
}

function endWarmup() {
	const threwSolvesAway = getWarmupState().count > 0;
	stopWarmup();

	// The digits may still show a time that exists nowhere, with the saved solves' diff under
	// them. Same read as initTimer: the current bucket's last solve.
	if (threwSolvesAway) {
		const lastSolve = fetchLastSolve(
			buildBucketFilter({
				session_id: getActiveSessionId(),
				cube_type: getSetting('cube_type'),
				scramble_subset: getSetting('scramble_subset'),
			})
		);
		setTimerParam('finalTime', lastSolve ? lastSolve.time * 1000 : 0);
	}
}

/** Returns whether the mode changed. */
export function toggleWarmup(): boolean {
	if (timerBusy()) return false;

	if (isWarmupActive()) {
		endWarmup();
	} else {
		startWarmup();
	}
	return true;
}

/** Ends a mode left on and forgotten. Runs on a clock, so it waits for a running solve. */
export function sweepWarmup(now: number = Date.now()) {
	if (warmupIdleExpired(now) && !timerBusy()) {
		endWarmup();
	}
}

/**
 * Would this solve be a new single PB if it were saved? Same bucket and same rule as the check a
 * saved solve goes through (checkForSinglePB, pb.ts): a tie counts, a first solve does not. Reads
 * only: nothing about the warm-up solve goes into the PB cache.
 */
export function warmupSolveBeatsPb(solve: Solve): boolean {
	if (solve.dnf || !(solve.time > 0)) return false;

	const pb = getSinglePB({
		cube_type: solve.cube_type,
		scramble_subset: solve.scramble_subset ?? null,
		from_timer: true,
	});
	return !!pb && solve.time <= pb.time;
}

/** The Save button: from here on the solve is an ordinary one, PB check included. */
export function saveLastWarmupSolve() {
	const solve = takeLastWarmupSolve();
	if (!solve) return;

	hapticImpact('light');
	createSolveDb(solve);
	noteCubeSolve(solve.cube_id);
}
