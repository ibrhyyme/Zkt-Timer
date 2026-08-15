import {
	buildScheduleRows,
	groupRowsByDay,
	collectRooms,
	dateKeyInTz,
	hourFloatInTz,
	compTimezone,
	rowDurationMinutes,
	isRowNow,
} from '../scheduleUtils';

const roundLabel = (n: number) => `Tur ${n}`;

// Times are UTC in the payload; Istanbul is UTC+3 all year.
const IST = 'Europe/Istanbul';

describe('venue timezone helpers', () => {
	it('reads the wall clock in the venue zone, not the reader zone', () => {
		// 06:30Z is 09:30 in Istanbul.
		expect(hourFloatInTz('2026-07-03T06:30:00.000Z', IST)).toBe(9.5);
		expect(dateKeyInTz('2026-07-03T06:30:00.000Z', IST)).toBe('2026-7-3');
	});

	it('keeps a late-evening block on the day it starts in the venue zone', () => {
		// 22:00Z is already the next day in Istanbul (01:00).
		expect(dateKeyInTz('2026-07-03T22:00:00.000Z', IST)).toBe('2026-7-4');
		// Same instant read in UTC stays on the 3rd.
		expect(dateKeyInTz('2026-07-03T22:00:00.000Z', 'UTC')).toBe('2026-7-3');
	});

	it('treats a missing federation timezone as absent, not as a zone name', () => {
		expect(compTimezone({timezone: IST})).toBe(IST);
		expect(compTimezone({timezone: ''})).toBeUndefined();
		expect(compTimezone({})).toBeUndefined();
	});
});

describe('buildScheduleRows', () => {
	const detail = {
		timezone: IST,
		rooms: [
			{id: 'r1', name: 'Ana Salon', color: '#10a3b8'},
			{id: 'r2', name: 'Yan Salon', color: '#e2b33c'},
		],
		schedule: [
			{
				id: 's1',
				title: 'Kayıt ve Kontrol',
				startTime: '2026-07-03T05:00:00.000Z',
				endTime: '2026-07-03T06:00:00.000Z',
				roomId: 'r1',
			},
		],
		events: [
			{
				eventId: '333',
				rounds: [
					{
						roundId: 'round-1',
						roundNumber: 1,
						isFinal: false,
						groups: [
							{groupId: 'g1', startTime: '2026-07-03T06:00:00.000Z', endTime: '2026-07-03T07:00:00.000Z', roomId: 'r1'},
							{groupId: 'g2', startTime: '2026-07-03T07:00:00.000Z', endTime: '2026-07-03T08:00:00.000Z', roomId: 'r1'},
						],
					},
				],
			},
		],
	};

	it('resolves rooms on custom items and on round blocks', () => {
		const rows = buildScheduleRows(detail, roundLabel);
		const custom = rows.find((r) => r.id === 's1')!;
		expect(custom.roomName).toBe('Ana Salon');
		expect(custom.roomColor).toBe('#10a3b8');

		const round = rows.find((r) => r.isRound)!;
		expect(round.roomName).toBe('Ana Salon');
	});

	it('collapses a round’s groups in one room into a single block', () => {
		const rows = buildScheduleRows(detail, roundLabel);
		const rounds = rows.filter((r) => r.isRound);
		expect(rounds).toHaveLength(1);
		// Spans the first group's start to the last group's end.
		expect(rounds[0].start).toBe('2026-07-03T06:00:00.000Z');
		expect(rounds[0].end).toBe('2026-07-03T08:00:00.000Z');
	});

	it('splits a round that runs in two rooms at once into one block per room', () => {
		const parallel = {
			...detail,
			schedule: [],
			events: [
				{
					eventId: '333',
					rounds: [
						{
							roundId: 'round-1',
							roundNumber: 1,
							isFinal: false,
							groups: [
								{groupId: 'g1', startTime: '2026-07-03T06:00:00.000Z', endTime: '2026-07-03T07:00:00.000Z', roomId: 'r1'},
								{groupId: 'g2', startTime: '2026-07-03T06:00:00.000Z', endTime: '2026-07-03T07:00:00.000Z', roomId: 'r2'},
							],
						},
					],
				},
			],
		};
		const rounds = buildScheduleRows(parallel, roundLabel).filter((r) => r.isRound);
		expect(rounds).toHaveLength(2);
		expect(rounds.map((r) => r.roomName).sort()).toEqual(['Ana Salon', 'Yan Salon']);
		// Both blocks keep their own room, rather than one swallowing the other.
		expect(new Set(rounds.map((r) => r.id)).size).toBe(2);
	});

	it('still splits a round across days, and keys the split by venue day', () => {
		const twoDay = {
			...detail,
			schedule: [],
			events: [
				{
					eventId: '333',
					rounds: [
						{
							roundId: 'round-1',
							roundNumber: 1,
							isFinal: false,
							groups: [
								{groupId: 'g1', startTime: '2026-07-03T06:00:00.000Z', endTime: '2026-07-03T07:00:00.000Z', roomId: 'r1'},
								{groupId: 'g2', startTime: '2026-07-04T06:00:00.000Z', endTime: '2026-07-04T07:00:00.000Z', roomId: 'r1'},
							],
						},
					],
				},
			],
		};
		const rounds = buildScheduleRows(twoDay, roundLabel).filter((r) => r.isRound);
		expect(rounds).toHaveLength(2);
	});

	it('degrades to no rooms when the federation has not published them', () => {
		const old = {
			schedule: [
				{id: 's1', title: 'Kayıt', startTime: '2026-07-03T05:00:00.000Z', endTime: null},
			],
			events: [],
		};
		const rows = buildScheduleRows(old, roundLabel);
		expect(rows[0].roomName).toBeNull();
		expect(collectRooms(rows)).toEqual([]);
	});

	it('names the final instead of numbering it', () => {
		const withFinal = {
			...detail,
			schedule: [],
			events: [
				{
					eventId: '333',
					rounds: [
						{
							roundId: 'round-2',
							roundNumber: 2,
							isFinal: true,
							groups: [{groupId: 'g1', startTime: '2026-07-03T09:00:00.000Z', endTime: null, roomId: 'r1'}],
						},
					],
				},
			],
		};
		const rows = buildScheduleRows(withFinal, roundLabel, 'Final');
		expect(rows[0].title).toContain('Final');
		expect(rows[0].title).not.toContain('Tur 2');
	});
});

