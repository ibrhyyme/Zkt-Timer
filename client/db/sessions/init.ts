import {getLokiDb} from '../lokijs';
import {Session} from '../../../server/schemas/Session.schema';
import {generateId} from '../../../shared/code';
import i18n from '../../i18n/i18n';

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

// Guarantee local default session for non-syncing users (anonymous, Basic).
// NO server submission — only added to local LokiJS. When upgrading from Basic to Pro,
// migrateLocalDataToServer flow transfers this session to server via bulkCreate.
export function ensureLocalDefaultSession() {
	if (typeof window === 'undefined') return;

	const db = getSessionDb();
	if (!db) return;
	if (db.count() > 0) return;

	db.insert({
		id: generateId(),
		name: i18n.t('sessions.new_session'),
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

	// Defensive: if server returns empty array, don't delete local. This shouldn't normally happen
	// (server creates default session on signup, last session has deletion protection).
	// In anomaly cases, preserve local cache so user's sessions aren't lost.
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
