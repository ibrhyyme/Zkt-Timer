// Online score entry (ZKT), plan K10: a group's 3rd and 4th attempts make one
// notice each for the competition's delegates and organisers, never more, never
// twice. The level itself is the federation's (K4, tested on the site); this
// file pins the thresholds, the once-only claim and the sending.

import {Prisma} from '@prisma/client';

const axiosGet = jest.fn();
jest.mock('axios', () => ({__esModule: true, default: {get: (...a: any[]) => axiosGet(...a)}}));
jest.mock('../logger', () => ({logger: {warn: jest.fn(), info: jest.fn(), error: jest.fn(), debug: jest.fn()}}));
jest.mock('../redis', () => ({
	RedisNamespace: {ZKT_JUDGE_PROGRESS: 'cd:zktjudge:progress'},
	createRedisKey: (ns: string, hash: string) => ({key: `${ns}#${hash}`}),
	acquireRedisLock: jest.fn().mockResolvedValue(null),
}));
const sendPushToUser = jest.fn().mockResolvedValue(undefined);
jest.mock('../push', () => ({sendPushToUser: (...a: any[]) => sendPushToUser(...a)}));
const optedOut = new Set<string>();
jest.mock('../../models/notification_preference', () => ({
	getUserIdsWithPrefDisabled: jest.fn(async (ids: string[]) => new Set(ids.filter((id) => optedOut.has(id)))),
}));

// The claim table as Postgres keeps it: the unique key refuses a second row.
interface NoticeRow {
	competition_id: string;
	round_id: string;
	group_key: string;
	since: string;
	threshold: number;
	level: number;
	sent: boolean;
}
let notices: NoticeRow[] = [];
const keyOf = (r: Pick<NoticeRow, 'round_id' | 'group_key' | 'since' | 'threshold'>) => `${r.round_id}|${r.group_key}|${r.since}|${r.threshold}`;
const uniqueViolation = () => new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {code: 'P2002', clientVersion: 'test'});
const matches = (r: NoticeRow, where: Partial<NoticeRow>) => Object.entries(where).every(([k, v]) => (r as any)[k] === v);

const staff = {
	u_org: {id: 'u_org', username: 'org', settings: {locale: 'tr'}},
	u_del: {id: 'u_del', username: 'del', settings: {locale: 'en'}},
	u_bare: {id: 'u_bare', username: 'bare', settings: null},
};
// Federation User.id -> this app's account, through Integration.zkt_user_id.
const links: Record<string, any> = {zkt_org: staff.u_org, zkt_del: staff.u_del, zkt_bare: staff.u_bare};
const inbox: any[] = [];

const prisma = {
	zktJudgeProgressNotice: {
		findMany: jest.fn(async ({where}: any) => notices.filter((r) => matches(r, where)).map((r) => ({threshold: r.threshold}))),
		create: jest.fn(async ({data}: any) => {
			if (notices.some((r) => keyOf(r) === keyOf(data))) throw uniqueViolation();
			notices.push(data);
			return data;
		}),
		createMany: jest.fn(async ({data}: any) => {
			let count = 0;
			for (const row of data) {
				if (notices.some((r) => keyOf(r) === keyOf(row))) continue;
				notices.push(row);
				count++;
			}
			return {count};
		}),
		deleteMany: jest.fn(async () => ({count: 0})),
	},
	integration: {
		findMany: jest.fn(async ({where}: any) => where.zkt_user_id.in.filter((id: string) => links[id]).map((id: string) => ({user: links[id]}))),
	},
	notification: {create: jest.fn(async ({data}: any) => inbox.push(data))},
};
jest.mock('../../database', () => ({getPrisma: () => prisma}));

import {decideProgress, noticeLevel, progressThresholds, type JudgeProgressFeed, type JudgeProgressGroup} from '../zkt_judge_progress';
import {processJudgeProgress, runZktJudgeProgressTick} from '../cron_zkt_judge_progress';

function group(over: Partial<JudgeProgressGroup> = {}): JudgeProgressGroup {
	return {
		roundId: 'r333',
		eventId: '333',
		roundNumber: 1,
		dualChance: false,
		groupKey: 'g1',
		groupNumber: 2,
		chance: 1,
		since: '2026-11-14T07:00:00.000Z',
		attemptCount: 5,
		level: 0,
		furthest: 0,
		...over,
	};
}
function feed(...groups: JudgeProgressGroup[]): JudgeProgressFeed {
	return {
		competitions: [{id: 'comp-1', slug: 'BursaSonbahar2026', name: 'ZKT Bursa Sonbahar 2026', recipients: ['zkt_org', 'zkt_del'], groups}],
	};
}
/** Run the feed and say which attempts were notified, as "<groupKey>:<attempt>" per push. */
async function run(f: JudgeProgressFeed): Promise<string[]> {
	const before = sendPushToUser.mock.calls.length;
	await processJudgeProgress(f);
	return sendPushToUser.mock.calls.slice(before).map((c) => `${c[0]}:${c[3].link}:${c[2]}`);
}
const pushes = () => sendPushToUser.mock.calls.length;

