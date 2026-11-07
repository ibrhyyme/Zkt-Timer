import { createSolveDb, deleteSolveDb } from '../../../db/solves/update';
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
	takeAutoSavedWarmupSolve,
	takeLastWarmupSolve,
	warmupIdleExpired,
} from '../../../lib/warmup/store';
import { hapticImpact } from '../../../util/native-plugins';
import { warmupAutoSaveReason } from '../../../lib/warmup/auto_save';
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
	persistWarmupSolve(takeLastWarmupSolve());
}

/**
 * Auto-save (settings `warmup_auto_save`, `warmup_auto_save_thresholds`): called by saveSolve
 * right after a warm-up solve was noted. The rules are in lib/warmup/auto_save.ts; the PB test
 * is the one the Save button's PB mark uses, so the chip and the save never disagree. The PB
 * lookup is lazy: a solve that is not a candidate never touches the PB cache. Returns whether
 * it saved.
 */
export function autoSaveWarmupSolve(solve: Solve): boolean {
	const reason = warmupAutoSaveReason(
		solve,
		getSetting('warmup_auto_save'),
		getSetting('warmup_auto_save_thresholds'),
		() => warmupSolveBeatsPb(solve)
	);
	if (!reason) return false;

	persistWarmupSolve(takeLastWarmupSolve(reason));
	return true;
}

/**
 * Undo on the chip: takes the auto-saved solve out again (no confirm, the press is the
 * confirmation) and puts it back under the Save button. A solve already deleted from the
 * last solve card is simply gone; deleteSolveDb finds nothing and does nothing.
 */
export function undoWarmupAutoSave() {
	const solve = takeAutoSavedWarmupSolve();
	if (!solve) return;

	hapticImpact('light');
	void deleteSolveDb(solve, true);
}

function persistWarmupSolve(solve: Solve | null) {
	if (!solve) return;

	hapticImpact('light');
	createSolveDb(solve);
	noteCubeSolve(solve.cube_id);
}
