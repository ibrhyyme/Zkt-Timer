import {groupRowsByDay, collectRooms, dateKeyInTz, hourFloatInTz, rowDurationMinutes, isRowNow} from '../scheduleUtils';

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
});

describe('grouping and row helpers', () => {
	it('groups by the venue day, so a late block does not open a second heading', () => {
		const rows = [
			{id: 'b', title: 'Sabah bloğu', start: '2026-07-03T06:00:00.000Z', end: '2026-07-03T07:00:00.000Z', isRound: false},
			{id: 'a', title: 'Akşam bloğu', start: '2026-07-03T20:00:00.000Z', end: '2026-07-03T21:00:00.000Z', isRound: false},
		];
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
