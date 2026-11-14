import {buildRows, cardProgress, isEditable, Row} from '../judge-rows';
import type {OutboxItem, OutboxSnapshot} from '../../../../../util/judge-outbox';
import type {JudgeCard, JudgeSlot} from '../../../../../../shared/zkt_judge';

// The judge card's lines as the phone draws them (the P4/P6 review, 12 Kasım):
// E1 and E2 follow the order the extras were used in, like the paper card, and
// the extra line takes "Süre düzelt" with an organiser's approval.

const USER = 'u1';

function card(slots: Partial<JudgeSlot>[], over: Partial<JudgeCard> = {}): JudgeCard {
	return {
		grantId: 'g1',
		cardId: 'c1',
		expiresAt: '2026-11-14T20:00:00.000Z',
		round: {
			id: 'r1',
			eventId: '333',
			roundNumber: 1,
			format: 'AO5',
			status: 'ACTIVE',
			dualChance: false,
			attemptCount: 5,
			timeLimitCs: null,
			timeLimitCumulative: false,
			cutoffCs: null,
			cutoffAttempts: null,
		},
		group: {id: 'gr1', number: 1},
		chance: 1,
		competitor: {key: 'k', name: 'Ayşe'},
		station: 1,
		judgeName: 'Hakem',
		cardStatus: 'OPEN',
		noShow: false,
		expected: 5,
		filled: 0,
		completed: false,
		attempts: Array.from({length: 5}, (_, i) => ({no: i + 1, value: null, extra: false, state: 'empty' as const, ...slots[i]})),
		permits: [],
		...over,
	};
}

const outbox = (items: Partial<OutboxItem>[] = []): OutboxSnapshot => ({
	items: items.map((i, n) => ({
		submissionId: `s${n}`,
		cardId: 'c1',
		kind: 'ATTEMPT',
		attemptNo: 1,
		value: null,
		rawValue: null,
		penalty: 0,
		permit: null,
		deviceSeq: n + 1,
		userId: USER,
		competitionId: 'zkt-x',
		createdAt: 0,
		tries: 0,
		state: 'pending',
		...i,
	})),
	notices: [],
	paused: null,
	offline: false,
});

const row = (rows: Row[], id: string) => rows.find((r) => r.id === id)!;
const sent = (value: number) => ({value, state: 'sent' as const});

describe('judge card lines', () => {
	test('two extras: E1 is the one used first, whichever attempt it replaced', () => {
		// Extra for attempt 4 first, then for attempt 2.
		const c = card(
			[sent(1200), {value: 1250, extra: true, original: 1300, state: 'sent'}, sent(1400), {value: 1450, extra: true, original: 1500, state: 'sent'}],
			{extraAttempts: [4, 2]}
		);
		const rows = buildRows(c, outbox(), USER);
		expect([row(rows, 'e1').attemptNo, row(rows, 'e1').value]).toEqual([4, 1450]);
		expect([row(rows, 'e2').attemptNo, row(rows, 'e2').value]).toEqual([2, 1250]);
		expect(row(rows, 'a4').replacedBy).toBe('E1');
		expect(row(rows, 'a2').replacedBy).toBe('E2');
		// The attempt lines keep what was written on them.
		expect([row(rows, 'a4').value, row(rows, 'a2').value]).toEqual([1500, 1300]);
	});

	test('a site answer without extraAttempts falls back to attempt order', () => {
		const c = card([sent(1200), {value: 1250, extra: true, original: 1300, state: 'sent'}, sent(1400), {value: 1450, extra: true, original: 1500, state: 'sent'}]);
		const rows = buildRows(c, outbox(), USER);
		expect([row(rows, 'e1').attemptNo, row(rows, 'e2').attemptNo]).toEqual([2, 4]);
	});

	test('a correction approved on an extra line opens the extra line, never the attempt line', () => {
		const c = card([{value: 1150, extra: true, original: 1510, state: 'sent'}], {
			extraAttempts: [1],
			permits: [{grantId: 'p1', purpose: 'CORRECT', attemptNo: 1, expiresAt: '2026-11-14T20:00:00.000Z'}],
		});
		const rows = buildRows(c, outbox(), USER);
		const e1 = row(rows, 'e1');
		expect([e1.value, e1.permit, isEditable(e1)]).toEqual([1150, 'CORRECT', true]);
		const a1 = row(rows, 'a1');
		expect([a1.value, a1.permit, isEditable(a1)]).toEqual([1510, null, false]);
	});

	test('the corrected time waiting to be sent shows on the extra line; the attempt line is unchanged', () => {
		const c = card([{value: 1150, extra: true, original: 1510, state: 'sent'}], {
			extraAttempts: [1],
			permits: [{grantId: 'p1', purpose: 'CORRECT', attemptNo: 1, expiresAt: '2026-11-14T20:00:00.000Z'}],
		});
		const rows = buildRows(c, outbox([{attemptNo: 1, value: 1105, permit: 'CORRECT'}]), USER);
		const e1 = row(rows, 'e1');
		expect([e1.value, e1.state, e1.permit]).toEqual([1105, 'pending', null]);
		expect(row(rows, 'a1').value).toBe(1510);
	});

	test('an attempt line without an extra still takes its own correction', () => {
		const c = card([sent(1510)], {permits: [{grantId: 'p1', purpose: 'CORRECT', attemptNo: 1, expiresAt: '2026-11-14T20:00:00.000Z'}]});
		const rows = buildRows(c, outbox(), USER);
		expect([row(rows, 'a1').permit, isEditable(row(rows, 'a1'))]).toEqual(['CORRECT', true]);
		expect(row(rows, 'e1').attemptNo).toBeNull();
	});
});

