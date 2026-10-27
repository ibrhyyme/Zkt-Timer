import {findPersonInWcif} from '../WcifTransformer';
import {
	acceptedPersons,
	announcementVariant,
	bestsAtCompetition,
	buildPersonTimeline,
	buildRankLines,
	computeNextCheckAt,
	decideAnnouncement,
	decideQuiet,
	decideReminder,
	diffTimeline,
	findNewPbs,
	formatCompTime,
	formatWcaResult,
	groupsHash,
	isAnnounceQuietHours,
	PersonTimeline,
	rankBaselineFromPerson,
	ranksReady,
	REGISTRATION_REMINDER_LEAD_MS,
	scheduleChangeDiff,
	scheduleHash,
	summarizeAssignments,
	wcifDates,
	wcifRegistrationOpenAt,
	zktWcifStatus,
} from '../CompetitionLifecycle';

// --- Fixtures -------------------------------------------------------------------

const MIN = 60 * 1000;

function activity(id: number, activityCode: string, start: string, children: any[] = []) {
	return {id, name: activityCode, activityCode, startTime: start, endTime: start, childActivities: children};
}

function wcif(persons: any[], over: any = {}): any {
	return {
		id: 'TestComp2026',
		name: 'Test Comp 2026',
		persons,
		schedule: {
			startDate: '2026-11-07',
			numberOfDays: 2,
			venues: [
				{
					id: 1,
					name: 'Venue',
					timezone: 'Europe/Istanbul',
					rooms: [
						{
							id: 1,
							name: 'Main',
							color: '#000',
							activities: [
								activity(10, '333-r1', '2026-11-07T07:00:00Z', [
									activity(11, '333-r1-g1', '2026-11-07T07:00:00Z'),
									activity(12, '333-r1-g2', '2026-11-07T07:30:00Z'),
								]),
								activity(20, '222-r1', '2026-11-07T09:00:00Z', [activity(21, '222-r1-g1', '2026-11-07T09:00:00Z')]),
								activity(30, '333-r2', '2026-11-08T08:00:00Z'),
								activity(40, 'other-lunch', '2026-11-07T10:00:00Z'),
							],
						},
						{
							id: 2,
							name: 'Side',
							color: '#fff',
							// The same round run in a parallel room: merged into one span.
							activities: [activity(50, '333-r1', '2026-11-07T07:15:00Z')],
						},
					],
				},
			],
		},
		...over,
	};
}

function person(over: any = {}): any {
	return {
		registrantId: 7,
		wcaUserId: 1234,
		wcaId: '2020TEST01',
		name: 'Test Person',
		roles: [],
		registration: {eventIds: ['333', '222'], status: 'accepted'},
		assignments: [],
		personalBests: [],
		...over,
	};
}

// --- Identity -------------------------------------------------------------------

describe('findPersonInWcif', () => {
	const a = {registrantId: 1, wcaId: '2020AAAA01', wcaUserId: 11, zktUserId: null, zktId: null};
	const b = {registrantId: 2, wcaId: null, wcaUserId: 22, zktUserId: null, zktId: null};
	const c = {registrantId: 3, wcaId: null, wcaUserId: null, zktUserId: 'cuid-c', zktId: '2024ZKT01'};
	const d = {registrantId: 4, wcaId: null, wcaUserId: null, zktUserId: null, zktId: '2023ZKT09'};
	const persons = [a, b, c, d];

	it('matches on the WCA id first', () => {
		expect(findPersonInWcif(persons, {wcaId: '2020AAAA01', wcaUserId: '22'})).toBe(a);
	});

	it('falls back to the WCA account id for a first-timer', () => {
		expect(findPersonInWcif(persons, {wcaUserId: '22'})).toBe(b);
	});

	it('matches ZKT members on the account id, then the competitor id', () => {
		expect(findPersonInWcif(persons, {zktUserId: 'cuid-c'})).toBe(c);
		expect(findPersonInWcif(persons, {zktId: '2023ZKT09'})).toBe(d);
	});

	it('never treats two nulls as a match', () => {
		expect(findPersonInWcif(persons, {wcaId: null, wcaUserId: null, zktUserId: null, zktId: null})).toBeNull();
		expect(findPersonInWcif(persons, {})).toBeNull();
	});
});

