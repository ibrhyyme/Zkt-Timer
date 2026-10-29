import {
	changeDigest,
	changeFlags,
	diffRegistrants,
	hasGroups,
	isWatchActive,
	lightRegistrationsFromApi,
	listHash,
	registrantsFromWcif,
	unstaffedRegistrationIds,
	WatchedRegistrant,
} from '../RegistrationWatch';

// --- Fixtures -------------------------------------------------------------------

function wcifPerson(
	registrantId: number,
	wcaRegistrationId: number,
	opts: {name?: string; status?: string; events?: string[]; roles?: string[]; groups?: number; tasks?: number} = {}
) {
	const assignments: any[] = [];
	for (let i = 0; i < (opts.groups ?? 0); i++) assignments.push({activityId: 100 + i, assignmentCode: 'competitor'});
	for (let i = 0; i < (opts.tasks ?? 0); i++) assignments.push({activityId: 200 + i, assignmentCode: 'staff-judge'});
	return {
		name: opts.name ?? `Person ${registrantId}`,
		wcaUserId: 5000 + registrantId,
		wcaId: null,
		registrantId,
		roles: opts.roles ?? [],
		registration: {
			wcaRegistrationId,
			eventIds: opts.events ?? ['333', '222'],
			status: opts.status ?? 'accepted',
			isCompeting: true,
		},
		assignments,
	};
}

function reg(id: number, overrides: Partial<WatchedRegistrant> = {}): WatchedRegistrant {
	return {
		wcaRegistrationId: id,
		registrantId: id - 1000,
		wcaUserId: null,
		wcaId: null,
		name: `Person ${id}`,
		eventIds: ['222', '333'],
		roles: [],
		competitorGroups: 2,
		staffTasks: 1,
		...overrides,
	};
}

// --- Reading ----------------------------------------------------------------------

describe('registrantsFromWcif', () => {
	it('keeps accepted registrants only and counts groups and tasks', () => {
		const out = registrantsFromWcif({
			persons: [
				wcifPerson(1, 1001, {groups: 3, tasks: 2, events: ['333', '222']}),
				wcifPerson(2, 1002, {status: 'pending'}),
				wcifPerson(3, 1003, {status: 'deleted'}),
			],
		});
		expect(out).toHaveLength(1);
		expect(out[0]).toMatchObject({
			wcaRegistrationId: 1001,
			registrantId: 1,
			competitorGroups: 3,
			staffTasks: 2,
			eventIds: ['222', '333'],
		});
	});

	it('survives a WCIF with no persons', () => {
		expect(registrantsFromWcif({})).toEqual([]);
		expect(registrantsFromWcif(null)).toEqual([]);
	});
});

describe('listHash', () => {
	it('matches between the light read and the WCIF of the same list', () => {
		const light = lightRegistrationsFromApi([
			{id: 1002, event_ids: ['333']},
			{id: 1001, event_ids: ['333', '222']},
		]);
		const fromWcif = registrantsFromWcif({
			persons: [wcifPerson(1, 1001, {events: ['222', '333']}), wcifPerson(2, 1002, {events: ['333']})],
		});
		expect(listHash(light)).toBe(listHash(fromWcif));
	});

	it('moves when someone is swapped, even though the count stays', () => {
		const a = listHash([{wcaRegistrationId: 1, eventIds: ['333']}, {wcaRegistrationId: 2, eventIds: ['333']}]);
		const b = listHash([{wcaRegistrationId: 1, eventIds: ['333']}, {wcaRegistrationId: 3, eventIds: ['333']}]);
		expect(a).not.toBe(b);
	});

	it('moves when events change', () => {
		const a = listHash([{wcaRegistrationId: 1, eventIds: ['333']}]);
		const b = listHash([{wcaRegistrationId: 1, eventIds: ['333', '222']}]);
		expect(a).not.toBe(b);
	});
});

// --- Diff -------------------------------------------------------------------------

