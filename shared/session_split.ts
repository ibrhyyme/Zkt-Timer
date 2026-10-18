import {toStoredSubset} from './solve';

/**
 * "Split session": the solves of the chosen buckets move out of a session into a new one.
 * A bucket is the (cube_type, scramble_subset) pair that identifies which list a solve
 * belongs to (see the cube-subset-bucket skill). Client and server use the same rules here,
 * so the local LokiJS move and the server's updateMany select exactly the same solves.
 */

export interface SolveBucket {
	cube_type: string;
	scramble_subset: string | null;
}

/** Upper bounds for the server-side input check. */
export const MAX_SPLIT_BUCKETS = 200;
export const MAX_BUCKET_FIELD_LENGTH = 100;
/** Same cap as the session name inputs on the client. */
export const MAX_SPLIT_SESSION_NAME_LENGTH = 200;

export function splitBucketKey(bucket: {cube_type: string; scramble_subset?: string | null}): string {
	return `${bucket.cube_type}::${toStoredSubset(bucket.scramble_subset) ?? ''}`;
}

/** Drops duplicates and normalizes the "default subset" spelling ('' and null) to null. */
export function normalizeSplitBuckets(buckets: {cube_type: string; scramble_subset?: string | null}[]): SolveBucket[] {
	const seen = new Set<string>();
	const out: SolveBucket[] = [];
	for (const bucket of buckets || []) {
		if (!bucket || typeof bucket.cube_type !== 'string' || !bucket.cube_type) continue;
		const normalized: SolveBucket = {
			cube_type: bucket.cube_type,
			scramble_subset: toStoredSubset(bucket.scramble_subset),
		};
		const key = splitBucketKey(normalized);
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(normalized);
	}
	return out;
}

/** Returns a reason when the input cannot be accepted, otherwise null. */
export function validateSplitBuckets(buckets: {cube_type: string; scramble_subset?: string | null}[]): string | null {
	if (!Array.isArray(buckets) || !buckets.length) {
		return 'Select at least one cube type';
	}
	if (buckets.length > MAX_SPLIT_BUCKETS) {
		return `Cannot split more than ${MAX_SPLIT_BUCKETS} cube types at once`;
	}
	for (const bucket of buckets) {
		if (!bucket || typeof bucket.cube_type !== 'string' || !bucket.cube_type) {
			return 'Invalid cube type';
		}
		if (bucket.cube_type.length > MAX_BUCKET_FIELD_LENGTH) {
			return 'Invalid cube type';
		}
		const subset = bucket.scramble_subset;
		if (subset != null && (typeof subset !== 'string' || subset.length > MAX_BUCKET_FIELD_LENGTH)) {
			return 'Invalid scramble subset';
		}
	}
	return null;
}

/** Builds a matcher for "does this solve belong to one of the chosen buckets". */
export function createSplitBucketMatcher(
	buckets: {cube_type: string; scramble_subset?: string | null}[]
): (solve: {cube_type?: string | null; scramble_subset?: string | null}) => boolean {
	const keys = new Set(normalizeSplitBuckets(buckets).map(splitBucketKey));
	return (solve) => {
		if (!solve || !solve.cube_type) return false;
		return keys.has(splitBucketKey({cube_type: solve.cube_type, scramble_subset: solve.scramble_subset}));
	};
}

/**
 * Default name of the new session: the original name with the moved types in brackets,
 * "3x3 (PLL)" or "3x3 (2x2, Pyraminx)". Kept within the name length cap.
 */
export function buildSplitSessionName(
	originalName: string,
	bucketLabels: string[],
	maxLength: number = MAX_SPLIT_SESSION_NAME_LENGTH
): string {
	const base = (originalName || '').trim();
	const labels = Array.from(new Set((bucketLabels || []).map((l) => (l || '').trim()).filter(Boolean)));
	const suffix = labels.join(', ');

	let name: string;
	if (!suffix) {
		name = base;
	} else if (!base) {
		name = suffix;
	} else {
		name = `${base} (${suffix})`;
	}

	if (name.length <= maxLength) {
		return name;
	}

	// Too long: keep the original name whole when it fits and shorten the type list.
	if (base && suffix && base.length + 4 < maxLength) {
		const room = maxLength - base.length - 3; // " (" and ")"
		return `${base} (${suffix.slice(0, Math.max(0, room - 1)).trimEnd()}…)`;
	}
	return name.slice(0, maxLength);
}

/**
 * Where the new session goes in the list: right after the one it came from, so the two
 * stay next to each other. Returns the full id order to store.
 */
export function orderAfterSource(orderedIds: string[], sourceId: string, newId: string): string[] {
	const without = orderedIds.filter((id) => id !== newId);
	const index = without.indexOf(sourceId);
	if (index === -1) {
		return [...without, newId];
	}
	return [...without.slice(0, index + 1), newId, ...without.slice(index + 1)];
}
