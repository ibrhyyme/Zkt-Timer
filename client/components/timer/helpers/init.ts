import { fetchSessionById, fetchSessions } from '../../../db/sessions/query';
import { setSetting } from '../../../db/settings/update';
import { ITimerContext } from '../Timer';
import { Dispatch } from 'redux';
import { getCubeTypeInfoById } from '../../../util/cubes/util';
import { getSetting } from '../../../db/settings/query';
import { fetchLastSolve, buildBucketFilter } from '../../../db/solves/query';
import { setTimerParam } from './params';
import { resetScramble } from './scramble';
import { getSolveDb } from '../../../db/solves/init';
import { migrateLokiSettingToWcaSubset } from '../../../db/solves/migrate_wca_subset';

export async function initTimer(dispatch: Dispatch<any>, context: ITimerContext) {
	const { inModal } = context;
	const sessionId = getSetting('session_id');
	const cubeType = getSetting('cube_type');
	const ct = getCubeTypeInfoById(cubeType);

	if (!inModal) {
		if (!sessionId || (sessionId && !fetchSessionById(sessionId))) {
			// Use existing session if available (prevents mismatch after IndexedDB clear).
			// Browser should NEVER create new session on its own — server guarantees default session at signup.
			// Old auto-create logic caused ghost sessions in race conditions.
			const existingSessions = fetchSessions();
			if (existingSessions.length > 0) {
				setSetting('session_id', existingSessions[0].id);
				migrateOrphanSolves(existingSessions[0].id);
			} else {
				console.error('[initTimer] User has zero sessions — server signup must have created a default session.');
			}
		}

		// If, for some reason, the cube type is not valid, default to WCA (3x3x3 via subset below)
		if (!ct) {
			setSetting('cube_type', 'wca');
		}

		// Standalone WCA-event picker buckets (333::null, 222::null, 333::333, ...) are
		// duplicates of the canonical wca::<event>. Redirect the active setting so the
		// picker matches where the solves migrate (migrate_wca_subset). Only empty/own-id
		// subsets are moved; real variants (333oh, 333mirror, ...) are untouched.
		// Covers ALL WCA events, not just 333.
		migrateLokiSettingToWcaSubset();

		// For cube_type='wca', subset is required — if old users have
		// subset=null in settings, default to '333' (otherwise orphans on save).
		const currentCubeType = getSetting('cube_type');
		const currentSubset = getSetting('scramble_subset');
		if (currentCubeType === 'wca' && !currentSubset) {
			setSetting('scramble_subset', '333');
		}
	}

	// On page load, load last solve's time into timer — scoped to the current
	// bucket so the display matches the active cube_type/subset, not the global last.
	const currentSessionId = getSetting('session_id');
	const lastSolve = fetchLastSolve(
		buildBucketFilter({
			session_id: currentSessionId,
			cube_type: getSetting('cube_type'),
			scramble_subset: getSetting('scramble_subset'),
		})
	);
	if (lastSolve && !inModal) {
		setTimerParam('finalTime', lastSolve.time * 1000);
	}

	// Generate scramble on initial page load
	resetScramble(context);
}

function migrateOrphanSolves(newSessionId: string) {
	const solveDb = getSolveDb();
	if (!solveDb) return;

	const sessionIds = new Set(fetchSessions().map((s) => s.id));
	const orphans = solveDb.find().filter((s) => !sessionIds.has(s.session_id));

	if (!orphans.length) return;

	for (const solve of orphans) {
		solve.session_id = newSessionId;
		solveDb.update(solve);
	}
}
