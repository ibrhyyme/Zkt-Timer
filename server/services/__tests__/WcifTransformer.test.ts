import {buildCompetitionDetail} from '../WcifTransformer';

// One round under two top-level activities with the same code. That is how the
// federation lays out a Dual Chance round ("3x3x3, Şans 1" / "Şans 2"), and how
// WCA lays out a round run on two stages. Every group has to survive.
const person = (registrantId: number, activityId: number) => ({
	registrantId,
	name: `P${registrantId}`,
	wcaUserId: registrantId,
	wcaId: null,
	countryIso2: 'TR',
	registration: {status: 'accepted', eventIds: ['333']},
	assignments: [{activityId, assignmentCode: 'competitor', stationNumber: null}],
	personalBests: [],
});

const group = (id: number, n: number, start: string, end: string) => ({
	id,
	name: `3x3x3, Grup ${n}`,
	activityCode: `333-r1-g${n}`,
	startTime: start,
	endTime: end,
	childActivities: [],
});

const wcif: any = {
	id: 'Dual2026',
	name: 'Dual 2026',
	persons: [person(1, 1), person(2, 2), person(3, 6), person(4, 7)],
	events: [{id: '333', rounds: [{id: '333-r1', format: 'a', results: []}]}],
	schedule: {
		startDate: '2026-10-10',
		numberOfDays: 1,
		venues: [
			{
				id: 1,
				name: 'Salon',
				rooms: [
					{
						id: 1,
						name: 'Ana salon',
						color: '#10a3b8',
						activities: [
							{
								id: 5,
								name: '3x3x3, Şans 1',
								activityCode: '333-r1',
								startTime: '2026-10-10T11:30:00Z',
								endTime: '2026-10-10T12:00:00Z',
								childActivities: [
									group(1, 1, '2026-10-10T11:30:00Z', '2026-10-10T11:45:00Z'),
									group(2, 2, '2026-10-10T11:45:00Z', '2026-10-10T12:00:00Z'),
								],
							},
							{
								id: 10,
								name: '3x3x3, Şans 2',
								activityCode: '333-r1',
								startTime: '2026-10-10T13:00:00Z',
								endTime: '2026-10-10T13:30:00Z',
								childActivities: [
									group(6, 3, '2026-10-10T13:00:00Z', '2026-10-10T13:15:00Z'),
									group(7, 4, '2026-10-10T13:15:00Z', '2026-10-10T13:30:00Z'),
								],
							},
						],
					},
				],
			},
		],
	},
	extensions: [],
};

describe('buildCompetitionDetail: one round under several activities', () => {
	it('keeps the groups of every activity, not only the last one', () => {
		const detail = buildCompetitionDetail(wcif, '');
		const round = detail!.events[0].rounds[0];
		expect(round.groups.map((g) => g.groupNumber)).toEqual([1, 2, 3, 4]);
		expect(round.groups.map((g) => g.competitors.map((c) => c.registrantId))).toEqual([[1], [2], [3], [4]]);
	});

	it('merges a group that runs in two rooms into one', () => {
		const twoRooms = JSON.parse(JSON.stringify(wcif));
		const room = twoRooms.schedule.venues[0].rooms[0];
		// The same group 1 also runs on a second stage, as its own activity.
		twoRooms.schedule.venues[0].rooms.push({
			id: 2,
			name: 'Yan salon',
			color: '#e2b33c',
			activities: [
				{
					...room.activities[0],
					id: 20,
					childActivities: [group(21, 1, '2026-10-10T11:30:00Z', '2026-10-10T11:50:00Z')],
				},
			],
		});
		twoRooms.persons.push(person(5, 21));
		const round = buildCompetitionDetail(twoRooms, '')!.events[0].rounds[0];
		expect(round.groups.map((g) => g.groupNumber)).toEqual([1, 2, 3, 4]);
		const g1 = round.groups[0];
		expect(g1.competitors.map((c) => c.registrantId).sort()).toEqual([1, 5]);
		expect(g1.endTime).toBe('2026-10-10T11:50:00Z');
	});
});