// --- WCIF helpers -------------------------------------------------------------------

describe('WCIF helpers', () => {
	it('keeps only accepted registrants', () => {
		const w = wcif([person(), person({registrantId: 8, registration: {eventIds: [], status: 'pending'}})]);
		expect(acceptedPersons(w).map((p) => p.registrantId)).toEqual([7]);
	});

	it('derives start and end dates as UTC midnights', () => {
		const dates = wcifDates(wcif([]))!;
		expect(dates.start.toISOString()).toBe('2026-11-07T00:00:00.000Z');
		expect(dates.end.toISOString()).toBe('2026-11-08T00:00:00.000Z');
		expect(wcifDates({schedule: {}})).toBeNull();
	});

	it('reads the ZKT status and the registration opening', () => {
		const w = {
			extensions: [{id: 'org.zktimer.zktCompetition.v1', data: {status: 'PUBLISHED'}}],
			registrationInfo: {openTime: '2026-10-10T17:00:00.000Z'},
		};
		expect(zktWcifStatus(w)).toBe('PUBLISHED');
		expect(wcifRegistrationOpenAt(w)?.toISOString()).toBe('2026-10-10T17:00:00.000Z');
		expect(wcifRegistrationOpenAt({registrationInfo: {openTime: null}})).toBeNull();
	});
});

// --- Timeline -------------------------------------------------------------------------

describe('buildPersonTimeline', () => {
	it('uses the registered rounds before groups exist, merging parallel rooms', () => {
		const t = buildPersonTimeline(wcif([]), person());
		expect(t.kind).toBe('registered');
		expect(t.entries.map((e) => e.activityCode)).toEqual(['333-r1', '222-r1', '333-r2']);
		const r1 = t.entries[0];
		expect(r1.start).toBe('2026-11-07T07:00:00Z');
		expect(r1.end).toBe('2026-11-07T07:15:00Z');
		expect(groupsHash(t)).toBe('');
	});

	it('uses the person own assignments once they exist', () => {
		const p = person({
			assignments: [
				{activityId: 12, assignmentCode: 'competitor'},
				{activityId: 21, assignmentCode: 'staff-judge'},
				{activityId: 11, assignmentCode: 'staff-scrambler'},
			],
		});
		const t = buildPersonTimeline(wcif([p]), p);
		expect(t.kind).toBe('assigned');
		expect(t.entries.map((e) => e.key)).toEqual(['333-r1-g1|staff-scrambler', '333-r1-g2|competitor', '222-r1-g1|staff-judge']);
		expect(groupsHash(t)).not.toBe('');
	});

	it('keeps keys unique when the same activity and role repeat', () => {
		const p = person({
			assignments: [
				{activityId: 21, assignmentCode: 'staff-judge'},
				{activityId: 21, assignmentCode: 'staff-judge'},
			],
		});
		const keys = buildPersonTimeline(wcif([p]), p).entries.map((e) => e.key);
		expect(keys).toEqual(['222-r1-g1|staff-judge', '222-r1-g1|staff-judge#2']);
	});

	it('survives a WCIF without a schedule', () => {
		const t = buildPersonTimeline({persons: []} as any, person());
		expect(t).toEqual({kind: 'registered', entries: []});
	});
});

