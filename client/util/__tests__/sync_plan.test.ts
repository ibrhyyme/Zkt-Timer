import {isSuspiciousMassDeletion, planDeltaSync} from '../sync-plan';

function ids(...values: string[]) {
	return new Set(values);
}

function range(prefix: string, n: number): string[] {
	return Array.from({length: n}, (_, i) => `${prefix}${i}`);
}

describe('planDeltaSync', () => {
	it('fetches server-only ids and removes local-only ones', () => {
		const plan = planDeltaSync({
			serverIds: ids('a', 'b', 'c'),
			localIds: ids('b', 'c', 'd'),
			pendingCreateIds: ids(),
			pendingDeleteIds: ids(),
			tombstoned: ids(),
		});
		expect(plan.toFetch).toEqual(['a']);
		expect(plan.toRemove).toEqual(['d']);
		expect(plan.resurrected).toEqual([]);
	});

	it('never removes a solve whose create is still queued', () => {
		const plan = planDeltaSync({
			serverIds: ids('a'),
			localIds: ids('a', 'offline-1'),
			pendingCreateIds: ids('offline-1'),
			pendingDeleteIds: ids(),
			tombstoned: ids(),
		});
		expect(plan.toRemove).toEqual([]);
	});

	it('does not fetch back what this device is deleting or has deleted', () => {
		const plan = planDeltaSync({
			serverIds: ids('pending-delete', 'tombstoned', 'new'),
			localIds: ids(),
			pendingCreateIds: ids(),
			pendingDeleteIds: ids('pending-delete'),
			tombstoned: ids('tombstoned'),
		});
		expect(plan.toFetch).toEqual(['new']);
		expect(plan.resurrected).toEqual(['tombstoned']);
	});

	it('applies a large removal: that is how a mass deletion on another device arrives', () => {
		// Withholding it would let the launch backfill upload the deleted solves again.
		const local = range('l', 200);
		const plan = planDeltaSync({
			serverIds: new Set(local.slice(0, 50)),
			localIds: new Set(local),
			pendingCreateIds: ids(),
			pendingDeleteIds: ids(),
			tombstoned: ids(),
		});
		expect(plan.toRemove).toHaveLength(150);
	});
});

describe('isSuspiciousMassDeletion', () => {
	it('needs both the absolute and the relative threshold', () => {
		expect(isSuspiciousMassDeletion(51, 100)).toBe(true);
		expect(isSuspiciousMassDeletion(50, 100)).toBe(false);
		expect(isSuspiciousMassDeletion(60, 1000)).toBe(false);
	});
});