describe('grouping and row helpers', () => {
	it('groups by the venue day, so a late block does not open a second heading', () => {
		const rows = buildScheduleRows(
			{
				timezone: 'UTC',
				schedule: [
					{id: 'a', title: 'Akşam bloğu', startTime: '2026-07-03T20:00:00.000Z', endTime: '2026-07-03T21:00:00.000Z'},
					{id: 'b', title: 'Sabah bloğu', startTime: '2026-07-03T06:00:00.000Z', endTime: '2026-07-03T07:00:00.000Z'},
				],
				events: [],
			},
			roundLabel
		);
		const days = groupRowsByDay(rows, 'tr-TR', 'UTC');
		expect(days).toHaveLength(1);
		expect(days[0].rows).toHaveLength(2);
	});

	it('collects rooms in first-appearance order without duplicates', () => {
		const rooms = collectRooms([
			{id: '1', title: 'a', start: null, end: null, isRound: false, roomName: 'B', roomColor: '#111'},
			{id: '2', title: 'b', start: null, end: null, isRound: false, roomName: 'A', roomColor: '#222'},
			{id: '3', title: 'c', start: null, end: null, isRound: false, roomName: 'B', roomColor: '#111'},
		]);
		expect(rooms).toEqual([
			{name: 'B', color: '#111'},
			{name: 'A', color: '#222'},
		]);
	});

	it('measures duration and detects the block running right now', () => {
		const row = {
			id: '1',
			title: 'a',
			start: '2026-07-03T06:00:00.000Z',
			end: '2026-07-03T07:30:00.000Z',
			isRound: true,
		};
		expect(rowDurationMinutes(row)).toBe(90);
		expect(isRowNow(row, Date.parse('2026-07-03T06:30:00.000Z'))).toBe(true);
		expect(isRowNow(row, Date.parse('2026-07-03T07:30:00.000Z'))).toBe(false);
		expect(isRowNow(row, Date.parse('2026-07-03T05:59:00.000Z'))).toBe(false);
		// A block with no end has no duration and is never "now".
		expect(rowDurationMinutes({...row, end: null})).toBe(0);
		expect(isRowNow({...row, end: null}, Date.parse('2026-07-03T06:30:00.000Z'))).toBe(false);
	});
});
