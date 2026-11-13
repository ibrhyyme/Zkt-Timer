/**
 * Deletions made on other devices, applied to this device (server-deletions.ts).
 *
 * The bug this guards against: a session deleted on the phone stayed on the computer, and
 * the computer's launch backfill put it (and its solves) back on the server, so it came back
 * on the phone too.
 */

const gqlQuery = jest.fn();
const requestPersist = jest.fn(async (..._args: any[]) => undefined);
const emitEvent = jest.fn();
let canRead = true;
let meId: string | null = 'user-me';
const storage = new Map<string, any>();

function fakeCollection(rows: any[]) {
	let data = [...rows];
	return {
		where: (fn: (doc: any) => boolean) => data.filter(fn),
		remove: (docs: any[]) => {
			data = data.filter((d) => !docs.includes(d));
		},
		ids: () => data.map((d) => d.id),
	};
}

let solveDb: ReturnType<typeof fakeCollection>;
let sessionDb: ReturnType<typeof fakeCollection>;

jest.mock('../../components/api', () => ({gqlQuery: (...a: any[]) => gqlQuery(...a)}));
jest.mock('../../db/solves/init', () => ({getSolveDb: () => solveDb}));
jest.mock('../../db/sessions/init', () => ({getSessionDb: () => sessionDb}));
jest.mock('../../db/persist', () => ({requestPersist: (...a: any[]) => requestPersist(...a)}));
jest.mock('../../lib/sync-gate', () => ({canReadSync: () => canRead}));
jest.mock('../../components/store', () => ({getStore: () => ({getState: () => ({account: {me: meId ? {id: meId} : null}})})}));
jest.mock('../event_handler', () => ({emitEvent: (...a: any[]) => emitEvent(...a)}));
jest.mock('../data/local_storage', () => ({
	getLocalStorage: (k: string) => storage.get(k) ?? null,
	setLocalStorageObject: (k: string, v: any) => storage.set(k, v),
	deleteLocalStorage: (k: string) => storage.delete(k),
}));

import {applyServerDeletions, clearServerDeletionsCursor} from '../server-deletions';

function answer(solve_ids: string[], session_ids: string[], cursor = 1000) {
	gqlQuery.mockResolvedValueOnce({data: {myDeletedRecords: {solve_ids, session_ids, cursor}}});
}

beforeEach(() => {
	gqlQuery.mockReset();
	requestPersist.mockClear();
	emitEvent.mockClear();
	storage.clear();
	canRead = true;
	meId = 'user-me';
	solveDb = fakeCollection([{id: 'a'}, {id: 'b'}, {id: 'c'}]);
	sessionDb = fakeCollection([{id: 's-main'}, {id: 's-gone'}]);
});

describe('applyServerDeletions', () => {
	it('removes the deleted solves and sessions however many there are', async () => {
		answer(['a', 'b', 'never-here'], ['s-gone']);

		expect(await applyServerDeletions()).toBe(true);

		expect(solveDb.ids()).toEqual(['c']);
		expect(sessionDb.ids()).toEqual(['s-main']);
		expect(emitEvent).toHaveBeenCalledWith('solveDbUpdatedEvent');
		expect(emitEvent).toHaveBeenCalledWith('sessionsDbUpdatedEvent');
		expect(requestPersist).toHaveBeenCalledWith({destructive: true});
	});

	it('reads from the start the first time, then from the cursor it was handed', async () => {
		answer([], [], 5000);
		await applyServerDeletions();
		answer([], [], 9000);
		await applyServerDeletions();

		expect(gqlQuery.mock.calls[0][1]).toEqual({since: null});
		expect(gqlQuery.mock.calls[1][1]).toEqual({since: 5000});
	});

	it('does not reuse another account\'s cursor', async () => {
		answer([], [], 5000);
		await applyServerDeletions();
		meId = 'user-other';
		answer([], [], 7000);
		await applyServerDeletions();

		expect(gqlQuery.mock.calls[1][1]).toEqual({since: null});
	});

	it('moves the cursor only after the removal is written out', async () => {
		let release: () => void = () => undefined;
		requestPersist.mockImplementationOnce(() => new Promise<undefined>((r) => (release = () => r(undefined))));
		answer(['a'], [], 5000);

		const run = applyServerDeletions();
		await new Promise((r) => setTimeout(r, 0));
		expect(storage.size).toBe(0);

		release();
		await run;
		expect([...storage.values()][0]).toEqual({userId: 'user-me', cursor: 5000});
	});

	it('keeps the cursor where it was when the read fails', async () => {
		gqlQuery.mockRejectedValueOnce(new Error('Failed to fetch'));

		expect(await applyServerDeletions()).toBe(false);
		expect(storage.size).toBe(0);
		expect(solveDb.ids()).toEqual(['a', 'b', 'c']);
	});

	it('leaves a Basic device alone: its history is local by design', async () => {
		canRead = false;

		expect(await applyServerDeletions()).toBe(false);
		expect(gqlQuery).not.toHaveBeenCalled();
	});

	it('does not write anything out when nothing local was deleted', async () => {
		answer(['not-here'], []);

		await applyServerDeletions();
		expect(requestPersist).not.toHaveBeenCalled();
		expect(emitEvent).not.toHaveBeenCalled();
	});

	it('clearing the cursor makes the next read start over', async () => {
		answer([], [], 5000);
		await applyServerDeletions();
		clearServerDeletionsCursor();
		answer([], []);
		await applyServerDeletions();

		expect(gqlQuery.mock.calls[1][1]).toEqual({since: null});
	});
});
