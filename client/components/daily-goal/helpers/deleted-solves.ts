import dayjs from 'dayjs';
import {getMe} from '../../store';

/**
 * Deleted-solve tally behind "Silinen çözümleri de say" (DailyGoalStorage.count_deleted_solves).
 *
 * Today's goal progress and the activity heatmap both count solves straight from the
 * solve DB, so deleting a solve takes it out of them too. To let a solve that was made
 * and then deleted keep counting there, each deletion is tallied per day and per bucket,
 * the same shape the Friendly Room counts have (room-solves.ts), and those two consumers
 * add the tally in while the toggle is on. The solve itself stays deleted: sessions,
 * stats and PBs never read this.
 *
 * - Keyed by the solve's own day (started_at), so deleting last week's solve today
 *   restores last week's count, not today's.
 * - Recorded whether or not the toggle is on, so turning it on is a pure view switch,
 *   as with the room toggle (which also reaches back over existing history), and
 *   switching it off and on again loses nothing.
 * - Kept in localStorage per user, like the goals. Device-local: storing it on the server
 *   needs a schema change, so a deletion made on another device does not reach here.
 */

type BucketCounts = Record<string, number>;

/** Day key ('YYYY-M-D', as consistency.ts / streak.ts use) → bucket key → count. */
export type DeletedSolveTally = Record<string, BucketCounts>;

/** The fields of a solve the tally reads. */
export interface DeletedSolveLike {
	started_at?: number | null;
	cube_type?: string | null;
	scramble_subset?: string | null;
	from_timer?: boolean | null;
	bulk?: boolean | null;
}

const STORAGE_KEY = 'daily_goal_deleted_solves';

// One day past the heatmap's 365, the longest window anything reads the tally over.
// Older days are dropped on write so the entry cannot grow without bound.
export const DELETED_TALLY_RETENTION_DAYS = 366;

export function deletedTallyDayKey(ms: number): string {
	return dayjs(ms).format('YYYY-M-D');
}

/**
 * Bucket identity. JSON keeps a null subset apart from an empty-string one, as the solve
 * query does ('' is a real subset id, e.g. 7x7 WCA).
 */
export function deletedTallyBucketKey(cubeType: string, scrambleSubset?: string | null): string {
	return JSON.stringify([cubeType, scrambleSubset ?? null]);
}

function parseBucketKey(key: string): [string, string | null] | null {
	try {
		const parsed = JSON.parse(key);
		if (Array.isArray(parsed) && typeof parsed[0] === 'string') {
			return [parsed[0], typeof parsed[1] === 'string' ? parsed[1] : null];
		}
	} catch {
		// Not one of ours
	}
	return null;
}

function retentionCutoffMs(nowMs: number): number {
	return dayjs(nowMs).startOf('day').subtract(DELETED_TALLY_RETENTION_DAYS, 'day').valueOf();
}

function dayKeyToMs(key: string): number {
	const [y, m, d] = key.split('-').map(Number);
	return new Date(y, m - 1, d, 0, 0, 0, 0).getTime();
}

/**
 * Whether deleting this solve is tallied. Only solves the goal and the heatmap counted
 * in the first place (from_timer), and never an imported one (bulk): deleting imported
 * solves is typically undoing an import, not removing solves someone made.
 */
export function isTalliedDeletion(solve: DeletedSolveLike | null | undefined): boolean {
	return (
		!!solve &&
		solve.from_timer === true &&
		!solve.bulk &&
		typeof solve.cube_type === 'string' &&
		!!solve.cube_type &&
		typeof solve.started_at === 'number' &&
		Number.isFinite(solve.started_at) &&
		solve.started_at > 0
	);
}

