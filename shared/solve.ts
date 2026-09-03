import { Solve } from '../server/schemas/Solve.schema';

// WCA official event ids. A standalone cube_type equal to one of these is the
// legacy/duplicate of the canonical `wca` bucket (cube_type='wca' + subset=<event>).
const WCA_EVENT_IDS = new Set([
	'333', '222', '444', '555', '666', '777',
	'sq1', 'pyram', 'clock', 'skewb', 'minx',
]);

/**
 * Collapses a standalone WCA-event bucket onto the canonical `wca` bucket.
 *
 * `333::null`, `333::''`, `333::333` -> `wca::333` (the duplicate "3x3" boxes).
 * Real variants (`333::333oh`, `333::333mirror`, `333o` random-move, ...) and
 * method cube types (`333cfop`, `333mehta`, ...) are left untouched.
 *
 * Shared by client save (save.ts) and server sanitizeSolve so a malformed bucket
 * can never reach the DB regardless of which path produced it.
 */
export function normalizeWcaEventBucket(
	cubeType: string | null | undefined,
	scrambleSubset: string | null | undefined
): { cube_type: string | null | undefined; scramble_subset: string | null } {
	if (cubeType && WCA_EVENT_IDS.has(cubeType)) {
		if (!scrambleSubset || scrambleSubset === cubeType) {
			return { cube_type: 'wca', scramble_subset: cubeType };
		}
	}
	return { cube_type: cubeType, scramble_subset: scrambleSubset ?? null };
}

/**
 * Coarse "which event is this" key for matching a daily-goal bucket against a room
 * solve. Room solves carry no scramble subset, so matching is cube_type-only: a
 * `333` room and a `wca::333` goal must collapse to the same key. WCA-event buckets
 * (333/222/...) reduce to their event id; everything else (method variants like
 * `333cfop`, non-WCA puzzles) keeps its cube_type.
 */
export function getBucketEventKey(
	cubeType: string | null | undefined,
	scrambleSubset?: string | null
): string {
	const n = normalizeWcaEventBucket(cubeType, scrambleSubset);
	if (n.cube_type === 'wca' && n.scramble_subset) return n.scramble_subset;
	return n.cube_type ?? '';
}

/**
 * The value `time` carries when a solve is a DNF.
 *
 * Every producer writes exactly this: the timer save path (client/components/timer/
 * helpers/save.ts), the penalty toggle (updateSolveTime in client/db/solves/update.tsx),
 * manual entry (client/util/time.ts) and the csTimer importer. Readers are looser and
 * test for `time < 0`, but -1 is the only value actually written, so validation checks
 * for it exactly. A genuinely corrupt -37 must still be caught.
 */
export const DNF_TIME = -1;

/**
 * Whether a solve time field may be stored.
 *
 * Lives in shared/ deliberately: the server rejects on this rule and the client filters
 * on it before uploading. Written twice, the two drift and one side starts sending what
 * the other refuses. That is exactly how DNF solves stopped syncing for two months: a
 * guard added to Solve.resolver.ts read -1 as corrupt data rather than as the DNF
 * sentinel the app has always written, so every solve that was DNF the moment it was
 * created (inspection timeout, manual "DNF" entry, imports) was refused by the server
 * while the client went on believing it had saved them.
 *
 * `time` accepts the sentinel; `raw_time` never does, because no producer writes a
 * negative raw time (save.ts clamps it with Math.max(time, 0)).
 */
export function isValidSolveTime(field: 'time' | 'raw_time', value: unknown): boolean {
	if (value == null) {
		return true;
	}
	if (typeof value !== 'number' || !Number.isFinite(value)) {
		return false;
	}
	if (field === 'time' && value === DNF_TIME) {
		return true;
	}
	return value >= 0;
}

/**
 * Names the time fields that fail validation, empty when the solve is storable.
 * Callers that reject use the first name; callers that log report all of them.
 */
export function invalidSolveTimeFields(solve: {time?: unknown; raw_time?: unknown}): string[] {
	const fields: string[] = [];
	for (const field of ['time', 'raw_time'] as const) {
		if (!isValidSolveTime(field, solve[field])) {
			fields.push(field);
		}
	}
	return fields;
}

export function sanitizeSolve(s: Partial<Solve>): Partial<Solve> {
	const solve = { ...s };

	// Defensive bucket normalization — guarantees WCA-event solves land in the
	// canonical `wca` bucket even if a stale client sends a legacy cube_type.
	const bucket = normalizeWcaEventBucket(solve.cube_type, solve.scramble_subset);
	solve.cube_type = bucket.cube_type;
	solve.scramble_subset = bucket.scramble_subset;

	delete solve.created_at;
	delete solve.user;
	delete solve.solve_method_steps;
	delete solve.solve_views;
	delete solve.smart_device;
	// GraphQL-only: tells the resolver which method to break the solve down with
	// (server/resolvers/Solve.resolver.ts), never a column on the Solve table itself.
	delete (solve as any).analysis_method;

	let startedAt: number | bigint = solve.started_at;
	let endedAt: number | bigint = solve.ended_at;
	if (startedAt && typeof startedAt === 'string') {
		startedAt = parseInt(startedAt, 10);
	}

	if (endedAt && typeof endedAt === 'string') {
		endedAt = parseInt(endedAt, 10);
	}

	solve.started_at = Number(startedAt) as any;
	solve.ended_at = Number(endedAt) as any;
	solve.dnf = !!solve.dnf;
	solve.plus_two = !!solve.plus_two;

	if (solve.trainer_name) {
		solve.session_id = null;
	}

	if (!solve.inspection_time) {
		solve.inspection_time = 0;
	}

	if (!solve.is_smart_cube) {
		solve.is_smart_cube = false;
	}

	if (!solve.smart_put_down_time) {
		solve.smart_put_down_time = 0;
	}

	if (!solve.smart_pick_up_time) {
		solve.smart_pick_up_time = 0;
	}

	solve.from_timer = true;
	if (
		!solve.session_id ||
		solve.trainer_name ||
		solve.training_session_id
	) {
		solve.from_timer = false;
	}

	return solve;
}

/**
 * Content identity of a solve, independent of its id.
 *
 * Import assigns a fresh id to every parsed row, so re-importing the same backup
 * writes the same solves again under new ids and the database's own duplicate
 * check (which only knows about ids) cannot see it. That is how one account
 * reached 114k rows for 39k real solves. Comparing content instead of ids is the
 * only way to recognise a row that is already stored.
 *
 * Kept in shared/ deliberately: the fingerprint the server publishes and the one
 * the importer computes must be produced by the exact same code, or every solve
 * looks new and the check silently passes everything through.
 */
export interface SolveFingerprintFields {
	time?: number | null;
	scramble?: string | null;
	started_at?: number | bigint | string | null;
}

export function solveFingerprint(solve: SolveFingerprintFields): string {
	// Milliseconds as an integer: `time` is a float that survives a JSON round
	// trip on one side and a Prisma decode on the other, and comparing raw floats
	// across those two paths is not reliable.
	const time =
		typeof solve.time === 'number' && Number.isFinite(solve.time)
			? String(Math.round(solve.time * 1000))
			: '';
	// Whitespace in a scramble is formatting, not content.
	const scramble = (solve.scramble || '').trim().replace(/\s+/g, ' ');
	const startedAt = solve.started_at === null || solve.started_at === undefined ? '' : String(solve.started_at);
	return `${time}|${scramble}|${startedAt}`;
}