describe('hashes', () => {
	const p = person({assignments: [{activityId: 12, assignmentCode: 'competitor'}]});

	it('schedule hash moves with a start time, groups hash does not', () => {
		const before = buildPersonTimeline(wcif([p]), p);
		const moved = wcif([p]);
		moved.schedule.venues[0].rooms[0].activities[0].childActivities[1].startTime = '2026-11-07T08:00:00Z';
		const after = buildPersonTimeline(moved, p);
		expect(scheduleHash(after)).not.toBe(scheduleHash(before));
		expect(groupsHash(after)).toBe(groupsHash(before));
	});

	it('ignores a re-serialised timestamp and an end-only edit', () => {
		const before = buildPersonTimeline(wcif([p]), p);
		const same = wcif([p]);
		const g2 = same.schedule.venues[0].rooms[0].activities[0].childActivities[1];
		g2.startTime = '2026-11-07T07:30:00.000+00:00';
		g2.endTime = '2026-11-07T09:00:00Z';
		expect(scheduleHash(buildPersonTimeline(same, p))).toBe(scheduleHash(before));
	});
});

// --- Diff ---------------------------------------------------------------------------------

function entry(key: string, start: string, assignmentCode = 'competitor') {
	const activityCode = key.split('|')[0];
	return {key, activityCode, assignmentCode, name: null, start, end: start};
}

function timeline(kind: 'assigned' | 'registered', entries: any[]): PersonTimeline {
	return {kind, entries};
}

describe('diffTimeline / scheduleChangeDiff', () => {
	const now = new Date('2026-11-01T00:00:00Z');

	it('reports moved, added and removed entries', () => {
		const before = timeline('assigned', [entry('333-r1-g1|competitor', '2026-11-07T07:00:00Z'), entry('222-r1-g1|staff-judge', '2026-11-07T09:00:00Z')]);
		const after = timeline('assigned', [entry('333-r1-g1|competitor', '2026-11-07T07:30:00Z'), entry('444-r1-g1|competitor', '2026-11-07T11:00:00Z')]);
		const diff = diffTimeline(before, after, now);
		expect(diff.changed.map((c) => c.after.key)).toEqual(['333-r1-g1|competitor']);
		expect(diff.added.map((e) => e.key)).toEqual(['444-r1-g1|competitor']);
		expect(diff.removed.map((e) => e.key)).toEqual(['222-r1-g1|staff-judge']);
	});

	it('ignores changes entirely in the past', () => {
		const late = new Date('2026-11-07T12:00:00Z');
		const before = timeline('assigned', [entry('333-r1-g1|competitor', '2026-11-07T07:00:00Z')]);
		const after = timeline('assigned', [entry('333-r1-g1|competitor', '2026-11-07T07:30:00Z')]);
		expect(diffTimeline(before, after, late).changed).toHaveLength(0);
	});

	it('treats a first-published schedule as no change', () => {
		const before = timeline('registered', []);
		const after = timeline('registered', [entry('333-r1|registered', '2026-11-07T07:00:00Z', 'registered')]);
		expect(scheduleChangeDiff(before, after, now)).toEqual({changed: [], added: [], removed: []});
	});

	it('before groups, only moved times count (registration edits are the user own doing)', () => {
		const before = timeline('registered', [entry('333-r1|registered', '2026-11-07T07:00:00Z', 'registered')]);
		const after = timeline('registered', [
			entry('333-r1|registered', '2026-11-07T08:00:00Z', 'registered'),
			entry('444-r1|registered', '2026-11-07T10:00:00Z', 'registered'),
		]);
		const diff = scheduleChangeDiff(before, after, now);
		expect(diff.changed).toHaveLength(1);
		expect(diff.added).toHaveLength(0);
	});
});

// --- Quiet period ---------------------------------------------------------------------------