/** A new tally with the solves added under their own day, and expired days dropped. */
export function addDeletedSolvesToTally(
	tally: DeletedSolveTally,
	solves: DeletedSolveLike[],
	nowMs: number
): DeletedSolveTally {
	const cutoff = retentionCutoffMs(nowMs);
	const next: DeletedSolveTally = {};

	for (const [day, buckets] of Object.entries(tally || {})) {
		const dayMs = dayKeyToMs(day);
		if (!Number.isFinite(dayMs) || dayMs < cutoff || !buckets || typeof buckets !== 'object') continue;
		next[day] = {...buckets};
	}

	for (const solve of solves || []) {
		if (!isTalliedDeletion(solve) || solve.started_at < cutoff) continue;
		const day = deletedTallyDayKey(solve.started_at);
		const bucket = deletedTallyBucketKey(solve.cube_type, solve.scramble_subset);
		const counts = next[day] || (next[day] = {});
		counts[bucket] = (counts[bucket] || 0) + 1;
	}

	return next;
}

/** Deleted solves of one goal bucket on one day. Exact bucket, as the goal's own query. */
export function countDeletedForBucketDay(
	tally: DeletedSolveTally,
	dayKey: string,
	cubeType: string,
	scrambleSubset?: string | null
): number {
	const count = tally?.[dayKey]?.[deletedTallyBucketKey(cubeType, scrambleSubset)];
	return typeof count === 'number' && count > 0 ? count : 0;
}

/**
 * Per-day counts for the heatmap and the streak, filtered the way the stats filter
 * matches solves: no cube type means every bucket; a cube type narrows to it; a subset,
 * when given (null included), narrows to that exact subset too.
 */
export function deletedDailyCountsFromTally(
	tally: DeletedSolveTally,
	cubeType?: string | null,
	scrambleSubset?: string | null
): Map<string, number> {
	const map = new Map<string, number>();

	for (const [day, buckets] of Object.entries(tally || {})) {
		if (!buckets || typeof buckets !== 'object') continue;

		let sum = 0;
		for (const [bucketKey, count] of Object.entries(buckets)) {
			if (typeof count !== 'number' || count <= 0) continue;
			if (cubeType) {
				const bucket = parseBucketKey(bucketKey);
				if (!bucket || bucket[0] !== cubeType) continue;
				if (scrambleSubset !== undefined && bucket[1] !== (scrambleSubset ?? null)) continue;
			}
			sum += count;
		}

		if (sum > 0) {
			map.set(day, sum);
		}
	}

	return map;
}

// --- localStorage ---

function getStorageKey(): string {
	return `${STORAGE_KEY}_${getMe()?.id || '_anon'}`;
}

export function readDeletedSolveTally(): DeletedSolveTally {
	if (typeof window === 'undefined') return {};

	try {
		const raw = localStorage.getItem(getStorageKey());
		const parsed = raw ? JSON.parse(raw) : null;
		return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
	} catch {
		return {};
	}
}

function writeDeletedSolveTally(tally: DeletedSolveTally): void {
	try {
		localStorage.setItem(getStorageKey(), JSON.stringify(tally));
	} catch {
		// Quota or private mode. The tally only feeds an opt-in count; losing a write
		// must never get in the way of the delete that triggered it.
	}
}

/**
 * Called by the solve DB's user-facing delete paths with the solves they actually
 * removed. Sync clean-up (a solve deleted on another device, a stale local copy) goes
 * around those paths and is never tallied: nobody deleted anything on this device.
 */
export function recordDeletedSolves(solves: DeletedSolveLike[]): void {
	if (typeof window === 'undefined' || !solves?.length || !solves.some(isTalliedDeletion)) {
		return;
	}
	writeDeletedSolveTally(addDeletedSolvesToTally(readDeletedSolveTally(), solves, Date.now()));
}

/** Today's deleted solves of a goal bucket. */
export function getDeletedCountForBucketToday(cubeType: string, scrambleSubset?: string | null): number {
	return countDeletedForBucketDay(readDeletedSolveTally(), deletedTallyDayKey(Date.now()), cubeType, scrambleSubset);
}

/** Per-day deleted solve counts (see deletedDailyCountsFromTally for the filter). */
export function getDeletedDailyCounts(cubeType?: string | null, scrambleSubset?: string | null): Map<string, number> {
	return deletedDailyCountsFromTally(readDeletedSolveTally(), cubeType, scrambleSubset);
}