describe('diffRegistrants', () => {
	it('finds a swap behind an unchanged count', () => {
		const before = [reg(1001), reg(1048), reg(1069)];
		const after = [reg(1001), reg(1007), reg(1058)];
		const changes = diffRegistrants(before, after);
		expect(changes.filter((c) => c.kind === 'left').map((c) => c.registrant.wcaRegistrationId).sort()).toEqual([1048, 1069]);
		expect(changes.filter((c) => c.kind === 'joined').map((c) => c.registrant.wcaRegistrationId).sort()).toEqual([1007, 1058]);
	});

	it('reports an event change with both sides', () => {
		const [change] = diffRegistrants([reg(1001, {eventIds: ['333']})], [reg(1001, {eventIds: ['222', '333']})]);
		expect(change).toMatchObject({kind: 'events_changed', eventsBefore: ['333'], eventsAfter: ['222', '333']});
	});

	it('ignores group and task changes', () => {
		expect(diffRegistrants([reg(1001, {staffTasks: 0})], [reg(1001, {staffTasks: 3})])).toEqual([]);
	});
});

describe('changeFlags', () => {
	const close = new Date('2026-10-03T19:55:05Z');
	const groups = new Date('2026-10-27T16:10:00Z');

	it('flags a change whose whole window is past both moments', () => {
		expect(
			changeFlags({windowStart: new Date('2026-10-28T10:00:00Z'), registrationClose: close, groupsSeenAt: groups})
		).toEqual({afterClose: true, afterGroups: true});
	});

	it('does not guess for a window that straddles the moment', () => {
		expect(
			changeFlags({windowStart: new Date('2026-10-27T16:00:00Z'), registrationClose: close, groupsSeenAt: groups})
		).toEqual({afterClose: true, afterGroups: false});
	});

	it('flags nothing without a window start or the moments', () => {
		expect(changeFlags({windowStart: null, registrationClose: close, groupsSeenAt: groups})).toEqual({
			afterClose: false,
			afterGroups: false,
		});
		expect(
			changeFlags({windowStart: new Date('2026-10-28T10:00:00Z'), registrationClose: null, groupsSeenAt: null})
		).toEqual({afterClose: false, afterGroups: false});
	});
});

// --- Anomaly ----------------------------------------------------------------------

describe('unstaffedRegistrationIds', () => {
	it('picks the competitors without a task when nearly everyone has one', () => {
		const list = [
			...Array.from({length: 10}, (_, i) => reg(2000 + i)),
			reg(3001, {staffTasks: 0}),
			reg(3002, {staffTasks: 0, roles: ['organizer']}),
			reg(3003, {staffTasks: 0, roles: ['staff-other', 'delegate']}),
		];
		expect([...unstaffedRegistrationIds(list)]).toEqual([3001]);
	});

	it('says nothing when the group tool handed out no tasks', () => {
		const list = Array.from({length: 10}, (_, i) => reg(2000 + i, {staffTasks: i < 5 ? 1 : 0}));
		expect(unstaffedRegistrationIds(list).size).toBe(0);
	});

	it('says nothing before groups exist', () => {
		const list = Array.from({length: 5}, (_, i) => reg(2000 + i, {competitorGroups: 0, staffTasks: 0}));
		expect(hasGroups(list)).toBe(false);
		expect(unstaffedRegistrationIds(list).size).toBe(0);
	});
});

// --- Misc -------------------------------------------------------------------------

describe('isWatchActive', () => {
	it('keeps reading through the day after the competition', () => {
		const end = new Date('2026-11-01T00:00:00Z');
		expect(isWatchActive(end, new Date('2026-11-02T20:00:00Z'))).toBe(true);
		expect(isWatchActive(end, new Date('2026-11-03T01:00:00Z'))).toBe(false);
	});
});

describe('changeDigest', () => {
	it('names the people of the flagged changes only', () => {
		const text = changeDigest([
			{kind: 'left', name: 'A', afterClose: true, afterGroups: true},
			{kind: 'joined', name: 'B', afterClose: true, afterGroups: true},
			{kind: 'joined', name: 'C', afterClose: false, afterGroups: false},
		]);
		expect(text).toBe('Çıkan: A. Giren: B (gruplar açıklandıktan sonra).');
	});

	it('is null when nothing happened after close', () => {
		expect(changeDigest([{kind: 'joined', name: 'C', afterClose: false, afterGroups: false}])).toBeNull();
	});
});
