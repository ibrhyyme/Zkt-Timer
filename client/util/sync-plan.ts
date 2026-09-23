/**
 * Pure decisions of the solve sync (layout/init.ts), kept apart so they can be tested
 * without LokiJS or the network.
 */

// A response that would delete more than this share of the local DB in one pass is far
// more likely to be partial or broken than a real batch of deletions made elsewhere.
const MASS_DELETE_MIN = 50;
const MASS_DELETE_SHARE = 0.2;

export function isSuspiciousMassDeletion(toDelete: number, localCount: number): boolean {
	return toDelete > MASS_DELETE_MIN && toDelete > localCount * MASS_DELETE_SHARE;
}

export interface DeltaPlanInput {
	serverIds: Set<string>;
	localIds: Set<string>;
	/** Unsent creates: absent server-side because they have not arrived yet. */
	pendingCreateIds: Set<string>;
	/** Unsent deletes: still present server-side because the delete has not arrived yet. */
	pendingDeleteIds: Set<string>;
	/** Deleted on this device. On the server again only because another device re-sent it. */
	tombstoned: Set<string>;
}

export interface DeltaPlan {
	toFetch: string[];
	toRemove: string[];
	resurrected: string[];
}

export function planDeltaSync(input: DeltaPlanInput): DeltaPlan {
	const {serverIds, localIds, pendingCreateIds, pendingDeleteIds, tombstoned} = input;

	const toFetch: string[] = [];
	const resurrected: string[] = [];
	for (const id of serverIds) {
		if (localIds.has(id) || pendingDeleteIds.has(id)) continue;
		if (tombstoned.has(id)) {
			resurrected.push(id);
			continue;
		}
		toFetch.push(id);
	}

	const toRemove: string[] = [];
	for (const id of localIds) {
		if (!serverIds.has(id) && !pendingCreateIds.has(id)) {
			toRemove.push(id);
		}
	}

	// Deliberately no mass-deletion guard here (unlike the reconciling sync). This is the
	// path through which a large deletion made on another device (a session with a thousand
	// solves) reaches this one, since that deletion changes the offline hash. Withholding it
	// would not just keep the solves here: the launch backfill would then upload them again
	// and undo the deletion everywhere. `mySolveIds` is one complete query, so a partial list
	// is not a realistic failure; the empty-list case is guarded by the caller.
	return {toFetch, toRemove, resurrected};
}
