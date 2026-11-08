import { AllSettings, getSetting } from '../../../db/settings/query';
import { setSettings } from '../../../db/settings/update';
import { buildBucketFilter, fetchLastBucketForSession, fetchLastSolve } from '../../../db/solves/query';
import { getCubeTypeInfoById } from '../../../util/cubes/util';
import { generateTimerScramble } from './scramble';
import { setTimerParam, setTimerParams } from './params';

/**
 * The timer's bucket (cube_type + scramble_subset) follows the session it is solving in.
 *
 * The bucket is a stored, synced setting, while the timer's session pick lives in memory
 * only (db/sessions/active.ts): a reload or relaunch puts the timer back on the main
 * session. Picking a 4x4 session in the timer header moved the stored bucket to 4x4, so the
 * next launch opened the 3x3 main session with 4x4 selected, on an empty list.
 *
 * The session the stored bucket was last lined up with. Module state, like the timer's own
 * session pick, so it survives the remount on every route change; null after a launch, which
 * makes the first timer mount check the bucket against the session it opens on.
 */
let bucketSessionId: string | null = null;

/** The timer header switched the session and set its bucket itself (SessionPicker). */
export function markBucketSession(sessionId: string | null): void {
	bucketSessionId = sessionId;
}

/**
 * Writes the timer's bucket and asks for a scramble of it. False when it was already the
 * selected one, in which case nothing is written.
 */
export function applyTimerBucket(cubeType: string, subset: string | null): boolean {
	const changes: Partial<AllSettings> = {};
	if (cubeType !== getSetting('cube_type')) {
		changes.cube_type = cubeType;
	}
	if (subset !== (getSetting('scramble_subset') ?? null)) {
		changes.scramble_subset = subset;
	}
	if (!Object.keys(changes).length) {
		return false;
	}

	// One write: both are global settings, and setSettings sends them in a single mutation.
	void setSettings(changes);

	if (getCubeTypeInfoById(cubeType)) {
		setTimerParam('scrambleSubset', subset);
		setTimerParams({ scramble: '', originalScramble: '', smartTurnOffset: 0 });
		generateTimerScramble(cubeType, subset, getSetting('scramble_top_color')).then((newScramble) => {
			setTimerParams({ scramble: newScramble, originalScramble: newScramble, smartTurnOffset: 0 });
		}).catch((e) => {
			console.error('[scramble] applyTimerBucket failed:', e);
		});
	}

	return true;
}

/**
 * Lines the bucket up with the session the timer is on, once per session: at launch, and
 * after the main session changed on the Sessions page. Only a selection with no timer solves
 * in that session is moved, to the session's last solved bucket. A selection the session
 * has solves in is kept, so is anything picked for an empty session.
 *
 * True when the bucket moved; a scramble for it is already on its way.
 */
export function followSessionBucket(sessionId: string | null): boolean {
	if (!sessionId || sessionId === bucketSessionId) {
		return false;
	}
	bucketSessionId = sessionId;

	const selectionHasSolves = fetchLastSolve({
		...buildBucketFilter({
			session_id: sessionId,
			cube_type: getSetting('cube_type'),
			scramble_subset: getSetting('scramble_subset'),
		}),
		from_timer: true,
	});
	if (selectionHasSolves) {
		return false;
	}

	const lastBucket = fetchLastBucketForSession(sessionId);
	// A solve can carry a custom cube type deleted since; the timer cannot open on that.
	if (!lastBucket || !getCubeTypeInfoById(lastBucket.cube_type)) {
		return false;
	}

	return applyTimerBucket(lastBucket.cube_type, lastBucket.scramble_subset ?? null);
}