describe('decideQuiet', () => {
	const t0 = new Date('2026-11-01T10:00:00Z');
	const quietMs = 20 * MIN;

	it('starts a quiet period on a new value', () => {
		expect(decideQuiet({current: 'B', baseline: 'A', pending: null, pendingSince: null, now: t0, quietMs})).toBe('set_pending');
	});

	it('restarts it when the value changes again mid-burst', () => {
		expect(decideQuiet({current: 'C', baseline: 'A', pending: 'B', pendingSince: t0, now: new Date(t0.getTime() + 25 * MIN), quietMs})).toBe('set_pending');
	});

	it('waits while the value holds still, then fires once', () => {
		const args = {current: 'B', baseline: 'A', pending: 'B', pendingSince: t0, quietMs};
		expect(decideQuiet({...args, now: new Date(t0.getTime() + 10 * MIN)})).toBe('none');
		expect(decideQuiet({...args, now: new Date(t0.getTime() + 20 * MIN)})).toBe('fire');
	});

	it('drops a pending change that was undone', () => {
		expect(decideQuiet({current: 'A', baseline: 'A', pending: 'B', pendingSince: t0, now: t0, quietMs})).toBe('clear');
		expect(decideQuiet({current: 'A', baseline: 'A', pending: null, pendingSince: null, now: t0, quietMs})).toBe('none');
	});

	it('with no baseline (groups not yet announced) any value is new', () => {
		expect(decideQuiet({current: 'G', baseline: null, pending: null, pendingSince: null, now: t0, quietMs})).toBe('set_pending');
	});

	it('coalesces a burst of five edits into a single fire', () => {
		let pending: string | null = null;
		let since: Date | null = null;
		let fires = 0;
		const edits = ['B', 'C', 'D', 'E', 'F'];
		let now = t0.getTime();
		for (const value of edits) {
			const d = decideQuiet({current: value, baseline: 'A', pending, pendingSince: since, now: new Date(now), quietMs});
			if (d === 'set_pending') {
				pending = value;
				since = new Date(now);
			}
			if (d === 'fire') fires++;
			now += 3 * MIN;
		}
		for (let i = 0; i < 10; i++) {
			const d = decideQuiet({current: 'F', baseline: 'A', pending, pendingSince: since, now: new Date(now), quietMs});
			if (d === 'fire') {
				fires++;
				break;
			}
			now += 5 * MIN;
		}
		expect(fires).toBe(1);
	});
});

describe('summarizeAssignments', () => {
	it('splits competing groups from duties', () => {
		const t = timeline('assigned', [
			entry('333-r1-g2|competitor', '2026-11-07T07:30:00Z'),
			entry('222-r1-g1|staff-judge', '2026-11-07T09:00:00Z', 'staff-judge'),
			entry('333-r1-g1|staff-scrambler', '2026-11-07T07:00:00Z', 'staff-scrambler'),
			entry('444-r1-g1|staff-dataentry', '2026-11-07T10:00:00Z', 'staff-dataentry'),
		]);
		const s = summarizeAssignments(t);
		expect(s.competing.map((e) => e.key)).toEqual(['333-r1-g2|competitor']);
		expect(s.duties).toEqual({judge: 1, scrambler: 1, runner: 0, other: 1});
	});
});

// --- Results and ranks ---------------------------------------------------------------------

