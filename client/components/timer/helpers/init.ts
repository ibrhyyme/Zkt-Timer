import { fetchSessionById, fetchSessions } from '../../../db/sessions/query';
import { setSetting } from '../../../db/settings/update';
import { ITimerContext } from '../Timer';
import { Dispatch } from 'redux';
import { getCubeTypeInfoById } from '../../../util/cubes/util';
import { getSetting } from '../../../db/settings/query';
import { fetchLastSolve } from '../../../db/solves/query';
import { setTimerParam } from './params';
import { resetScramble } from './scramble';
import { getSolveDb } from '../../../db/solves/init';

export async function initTimer(dispatch: Dispatch<any>, context: ITimerContext) {
	const { inModal } = context;
	const sessionId = getSetting('session_id');
	const cubeType = getSetting('cube_type');
	const ct = getCubeTypeInfoById(cubeType);

	if (!inModal) {
		if (!sessionId || (sessionId && !fetchSessionById(sessionId))) {
			// Mevcut session varsa onu kullan (IndexedDB silindikten sonra oluşabilecek uyumsuzluğu önler).
			// Tarayıcı kendi başına ASLA yeni sezon oluşturmaz — server signup'ta default sezon garanti ediyor.
			// Eski auto-create logic'i race condition'da hayalet sezonlara sebep oluyordu.
			const existingSessions = fetchSessions();
			if (existingSessions.length > 0) {
				setSetting('session_id', existingSessions[0].id);
				migrateOrphanSolves(existingSessions[0].id);
			} else {
				console.error('[initTimer] User has zero sessions — server signup must have created a default session.');
			}
		}

		// If, for some reason, the cube type is not valid, set it to 3x3
		if (!ct) {
			setSetting('cube_type', '333');
		}

		// cube_type='wca' icin subset zorunlu — eski user'larin Setting'inde
		// subset=null kalmissa default '333' atanir (yoksa save'de orphan olur).
		const currentCubeType = getSetting('cube_type');
		const currentSubset = getSetting('scramble_subset');
		if (currentCubeType === 'wca' && !currentSubset) {
			setSetting('scramble_subset', '333');
		}
	}

	// Sayfa yüklendiğinde son çözümün süresini timer'a yükle
	const currentSessionId = getSetting('session_id');
	const lastSolve = fetchLastSolve({ session_id: currentSessionId });
	if (lastSolve && !inModal) {
		setTimerParam('finalTime', lastSolve.time * 1000);
	}

	// Sayfa ilk yüklendiğinde scramble generate et
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

