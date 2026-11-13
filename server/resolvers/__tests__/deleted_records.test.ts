import 'reflect-metadata';

// Server-side deletion tombstones (server/models/deleted_record.ts) against an in-memory
// stand-in for Prisma. The case this suite is about: a device that has not caught up with a
// deletion made on another device sends the deleted solves and sessions again (launch
// backfill, offline queue replay, a session sent ahead of its solve), and the server used to
// take them back.

const createSolveModel = jest.fn();
const bulkCreateSolvesModel = jest.fn();

jest.mock('../../models/solve', () => ({
	createSolve: (...a: any[]) => createSolveModel(...a),
	bulkCreateSolves: (...a: any[]) => bulkCreateSolvesModel(...a),
	updateSolve: jest.fn(async () => undefined),
}));
jest.mock('../../models/solve_method_step', () => ({
	createSolveMethodSteps: jest.fn(async () => []),
	replaceSolveMethodSteps: jest.fn(async () => undefined),
}));
jest.mock('../../models/user_account', () => ({updateUserAccountWithParams: jest.fn(async () => undefined)}));
jest.mock('../../services/logger', () => ({
	logger: {warn: jest.fn(), info: jest.fn(), error: jest.fn()},
}));

let db: ReturnType<typeof makeDb>;
jest.mock('../../database', () => ({getPrisma: () => db.prisma}));

/* eslint-disable @typescript-eslint/no-var-requires */
const {SolveResolver} = require('../Solve.resolver');
const {SessionResolver} = require('../Session.resolver');
const {SOLVE_DELETED_I18N_KEY, SOLVE_SESSION_MISSING_I18N_KEY} = require('../../../shared/solve');
/* eslint-enable @typescript-eslint/no-var-requires */

const ME = 'user-me';

function inList(value: any, filter: any): boolean {
	if (filter === undefined) return true;
	if (filter && typeof filter === 'object' && Array.isArray(filter.in)) return filter.in.includes(value);
	return value === filter;
}

function makeDb() {
	const tombstones: {user_id: string; kind: string; record_id: string; deleted_at: Date}[] = [];
	let sessions = [
		{id: 's-main', user_id: ME, order: 0, name: 'Main', created_at: new Date('2026-01-01')},
		{id: 's-other', user_id: ME, order: 1, name: 'Other', created_at: new Date('2026-01-02')},
		{id: 's-gone', user_id: ME, order: 2, name: 'Gone', created_at: new Date('2026-01-03')},
	];
	let solves = [
		{id: 'a', user_id: ME, session_id: 's-gone'},
		{id: 'b', user_id: ME, session_id: 's-gone'},
		{id: 'c', user_id: ME, session_id: 's-main'},
	];
	let mainSessionId: string | null = 's-main';

	const matchSession = (s: any, where: any = {}) => inList(s.id, where.id) && inList(s.user_id, where.user_id);
	const matchSolve = (s: any, where: any = {}) =>
		inList(s.id, where.id) && inList(s.user_id, where.user_id) && inList(s.session_id, where.session_id);

	const prisma: any = {
		$transaction: jest.fn(async (ops: Promise<any>[]) => Promise.all(ops)),
		deletedRecord: {
			createMany: jest.fn(async ({data}: any) => {
				let count = 0;
				for (const row of data) {
					const dup = tombstones.some(
						(t) => t.user_id === row.user_id && t.kind === row.kind && t.record_id === row.record_id
					);
					if (!dup) {
						tombstones.push({...row, deleted_at: new Date()});
						count += 1;
					}
				}
				return {count};
			}),
			findMany: jest.fn(async ({where}: any) =>
				tombstones.filter(
					(t) =>
						t.user_id === where.user_id &&
						inList(t.kind, where.kind) &&
						inList(t.record_id, where.record_id) &&
						(!where.deleted_at || t.deleted_at > where.deleted_at.gt)
				)
			),
			findUnique: jest.fn(async ({where}: any) => {
				const k = where.user_id_kind_record_id;
				return (
					tombstones.find((t) => t.user_id === k.user_id && t.kind === k.kind && t.record_id === k.record_id) || null
				);
			}),
		},
		setting: {findUnique: jest.fn(async () => ({session_id: mainSessionId}))},
		session: {
			findUnique: jest.fn(async ({where}: any) => sessions.find((s) => s.id === where.id) || null),
			findFirst: jest.fn(async ({where, orderBy}: any) => {
				let rows = sessions.filter((s) => matchSession(s, where));
				if (orderBy) rows = [...rows].sort((x, y) => x.order - y.order);
				return rows[0] || null;
			}),
			findMany: jest.fn(async ({where}: any) => sessions.filter((s) => matchSession(s, where))),
			count: jest.fn(async ({where}: any) => sessions.filter((s) => matchSession(s, where)).length),
			createMany: jest.fn(async ({data}: any) => {
				for (const row of data) {
					if (!sessions.some((s) => s.id === row.id)) sessions.push({order: 0, created_at: new Date(), ...row});
				}
				return {count: data.length};
			}),
			deleteMany: jest.fn(async ({where}: any) => {
				const gone = sessions.filter((s) => matchSession(s, where)).map((s) => s.id);
				sessions = sessions.filter((s) => !gone.includes(s.id));
				// The foreign key cascade
				solves = solves.filter((s) => !gone.includes(s.session_id));
				return {count: gone.length};
			}),
			update: jest.fn(async ({where, data}: any) => {
				const s = sessions.find((x) => x.id === where.id);
				Object.assign(s, data);
				return s;
			}),
		},
		solve: {
			findFirst: jest.fn(async ({where}: any) => solves.find((s) => matchSolve(s, where)) || null),
			findMany: jest.fn(async ({where}: any) => solves.filter((s) => matchSolve(s, where))),
			deleteMany: jest.fn(async ({where}: any) => {
				const before = solves.length;
				solves = solves.filter((s) => !matchSolve(s, where));
				return {count: before - solves.length};
			}),
		},
		smartDevice: {findMany: jest.fn(async () => [])},
		cube: {findMany: jest.fn(async () => [])},
	};

	return {
		prisma,
		context: {user: {id: ME}, prisma} as any,
		tombstones,
		sessions: () => sessions,
		solves: () => solves,
		setMainSession: (id: string | null) => {
			mainSessionId = id;
		},
	};
}

