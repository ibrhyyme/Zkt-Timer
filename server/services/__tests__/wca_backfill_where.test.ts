import {
	runWcaBackfill,
	WCA_RECORDS_MISSING_WHERE,
	WCA_RECORDS_REFRESH_WHERE,
	WCA_REFRESH_AFTER_MS,
} from '../WcaBackfillService';
import {getPrisma} from '../../database';
import {saveWcaPersonRecords} from '../../models/wca_record';
import {WcaApiService} from '../WcaApiService';

jest.mock('axios');
jest.mock('../../database');
jest.mock('../../models/integration', () => ({updateIntegration: jest.fn()}));
jest.mock('../../models/wca_record', () => ({fetchAndSaveWcaRecords: jest.fn(), saveWcaPersonRecords: jest.fn()}));
jest.mock('../WcaApiService', () => ({WcaApiService: {fetchPersonDataOrThrow: jest.fn()}}));
jest.mock('../../integrations/oauth', () => ({
	getOAuthPostRequest: jest.fn(),
	syncWcaProfileToIntegration: jest.fn(),
}));
jest.mock('../logger', () => ({
	logger: {info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn()},
}));

const mockedGetPrisma = getPrisma as jest.MockedFunction<typeof getPrisma>;

// Phase 2 of the WCA backfill picks users whose WCA records were never fetched.
// It used to key on the derived `kinch_score` column, which the old ranking wrote.
// With the ranking gone and that column cleared, a column marker would select every
// WCA user every night and flood the WCA API. The marker must be the relation.
describe('WCA backfill phase 2 selector', () => {
	it('selects linked users with a wca_id and no WcaRecord rows', () => {
		expect(WCA_RECORDS_MISSING_WHERE).toEqual({
			service_name: 'wca',
			revoked_at: null,
			wca_id: {not: null},
			wca_records: {none: {}},
		});
	});

	it('does not key on any old ranking column', () => {
		const keys = Object.keys(WCA_RECORDS_MISSING_WHERE);
		for (const col of ['kinch_score', 'sor_single', 'sor_average', 'ranks_updated_at']) {
			expect(keys).not.toContain(col);
		}
	});

	it('runWcaBackfill queries phase 2 with that selector', async () => {
		const findMany = jest.fn().mockResolvedValue([]);
		mockedGetPrisma.mockReturnValue({integration: {findMany}} as any);

		const result = await runWcaBackfill({requestDelayMs: 0});

		expect(findMany).toHaveBeenCalledTimes(2);
		const phase2 = findMany.mock.calls[1][0];
		expect(phase2.where).toEqual(WCA_RECORDS_MISSING_WHERE);
		expect(result.recordsTotal).toBe(0);
	});

	it('skips phase 2 when records are not requested', async () => {
		const findMany = jest.fn().mockResolvedValue([]);
		mockedGetPrisma.mockReturnValue({integration: {findMany}} as any);

		await runWcaBackfill({requestDelayMs: 0, includeRecords: false});

		expect(findMany).toHaveBeenCalledTimes(1);
	});
});

// Phase 3 keeps every linked profile within a day of WCA: PBs, ranks, medals and
// competition counts used to change only when the user pressed "refresh".
describe('WCA backfill phase 3 (nightly refresh)', () => {
	const mockedFetch = WcaApiService.fetchPersonDataOrThrow as jest.Mock;
	const mockedSave = saveWcaPersonRecords as jest.Mock;

	beforeEach(() => {
		mockedFetch.mockReset();
		mockedSave.mockReset();
	});

	const due = (n: number, prefix = 'u') =>
		Array.from({length: n}, (_, i) => ({id: `int-${prefix}${i}`, user_id: `${prefix}${i}`, wca_id: `2020TEST${i}`}));

	const opts = {requestDelayMs: 0, includeRecords: false, includeRefresh: true, refreshDelayMs: 0, rateLimitPauseMs: 0};

	it('is off unless asked for, so the admin run stays short', async () => {
		const findMany = jest.fn().mockResolvedValue([]);
		mockedGetPrisma.mockReturnValue({integration: {findMany}} as any);

		await runWcaBackfill({requestDelayMs: 0});

		expect(findMany).toHaveBeenCalledTimes(2);
		expect(mockedFetch).not.toHaveBeenCalled();
	});

	it('reads never-refreshed rows first, then the stalest, and saves each person', async () => {
		const findMany = jest
			.fn()
			.mockResolvedValueOnce([]) // phase 1
			.mockResolvedValueOnce(due(1, 'never'))
			.mockResolvedValueOnce(due(2, 'stale'));
		mockedGetPrisma.mockReturnValue({integration: {findMany}} as any);
		mockedFetch.mockResolvedValue({personal_records: {}});

		const before = Date.now();
		const result = await runWcaBackfill({...opts, refreshBatchSize: 10});

		const neverQuery = findMany.mock.calls[1][0];
		expect(neverQuery.where).toEqual({...WCA_RECORDS_REFRESH_WHERE, wca_records_synced_at: null});
		expect(neverQuery.take).toBe(10);

		const staleQuery = findMany.mock.calls[2][0];
		expect(staleQuery.orderBy).toEqual({wca_records_synced_at: 'asc'});
		expect(staleQuery.take).toBe(9);
		const cutoff = staleQuery.where.wca_records_synced_at.lt.getTime();
		expect(cutoff).toBeLessThanOrEqual(before - WCA_REFRESH_AFTER_MS + 1000);
		expect(cutoff).toBeGreaterThanOrEqual(before - WCA_REFRESH_AFTER_MS - 1000);

		expect(result.refreshTotal).toBe(3);
		expect(result.refreshed).toBe(3);
		expect(mockedSave).toHaveBeenCalledWith('never0', 'int-never0', {personal_records: {}});
	});

	it('skips the stale query when never-refreshed rows fill the batch', async () => {
		const findMany = jest.fn().mockResolvedValueOnce([]).mockResolvedValueOnce(due(2));
		mockedGetPrisma.mockReturnValue({integration: {findMany}} as any);
		mockedFetch.mockResolvedValue({});

		await runWcaBackfill({...opts, refreshBatchSize: 2});

		expect(findMany).toHaveBeenCalledTimes(2);
	});

	it('gives up for the night after three 429s in a row', async () => {
		const findMany = jest.fn().mockResolvedValueOnce([]).mockResolvedValueOnce(due(6));
		mockedGetPrisma.mockReturnValue({integration: {findMany}} as any);
		mockedFetch.mockRejectedValue({response: {status: 429}});

		const result = await runWcaBackfill({...opts, refreshBatchSize: 6});

		expect(mockedFetch).toHaveBeenCalledTimes(3);
		expect(result.rateLimited).toBe(3);
		expect(mockedSave).not.toHaveBeenCalled();
	});

	it('counts other failures and moves on', async () => {
		const findMany = jest.fn().mockResolvedValueOnce([]).mockResolvedValueOnce(due(2));
		mockedGetPrisma.mockReturnValue({integration: {findMany}} as any);
		mockedFetch.mockRejectedValueOnce({response: {status: 404}}).mockResolvedValueOnce({});

		const result = await runWcaBackfill({...opts, refreshBatchSize: 2});

		expect(result.refreshError).toBe(1);
		expect(result.refreshed).toBe(1);
	});
});
