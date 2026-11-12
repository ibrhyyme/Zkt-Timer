import {buildLiveStatusRows, liveBest} from '../wca_live/live-status-rows';

const att = (...v: number[]) => v.map((result) => ({result}));
const opts = {numAttempts: 5, sortBy: 'average', eventId: '444'};

describe('buildLiveStatusRows', () => {
	it('ranks full averages first, then by best, nothing-yet last', () => {
		const rows = buildLiveStatusRows(
			[
				{personLiveId: 'a', personName: 'Partial', done: 2, expected: 5, attempts: att(3000, 2900)},
				{personLiveId: 'b', personName: 'Full', done: 5, expected: 5, attempts: att(4000, 4100, 4200, 4300, 4400)},
				{personLiveId: 'c', personName: 'Empty', done: 0, expected: 5, attempts: []},
				{personLiveId: 'd', personName: 'Gelmedi', done: 0, expected: 5, noShow: true, attempts: []},
			],
			[],
			opts
		);
		expect(rows.map((r) => [r.personName, r.ranking, r.average, r.best])).toEqual([
			['Full', 1, 4200, 4000],
			['Partial', 2, null, 2900],
			['Empty', null, null, null],
			['Gelmedi', null, null, null],
		]);
		expect(rows.find((r) => r.personName === 'Gelmedi')!.tag).toBe('noShow');
	});

	it('takes the desk numbers for an official row and adds desk rows without a card', () => {
		const official = [
			{personLiveId: 'o', personName: 'Desk card', best: 1525, average: 2012, attempts: att(1525, 1625, 1725, -1, 2685)},
			{personLiveId: 'p', personName: 'Desk only', best: 4512, average: 0, attempts: att(4512, 4703)},
			{personLiveId: 'q', personName: 'Not yet', best: 0, average: 0, attempts: []},
		];
		const rows = buildLiveStatusRows(
			[{personLiveId: 'o', personName: 'Desk card', official: true, done: 5, expected: 5, attempts: att(1525)}],
			official,
			opts
		);
		expect(rows.map((r) => [r.personName, r.ranking, r.tag, r.average, r.best, `${r.done}/${r.expected}`])).toEqual([
			['Desk card', 1, 'official', 2012, 1525, '5/5'],
			['Desk only', 2, 'official', null, 4512, '2/5'],
		]);
	});

	it('counts a desk row that missed the cutoff as done after the cutoff attempts', () => {
		const cutoff = {attempts: 2, result: 7000};
		const official = [
			{personLiveId: 'm', personName: 'Missed', best: 7500, average: 0, attempts: att(7500, -1)},
			{personLiveId: 'k', personName: 'Made', best: 6500, average: 0, attempts: att(7500, 6500)},
		];
		const rows = buildLiveStatusRows([], official, {...opts, cutoff});
		expect(rows.map((r) => [r.personName, `${r.done}/${r.expected}`])).toEqual([
			['Made', '2/5'],
			['Missed', '2/2'],
		]);
	});

	it('keeps an accepted Gelmedi as Gelmedi', () => {
		const rows = buildLiveStatusRows(
			[{personLiveId: 'n', personName: 'No show', official: true, noShow: true, attempts: []}],
			[{personLiveId: 'n', personName: 'No show', best: -1, average: -1, attempts: att(-2, -2, -2, -2, -2)}],
			opts
		);
		expect(rows[0].tag).toBe('noShow');
	});

	it('shares a rank on a tie and puts an all-DNF row after the successes', () => {
		const rows = buildLiveStatusRows(
			[
				{personLiveId: 'a', personName: 'A', attempts: att(3000)},
				{personLiveId: 'b', personName: 'B', attempts: att(3000)},
				{personLiveId: 'c', personName: 'C', attempts: att(-1)},
				{personLiveId: 'd', personName: 'D', attempts: att(3100)},
			],
			[],
			opts
		);
		expect(rows.map((r) => [r.personName, r.ranking])).toEqual([
			['A', 1],
			['B', 1],
			['D', 3],
			['C', 4],
		]);
	});

	it('ranks by best only on a best-of round and gives no average', () => {
		const rows = buildLiveStatusRows(
			[
				{personLiveId: 'a', personName: 'A', attempts: att(5000, 5100, 5200)},
				{personLiveId: 'b', personName: 'B', attempts: att(4000)},
			],
			[],
			{numAttempts: 3, sortBy: 'best', eventId: '333bf'}
		);
		expect(rows.map((r) => [r.personName, r.ranking, r.average])).toEqual([
			['B', 1, null],
			['A', 2, null],
		]);
	});

	it('averages a mean of 3 once all three are visible', () => {
		const rows = buildLiveStatusRows(
			[{personLiveId: 'a', personName: 'A', attempts: att(6000, 6300, 6600)}],
			[],
			{numAttempts: 3, sortBy: 'average', eventId: '666'}
		);
		expect(rows[0].average).toBe(6300);
	});
});

describe('liveBest', () => {
	it('is the fastest success, DNF when all failed, null with nothing', () => {
		expect(liveBest([3000, -1, 2900])).toBe(2900);
		expect(liveBest([-1, -2])).toBe(-1);
		expect(liveBest([])).toBeNull();
	});
});
