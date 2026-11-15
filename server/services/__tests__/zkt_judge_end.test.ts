// Online score entry (ZKT): ending judging on a finished card sends the
// competitor their unofficial result (owner, 2026-11-15). The judge's phone
// never sees the block; a competitor without a linked account gets nothing.

jest.mock('../logger', () => ({logger: {warn: jest.fn(), info: jest.fn(), error: jest.fn(), debug: jest.fn()}}));
const sendPushToUser = jest.fn().mockResolvedValue(undefined);
jest.mock('../push', () => ({sendPushToUser: (...a: any[]) => sendPushToUser(...a)}));

const competitors = {
	u_tr: {id: 'u_tr', username: 'tr', settings: {locale: 'tr'}},
	u_en: {id: 'u_en', username: 'en', settings: {locale: 'en'}},
};
const links: Record<string, any> = {zkt_tr: competitors.u_tr, zkt_en: competitors.u_en};
const inbox: any[] = [];
const prisma = {
	integration: {
		findMany: jest.fn(async ({where}: any) =>
			where.zkt_user_id.in.filter((id: string) => links[id]).map((id: string) => ({zkt_user_id: id, user: links[id]}))
		),
	},
	notification: {create: jest.fn(async ({data}: any) => inbox.push(data))},
};
jest.mock('../../database', () => ({getPrisma: () => prisma}));

import {notifyJudgeEndResults, readJudgeEndNotify, splitJudgeEndAnswer, type JudgeEndNotify, type JudgeEndResult} from '../zkt_judge_end';

const competition = {id: 'comp-1', slug: 'BursaSonbahar2026', name: 'ZKT Bursa Sonbahar 2026'};
const result = (over: Partial<JudgeEndResult> = {}): JudgeEndResult => ({
	cardId: 'card-1',
	competitorUserId: 'zkt_tr',
	eventId: '333',
	best: 1021,
	average: 1234,
	...over,
});
const notice = (...results: JudgeEndResult[]): JudgeEndNotify => ({competition, results});
const pushes = () => sendPushToUser.mock.calls.map((c) => `${c[0]}:${c[1]}:${c[2]}`);

beforeEach(() => {
	inbox.length = 0;
	jest.clearAllMocks();
});

describe('the site answer', () => {
	it('the phone gets everything but the notice block', () => {
		const {response, notify} = splitJudgeEndAnswer({ended: 1, notify: notice(result())});
		expect(response).toEqual({ended: 1});
		expect(notify?.results).toHaveLength(1);
	});
	it('no block (unfinished card, older site) or a malformed one means no notice', () => {
		expect(splitJudgeEndAnswer({ended: 1}).notify).toBeNull();
		expect(readJudgeEndNotify({competition, results: []})).toBeNull();
		expect(readJudgeEndNotify({competition, results: [{cardId: 'c', competitorUserId: 'x', eventId: '333', best: 'fast'}]})).toBeNull();
		expect(readJudgeEndNotify(null)).toBeNull();
	});
});

describe('sending', () => {
	it('capitals title, average then single, in the competitor language; the inbox names the competition', async () => {
		expect(await notifyJudgeEndResults(notice(result(), result({cardId: 'card-2', competitorUserId: 'zkt_en', best: 950, average: 1100})))).toBe(2);
		expect(pushes()).toEqual([
			'u_tr:RESMİ OLMAYAN SONUÇLARA GÖRE:Ortalama: 12.34 · Single: 10.21',
			'u_en:ACCORDING TO UNOFFICIAL RESULTS:Average: 11.00 · Single: 9.50',
		]);
		expect(sendPushToUser.mock.calls[0][3]).toEqual({
			type: 'zkt_unofficial_result',
			link: '/competitions/zkt-BursaSonbahar2026/wca-live',
			competitionId: 'zkt-BursaSonbahar2026',
		});
		expect(inbox[0].notification_type).toBe('zkt_unofficial_result');
		expect(inbox[0].notification_category_name).toBe('ZKT Bursa Sonbahar 2026');
		expect(inbox[0].in_app_message).toBe('RESMİ OLMAYAN SONUÇLARA GÖRE · Ortalama: 12.34 · Single: 10.21');
	});

	it('no average (Bo1, missed cutoff): the single alone; DNF average says DNF; FMC reads moves', async () => {
		await notifyJudgeEndResults(notice(result({average: null, best: 6500})));
		await notifyJudgeEndResults(notice(result({average: -1})));
		await notifyJudgeEndResults(notice(result({eventId: '333fm', best: 28, average: 2967})));
		expect(pushes()).toEqual([
			'u_tr:RESMİ OLMAYAN SONUÇLARA GÖRE:Single: 1:05.00',
			'u_tr:RESMİ OLMAYAN SONUÇLARA GÖRE:Ortalama: DNF · Single: 10.21',
			'u_tr:RESMİ OLMAYAN SONUÇLARA GÖRE:Ortalama: 29.67 · Single: 28',
		]);
	});

	it('a competitor without a linked account gets nothing; a failing push never throws to the judge', async () => {
		expect(await notifyJudgeEndResults(notice(result({competitorUserId: 'zkt_nobody'})))).toBe(0);
		sendPushToUser.mockRejectedValueOnce(new Error('fcm down'));
		await expect(notifyJudgeEndResults(notice(result()))).resolves.toBe(0);
	});
});