beforeEach(() => {
	notices = [];
	inbox.length = 0;
	optedOut.clear();
	jest.clearAllMocks();
});

describe('thresholds (K10, and the owner rule for other formats)', () => {
	it('Ao5: the 3rd and the 4th attempt, as K10 says', () => {
		expect(progressThresholds(5)).toEqual([3, 4]);
	});
	it('the same place in the round for other formats: Ao12 8 and 10, Mo3 2 and 3, Bo2 2, Bo1 1', () => {
		expect(progressThresholds(12)).toEqual([8, 10]);
		expect(progressThresholds(3)).toEqual([2, 3]);
		expect(progressThresholds(2)).toEqual([2]);
		expect(progressThresholds(1)).toEqual([1]);
		expect(progressThresholds(0)).toEqual([]);
	});
	it('nobody having solved does not count as a level', () => {
		expect(noticeLevel({level: 5, furthest: 0})).toBe(0);
		expect(noticeLevel({level: 3, furthest: 4})).toBe(3);
	});
	it('a jump past both thresholds sends the higher one and marks the lower done', () => {
		expect(decideProgress([3, 4], 5, new Set())).toEqual({send: 4, quiet: [3]});
		expect(decideProgress([3, 4], 3, new Set())).toEqual({send: 3, quiet: []});
		expect(decideProgress([3, 4], 4, new Set([3]))).toEqual({send: 4, quiet: []});
		expect(decideProgress([3, 4], 2, new Set())).toEqual({send: null, quiet: []});
		// A missing lower claim after a higher one never sends backwards.
		expect(decideProgress([3, 4], 4, new Set([4]))).toEqual({send: null, quiet: []});
	});
});

