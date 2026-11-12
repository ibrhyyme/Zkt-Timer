import {backoffDelayMs, createJudgeOutbox, nextDeviceSeq, OutboxItem, settleItem} from '../judge-outbox';
import {JudgeEntryItem, JudgeEntryResult} from '../../../shared/zkt_judge';

// The judge outbox: a time typed on the entry card leaves the device copy only
// when the site names that exact entry in its answer.

const USER = 'user-1';

function entry(id: string, attemptNo: number, seq: number, userId = USER) {
	return {
		submissionId: id,
		cardId: 'card-1',
		kind: 'ATTEMPT' as const,
		attemptNo,
		value: 1234,
		rawValue: 1234,
		penalty: 0,
		permit: null,
		deviceSeq: seq,
		userId,
		competitionId: 'zkt-test',
	};
}

function makeOutbox(send: (items: JudgeEntryItem[]) => Promise<JudgeEntryResult[]>, user: () => string | null = () => USER) {
	let stored: OutboxItem[] = [];
	let clock = 1_000_000;
	const settled: string[] = [];
	const outbox = createJudgeOutbox({
		storage: {
			load: async () => stored,
			save: async (items) => {
				stored = items.map((i) => ({...i}));
			},
		},
		send,
		getUserId: user,
		now: () => clock,
		random: () => 1,
		onResults: (list) => settled.push(...list.map((s) => s.item.submissionId)),
	});
	return {
		outbox,
		settled,
		stored: () => stored,
		advance: (ms: number) => {
			clock += ms;
		},
	};
}

const ok = (id: string, outcome: JudgeEntryResult['outcome'] = 'APPLIED'): JudgeEntryResult => ({submissionId: id, status: 200, outcome});
const flushed = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('settleItem', () => {
	const item: OutboxItem = {...entry('a1234567', 1, 1), createdAt: 0, tries: 0, state: 'pending'};

	it('removes an entry the site applied', () => {
		expect(settleItem(item, ok('a1234567'))).toEqual({keep: null, notice: null, retry: false});
		expect(settleItem(item, ok('a1234567', 'CONFLICT')).keep).toBeNull();
	});

	it('keeps an entry whose id is not in the answer', () => {
		expect(settleItem(item, undefined).keep).toMatchObject({state: 'pending', tries: 1});
		expect(settleItem(item, ok('other-id-000')).retry).toBe(true);
	});

	it('turns a processed refusal into a notice, not a sent row', () => {
		const out = settleItem(item, ok('a1234567', 'REJECTED_SENT'));
		expect(out.keep).toBeNull();
		expect(out.notice).toMatchObject({attemptNo: 1, outcome: 'REJECTED_SENT'});
	});

	it('keeps a 200 without an outcome', () => {
		expect(settleItem(item, {submissionId: 'a1234567', status: 200}).keep).not.toBeNull();
	});

	it('blocks on 403 and 404 without deleting', () => {
		expect(settleItem(item, {submissionId: 'a1234567', status: 403, error: 'NOT_JUDGE'}).keep).toMatchObject({
			state: 'blocked',
			error: 'NOT_JUDGE',
		});
		expect(settleItem(item, {submissionId: 'a1234567', status: 404}).keep?.state).toBe('blocked');
	});

	it('sets a 422 aside so it does not hold the queue', () => {
		const out = settleItem(item, {submissionId: 'a1234567', status: 422, error: 'sum'});
		expect(out.keep?.state).toBe('invalid');
		expect(out.retry).toBe(false);
	});

	it('retries a 409', () => {
		const out = settleItem(item, {submissionId: 'a1234567', status: 409, error: 'DISABLED'});
		expect(out.keep?.state).toBe('pending');
		expect(out.retry).toBe(true);
	});
});