describe('a DNF with its time (team, 12 Nov)', () => {
	it('a sent DNF line carries the time the site keeps, a waiting one the time it is sending', () => {
		const rows = buildRows(
			card([
				{value: -1, dnfTime: 1234, state: 'sent'},
				{value: -1, state: 'sent'},
			]),
			outbox([{attemptNo: 3, value: -1, rawValue: 1500}]),
			USER
		);
		const by = (id: string) => rows.find((r) => r.id === id)!;
		expect([by('a1').value, by('a1').dnfTime]).toEqual([-1, 1234]);
		expect(by('a2').dnfTime).toBeNull();
		expect([by('a3').state, by('a3').value, by('a3').dnfTime]).toEqual(['pending', -1, 1500]);
	});

	it('under an extra the attempt line keeps its own DNF time, the extra line its own value', () => {
		const rows = buildRows(
			card([{}, {value: 1100, extra: true, original: -1, originalDnfTime: 1500, state: 'sent'}], {extraAttempts: [2]}),
			outbox(),
			USER
		);
		const by = (id: string) => rows.find((r) => r.id === id)!;
		expect([by('a2').value, by('a2').dnfTime, by('a2').replacedBy]).toEqual([-1, 1500, 'E1']);
		expect([by('e1').value, by('e1').dnfTime]).toEqual([1100, null]);
	});
});

describe('attempts go in order (owner, 14 Nov)', () => {
	const states = (rows: Row[]) => rows.filter((r) => r.kind === 'attempt').map((r) => r.state);

	test('only the first empty attempt line takes a time; the rest wait', () => {
		const rows = buildRows(card([]), outbox(), USER);
		expect(states(rows)).toEqual(['empty', 'later', 'later', 'later', 'later']);
		expect(rows.filter(isEditable).map((r) => r.id)).toEqual(['a1']);
	});

	test('a sent, waiting or refused time counts as written; the next line opens', () => {
		const rows = buildRows(card([sent(1234)]), outbox([{attemptNo: 2, value: 1300, state: 'blocked'}]), USER);
		expect(states(rows)).toEqual(['sent', 'blocked', 'empty', 'later', 'later']);
	});

	test('a missed cutoff locks the rest instead', () => {
		const cut = card([sent(4000), sent(4100)], {round: {...card([]).round, cutoffCs: 3000, cutoffAttempts: 2}});
		expect(states(buildRows(cut, outbox(), USER))).toEqual(['sent', 'sent', 'locked', 'locked', 'locked']);
	});
});

describe('progress on the card switch (owner, 14 Nov)', () => {
	test('sent and waiting lines count, empty and later ones do not', () => {
		const rows = buildRows(card([sent(1200)]), outbox([{attemptNo: 2, value: 1300}]), USER);
		expect(cardProgress(rows)).toEqual({written: 2, total: 5});
	});

	test('lines closed by a missed cutoff are not owed', () => {
		const cut = card([sent(4000), sent(4100)], {round: {...card([]).round, cutoffCs: 3000, cutoffAttempts: 2}});
		expect(cardProgress(buildRows(cut, outbox(), USER))).toEqual({written: 2, total: 2});
	});
});
