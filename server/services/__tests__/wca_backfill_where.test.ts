import {runWcaBackfill, WCA_RECORDS_MISSING_WHERE} from '../WcaBackfillService';
import {getPrisma} from '../../database';

jest.mock('axios');
jest.mock('../../database');
jest.mock('../../models/integration', () => ({updateIntegration: jest.fn()}));
jest.mock('../../models/wca_record', () => ({fetchAndSaveWcaRecords: jest.fn()}));
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
