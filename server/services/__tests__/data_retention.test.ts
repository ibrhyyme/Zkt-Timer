// The privacy page gives retention periods. These sweeps are what keeps them true.

const acquireRedisLock = jest.fn();
jest.mock('../redis', () => ({
	RedisNamespace: {PRO_DATA: 'cd:pro'},
	createRedisKey: (ns: string, hash: string) => ({key: `${ns}#${hash}`}),
	acquireRedisLock: (...a: any[]) => acquireRedisLock(...a),
}));
jest.mock('../logger', () => ({logger: {warn: jest.fn(), info: jest.fn(), error: jest.fn(), debug: jest.fn()}}));

const searchClient = {
	cat: {indices: jest.fn()},
	indices: {delete: jest.fn()},
};
jest.mock('../search', () => ({getSearchClient: () => searchClient}));

const prisma = {
	message: {deleteMany: jest.fn()},
	conversation: {deleteMany: jest.fn()},
	messageReport: {deleteMany: jest.fn()},
	emailLog: {deleteMany: jest.fn(), create: jest.fn()},
};
jest.mock('../../database', () => ({getPrisma: () => prisma}));

import {runTick as sweepMessages} from '../cron_message_retention';
import {runTick as sweepEmailLogs} from '../cron_email_log_retention';
import {expiredLogIndices, runTick as sweepLogs} from '../cron_log_retention';
import {createEmailLog} from '../../models/email_log';

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date('2026-11-02T12:00:00Z').getTime();

beforeEach(() => {
	jest.clearAllMocks();
	jest.spyOn(Date, 'now').mockReturnValue(NOW);
	acquireRedisLock.mockResolvedValue(true);
	for (const table of [prisma.message, prisma.conversation, prisma.messageReport, prisma.emailLog]) {
		table.deleteMany.mockResolvedValue({count: 0});
	}
});

afterEach(() => {
	jest.restoreAllMocks();
});

describe('message retention', () => {
	it('deletes closed reports past a year, the same limit as the messages they copy', async () => {
		await sweepMessages();

		const {where} = prisma.messageReport.deleteMany.mock.calls[0][0];
		expect(where.status).toEqual({not: 'OPEN'});
		expect(where.created_at.lt.getTime()).toBe(NOW - 365 * DAY_MS);
		expect(prisma.message.deleteMany.mock.calls[0][0].where.created_at.lt.getTime()).toBe(NOW - 365 * DAY_MS);
	});

	it('leaves everything alone on the instance that lost the lock', async () => {
		acquireRedisLock.mockResolvedValue(false);

		await sweepMessages();

		expect(prisma.messageReport.deleteMany).not.toHaveBeenCalled();
	});
});

describe('email log retention', () => {
	it('deletes rows past 90 days and rows left behind by deleted accounts', async () => {
		await sweepEmailLogs();

		const {where} = prisma.emailLog.deleteMany.mock.calls[0][0];
		expect(where.OR[0].created_at.lt.getTime()).toBe(NOW - 90 * DAY_MS);
		expect(where.OR[1]).toEqual({user_id: null});
	});

	it('leaves everything alone on the instance that lost the lock', async () => {
		acquireRedisLock.mockResolvedValue(false);

		await sweepEmailLogs();

		expect(prisma.emailLog.deleteMany).not.toHaveBeenCalled();
	});
});

describe('server log retention', () => {
	it('picks daily log indices older than a year and keeps the ones inside it', () => {
		expect(expiredLogIndices(['logs-2025.11.01', 'logs-2025.11.02', 'logs-2025.11.03', 'logs-2026.11.02'], NOW)).toEqual([
			'logs-2025.11.01',
			'logs-2025.11.02',
		]);
	});

	it('never picks anything but a daily log index, the archive lives on the same cluster', () => {
		expect(
			expiredLogIndices(['zkt_archived_competitions', 'logs', 'logs-2020', 'logs-2020.01.01-reindexed', 'xlogs-2020.01.01'], NOW)
		).toEqual([]);
	});

	it('deletes expired indices by name, one at a time', async () => {
		searchClient.cat.indices.mockResolvedValue([{index: 'logs-2020.01.01'}, {index: 'logs-2020.01.02'}, {index: 'logs-2026.11.01'}]);

		await sweepLogs();

		expect(searchClient.cat.indices.mock.calls[0][0].index).toBe('logs-*');
		expect(searchClient.indices.delete.mock.calls).toEqual([[{index: 'logs-2020.01.01'}], [{index: 'logs-2020.01.02'}]]);
	});

	it('leaves everything alone on the instance that lost the lock', async () => {
		acquireRedisLock.mockResolvedValue(false);

		await sweepLogs();

		expect(searchClient.indices.delete).not.toHaveBeenCalled();
	});
});

describe('createEmailLog', () => {
	it('records that the mail went out and keeps nothing it said', async () => {
		await createEmailLog({id: 'user-1', email: 'a@b.co'} as any, 'Verify', 'email_verification');

		const {data} = prisma.emailLog.create.mock.calls[0][0];
		expect(data).toMatchObject({
			user_id: 'user-1',
			email: 'a@b.co',
			subject: 'Verify',
			template: 'email_verification',
			vars: '{}',
		});
	});
});
