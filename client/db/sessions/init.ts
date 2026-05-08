import {getLokiDb} from '../lokijs';
import {Session} from '../../../server/schemas/Session.schema';
import {generateId} from '../../../shared/code';

export function getSessionDb(): Collection<Session> {
	const db = getLokiDb();
	return db.getCollection('sessions');
}

export function initSessionCollection() {
	const db = getLokiDb();

	if (!getSessionDb()) {
		db.addCollection<Session>('sessions', {
			unique: ['id'],
		});
	}
}

export function initSessionDb(sessions: Session[]) {
	if (typeof window === 'undefined') {
		return;
	}

	initSessionCollection();

	for (const session of sessions) {
		getSessionDb().insert(session);
	}
}

// Sync etmeyen kullanicilar (anonim, Basic) icin local default sezon garantisi.
// Server'a gonderim YOK — sadece lokal LokiJS'e ekler. Basic'ten Pro'ya gecerken
// migrateLocalDataToServer akisi bu sezonu da bulkCreate ile sunucuya tasir.
export function ensureLocalDefaultSession() {
	if (typeof window === 'undefined') return;

	const db = getSessionDb();
	if (!db) return;
	if (db.count() > 0) return;

	db.insert({
		id: generateId(),
		name: 'Yeni Sezon',
		order: 0,
		created_at: new Date(),
		user_id: '_local',
	} as Session);
}

export function reconcileSessionDb(serverSessions: Session[]): boolean {
	const sessionDb = getSessionDb();
	if (!sessionDb) return false;

	const localSessions = sessionDb.find();
	const localMap = new Map(localSessions.map((s) => [s.id, s]));
	const serverMap = new Map(serverSessions.map((s) => [s.id, s]));

	let changed = false;

	for (const serverSession of serverSessions) {
		const local = localMap.get(serverSession.id);
		if (!local) {
			sessionDb.insert({...serverSession});
			changed = true;
		} else if (local.name !== serverSession.name || local.order !== serverSession.order) {
			sessionDb.update({
				...local,
				name: serverSession.name,
				order: serverSession.order,
			});
			changed = true;
		}
	}

	// Defansif: server bos array dondurduyse local'i silme. Bu durum normalde olmamali
	// (server signup'ta default sezon yaratiyor, son sezon silme korumasi var).
	// Anomali durumunda local cache'i koruyoruz; kullanicinin sezonlari kaybolmasin.
	if (serverSessions.length === 0 && localSessions.length > 0) {
		console.error('[reconcileSessionDb] Server returned 0 sessions but local has data — preserving local cache');
		return changed;
	}

	for (const local of localSessions) {
		if (!serverMap.has(local.id)) {
			sessionDb.remove(local);
			changed = true;
		}
	}

	return changed;
}
