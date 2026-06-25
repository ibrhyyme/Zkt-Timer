import {gql} from '@apollo/client';
import dayjs from 'dayjs';
import {getMe} from '../../store';
import {emitEvent} from '../../../util/event_handler';
import {gqlQuery} from '../../api';
import {getBucketEventKey} from '../../../../shared/solve';

/**
 * Friendly Room solves live in a separate table (`FriendlyRoomSolve`) and are never
 * written to the personal Solve DB. This module fetches the current user's room
 * solves once and caches them in-memory so the (synchronous) daily-goal progress and
 * activity heatmap can fold them in without per-render network calls.
 *
 * Matching is cube_type-only (rooms carry no scramble subset) via getBucketEventKey.
 */

interface RoomSolveEntry {
	created_at: number; // epoch ms
	cube_type: string;
}

const SINCE_DAYS = 365;

let cache: RoomSolveEntry[] = [];
let loaded = false;
let inFlight: Promise<void> | null = null;

const ROOM_SOLVE_ENTRIES_QUERY = gql`
	query MyRoomSolveEntries($sinceDays: Int!) {
		myRoomSolveEntries(sinceDays: $sinceDays) {
			created_at
			cube_type
		}
	}
`;

/** True once a fetch has populated the cache at least once. */
export function hasRoomSolveCache(): boolean {
	return loaded;
}

/**
 * Fetch the user's room solves and refresh the cache. Fire-and-forget safe.
 * Emits `dailyGoalUpdatedEvent` so progress bars + heatmap recompute.
 */
export async function fetchRoomSolveCounts(): Promise<void> {
	const me = getMe();
	if (!me) {
		cache = [];
		loaded = false;
		return;
	}

	if (inFlight) return inFlight;

	inFlight = (async () => {
		try {
			const res = await gqlQuery<{myRoomSolveEntries: RoomSolveEntry[]}>(ROOM_SOLVE_ENTRIES_QUERY, {
				sinceDays: SINCE_DAYS,
			});
			cache = (res.data.myRoomSolveEntries || []).map((e) => ({
				created_at: Number(e.created_at),
				cube_type: e.cube_type,
			}));
			loaded = true;
			emitEvent('dailyGoalUpdatedEvent');
		} catch (e) {
			console.error('Failed to fetch room solve counts', e);
		} finally {
			inFlight = null;
		}
	})();

	return inFlight;
}

/** Clear the cache (e.g. on logout). */
export function clearRoomSolveCache(): void {
	cache = [];
	loaded = false;
}

function startOfTodayMs(): number {
	const d = new Date();
	d.setHours(0, 0, 0, 0);
	return d.getTime();
}

/**
 * Today's room solve count for a goal bucket. Subset is ignored beyond the WCA-event
 * collapse done by getBucketEventKey (a `wca::333` goal matches a `333` room).
 */
export function getRoomCountForBucketToday(cubeType: string, scrambleSubset?: string | null): number {
	if (!loaded || cache.length === 0) return 0;
	const todayStart = startOfTodayMs();
	const goalKey = getBucketEventKey(cubeType, scrambleSubset ?? null);

	let count = 0;
	for (const entry of cache) {
		if (entry.created_at < todayStart) continue;
		if (getBucketEventKey(entry.cube_type, null) === goalKey) count++;
	}
	return count;
}

/**
 * Per-day room solve counts (key: `YYYY-M-D`, matching consistency.ts/streak.ts).
 * When cubeType is given, only solves matching that bucket's event key are counted;
 * otherwise all room solves are counted.
 */
export function getRoomDailyCounts(cubeType?: string | null, scrambleSubset?: string | null): Map<string, number> {
	const map = new Map<string, number>();
	if (!loaded || cache.length === 0) return map;

	const filterKey = cubeType ? getBucketEventKey(cubeType, scrambleSubset ?? null) : null;

	for (const entry of cache) {
		if (filterKey && getBucketEventKey(entry.cube_type, null) !== filterKey) continue;
		const key = dayjs(entry.created_at).format('YYYY-M-D');
		map.set(key, (map.get(key) || 0) + 1);
	}
	return map;
}
