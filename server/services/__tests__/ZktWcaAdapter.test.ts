import {
	zktDetailToLiveOverview,
	zktRecordsToRecordEntries,
	zktRoundToWcaLiveResults,
	chanceOfGroup,
	zktDualChanceRounds,
	applyZktDualChance,
} from '../ZktWcaAdapter';
import {watchMatchesRecord} from '../record_radar_match';

// Shaped like the federation's PublicCompetitionDetail for a day-split
// competition: two day-chains (rounds 1-2 on each) feeding one shared final,
// plus the organizer's own programme items and two rooms.
const detail = {
	name: 'ZKT Test',
	location: 'Salon',
	rooms: [
		{id: 'r-main', name: 'Ana salon', color: '#10a3b8'},
		{id: 'r-side', name: 'Yan salon', color: '#e2b33c'},
	],
	schedule: [
		{
			id: 's1',
			title: 'Kayıt Masası',
			startTime: '2026-08-15T06:00:00.000Z',
			endTime: '2026-08-15T06:30:00.000Z',
			roomId: 'r-main',
		},
		{
			id: 's2',
			title: 'Ödül Töreni',
			startTime: '2026-08-16T14:00:00.000Z',
			endTime: '2026-08-16T14:30:00.000Z',
			roomId: null,
		},
	],
	events: [
		{
			eventId: '333',
			eventName: '3x3x3',
			rounds: [
				{
					roundId: 'a1',
					roundNumber: 1,
					status: 'FINISHED',
					dayIndex: 1,
					dayLabel: '15 Ağu Cmt',
					isFinal: false,
					groups: [
						{startTime: '2026-08-15T07:00:00.000Z', endTime: '2026-08-15T08:00:00.000Z', roomId: 'r-main'},
						{startTime: '2026-08-15T08:00:00.000Z', endTime: '2026-08-15T09:00:00.000Z', roomId: 'r-main'},
					],
				},
				{
					roundId: 'b1',
					roundNumber: 1,
					status: 'UPCOMING',
					dayIndex: 2,
					dayLabel: '16 Ağu Paz',
					isFinal: false,
					groups: [
						{startTime: '2026-08-16T07:00:00.000Z', endTime: '2026-08-16T08:00:00.000Z', roomId: 'r-side'},
					],
				},
				{
					roundId: 'f',
					roundNumber: 3,
					status: 'UPCOMING',
					dayIndex: 0,
					dayLabel: null,
					isFinal: true,
					groups: [
						{startTime: '2026-08-16T12:00:00.000Z', endTime: '2026-08-16T13:00:00.000Z', roomId: 'r-main'},
					],
				},
			],
		},
	],
	podiums: [],
};