describe('official results', () => {
	const baseline = rankBaselineFromPerson(
		person({
			personalBests: [
				{eventId: '333', best: 1200, type: 'average', worldRanking: 5000, continentalRanking: 900, nationalRanking: 45},
				{eventId: '333', best: 1000, type: 'single', worldRanking: 6000, continentalRanking: 1000, nationalRanking: 50},
			],
		})
	);
	const results = [
		{competition_id: 'TestComp2026', event_id: '333', best: 980, average: 1124},
		{competition_id: 'TestComp2026', event_id: '333', best: 1050, average: 1180},
		{competition_id: 'TestComp2026', event_id: '222', best: 300, average: 0},
		{competition_id: 'OtherComp', event_id: '333', best: 500, average: 600},
	];

	it('takes the best single and average per event at this competition only', () => {
		const bests = bestsAtCompetition(results, 'TestComp2026');
		expect(bests).toEqual(
			expect.arrayContaining([
				{eventId: '333', type: 'single', best: 980},
				{eventId: '333', type: 'average', best: 1124},
				{eventId: '222', type: 'single', best: 300},
			])
		);
		expect(bests).toHaveLength(3);
	});

	it('finds PBs against the pre-competition baseline, new events included', () => {
		const pbs = findNewPbs(baseline, bestsAtCompetition(results, 'TestComp2026'));
		expect(pbs.map((p) => `${p.eventId}:${p.type}`).sort()).toEqual(['222:single', '333:average', '333:single']);
	});

	it('waits for WCA rank tables to catch up', () => {
		const pbs = [{eventId: '333', type: 'average' as const, best: 1124}];
		expect(ranksReady(pbs, {'333': {average: {best: 1200, country_rank: 45}}})).toBe(false);
		expect(ranksReady(pbs, {'333': {average: {best: 1124, country_rank: 38}}})).toBe(true);
		expect(ranksReady(pbs, null)).toBe(false);
	});

	it('builds rank lines, biggest climb first, unmoved ranks dropped', () => {
		const pbs = [
			{eventId: '333', type: 'average' as const, best: 1124},
			{eventId: '333', type: 'single' as const, best: 980},
			{eventId: '222', type: 'single' as const, best: 300},
		];
		const records = {
			'333': {average: {best: 1124, country_rank: 38}, single: {best: 980, country_rank: 50}},
			'222': {single: {best: 300, country_rank: 120}},
		};
		const lines = buildRankLines(pbs, baseline, records);
		expect(lines).toEqual([
			{eventId: '333', type: 'average', best: 1124, before: 45, after: 38},
			{eventId: '222', type: 'single', best: 300, before: null, after: 120},
		]);
	});
});

describe('formatWcaResult', () => {
	it('formats times, FMC and MBLD correctly', () => {
		expect(formatWcaResult(1124, '333', 'average')).toBe('11.24');
		expect(formatWcaResult(6543, '444', 'single')).toBe('1:05.43');
		expect(formatWcaResult(28, '333fm', 'single')).toBe('28');
		expect(formatWcaResult(2933, '333fm', 'average')).toBe('29.33');
		// 0DDTTTTTMM: 2 points -> DD = 99 - 2 = 97, 3465 s, 1 missed => 3/4 in 57:45
		expect(formatWcaResult(970346501, '333mbf', 'single')).toBe('3/4 57:45');
		expect(formatWcaResult(-1, '333', 'single')).toBe('DNF');
	});
});

// --- Pacing --------------------------------------------------------------------------------

describe('computeNextCheckAt', () => {
	const start = new Date('2026-11-07T00:00:00Z');
	const end = new Date('2026-11-08T00:00:00Z');

	it('checks often close to the competition and rarely far from it', () => {
		const close = new Date('2026-11-05T12:00:00Z');
		const far = new Date('2026-09-01T00:00:00Z');
		const delay = (now: Date, hasStates = true) =>
			computeNextCheckAt({start, end, now, hasStates, source: 'wca'}).getTime() - now.getTime();
		expect(delay(close)).toBe(10 * MIN);
		expect(delay(far)).toBe(6 * 60 * MIN);
		expect(delay(close, false)).toBe(12 * 60 * MIN);
	});

	it('comes back early for a pending change', () => {
		const now = new Date('2026-09-01T00:00:00Z');
		const pendingDue = new Date(now.getTime() + 20 * MIN);
		expect(computeNextCheckAt({start, end, now, hasStates: true, source: 'zkt', pendingDue}).getTime()).toBe(pendingDue.getTime());
	});
});

// --- ZKT announcements ---------------------------------------------------------------------