function solveInput(id: string, sessionId: string): any {
	return {
		id,
		time: 9.5,
		raw_time: 9.5,
		cube_type: 'wca',
		scramble_subset: '333',
		scramble: "R U R'",
		session_id: sessionId,
		started_at: 1,
		ended_at: 2,
		dnf: false,
		plus_two: false,
	};
}

function i18nKeyOf(error: any): string | undefined {
	return error?.extensions?.i18nKey;
}

beforeEach(() => {
	db = makeDb();
	createSolveModel.mockReset();
	createSolveModel.mockImplementation(async (_user: any, input: any) => ({...input}));
	bulkCreateSolvesModel.mockReset();
	bulkCreateSolvesModel.mockImplementation(async () => ({count: 0}));
});

describe('solve deletions', () => {
	it('deleteSolves records every requested id, also one the server does not have yet', async () => {
		await new SolveResolver().deleteSolves(db.context, ['c', 'not-uploaded-yet']);

		expect(db.solves().map((s) => s.id)).toEqual(['a', 'b']);
		expect(db.tombstones.map((t) => [t.kind, t.record_id])).toEqual([
			['solve', 'c'],
			['solve', 'not-uploaded-yet'],
		]);
	});

	it('createSolve refuses a deleted solve with the deleted i18nKey and stores nothing', async () => {
		await new SolveResolver().deleteSolves(db.context, ['c']);

		const error = await new SolveResolver().createSolve(db.context, solveInput('c', 's-main')).catch((e: any) => e);

		expect(i18nKeyOf(error)).toBe(SOLVE_DELETED_I18N_KEY);
		expect(createSolveModel).not.toHaveBeenCalled();
	});

	it('bulkCreateSolves passes over deleted solves without failing the batch', async () => {
		await new SolveResolver().deleteSolves(db.context, ['c']);

		await new SolveResolver().bulkCreateSolves(db.context, [solveInput('c', 's-main'), solveInput('d', 's-main')]);

		const sent = bulkCreateSolvesModel.mock.calls[0][1].map((s: any) => s.id);
		expect(sent).toEqual(['d']);
	});

	it('bulkCreateSolves made only of deleted solves is not an error', async () => {
		await new SolveResolver().deleteSolves(db.context, ['c']);

		await expect(
			new SolveResolver().bulkCreateSolves(db.context, [solveInput('c', 's-main')])
		).resolves.toBeUndefined();
		expect(bulkCreateSolvesModel).not.toHaveBeenCalled();
	});

	it('deleteAllSolvesInSession records the solves it removes', async () => {
		await new SolveResolver().deleteAllSolvesInSession(db.context, 's-gone');

		expect(db.solves().map((s) => s.id)).toEqual(['c']);
		expect(db.tombstones.map((t) => t.record_id).sort()).toEqual(['a', 'b']);
	});
});

