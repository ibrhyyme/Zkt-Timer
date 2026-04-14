import {getLokiDb} from '../lokijs';
import {Session} from '../../../server/schemas/Session.schema';

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

	for (const local of localSessions) {
		if (!serverMap.has(local.id)) {
			sessionDb.remove(local);
			changed = true;
		}
	}

	return changed;
}
