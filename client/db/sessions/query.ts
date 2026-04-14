import {getSessionDb} from './init';
import {fetchSolves} from '../solves/query';
import {Session} from '../../../server/schemas/Session.schema';

interface FetchSessionOptions {
	id?: string;
	name?: string;
}

export function fetchSessionById(id: string) {
	const sessionDb = getSessionDb();
	return sessionDb.findOne({
		id,
	});
}

export function fetchSessions(options: FetchSessionOptions = {}) {
	const sessionDb = getSessionDb();
	return sessionDb
		.chain()
		.find(options)
		.sort((a, b) => {
			if (a.order < b.order) {
				return -1;
			} else if (a.order > b.order) {
				return 1;
			} else if (a.order === b.order) {
				const aDate = new Date(a.created_at);
				const bDate = new Date(b.created_at);

				return bDate.getTime() - aDate.getTime();
			}
		})
		.data();
}

export function getCubeTypesFromSession(session: Session) {
	if (!session) {
		return [];
	}

	const types = new Set<string>();
	const solves = fetchSolves({
		session_id: session.id,
	});

	for (const solve of solves) {
		types.add(solve.cube_type);
	}

	return Array.from(types);
}

export interface SessionCubeBucket {
	cube_type: string;
	scramble_subset: string | null;
}

// Session icindeki (cube_type, subset) ciftlerini dondur. WCA altinda farkli etkinlikler icin ayri bucket.
export function getCubeBucketsFromSession(session: Session): SessionCubeBucket[] {
	if (!session) {
		return [];
	}

	const seen = new Set<string>();
	const out: SessionCubeBucket[] = [];
	const solves = fetchSolves({
		session_id: session.id,
	});

	for (const solve of solves) {
		const subset = solve.scramble_subset ?? null;
		const key = `${solve.cube_type}::${subset ?? ''}`;
		if (seen.has(key)) continue;
		seen.add(key);
		out.push({ cube_type: solve.cube_type, scramble_subset: subset });
	}

	return out;
}