describe('sending', () => {
	it('nothing below the 3rd attempts, one notice at 3, one at 4, nothing after', async () => {
		expect(await run(feed(group({level: 2, furthest: 3})))).toEqual([]);

		const at3 = await run(feed(group({level: 3, furthest: 4})));
		expect(at3).toEqual([
			'u_org:/competitions/zkt-BursaSonbahar2026/judge/staff:3x3 1. Tur, Grup 2: 3. çözümler bitti.',
			'u_del:/competitions/zkt-BursaSonbahar2026/judge/staff:3x3 Round 1, Group 2: everyone has finished attempt 3.',
		]);
		// Same level again, and a later tick: nothing.
		expect(await run(feed(group({level: 3, furthest: 4})))).toEqual([]);

		const at4 = await run(feed(group({level: 4, furthest: 5})));
		expect(at4.map((p) => p.split(':')[0])).toEqual(['u_org', 'u_del']);
		expect(at4[0]).toContain('4. çözümler bitti.');
		// The group finishes: still nothing (at most two per group).
		expect(await run(feed(group({level: 5, furthest: 5})))).toEqual([]);
		expect(pushes()).toBe(4);
	});

	it('the push title is the competition and a tap opens the organisers panel; the inbox row stands alone', async () => {
		await run(feed(group({level: 3, furthest: 3})));
		const [userId, title, , data] = sendPushToUser.mock.calls[0];
		expect(userId).toBe('u_org');
		expect(title).toBe('ZKT Bursa Sonbahar 2026');
		expect(data).toEqual({type: 'zkt_judge_group_progress', link: '/competitions/zkt-BursaSonbahar2026/judge/staff', competitionId: 'zkt-BursaSonbahar2026'});
		expect(inbox[0].in_app_message).toBe('ZKT Bursa Sonbahar 2026 · 3x3 1. Tur, Grup 2: 3. çözümler bitti.');
		expect(inbox[0].notification_category_name).toBe('Skor girişi');
		expect(inbox[0].notification_type).toBe('zkt_judge_group_progress');
	});

	it('a card opened later takes the reported level back to 0: no new notice, and 4 still goes once', async () => {
		await run(feed(group({level: 3, furthest: 3})));
		expect(await run(feed(group({level: 0, furthest: 3})))).toEqual([]);
		expect(await run(feed(group({level: 3, furthest: 4})))).toEqual([]);
		expect((await run(feed(group({level: 4, furthest: 4})))).length).toBe(2);
		expect(pushes()).toBe(4);
	});

	it('a jump from 2 to 5 sends one notice (the 4th), not two', async () => {
		const sent = await run(feed(group({level: 5, furthest: 5})));
		expect(sent.length).toBe(2); // one per recipient
		expect(sent[0]).toContain('4. çözümler bitti.');
		expect(notices.map((n) => [n.threshold, n.sent]).sort()).toEqual([
			[3, false],
			[4, true],
		]);
		expect(await run(feed(group({level: 5, furthest: 5})))).toEqual([]);
	});

	it('a restart (a fresh module, the same database) sends nothing again', async () => {
		await run(feed(group({level: 3, furthest: 3})));
		let fresh: typeof processJudgeProgress | undefined;
		jest.isolateModules(() => {
			fresh = require('../cron_zkt_judge_progress').processJudgeProgress;
		});
		await fresh!(feed(group({level: 3, furthest: 3})));
		expect(pushes()).toBe(2);
	});

	it('two servers on the same tick: the one whose claim loses sends nothing', async () => {
		const f = feed(group({level: 3, furthest: 3}));
		await Promise.all([processJudgeProgress(f), processJudgeProgress(f)]);
		expect(pushes()).toBe(2);
		expect(notices.length).toBe(1);
	});

	it('a cleared rehearsal (new `since`) notifies again on the real day', async () => {
		await run(feed(group({level: 3, furthest: 3})));
		expect((await run(feed(group({level: 3, furthest: 3, since: '2026-11-15T07:30:00.000Z'})))).length).toBe(2);
	});

	it('groups are independent, and only linked accounts that did not switch it off get it', async () => {
		optedOut.add('u_del');
		const f = feed(group({level: 3, furthest: 3}), group({groupKey: 'g2', groupNumber: 3, level: 1, furthest: 2}));
		f.competitions[0].recipients.push('zkt_bare', 'zkt_unlinked');
		const sent = await run(f);
		expect(sent.map((s) => s.split(':')[0])).toEqual(['u_org', 'u_bare']);
		// No locale on the account: Turkish (ZKT staff), not English.
		expect(sent[1]).toContain('3. çözümler bitti.');
	});

	it('an absentee-only group (full level, nobody solved) sends nothing', async () => {
		expect(await run(feed(group({level: 5, furthest: 0})))).toEqual([]);
		expect(notices.length).toBe(0);
	});

	it('Çift Şans names the chance; a group-less card names the round only', async () => {
		const sent = await run(
			feed(group({dualChance: true, chance: 2, groupNumber: 1, level: 3, furthest: 3}), group({groupKey: '', groupNumber: null, roundId: 'r444', eventId: '444', level: 3, furthest: 3}))
		);
		expect(sent[0]).toContain('3x3 1. Tur, Grup 1 · Şans 2: 3. çözümler bitti.');
		expect(sent[2]).toContain('4x4 1. Tur: 3. çözümler bitti.');
	});

	it('Mo3 notifies at 2 and 3; Ao12 at 8 and 10', async () => {
		expect((await run(feed(group({attemptCount: 3, level: 2, furthest: 2})))).length).toBe(2);
		expect((await run(feed(group({attemptCount: 3, level: 3, furthest: 3})))).length).toBe(2);
		expect(await run(feed(group({roundId: 'a12', attemptCount: 12, level: 7, furthest: 9})))).toEqual([]);
		expect((await run(feed(group({roundId: 'a12', attemptCount: 12, level: 8, furthest: 9})))).length).toBe(2);
		expect(await run(feed(group({roundId: 'a12', attemptCount: 12, level: 9, furthest: 10})))).toEqual([]);
		expect((await run(feed(group({roundId: 'a12', attemptCount: 12, level: 10, furthest: 10})))).length).toBe(2);
	});
});

describe('the poll', () => {
	const saved = {secret: process.env.ZKT_JUDGE_API_SECRET, api: process.env.ZKT_FEDERATION_API};
	afterEach(() => {
		process.env.ZKT_JUDGE_API_SECRET = saved.secret;
		process.env.ZKT_FEDERATION_API = saved.api;
	});

	it('asks the site with the judge secret, trailing slash, and sends what it reports', async () => {
		process.env.ZKT_JUDGE_API_SECRET = 'judge-secret';
		process.env.ZKT_FEDERATION_API = 'https://fed.example/api/public/v1';
		axiosGet.mockResolvedValue({data: feed(group({level: 3, furthest: 3}))});
		await runZktJudgeProgressTick();
		expect(axiosGet).toHaveBeenCalledTimes(1);
		const [url, config] = axiosGet.mock.calls[0];
		expect(url).toBe('https://fed.example/api/internal/v1/judge/progress/');
		expect(config.headers.Authorization).toBe('Bearer judge-secret');
		expect(config.maxRedirects).toBe(0);
		expect(pushes()).toBe(2);
	});

	it('without the secret it never calls; an HTML answer or a 404 sends nothing', async () => {
		delete process.env.ZKT_JUDGE_API_SECRET;
		await runZktJudgeProgressTick();
		expect(axiosGet).not.toHaveBeenCalled();

		process.env.ZKT_JUDGE_API_SECRET = 'judge-secret';
		axiosGet.mockResolvedValueOnce({data: '<html>proxy</html>'});
		await runZktJudgeProgressTick();
		axiosGet.mockRejectedValueOnce({response: {status: 404}});
		await runZktJudgeProgressTick();
		expect(pushes()).toBe(0);
	});
});