describe('zktDetailToLiveOverview', () => {
	const overview = zktDetailToLiveOverview(detail, 'zkt-test');
	const rooms = overview.schedule.flatMap((v: any) => v.rooms);
	const activities = rooms.flatMap((r: any) => r.activities);

	it('carries the day onto every round, so two "1. Tur"s can be told apart', () => {
		const rounds = overview.events[0].rounds;
		expect(rounds.map((r: any) => [r.number, r.dayIndex, r.dayLabel])).toEqual([
			[1, 1, '15 Ağu Cmt'],
			[1, 2, '16 Ağu Paz'],
			[3, 0, undefined],
		]);
	});

	it('marks the chain final, which the round number alone cannot say', () => {
		const rounds = overview.events[0].rounds;
		expect(rounds.filter((r: any) => r.isFinal).map((r: any) => r.number)).toEqual([3]);
	});

	it("includes the organizer's own programme items, not just event rounds", () => {
		const names = activities.map((a: any) => a.name);
		expect(names).toContain('Kayıt Masası');
		expect(names).toContain('Ödül Töreni');
		// 3 rounds + 2 custom items.
		expect(activities).toHaveLength(5);
	});

	it('puts each block in its own room, keeping parallel stages apart', () => {
		expect(rooms.map((r: any) => r.name).sort()).toEqual(['Ana salon', 'Salon', 'Yan salon']);
		const side = rooms.find((r: any) => r.name === 'Yan salon');
		expect(side.color).toBe('#e2b33c');
		expect(side.activities.map((a: any) => a.activityCode)).toEqual(['333-r1']);
	});

	it('spans a round from its first group start to its last group end', () => {
		const main = rooms.find((r: any) => r.name === 'Ana salon');
		const round1 = main.activities.find((a: any) => a.activityCode === '333-r1');
		expect(round1.startTime).toBe('2026-08-15T07:00:00.000Z');
		expect(round1.endTime).toBe('2026-08-15T09:00:00.000Z');
	});

	it('leaves custom items without an activity code, so nothing routes them to an event', () => {
		const custom = activities.filter((a: any) => !a.activityCode);
		expect(custom.map((a: any) => a.name).sort()).toEqual(['Kayıt Masası', 'Ödül Töreni']);
	});

	it('names the round in the block, not just the event', () => {
		// "Skewb" twice told the reader nothing; "Skewb 1. Tur" does. No long
		// dash in the label (product copy rule).
		const names = activities.filter((a: any) => a.activityCode).map((a: any) => a.name);
		expect(names).toContain('3x3 1. Tur');
		expect(names).toContain('3x3 Final');
		expect(names).not.toContain('3x3');
		expect(names.join(' ')).not.toContain('—');
	});

	it('falls back to the round’s own slot when its groups have no times', () => {
		// The second day of a day-split event is usually laid out this way: the
		// round sits on the calendar but its groups are not timed yet. Reading
		// only the groups dropped these rounds from the programme entirely.
		const noGroups = {
			...detail,
			schedule: [],
			events: [
				{
					eventId: 'skewb',
					eventName: 'Skewb',
					rounds: [
						{
							roundId: 'day2',
							roundNumber: 1,
							status: 'UPCOMING',
							dayIndex: 2,
							dayLabel: '16 Ağu Paz',
							isFinal: false,
							startTime: '2026-08-16T09:15:00.000Z',
							endTime: '2026-08-16T10:15:00.000Z',
							roomId: 'r-side',
							groups: [],
						},
					],
				},
			],
		};
		const out = zktDetailToLiveOverview(noGroups, 'zkt-test');
		const acts = out.schedule.flatMap((v: any) => v.rooms).flatMap((r: any) => r.activities);
		expect(acts).toHaveLength(1);
		expect(acts[0].name).toBe('Skewb 1. Tur');
		expect(acts[0].startTime).toBe('2026-08-16T09:15:00.000Z');
		expect(acts[0].dayLabel).toBe('16 Ağu Paz');
	});

	it('still drops a round that has neither groups nor a slot', () => {
		const nothing = {
			...detail,
			schedule: [],
			events: [
				{
					eventId: 'skewb',
					eventName: 'Skewb',
					rounds: [
						{roundId: 'x', roundNumber: 1, status: 'UPCOMING', dayIndex: 0, isFinal: false, groups: []},
					],
				},
			],
		};
		const out = zktDetailToLiveOverview(nothing, 'zkt-test');
		expect(out.schedule).toEqual([]);
	});

	it('keeps each room ordered by time', () => {
		for (const room of rooms) {
			const times = room.activities.map((a: any) => a.startTime);
			expect(times).toEqual([...times].sort());
		}
	});

	it('degrades to one room when the federation published none', () => {
		const plain = zktDetailToLiveOverview(
			{...detail, rooms: [], schedule: [], location: 'Tek Salon'},
			'zkt-test'
		);
		const plainRooms = plain.schedule.flatMap((v: any) => v.rooms);
		expect(plainRooms).toHaveLength(1);
		expect(plainRooms[0].name).toBe('Tek Salon');
	});
});

