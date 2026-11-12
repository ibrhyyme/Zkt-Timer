import 'reflect-metadata';

// ZktJudge.resolver + ZktJudgeRelay: the member the site is told about always
// comes from the session's own ZKT link, the site's refusals reach the client
// by code, and nothing but a JSON answer from the site counts as an answer.

jest.mock('../../services/logger', () => ({logger: {warn: jest.fn(), info: jest.fn(), error: jest.fn(), debug: jest.fn()}}));

const getIntegration = jest.fn();
jest.mock('../../models/integration', () => ({getIntegration: (...args: any[]) => getIntegration(...args)}));

const request = jest.fn();
jest.mock('axios', () => ({
	__esModule: true,
	default: {
		request: (...args: any[]) => request(...args),
		isAxiosError: (e: any) => !!e?.isAxiosError,
	},
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const {ZktJudgeResolver} = require('../ZktJudge.resolver');

const SECRET = 'j'.repeat(64);
const ctx: any = {user: {id: 'timer-user-1'}};
const resolver = new ZktJudgeResolver();

function axiosError(status: number, data: any, headers: Record<string, string> = {}) {
	return {isAxiosError: true, response: {status, data, headers}};
}

beforeEach(() => {
	process.env.ZKT_JUDGE_API_SECRET = SECRET;
	delete process.env.ZKT_FEDERATION_API;
	getIntegration.mockReset().mockResolvedValue({zkt_user_id: 'site-user-9'});
	request.mockReset().mockResolvedValue({status: 200, data: {enabled: true, cards: []}});
});

describe('identity', () => {
	it('acts as the linked ZKT account, with the judge secret and a trailing slash', async () => {
		const me = await resolver.zktJudgeMe(ctx, 'zkt-bursa-2026', 'jti-1');
		expect(me).toEqual({enabled: true, cards: [], linked: true});
		expect(getIntegration).toHaveBeenCalledWith(ctx.user, 'zkt');
		const call = request.mock.calls[0][0];
		expect(call.url).toBe('http://localhost:4000/api/internal/v1/judge/me/');
		expect(call.method).toBe('GET');
		expect(call.params).toEqual({competition: 'bursa-2026', jti: 'jti-1'});
		expect(call.headers.Authorization).toBe(`Bearer ${SECRET}`);
		expect(call.headers['x-zkt-member']).toBe('site-user-9');
		expect(call.maxRedirects).toBe(0);
	});

	it('answers "not linked" without asking the site', async () => {
		getIntegration.mockResolvedValue(null);
		expect(await resolver.zktJudgeMe(ctx, 'zkt-bursa-2026')).toEqual({linked: false, enabled: false});
		await expect(resolver.zktJudgeBoard(ctx, 'zkt-bursa-2026')).rejects.toMatchObject({extensions: {code: 'ZKT_NOT_LINKED'}});
		await expect(
			resolver.zktJudgeSubmitEntries(ctx, [{submissionId: 'sub-00001', cardId: 'c1', attemptNo: 1, value: 1234}])
		).rejects.toMatchObject({extensions: {code: 'ZKT_NOT_LINKED'}});
		expect(request).not.toHaveBeenCalled();
	});

	it('does not relay for a WCA competition', async () => {
		expect(await resolver.zktJudgeMe(ctx, 'BursaOpen2026')).toEqual({linked: false, enabled: false});
		await expect(resolver.zktJudgeBoard(ctx, 'BursaOpen2026')).rejects.toMatchObject({extensions: {code: 'BAD_INPUT'}});
		expect(request).not.toHaveBeenCalled();
	});

	it('follows ZKT_FEDERATION_API to the same host', async () => {
		process.env.ZKT_FEDERATION_API = 'http://federation:4000/api/public/v1/';
		await resolver.zktJudgeBoard(ctx, 'zkt-bursa-2026', 'round-1');
		expect(request.mock.calls[0][0].url).toBe('http://federation:4000/api/internal/v1/judge/board/');
		expect(request.mock.calls[0][0].params).toEqual({competition: 'bursa-2026', round: 'round-1'});
	});
});

describe('requests', () => {
	it('builds a JUDGE request body', async () => {
		request.mockResolvedValue({status: 200, data: {jti: 'x'}});
		await resolver.zktJudgeRequest(ctx, {
			competitionId: 'zkt-bursa-2026',
			groupId: 'g1',
			competitorKey: '0123456789abcdef',
			stationNumber: 4,
			judgeKind: 'external',
			judgeName: 'Mustafa Çamlıca',
		});
		const call = request.mock.calls[0][0];
		expect(call.url).toMatch(/\/requests\/$/);
		expect(call.data).toEqual({
			purpose: 'JUDGE',
			competition: 'bursa-2026',
			groupId: 'g1',
			competitorKey: '0123456789abcdef',
			stationNumber: 4,
			judge: {kind: 'external', name: 'Mustafa Çamlıca'},
		});
	});

	it('a correction names its card, not a competition', async () => {
		request.mockResolvedValue({status: 200, data: {jti: 'x'}});
		await resolver.zktJudgeRequest(ctx, {purpose: 'CORRECT', cardId: 'card-1', attemptNo: 3});
		expect(request.mock.calls[0][0].data).toEqual({purpose: 'CORRECT', cardId: 'card-1', attemptNo: 3});
	});

	it('self grant is always a JUDGE request', async () => {
		request.mockResolvedValue({status: 200, data: {status: 'approved'}});
		await resolver.zktJudgeSelfGrant(ctx, {competitionId: 'zkt-bursa-2026', purpose: 'EXTRA', groupId: 'g1', competitorKey: 'k'});
		expect(request.mock.calls[0][0].url).toMatch(/\/grants\/self\/$/);
		expect(request.mock.calls[0][0].data.purpose).toBe('JUDGE');
	});

	it('ends one grant, one card or all, and nothing unnamed', async () => {
		request.mockResolvedValue({status: 200, data: {ended: 1}});
		await resolver.zktJudgeEndGrant(ctx, 'zkt-bursa-2026', 'grant-1');
		expect(request.mock.calls[0][0].data).toEqual({competition: 'bursa-2026', grantId: 'grant-1'});
		await resolver.zktJudgeEndGrant(ctx, 'zkt-bursa-2026', undefined, undefined, true);
		expect(request.mock.calls[1][0].data).toEqual({competition: 'bursa-2026', all: true});
		await expect(resolver.zktJudgeEndGrant(ctx, 'zkt-bursa-2026')).rejects.toMatchObject({extensions: {code: 'BAD_INPUT'}});
	});
});

describe('entries', () => {
	it('passes entries through and returns the site’s per-entry answers', async () => {
		const results = [{submissionId: 'sub-00001', status: 200, outcome: 'APPLIED'}];
		request.mockResolvedValue({status: 200, data: {results}});
		const out = await resolver.zktJudgeSubmitEntries(ctx, [
			{submissionId: 'sub-00001', cardId: 'c1', attemptNo: 1, value: 1424, rawValue: 1224, penalty: 200, deviceSeq: 7},
			{submissionId: 'sub-00002', cardId: 'c1', kind: 'NO_SHOW'},
		]);
		expect(out).toEqual({results});
		expect(request.mock.calls[0][0].data).toEqual({
			items: [
				{submissionId: 'sub-00001', cardId: 'c1', kind: 'ATTEMPT', attemptNo: 1, value: 1424, rawValue: 1224, penalty: 200, deviceSeq: 7},
				{submissionId: 'sub-00002', cardId: 'c1', kind: 'NO_SHOW'},
			],
		});
	});

	it('refuses an empty or oversized batch before calling the site', async () => {
		await expect(resolver.zktJudgeSubmitEntries(ctx, [])).rejects.toMatchObject({extensions: {code: 'BAD_INPUT'}});
		const many = Array.from({length: 51}, (_, i) => ({submissionId: `sub-${i}`, cardId: 'c1', attemptNo: 1, value: 1}));
		await expect(resolver.zktJudgeSubmitEntries(ctx, many)).rejects.toMatchObject({extensions: {code: 'BAD_INPUT'}});
		expect(request).not.toHaveBeenCalled();
	});
});

describe('failures', () => {
	it('passes the site’s refusal code on', async () => {
		request.mockRejectedValue(axiosError(409, {error: 'SELF_CARD', message: 'Kendi skor kartına hakemlik yapılamaz.'}));
		await expect(
			resolver.zktJudgeRequest(ctx, {competitionId: 'zkt-bursa-2026', groupId: 'g1', competitorKey: 'k'})
		).rejects.toMatchObject({message: 'Kendi skor kartına hakemlik yapılamaz.', extensions: {code: 'SELF_CARD'}});
	});

	it('maps 429 to RATE_LIMITED with the wait', async () => {
		request.mockRejectedValue(axiosError(429, {error: 'rate_limited'}, {'retry-after': '12'}));
		await expect(resolver.zktJudgeMe(ctx, 'zkt-bursa-2026')).rejects.toMatchObject({
			extensions: {code: 'RATE_LIMITED', retryAfterS: 12},
		});
	});

	it('hides a wrong secret, a 5xx and a dead site behind JUDGE_UNAVAILABLE', async () => {
		for (const error of [
			axiosError(401, {error: 'unauthorized'}),
			axiosError(503, {error: 'not_configured'}),
			axiosError(500, {error: 'internal_error'}),
			{isAxiosError: true, code: 'ECONNREFUSED', message: 'connect ECONNREFUSED'},
		]) {
			request.mockRejectedValue(error);
			await expect(resolver.zktJudgeMe(ctx, 'zkt-bursa-2026')).rejects.toMatchObject({extensions: {code: 'JUDGE_UNAVAILABLE'}});
		}
	});

	it('does not take an HTML 200 for an answer', async () => {
		request.mockResolvedValue({status: 200, data: '<html>Sign in to Wi-Fi</html>'});
		await expect(
			resolver.zktJudgeSubmitEntries(ctx, [{submissionId: 'sub-00001', cardId: 'c1', attemptNo: 1, value: 1234}])
		).rejects.toMatchObject({extensions: {code: 'JUDGE_UNAVAILABLE'}});
	});

	it('is unavailable, not crashing, without the secret', async () => {
		delete process.env.ZKT_JUDGE_API_SECRET;
		await expect(resolver.zktJudgeMe(ctx, 'zkt-bursa-2026')).rejects.toMatchObject({extensions: {code: 'JUDGE_UNAVAILABLE'}});
		expect(request).not.toHaveBeenCalled();
	});
});
