jest.mock('../../database', () => ({getPrisma: jest.fn()}));

import {getPrisma} from '../../database';
import {maskHiddenWcaRanks, newRecordStartsPublished, saveWcaPersonRecords} from '../wca_record';
import {WcaPerson} from '../../services/WcaApiService';

const mockedGetPrisma = getPrisma as jest.MockedFunction<typeof getPrisma>;

const ranks = {
	single_world_rank: 1200,
	average_world_rank: 1500,
	single_continent_rank: 400,
	average_continent_rank: 450,
	single_country_rank: 12,
	average_country_rank: 15,
};

describe('maskHiddenWcaRanks', () => {
	it('blanks world and continent ranks when "show world ranking" is off, keeps the country rank', () => {
		const [masked] = maskHiddenWcaRanks([{...ranks, integration: {wca_show_rank: false}}]);
		expect(masked.single_world_rank).toBeNull();
		expect(masked.average_world_rank).toBeNull();
		expect(masked.single_continent_rank).toBeNull();
		expect(masked.average_continent_rank).toBeNull();
		expect(masked.single_country_rank).toBe(12);
		expect(masked.average_country_rank).toBe(15);
	});

	it('leaves records alone when the switch is on or unset', () => {
		const on = {...ranks, integration: {wca_show_rank: true}};
		const unset = {...ranks, integration: {}};
		expect(maskHiddenWcaRanks([on, unset])).toEqual([on, unset]);
	});
});

describe('new WCA events on a refresh', () => {
	it('start published only for a user who already shows WCA records', () => {
		expect(newRecordStartsPublished(0)).toBe(false);
		expect(newRecordStartsPublished(1)).toBe(true);
		expect(newRecordStartsPublished(5)).toBe(true);
	});

	function mockDb(publishedCount: number) {
		const db = {
			integration: {update: jest.fn().mockResolvedValue({})},
			wcaRecord: {
				count: jest.fn().mockResolvedValue(publishedCount),
				// 333 already exists, 444 is the new event.
				findUnique: jest.fn(({where}) =>
					Promise.resolve(where.user_id_wca_event.wca_event === '333' ? {id: 'rec-333'} : null)
				),
				update: jest.fn(({data}) => Promise.resolve({id: 'rec-333', ...data})),
				create: jest.fn(({data}) => Promise.resolve({id: 'rec-new', ...data})),
			},
		};
		mockedGetPrisma.mockReturnValue(db as any);
		return db;
	}

	const person = {
		wca_id: '2019TEST01',
		name: 'Test',
		country_iso2: 'TR',
		competition_count: 12,
		medals: {gold: 1, silver: 0, bronze: 2, total: 3},
		records: {national: 1, continental: 0, world: 0, total: 1},
		personal_records: {
			'333': {single: {best: 950, world_rank: 9000, continent_rank: 3000, country_rank: 40}},
			'444': {single: {best: 4100, world_rank: 20000, continent_rank: 6000, country_rank: 90}},
		},
	} as unknown as WcaPerson;

	it('publishes the new event for a user with published records and stamps the refresh time', async () => {
		const db = mockDb(2);
		await saveWcaPersonRecords('user-1', 'int-1', person);

		expect(db.wcaRecord.create).toHaveBeenCalledTimes(1);
		expect(db.wcaRecord.create.mock.calls[0][0].data).toMatchObject({wca_event: '444', published: true});
		// An existing row keeps whatever the user chose: update never touches published.
		expect(db.wcaRecord.update.mock.calls[0][0].data).not.toHaveProperty('published');

		const integrationData = db.integration.update.mock.calls[0][0].data;
		expect(integrationData.wca_competition_count).toBe(12);
		expect(integrationData.wca_records_synced_at).toBeInstanceOf(Date);
	});

	it('keeps the new event hidden for a user who publishes none', async () => {
		const db = mockDb(0);
		await saveWcaPersonRecords('user-1', 'int-1', person);
		expect(db.wcaRecord.create.mock.calls[0][0].data).toMatchObject({wca_event: '444', published: false});
	});
});