describe('zktRecordsToRecordEntries', () => {
	const entry = (over: any = {}) => ({
		id: 'rec-1',
		eventId: '333',
		eventName: '3x3x3',
		type: 'single',
		tag: 'NR',
		attemptResult: 642,
		personName: 'Ornek Yarismaci',
		personCountryIso2: 'TR',
		roundNumber: 2,
		competitionId: 'comp-uuid',
		competitionName: 'Ornek Yarisma',
		competitionSlug: 'ornek-yarisma',
		setAt: '2026-09-08T12:00:00.000Z',
		...over,
	});

	// The whole reason this mapper exists instead of reusing zktRecordsToWcaLive.
	// The federation's countryIso2 is nullable; the radar's NR rule is
	// `!!personCountryIso2 && personCountryIso2 === watch.region`, so passing a
	// null through would silently match no watch and drop the record.
	it('defaults a missing country to TR so an NR/TR watch still matches', () => {
		const [mapped] = zktRecordsToRecordEntries([entry({personCountryIso2: null})]);
		expect(mapped.personCountryIso2).toBe('TR');

		const fires = watchMatchesRecord({events: ['333'], scope: 'NR', region: 'TR'}, {
			eventId: mapped.eventId,
			tag: mapped.tag,
			personCountryIso2: mapped.personCountryIso2,
		});
		expect(fires).toBe(true);
	});

	it('defaults a missing tag to NR and a missing type to single', () => {
		const [mapped] = zktRecordsToRecordEntries([entry({tag: undefined, type: undefined})]);
		expect(mapped.tag).toBe('NR');
		expect(mapped.type).toBe('single');
	});

	it('passes a null roundNumber through as undefined so the caller can default it', () => {
		const [mapped] = zktRecordsToRecordEntries([entry({roundNumber: null})]);
		expect(mapped.roundNumber).toBeUndefined();
	});

	it('keeps the federation event name rather than recomputing it', () => {
		const [mapped] = zktRecordsToRecordEntries([entry({eventName: '3x3x3 Kup'})]);
		expect(mapped.eventName).toBe('3x3x3 Kup');
	});

	it('drops entries with no event id', () => {
		expect(zktRecordsToRecordEntries([entry({eventId: ''}), entry()])).toHaveLength(1);
	});

	it('handles a null payload', () => {
		expect(zktRecordsToRecordEntries(null as any)).toEqual([]);
	});

	// AO12 averages are excluded from records federation-side (they never become a
	// ZktRecord row), so nothing reaches this mapper to filter. Do not "helpfully"
	// add an average filter here: AO12 SINGLES are legitimate records.
	it('does not filter averages — the federation already decided what counts', () => {
		const mapped = zktRecordsToRecordEntries([entry({type: 'average', attemptResult: 800})]);
		expect(mapped).toHaveLength(1);
		expect(mapped[0].type).toBe('average');
	});
});

// Dual Chance ("Çift Şans"): a round option, not a WCA dual round. Shaped like
// the federation detail of ZKT Back to School İstanbul 2026, 3x3x3 round 1:
// 4 + 4 groups, with a gap between the two chances.
const dualDetail = {
	name: 'ZKT Dual',
	location: 'Salon',
	rooms: [],
	schedule: [],
	podiums: [],
	events: [
		{
			eventId: '333',
			eventName: '3x3x3',
			rounds: [
				{
					roundId: 'r1',
					roundNumber: 1,
					format: 'AO5',
					status: 'FINISHED',
					dualChance: true,
					isFinal: false,
					groups: [
						{groupNumber: 1, startTime: '2026-10-10T11:30:00.000Z', endTime: '2026-10-10T11:45:00.000Z'},
						{groupNumber: 2, startTime: '2026-10-10T11:45:00.000Z', endTime: '2026-10-10T12:00:00.000Z'},
						{groupNumber: 3, startTime: '2026-10-10T12:00:00.000Z', endTime: '2026-10-10T12:15:00.000Z'},
						{groupNumber: 4, startTime: '2026-10-10T12:15:00.000Z', endTime: '2026-10-10T12:30:00.000Z'},
						{groupNumber: 5, startTime: '2026-10-10T13:00:00.000Z', endTime: '2026-10-10T13:15:00.000Z'},
						{groupNumber: 6, startTime: '2026-10-10T13:15:00.000Z', endTime: '2026-10-10T13:30:00.000Z'},
						{groupNumber: 7, startTime: '2026-10-10T13:30:00.000Z', endTime: '2026-10-10T13:45:00.000Z'},
						{groupNumber: 8, startTime: '2026-10-10T13:45:00.000Z', endTime: '2026-10-10T14:00:00.000Z'},
					],
				},
				{
					roundId: 'r2',
					roundNumber: 2,
					format: 'AO5',
					status: 'FINISHED',
					isFinal: true,
					groups: [{groupNumber: 1, startTime: '2026-10-10T15:00:00.000Z', endTime: '2026-10-10T15:30:00.000Z'}],
				},
			],
		},
	],
};