describe('ZKT announcements', () => {
	// 12:00 in Istanbul (UTC+3)
	const noon = new Date('2026-10-05T09:00:00Z');
	// 02:00 in Istanbul
	const night = new Date('2026-10-04T23:00:00Z');

	it('holds announcements during Turkish night hours', () => {
		expect(isAnnounceQuietHours(night)).toBe(true);
		expect(isAnnounceQuietHours(noon)).toBe(false);
		expect(decideAnnouncement({status: 'ANNOUNCED', startDate: '2026-11-07', cancelled: false, now: night})).toBe('wait');
		expect(decideAnnouncement({status: 'ANNOUNCED', startDate: '2026-11-07', cancelled: false, now: noon})).toBe('send');
	});

	it('never announces cancelled, past or not-yet-announced competitions', () => {
		expect(decideAnnouncement({status: 'CANCELLED', startDate: '2026-11-07', cancelled: true, now: noon})).toBe('skip');
		expect(decideAnnouncement({status: 'ANNOUNCED', startDate: '2026-09-01', cancelled: false, now: noon})).toBe('skip');
		expect(decideAnnouncement({status: 'ONGOING', startDate: '2026-11-07', cancelled: false, now: noon})).toBe('skip');
		expect(decideAnnouncement({status: 'REGISTRATION_OPEN', startDate: '2026-11-07', cancelled: false, now: noon})).toBe('send');
	});

	it('picks the variant from status and opening time', () => {
		const later = new Date(noon.getTime() + 3 * 24 * 60 * MIN);
		const earlier = new Date(noon.getTime() - MIN);
		expect(announcementVariant({status: 'ANNOUNCED', openAt: later, now: noon})).toBe('announced');
		expect(announcementVariant({status: 'REGISTRATION_OPEN', openAt: earlier, now: noon})).toBe('announced_open');
		// Planned time passed but the organizer has not opened it: never claim "open".
		expect(announcementVariant({status: 'ANNOUNCED', openAt: earlier, now: noon})).toBe('announced_no_date');
		expect(announcementVariant({status: 'ANNOUNCED', openAt: null, now: noon})).toBe('announced_no_date');
	});

	describe('decideReminder', () => {
		const openAt = new Date('2026-10-10T17:00:00Z');
		const base = {openAt, status: 'ANNOUNCED', cancelled: false, announcedAt: new Date('2026-10-01T09:00:00Z'), eligible: true};

		it('waits until the lead window, then sends', () => {
			expect(decideReminder({...base, now: new Date(openAt.getTime() - REGISTRATION_REMINDER_LEAD_MS - MIN)})).toBe('wait');
			expect(decideReminder({...base, now: new Date(openAt.getTime() - REGISTRATION_REMINDER_LEAD_MS)})).toBe('send');
		});

		it('drops a reminder that would arrive well after the opening', () => {
			expect(decideReminder({...base, now: new Date(openAt.getTime() + 30 * MIN)})).toBe('skip');
		});

		it('skips when the announcement itself landed inside the window', () => {
			expect(
				decideReminder({...base, announcedAt: new Date(openAt.getTime() - 30 * MIN), now: new Date(openAt.getTime() - 20 * MIN)})
			).toBe('skip');
		});

		it('never reminds before the competition was announced', () => {
			expect(decideReminder({...base, announcedAt: null, eligible: false, now: new Date(openAt.getTime() - 30 * MIN)})).toBe('wait');
		});

		it('skips cancelled competitions', () => {
			expect(decideReminder({...base, status: 'CANCELLED', cancelled: true, now: new Date(openAt.getTime() - 30 * MIN)})).toBe('skip');
		});
	});
});

describe('formatCompTime', () => {
	it('formats in the competition timezone, not the server one', () => {
		const iso = '2026-11-07T07:30:00Z'; // 10:30 in Istanbul
		expect(formatCompTime(iso, 'Europe/Istanbul', 'tr', 'time')).toBe('10:30');
		expect(formatCompTime(iso, 'Europe/Istanbul', 'tr', 'weekday_time')).toContain('10:30');
		expect(formatCompTime(iso, 'Europe/Istanbul', 'tr', 'date_time')).toContain('Kasım');
	});

	it('falls back to UTC for an unknown timezone instead of throwing', () => {
		expect(formatCompTime('2026-11-07T07:30:00Z', 'Not/AZone', 'en', 'time')).toBe('07:30');
		expect(formatCompTime(null, 'Europe/Istanbul', 'en', 'time')).toBe('');
	});
});
