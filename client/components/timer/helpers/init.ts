import { fetchSessionById, fetchSessions } from '../../../db/sessions/query';
import { createSessionDb } from '../../../db/sessions/update';
import { setSetting } from '../../../db/settings/update';
import { ITimerContext } from '../Timer';
import { Dispatch } from 'redux';
import { getCubeTypeInfoById } from '../../../util/cubes/util';
import { getSetting } from '../../../db/settings/query';
import { fetchLastSolve } from '../../../db/solves/query';
import { setTimerParam } from './params';
import { resetScramble } from './scramble';
import i18n from '../../../i18n/i18n';
import { getSolveDb } from '../../../db/solves/init';

// Creates session if none exist already
export async function initTimer(dispatch: Dispatch<any>, context: ITimerContext) {
	const { inModal } = context;
	const sessionId = getSetting('session_id');
	const cubeType = getSetting('cube_type');
	const ct = getCubeTypeInfoById(cubeType);

	if (!inModal) {
		if (!sessionId || (sessionId && !fetchSessionById(sessionId))) {
			// Mevcut session varsa onu kullan (IndexedDB silindikten sonra oluşabilecek uyumsuzluğu önler)
			const existingSessions = fetchSessions();
			if (existingSessions.length > 0) {
				setSetting('session_id', existingSessions[0].id);
			} else {
				const session = await createSessionDb({
					name: i18n.t('sessions.new_session'),
				});
				setSetting('session_id', session.id);

				// Yeni session oluşturulduysa ve yetim solve'lar varsa, onları bu session'a taşı
				migrateOrphanSolves(session.id);
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

