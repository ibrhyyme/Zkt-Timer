import axios from 'axios';
import {WcaApiService} from '../WcaApiService';

jest.mock('axios');
jest.mock('../redis', () => ({}));

const mockedGet = axios.get as jest.MockedFunction<typeof axios.get>;

// WCA's /competitions/mine also lists competitions the user organizes or
// delegates, unannounced ones included. A hidden test competition the user was
// once added to stayed in "Yarışmalarım" for good.
describe('WcaApiService.fetchMyCompetitions', () => {
	beforeEach(() => mockedGet.mockReset());

	it('drops competitions that are not visible on the WCA site', async () => {
		mockedGet.mockResolvedValueOnce({
			data: {
				future_competitions: [
					{id: 'BursaOpen2026', 'visible?': true, 'cancelled?': false},
					{id: 'Test2026', 'visible?': false, 'cancelled?': false},
					{id: 'Cancelled2026', 'visible?': true, 'cancelled?': true},
				],
			},
		} as any);
		const ids = (await WcaApiService.fetchMyCompetitions('token')).map((c) => c.id);
		expect(ids).toEqual(['BursaOpen2026']);
	});

	it('keeps a competition when WCA does not send the visibility field', async () => {
		mockedGet.mockResolvedValueOnce({data: {future_competitions: [{id: 'Old2026'}]}} as any);
		const ids = (await WcaApiService.fetchMyCompetitions('token')).map((c) => c.id);
		expect(ids).toEqual(['Old2026']);
	});
});
