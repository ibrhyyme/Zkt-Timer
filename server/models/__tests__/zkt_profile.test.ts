jest.mock('../../database', () => ({getPrisma: jest.fn()}));
jest.mock('../../services/ZktFederationService', () => ({ZktFederationService: {}}));

import {bestZktRank, buildZktProfile, FederationPersonSummary, ZktIntegrationRow} from '../zkt_profile';
import {publicIntegrationSelect} from '../integration';

const row: ZktIntegrationRow = {
	zkt_id: '2025YILD01',
	zkt_name: 'Local Name',
	zkt_member_no: 7,
};

const summary: FederationPersonSummary = {
	name: 'Federation Name',
	competitionCount: 4,
	medals: {gold: 1, silver: 2, bronze: 0},
	recordCount: 1,
	personalBests: [
		{eventId: '333', single: '9.12', average: '11.40', singleRank: {rank: 14, total: 300}, averageRank: {rank: 9, total: 250}},
		{eventId: '222', single: '3.01', average: null, singleRank: {rank: 3, total: 120}, averageRank: null},
	],
};

describe('ZKT profile: member number stays private', () => {
	it('is never in the public profile', () => {
		expect(buildZktProfile(row, summary, 'public').zkt_member_no).toBeUndefined();
		expect(buildZktProfile(row, null, 'public').zkt_member_no).toBeUndefined();
	});

	it('is in the owner profile', () => {
		expect(buildZktProfile(row, summary, 'owner').zkt_member_no).toBe(7);
	});

	it('is not in the select behind public user.integrations', () => {
		expect(Object.keys(publicIntegrationSelect)).not.toContain('zkt_member_no');
	});
});

describe('ZKT profile: rankings', () => {
	it('maps the federation ranks onto each PB and picks the best one', () => {
		const p = buildZktProfile(row, summary, 'public');
		expect(p.zkt_personal_bests?.[0]).toEqual({
			event_id: '333',
			single: '9.12',
			average: '11.40',
			single_rank: {rank: 14, total: 300},
			average_rank: {rank: 9, total: 250},
		});
		expect(p.zkt_personal_bests?.[1].average_rank).toBeUndefined();
		expect(p.zkt_best_rank).toBe(3);
		expect(p.zkt_best_rank_event).toBe('222');
	});

	it('blanks every rank for other viewers when the switch is off', () => {
		const p = buildZktProfile({...row, zkt_show_rank: false}, summary, 'public');
		expect(p.zkt_show_rank).toBe(false);
		expect(p.zkt_best_rank).toBeUndefined();
		for (const pb of p.zkt_personal_bests || []) {
			expect(pb.single_rank).toBeUndefined();
			expect(pb.average_rank).toBeUndefined();
		}
		// The times themselves stay: only the ranking was switched off.
		expect(p.zkt_personal_bests?.[0].single).toBe('9.12');
	});

	it('still shows the owner what the hidden ranks hold', () => {
		const p = buildZktProfile({...row, zkt_show_rank: false}, summary, 'owner');
		expect(p.zkt_best_rank).toBe(3);
		expect(p.zkt_personal_bests?.[0].single_rank).toEqual({rank: 14, total: 300});
	});

	it('keeps the best rank when only the PB list is hidden, like the WCA best world rank', () => {
		const p = buildZktProfile({...row, zkt_show_pbs: false}, summary, 'public');
		expect(p.zkt_personal_bests).toBeUndefined();
		expect(p.zkt_best_rank).toBe(3);
	});

	it('bestZktRank keeps the first event on a tie and ignores missing ranks', () => {
		expect(
			bestZktRank([
				{eventId: '444', singleRank: {rank: 5, total: 50}},
				{eventId: '555', averageRank: {rank: 5, total: 40}},
				{eventId: 'pyram', singleRank: null},
			])
		).toEqual({rank: 5, eventId: '444'});
		expect(bestZktRank([])).toBeNull();
		expect(bestZktRank(undefined)).toBeNull();
	});
});

describe('ZKT profile: sections', () => {
	it('blanks switched-off sections for other viewers only', () => {
		const hidden = {...row, zkt_show_competitions: false, zkt_show_medals: false, zkt_show_records: false};
		const pub = buildZktProfile(hidden, summary, 'public');
		expect(pub.zkt_competition_count).toBeUndefined();
		expect(pub.zkt_medal_gold).toBeUndefined();
		expect(pub.zkt_record_count).toBeUndefined();

		const own = buildZktProfile(hidden, summary, 'owner');
		expect(own.zkt_competition_count).toBe(4);
		expect(own.zkt_medal_silver).toBe(2);
		expect(own.zkt_record_count).toBe(1);
	});

	it('reports no numbers, not zeros, when the federation could not answer', () => {
		const p = buildZktProfile(row, null, 'public');
		expect(p.zkt_id).toBe('2025YILD01');
		expect(p.zkt_competition_count).toBeUndefined();
		expect(p.zkt_medal_gold).toBeUndefined();
		expect(p.zkt_personal_bests).toBeUndefined();
	});

	it('defaults every switch, history included, to on', () => {
		const p = buildZktProfile(row, summary, 'public');
		expect(p.zkt_show_results).toBe(true);
		expect(p.zkt_show_rank).toBe(true);
		expect(p.zkt_name).toBe('Federation Name');
	});
});
