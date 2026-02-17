import { getLokiDb, stripLokiJsMetadata } from '../lokijs';
import { SolveStat } from './stats/solves/caching';
import { Solve } from '../../../server/schemas/Solve.schema';
import { emitEvent } from '../../util/event_handler';

export function getSolveDb(): Collection<Solve> {
	const db = getLokiDb();
	return db.getCollection('solves');
}

export function getSolveCacheDb(): Collection<SolveStat> {
	const db = getLokiDb();
	return db.getCollection('solve_cache');
}

export function initSolvesCollection(forceRefresh = false) {
	const db = getLokiDb();

	if (forceRefresh) {
		db.removeCollection('solves');
	}

	if (!getSolveDb()) {
		db.addCollection<Solve>('solves', {
			unique: ['id'],
			indices: ['session_id', 'started_at', 'is_smart_cube', 'time', 'cube_type', 'trainer_name', 'from_timer'],
		});
	}

	db.removeCollection('solve_cache');
	db.addCollection<SolveStat>('solve_cache');
}

export function initSolveDb(solveList: Solve[], forceRefresh = false) {
	if (typeof window === 'undefined') {
		return;
	}

	console.time('[PERF] solves:collectionInit');
	initSolvesCollection(forceRefresh);
	console.timeEnd('[PERF] solves:collectionInit');

	console.log(`[PERF] solves:inserting ${solveList.length} records into LokiJS`);
	console.time('[PERF] solves:insertLoop');
	for (const solve of solveList) {
		solve.started_at = parseInt(String(solve.started_at), 10);
		solve.ended_at = parseInt(String(solve.ended_at), 10);

		getSolveDb().insert(stripLokiJsMetadata(solve));
	}
	console.timeEnd('[PERF] solves:insertLoop');

	emitEvent('solveDbUpdatedEvent');
}

export function appendSolvesToDb(solveList: Solve[], silent = false) {
	if (typeof window === 'undefined' || !solveList.length) {
		return;
	}

	const db = getSolveDb();
	let added = 0;

	for (const solve of solveList) {
		// Skip if already exists
		const existing = db.findOne({ id: solve.id });
		if (existing) continue;

		solve.started_at = parseInt(String(solve.started_at), 10);
		solve.ended_at = parseInt(String(solve.ended_at), 10);

		db.insert(stripLokiJsMetadata(solve));
		added++;
	}

	if (added > 0 && !silent) {
		emitEvent('solveDbUpdatedEvent');
	}
}


