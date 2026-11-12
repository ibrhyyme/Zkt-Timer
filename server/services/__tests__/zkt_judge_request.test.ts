// Online score entry (ZKT): a judge asking for a correction or an extra makes
// one notice for the staff who can approve it (the site names them). The phone
// never sees the recipient list, and the QR refreshing every two minutes does
// not send the same notice again.

jest.mock('../logger', () => ({logger: {warn: jest.fn(), info: jest.fn(), error: jest.fn(), debug: jest.fn()}}));
// Redis as SET ... EX ... NX behaves: the first set wins until the key expires.
const redisKeys = new Set<string>();
let redisDown = false;
jest.mock('../redis', () => ({
	RedisNamespace: {ZKT_JUDGE_REQUEST: 'cd:zktjudge:request'},
	createRedisKey: (ns: string, hash: string) => ({key: `${ns}#${hash}`}),
	getRedisPubClient: () => ({
		set: jest.fn(async (key: string) => {
			if (redisDown) throw new Error('ECONNREFUSED');
			if (redisKeys.has(key)) return null;
			redisKeys.add(key);
			return 'OK';
		}),
	}),
}));
const sendPushToUser = jest.fn().mockResolvedValue(undefined);
jest.mock('../push', () => ({sendPushToUser: (...a: any[]) => sendPushToUser(...a)}));
const optedOut = new Set<string>();
jest.mock('../../models/notification_preference', () => ({
	getUserIdsWithPrefDisabled: jest.fn(async (ids: string[], key: string) => {
		expect(key).toBe('zkt_judge_request');
		return new Set(ids.filter((id) => optedOut.has(id)));
	}),
}));

const staff = {
	u_org: {id: 'u_org', username: 'org', settings: {locale: 'tr'}},
	u_del: {id: 'u_del', username: 'del', settings: {locale: 'en'}},
};
const links: Record<string, any> = {zkt_org: staff.u_org, zkt_del: staff.u_del};
const inbox: any[] = [];
const prisma = {
	integration: {
		findMany: jest.fn(async ({where}: any) => where.zkt_user_id.in.filter((id: string) => links[id]).map((id: string) => ({user: links[id]}))),
	},
	notification: {create: jest.fn(async ({data}: any) => inbox.push(data))},
};
jest.mock('../../database', () => ({getPrisma: () => prisma}));

import {notifyJudgeRequest, readJudgeRequestNotify, splitJudgeRequestAnswer, type JudgeRequestNotify} from '../zkt_judge_request';

function notice(over: Partial<JudgeRequestNotify> = {}): JudgeRequestNotify {
	return {
		competition: {id: 'comp-1', slug: 'BursaSonbahar2026', name: 'ZKT Bursa Sonbahar 2026'},
		recipients: ['zkt_org', 'zkt_del', 'zkt_nobody'],
		eventId: '444',
		roundNumber: 1,
		dualChance: false,
		chance: 1,
		groupNumber: 2,
		stationNumber: 5,
		attemptNo: 2,
		...over,
	};
}
const bodies = () => sendPushToUser.mock.calls.map((c) => `${c[0]}:${c[2]}`);

beforeEach(() => {
	redisKeys.clear();
	redisDown = false;
	inbox.length = 0;
	optedOut.clear();
	jest.clearAllMocks();
});

describe('the site answer', () => {
	it('the phone gets everything but the notice block', () => {
		const {response, notify} = splitJudgeRequestAnswer({token: 't', qrSvg: '<svg/>', canSelfAuthorize: false, notify: notice()});
		expect(response).toEqual({token: 't', qrSvg: '<svg/>', canSelfAuthorize: false});
		expect(notify?.recipients).toEqual(['zkt_org', 'zkt_del', 'zkt_nobody']);
	});
	it('an older site without the block, or a malformed one, means no notice', () => {
		expect(splitJudgeRequestAnswer({token: 't'}).notify).toBeNull();
		expect(readJudgeRequestNotify({competition: {id: 'x'}, recipients: []})).toBeNull();
		expect(readJudgeRequestNotify(null)).toBeNull();
	});
});

describe('sending', () => {
	it('an extra: one push per linked staff member, in their language, with the station', async () => {
		expect(await notifyJudgeRequest('EXTRA', 'card-1', notice())).toBe(2);
		expect(bodies()).toEqual([
			'u_org:4x4 1. Tur, Grup 2, İstasyon 5: 2. çözüm için ekstra isteniyor.',
			'u_del:4x4 Round 1, Group 2, Station 5: an extra is requested for attempt 2.',
		]);
		const [, title, , data] = sendPushToUser.mock.calls[0];
		expect(title).toBe('ZKT Bursa Sonbahar 2026');
		expect(data).toEqual({type: 'zkt_judge_request', link: '/competitions/zkt-BursaSonbahar2026/judge/staff', competitionId: 'zkt-BursaSonbahar2026'});
		expect(inbox[0].notification_type).toBe('zkt_judge_request');
		expect(inbox[0].in_app_message).toBe('ZKT Bursa Sonbahar 2026 · 4x4 1. Tur, Grup 2, İstasyon 5: 2. çözüm için ekstra isteniyor.');
	});

	it('a correction says so; a Çift Şans round names the chance', async () => {
		await notifyJudgeRequest('CORRECT', 'card-1', notice({dualChance: true, chance: 2, attemptNo: 1}));
		expect(bodies()[0]).toBe('u_org:4x4 1. Tur, Grup 2 · Şans 2, İstasyon 5: 1. çözüm için süre düzeltme isteniyor.');
	});

	it('the QR refreshing does not send it again; another attempt or the other kind does', async () => {
		await notifyJudgeRequest('EXTRA', 'card-1', notice());
		expect(await notifyJudgeRequest('EXTRA', 'card-1', notice())).toBe(0);
		expect(await notifyJudgeRequest('EXTRA', 'card-1', notice({attemptNo: 3}))).toBe(2);
		expect(await notifyJudgeRequest('CORRECT', 'card-1', notice())).toBe(2);
		expect(sendPushToUser).toHaveBeenCalledTimes(6);
	});

	it('nobody to tell (the judge approves on their own phone): nothing, and no claim taken', async () => {
		expect(await notifyJudgeRequest('EXTRA', 'card-1', notice({recipients: []}))).toBe(0);
		expect(redisKeys.size).toBe(0);
		expect(sendPushToUser).not.toHaveBeenCalled();
	});

	it('a staff member who switched it off is skipped', async () => {
		optedOut.add('u_del');
		expect(await notifyJudgeRequest('EXTRA', 'card-1', notice())).toBe(1);
		expect(bodies()).toEqual(['u_org:4x4 1. Tur, Grup 2, İstasyon 5: 2. çözüm için ekstra isteniyor.']);
	});

	it('Redis down: the notice still goes; a failing push never throws to the judge', async () => {
		redisDown = true;
		expect(await notifyJudgeRequest('EXTRA', 'card-1', notice())).toBe(2);
		sendPushToUser.mockRejectedValueOnce(new Error('fcm down'));
		await expect(notifyJudgeRequest('EXTRA', 'card-2', notice())).resolves.toBe(1);
	});

	it('no station on the card: the place still reads well', async () => {
		await notifyJudgeRequest('EXTRA', 'card-1', notice({stationNumber: null, groupNumber: null}));
		expect(bodies()[0]).toBe('u_org:4x4 1. Tur: 2. çözüm için ekstra isteniyor.');
	});
});
