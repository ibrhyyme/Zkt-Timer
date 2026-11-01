import axios from 'axios';
import {WcaApiService} from '../WcaApiService';

jest.mock('axios');
jest.mock('../redis', () => ({}));

const mockedGet = axios.get as jest.MockedFunction<typeof axios.get>;

// A two-day competition that started on the last day of a month disappeared
// from the list on its second day: the query was bounded by START date from the
// 1st of the current month. The bound has to be the END date, whatever the
// competition's length.
describe('WcaApiService.fetchUpcomingCompetitions', () => {
	beforeEach(() => {
		jest.spyOn(Date, 'now').mockReturnValue(new Date('2026-11-01T10:00:00Z').getTime());
		mockedGet.mockReset();
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('bounds the query by end date (yesterday), not by start date', async () => {
		mockedGet.mockResolvedValue({data: [], headers: {total: '0'}} as any);

		await WcaApiService.fetchUpcomingCompetitions('TR');

		const params = (mockedGet.mock.calls[0][1] as any).params;
		expect(params.ongoing_and_future).toBe('2026-10-31');
		expect(params.start).toBeUndefined();
		expect(params.country_iso2).toBe('TR');
	});

	it('keeps a competition that started last month and is still running', async () => {
		const running = {id: 'NewAgeTurkey2026', start_date: '2026-10-31', end_date: '2026-11-01'};
		const cancelled = {id: 'Cancelled2026', start_date: '2026-11-05', end_date: '2026-11-05', cancelled_at: '2026-10-20'};
		mockedGet.mockResolvedValue({data: [running, cancelled], headers: {total: '2'}} as any);

		const comps = await WcaApiService.fetchUpcomingCompetitions();

		expect(comps.map((c: any) => c.id)).toEqual(['NewAgeTurkey2026']);
	});
});