describe('Dual Chance', () => {
	it('derives the chance from the group number: 1..N chance 1, N+1..2N chance 2', () => {
		expect([1, 2, 3, 4, 5, 6, 7, 8].map((g) => chanceOfGroup(g, 8))).toEqual([1, 1, 1, 1, 2, 2, 2, 2]);
		expect(chanceOfGroup(null, 8)).toBeNull();
		expect(chanceOfGroup(1, 1)).toBeNull();
	});

	it('lists only the Dual Chance rounds, with their group count', () => {
		expect([...zktDualChanceRounds(dualDetail).entries()]).toEqual([['333-r1', 8]]);
		expect(zktDualChanceRounds(null).size).toBe(0);
	});

	it('flags the round on the live overview', () => {
		const overview = zktDetailToLiveOverview(dualDetail, 'zkt-dual');
		expect(overview.events[0].rounds.map((r: any) => r.dualChance)).toEqual([true, undefined]);
	});

	it('draws one programme block per chance, not one spanning both', () => {
		const overview = zktDetailToLiveOverview(dualDetail, 'zkt-dual');
		const acts = overview.schedule
			.flatMap((v: any) => v.rooms)
			.flatMap((r: any) => r.activities)
			.filter((a: any) => a.activityCode === '333-r1');
		expect(acts.map((a: any) => [a.chance, a.startTime, a.endTime, a.name])).toEqual([
			[1, '2026-10-10T11:30:00.000Z', '2026-10-10T12:30:00.000Z', '3x3 1. Tur, Şans 1'],
			[2, '2026-10-10T13:00:00.000Z', '2026-10-10T14:00:00.000Z', '3x3 1. Tur, Şans 2'],
		]);
		// Parts for the client to name the block in the viewer's language.
		expect(acts[0].roundNumber).toBe(1);
		expect(acts[0].isFinal).toBe(false);
	});

	it('carries both chances on a round result, attempts shaped like the row', () => {
		const out = zktRoundToWcaLiveResults({
			eventId: '333',
			roundNumber: 1,
			format: 'AO5',
			status: 'FINISHED',
			dualChance: true,
			results: [
				{
					competitor: {id: 'c1', name: 'A', country: 'TR'},
					ranking: 1,
					attempts: [745, 786, 777, 1138, 950],
					best: 667,
					average: 838,
					recordTags: {single: null, average: null},
					advancing: true,
					clinched: true,
					questionable: false,
					chances: [
						{chance: 1, attempts: [825, 667, 851, 882, 1106], best: 667, average: 853, noShow: false, counting: false},
						{chance: 2, attempts: [745, 786, 777, 1138, 950], best: 745, average: 838, noShow: false, counting: true},
					],
				},
				{
					competitor: {id: 'c2', name: 'B'},
					ranking: 2,
					attempts: [900, 900, 900, 900, 900],
					best: 900,
					average: 900,
					recordTags: {},
					advancing: false,
					clinched: false,
					questionable: false,
				},
			],
		});
		expect(out.dualChance).toBe(true);
		const [a, b] = out.results;
		expect(a.chances.map((c: any) => [c.chance, c.average, c.counting])).toEqual([
			[1, 853, false],
			[2, 838, true],
		]);
		expect(a.chances[1].attempts[0]).toEqual({result: 745});
		// The row itself stays the counting chance, best single across both.
		expect([a.average, a.best]).toEqual([838, 667]);
		// A row the federation sends without chances has none.
		expect(b.chances).toBeUndefined();
	});

	it('marks rounds, groups and assignments on a WCIF-built detail', () => {
		const detail: any = {
			events: [
				{
					eventId: '333',
					rounds: [
						{roundNumber: 1, groups: [1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({groupNumber: n}))},
						{roundNumber: 2, groups: [{groupNumber: 1}]},
					],
				},
			],
			competitors: [
				{
					assignments: [
						{activityCode: '333-r1-g3'},
						{activityCode: '333-r1-g6'},
						{activityCode: '333-r2-g1'},
					],
				},
			],
			schedule: [{date: '2026-10-10', assignments: [{activityCode: '333-r1-g7'}]}],
		};
		applyZktDualChance(detail, dualDetail);
		const [r1, r2] = detail.events[0].rounds;
		expect(r1.dualChance).toBe(true);
		expect(r1.groups.map((g: any) => g.chance)).toEqual([1, 1, 1, 1, 2, 2, 2, 2]);
		expect(r2.dualChance).toBeUndefined();
		expect(detail.competitors[0].assignments.map((a: any) => a.chance)).toEqual([1, 2, undefined]);
		expect(detail.schedule[0].assignments[0].chance).toBe(2);
	});

	it('leaves the detail as it was when the federation detail is unavailable', () => {
		const detail: any = {events: [{eventId: '333', rounds: [{roundNumber: 1, groups: [{groupNumber: 1}]}]}]};
		applyZktDualChance(detail, null);
		expect(detail.events[0].rounds[0].dualChance).toBeUndefined();
	});
});