describe('session deletions', () => {
	it('deleteSession records the session and the solves the cascade takes with it', async () => {
		await new SessionResolver().deleteSession(db.context, 's-gone');

		expect(db.sessions().map((s) => s.id)).toEqual(['s-main', 's-other']);
		expect(db.tombstones.map((t) => `${t.kind}:${t.record_id}`).sort()).toEqual([
			'session:s-gone',
			'solve:a',
			'solve:b',
		]);
	});

	it('bulkDeleteSessions records every session and its solves', async () => {
		await new SessionResolver().bulkDeleteSessions(db.context, ['s-gone', 's-other']);

		expect(db.tombstones.map((t) => `${t.kind}:${t.record_id}`).sort()).toEqual([
			'session:s-gone',
			'session:s-other',
			'solve:a',
			'solve:b',
		]);
	});

	it('mergeSessions records the merged-away session but not its solves, which live on', async () => {
		db.prisma.solve.updateMany = jest.fn(async () => ({count: 2}));
		db.prisma.session.delete = jest.fn(async ({where}: any) => db.prisma.session.deleteMany({where}));

		await new SessionResolver().mergeSessions(db.context, 's-gone', 's-main');

		expect(db.tombstones.map((t) => `${t.kind}:${t.record_id}`)).toEqual(['session:s-gone']);
	});

	it('bulkCreateSessions does not put a deleted session back', async () => {
		await new SessionResolver().deleteSession(db.context, 's-gone');

		await new SessionResolver().bulkCreateSessions(db.context, [
			{id: 's-gone', name: 'Gone', order: 2},
			{id: 's-new', name: 'New', order: 3},
		]);

		expect(db.sessions().map((s) => s.id)).toEqual(['s-main', 's-other', 's-new']);
	});

	it('a solve made in a session deleted elsewhere lands in the main session', async () => {
		await new SessionResolver().deleteSession(db.context, 's-gone');

		const created = await new SolveResolver().createSolve(db.context, solveInput('new-solve', 's-gone'));

		expect(created.session_id).toBe('s-main');
		expect(createSolveModel.mock.calls[0][1].session_id).toBe('s-main');
	});

	it('falls back to the first session when the main one is gone too', async () => {
		db.setMainSession('s-gone');
		await new SessionResolver().deleteSession(db.context, 's-gone');

		const created = await new SolveResolver().createSolve(db.context, solveInput('new-solve', 's-gone'));

		expect(created.session_id).toBe('s-main');
	});

	it('a session that has simply not arrived yet still asks the device to send it first', async () => {
		const error = await new SolveResolver()
			.createSolve(db.context, solveInput('new-solve', 's-offline-created'))
			.catch((e: any) => e);

		expect(i18nKeyOf(error)).toBe(SOLVE_SESSION_MISSING_I18N_KEY);
		expect(createSolveModel).not.toHaveBeenCalled();
	});
});

describe('myDeletedRecords', () => {
	it('splits the ids by kind and hands back a cursor that trails the read', async () => {
		await new SessionResolver().deleteSession(db.context, 's-gone');
		const before = Date.now();

		const result = await new SolveResolver().myDeletedRecords(db.context, null);

		expect(result.solve_ids.sort()).toEqual(['a', 'b']);
		expect(result.session_ids).toEqual(['s-gone']);
		expect(result.cursor).toBeLessThan(before);
	});

	it('reads only what was deleted after the cursor', async () => {
		await new SolveResolver().deleteSolves(db.context, ['c']);
		const cursor = Date.now() + 1000;

		const result = await new SolveResolver().myDeletedRecords(db.context, cursor);

		expect(result.solve_ids).toEqual([]);
		expect(result.session_ids).toEqual([]);
	});
});
