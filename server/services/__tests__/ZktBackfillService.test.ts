import axios from 'axios';
import {runZktBackfill} from '../ZktBackfillService';
import {getPrisma} from '../../database';

jest.mock('axios');
jest.mock('../../database');
jest.mock('../logger', () => ({
	logger: {info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()},
}));

const mockedAxios = axios as jest.Mocked<typeof axios>;
const mockedGetPrisma = getPrisma as jest.MockedFunction<typeof getPrisma>;

interface PendingRow {
	id: string;
	user_id: string;
	zkt_user_id: string;
}

// Minimal stand-in for the two Prisma calls the service makes. `update` is a jest
// mock so a test can make one specific row reject with P2002.
function prismaStub(pending: PendingRow[], update = jest.fn().mockResolvedValue({})) {
	return {
		integration: {
			findMany: jest.fn().mockResolvedValue(pending),
			update,
		},
	} as any;
}

const SECRET = 'test-secret';

beforeEach(() => {
	jest.clearAllMocks();
	process.env.ZKT_INTERNAL_API_SECRET = SECRET;
});

afterAll(() => {
	delete process.env.ZKT_INTERNAL_API_SECRET;
});

describe('runZktBackfill', () => {
	it('does nothing when the shared secret is not configured', async () => {
		delete process.env.ZKT_INTERNAL_API_SECRET;
		mockedGetPrisma.mockReturnValue(prismaStub([]));

		const result = await runZktBackfill();

		expect(result.total).toBe(0);
		expect(mockedAxios.post).not.toHaveBeenCalled();
	});

	it('writes the IDs the federation has minted and counts the rest as still null', async () => {
		const update = jest.fn().mockResolvedValue({});
		mockedGetPrisma.mockReturnValue(
			prismaStub(
				[
					{id: 'i1', user_id: 'u1', zkt_user_id: 'sub1'},
					{id: 'i2', user_id: 'u2', zkt_user_id: 'sub2'},
				],
				update,
			),
		);
		mockedAxios.post.mockResolvedValue({
			data: {ids: {sub1: '2026ISAZ01', sub2: null}},
		} as any);

		const result = await runZktBackfill();

		expect(result).toMatchObject({total: 2, filled: 1, stillNull: 1, conflict: 0, error: 0});
		expect(update).toHaveBeenCalledTimes(1);
		expect(update).toHaveBeenCalledWith(
			expect.objectContaining({
				where: {id: 'i1'},
				data: expect.objectContaining({zkt_id: '2026ISAZ01'}),
			}),
		);
	});

	it('sends every pending subject in one request', async () => {
		mockedGetPrisma.mockReturnValue(
			prismaStub([
				{id: 'i1', user_id: 'u1', zkt_user_id: 'sub1'},
				{id: 'i2', user_id: 'u2', zkt_user_id: 'sub2'},
				{id: 'i3', user_id: 'u3', zkt_user_id: 'sub3'},
			]),
		);
		mockedAxios.post.mockResolvedValue({data: {ids: {}}} as any);

		await runZktBackfill();

		expect(mockedAxios.post).toHaveBeenCalledTimes(1);
		const [url, body, config] = mockedAxios.post.mock.calls[0] as any[];
		expect(body).toEqual({subs: ['sub1', 'sub2', 'sub3']});
		// Trailing slash matters: the federation 308-redirects the slash-less form.
		expect(url).toMatch(/\/api\/internal\/v1\/zkt-ids\/$/);
		expect(config.headers.Authorization).toBe(`Bearer ${SECRET}`);
	});

	it('splits into chunks and keeps going when one chunk fails', async () => {
		mockedGetPrisma.mockReturnValue(
			prismaStub([
				{id: 'i1', user_id: 'u1', zkt_user_id: 'sub1'},
				{id: 'i2', user_id: 'u2', zkt_user_id: 'sub2'},
			]),
		);
		mockedAxios.post
			.mockRejectedValueOnce(Object.assign(new Error('boom'), {response: {status: 500}}))
			.mockResolvedValueOnce({data: {ids: {sub2: '2026ABCD01'}}} as any);

		const result = await runZktBackfill({chunkSize: 1});

		expect(mockedAxios.post).toHaveBeenCalledTimes(2);
		expect(result).toMatchObject({total: 2, filled: 1, error: 1});
	});

	it('counts a taken ZKT ID as a conflict instead of aborting the run', async () => {
		const update = jest
			.fn()
			.mockRejectedValueOnce(Object.assign(new Error('unique'), {code: 'P2002'}))
			.mockResolvedValueOnce({});
		mockedGetPrisma.mockReturnValue(
			prismaStub(
				[
					{id: 'i1', user_id: 'u1', zkt_user_id: 'sub1'},
					{id: 'i2', user_id: 'u2', zkt_user_id: 'sub2'},
				],
				update,
			),
		);
		mockedAxios.post.mockResolvedValue({
			data: {ids: {sub1: '2026ISAZ01', sub2: '2026ABCD01'}},
		} as any);

		const result = await runZktBackfill();

		expect(result).toMatchObject({total: 2, filled: 1, conflict: 1, error: 0});
		expect(update).toHaveBeenCalledTimes(2);
	});

	it('skips the federation call entirely when nothing is pending', async () => {
		mockedGetPrisma.mockReturnValue(prismaStub([]));

		const result = await runZktBackfill();

		expect(result.total).toBe(0);
		expect(mockedAxios.post).not.toHaveBeenCalled();
	});

	it('only asks for integrations that are linked, unrevoked and still ID-less', async () => {
		const stub = prismaStub([]);
		mockedGetPrisma.mockReturnValue(stub);

		await runZktBackfill();

		expect(stub.integration.findMany).toHaveBeenCalledWith(
			expect.objectContaining({
				where: {
					service_name: 'zkt',
					revoked_at: null,
					zkt_id: null,
					zkt_user_id: {not: null},
				},
			}),
		);
	});
});
