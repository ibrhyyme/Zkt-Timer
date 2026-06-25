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