describe('judge outbox', () => {
	it('stores before sending and removes only on a named 200', async () => {
		const send = jest.fn(async (items: JudgeEntryItem[]) => items.map((i) => ok(i.submissionId)));
		const {outbox, stored, settled} = makeOutbox(send);
		await outbox.enqueue(entry('sub-00001', 1, 1));
		expect(stored()).toHaveLength(1);
		await flushed();
		expect(send).toHaveBeenCalledTimes(1);
		expect(send.mock.calls[0][0][0]).toEqual({
			submissionId: 'sub-00001',
			cardId: 'card-1',
			kind: 'ATTEMPT',
			attemptNo: 1,
			value: 1234,
			rawValue: 1234,
			penalty: 0,
			permit: null,
			deviceSeq: 1,
		});
		expect(stored()).toHaveLength(0);
		expect(settled).toEqual(['sub-00001']);
	});

	it('keeps the entry through a failed send and sends it once when the network returns', async () => {
		let online = false;
		const send = jest.fn(async (items: JudgeEntryItem[]) => {
			if (!online) throw 'retry';
			return items.map((i) => ok(i.submissionId));
		});
		const {outbox, stored, advance} = makeOutbox(send);
		await outbox.enqueue(entry('sub-00002', 1, 1));
		await flushed();
		expect(stored()).toHaveLength(1);
		expect(outbox.getSnapshot().offline).toBe(true);

		// Inside the backoff window a timer tick does nothing.
		await outbox.flush(false);
		expect(send).toHaveBeenCalledTimes(1);

		online = true;
		advance(5000);
		await outbox.flush(false);
		expect(send).toHaveBeenCalledTimes(2);
		expect(stored()).toHaveLength(0);
		expect(outbox.getSnapshot().offline).toBe(false);
		// Same id both times: the site can answer the repeat with the first result.
		expect(send.mock.calls[1][0][0].submissionId).toBe('sub-00002');
	});

	it('does not drop an entry when the answer is not about it (captive portal, proxy page)', async () => {
		const send = jest.fn(async () => [] as JudgeEntryResult[]);
		const {outbox, stored} = makeOutbox(send);
		await outbox.enqueue(entry('sub-00003', 1, 1));
		await flushed();
		expect(stored()).toHaveLength(1);
		expect(stored()[0].state).toBe('pending');
	});

	it('pauses on a signed-out session and keeps everything', async () => {
		const send = jest.fn(async () => {
			throw 'auth';
		});
		const {outbox, stored} = makeOutbox(send);
		await outbox.enqueue(entry('sub-00004', 1, 1));
		await flushed();
		expect(outbox.getSnapshot().paused).toBe('auth');
		expect(stored()).toHaveLength(1);
	});

	it('never sends another account’s entries, and never deletes them', async () => {
		let user = 'user-1';
		const send = jest.fn(async (items: JudgeEntryItem[]) => items.map((i) => ok(i.submissionId)));
		const {outbox, stored} = makeOutbox(send, () => user);
		user = 'user-2';
		await outbox.enqueue(entry('sub-00005', 1, 1, 'user-1'));
		await flushed();
		expect(send).not.toHaveBeenCalled();
		expect(stored()).toHaveLength(1);
		user = 'user-1';
		await outbox.flush(true);
		expect(stored()).toHaveLength(0);
	});

	it('sends in device order, and a 422 does not stop the entries after it', async () => {
		const send = jest.fn(async (items: JudgeEntryItem[]) =>
			items.map((i) => (i.attemptNo === 1 ? {submissionId: i.submissionId, status: 422, error: 'value'} : ok(i.submissionId)))
		);
		const {outbox, stored} = makeOutbox(async () => {
			throw 'retry';
		});
		// Queue both while offline, then swap in the working sender.
		await outbox.enqueue(entry('sub-00007', 2, 20));
		await outbox.enqueue(entry('sub-00006', 1, 10));
		await flushed();
		expect(stored()).toHaveLength(2);
		const second = makeOutbox(send);
		await second.outbox.enqueue(entry('sub-00007', 2, 20));
		await second.outbox.enqueue(entry('sub-00006', 1, 10));
		await flushed();
		await second.outbox.flush(true);
		const lastCall = send.mock.calls[send.mock.calls.length - 1][0];
		expect(lastCall.map((i) => i.deviceSeq)).toEqual([...lastCall.map((i) => i.deviceSeq)].sort((a, b) => a - b));
		expect(second.stored().map((i) => [i.submissionId, i.state])).toEqual([['sub-00006', 'invalid']]);
	});

	it('a refusal leaves a notice and a new entry for the same attempt clears it', async () => {
		let outcome: JudgeEntryResult['outcome'] = 'REJECTED_SENT';
		const send = jest.fn(async (items: JudgeEntryItem[]) => items.map((i) => ok(i.submissionId, outcome)));
		const {outbox, stored} = makeOutbox(send);
		await outbox.enqueue(entry('sub-00008', 3, 1));
		await flushed();
		expect(stored()).toHaveLength(0);
		expect(outbox.getSnapshot().notices).toMatchObject([{attemptNo: 3, outcome: 'REJECTED_SENT'}]);
		outcome = 'APPLIED';
		await outbox.enqueue(entry('sub-00009', 3, 2));
		expect(outbox.getSnapshot().notices).toHaveLength(0);
	});

	it('a blocked entry goes again after the judge is approved for the card once more', async () => {
		let allowed = false;
		const send = jest.fn(async (items: JudgeEntryItem[]) =>
			items.map((i) => (allowed ? ok(i.submissionId) : {submissionId: i.submissionId, status: 403, error: 'NOT_JUDGE'}))
		);
		const {outbox, stored} = makeOutbox(send);
		await outbox.enqueue(entry('sub-00010', 1, 1));
		await flushed();
		expect(stored()[0].state).toBe('blocked');
		// Blocked entries are not retried on their own.
		await outbox.flush(true);
		expect(send).toHaveBeenCalledTimes(1);
		allowed = true;
		await outbox.retryBlocked('card-1');
		await flushed();
		expect(stored()).toHaveLength(0);
	});

	it('discard removes a blocked entry but never a pending one', async () => {
		const send = jest.fn(async () => {
			throw 'retry';
		});
		const {outbox, stored} = makeOutbox(send);
		await outbox.enqueue(entry('sub-00011', 1, 1));
		await flushed();
		await outbox.discard('sub-00011');
		expect(stored()).toHaveLength(1);
	});
});

describe('helpers', () => {
	it('backs off exponentially up to a minute', () => {
		expect(backoffDelayMs(1, 1)).toBe(2000);
		expect(backoffDelayMs(2, 1)).toBe(4000);
		expect(backoffDelayMs(20, 1)).toBe(60000);
		expect(backoffDelayMs(3, 0)).toBe(4000);
	});

	it('device sequence only rises and fits a GraphQL Int', () => {
		const a = nextDeviceSeq();
		const b = nextDeviceSeq();
		const c = nextDeviceSeq(0);
		expect(b).toBeGreaterThan(a);
		expect(c).toBeGreaterThan(b);
		expect(c).toBeLessThan(2 ** 31);
	});
});
