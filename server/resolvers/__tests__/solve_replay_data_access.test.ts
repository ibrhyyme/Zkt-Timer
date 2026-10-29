import 'reflect-metadata';

// solveReplayData hands out a solve's raw gyro stream. The owner gets it with their verdict;
// anyone else only with the solve's share code (a shared link's viewer), never by id alone,
// and never the verdict. With Pro on it takes the viewer's Pro or the owner's: a Pro member's
// shared solve plays for anyone, a Basic or lapsed owner's for nobody without Pro of their own.

jest.mock('../../models/solve', () => ({
	createSolve: jest.fn(),
	bulkCreateSolves: jest.fn(),
	updateSolve: jest.fn(),
}));
jest.mock('../../models/solve_method_step', () => ({
	createSolveMethodSteps: jest.fn(),
	replaceSolveMethodSteps: jest.fn(),
}));
jest.mock('../../models/user_account', () => ({updateUserAccountWithParams: jest.fn()}));
jest.mock('../../services/logger', () => ({logger: {warn: jest.fn(), info: jest.fn(), error: jest.fn()}}));
const checkRateLimit = jest.fn(async (..._args: any[]) => ({allowed: true, count: 1, ttl: 60}));
jest.mock('../../services/rate_limit', () => ({checkRateLimit: (...args: any[]) => checkRateLimit(...args)}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const {SolveResolver} = require('../Solve.resolver');

const PRO = {is_pro: true, is_premium: false, pro_expires_at: null, premium_expires_at: null};
const BASIC = {is_pro: false, is_premium: false, pro_expires_at: null, premium_expires_at: null};
// Granting Premium clears is_pro (Admin.resolver.ts setPremium).
const PREMIUM = {is_pro: false, is_premium: true, pro_expires_at: null, premium_expires_at: null};
// Run out, not yet swept by the expiry cron.
const LAPSED = {is_pro: true, is_premium: false, pro_expires_at: new Date(Date.now() - 60_000), premium_expires_at: null};

const CODE = 'ABCDEFGH';
const STREAM = 'g1;0;AAAA';

function row(owner: any = PRO, extra: any = {}) {
	return {user_id: 'owner', share_code: CODE, smart_gyro: STREAM, reconstruction_vote: -1, user: owner, ...extra};
}

function makeContext(user: any, found: any = row()) {
	const findUnique = jest.fn(async (_args: any) => found);
	const req = {headers: {'cf-connecting-ip': '203.0.113.9'}};
	return {user, req, prisma: {solve: {findUnique}}} as any;
}

const read = (user: any, found: any, shareCode?: string | null) =>
	new SolveResolver().solveReplayData(makeContext(user, found), 's-1', shareCode);

const SHARED = {smart_gyro: STREAM, reconstruction_vote: null, is_owner: false};

describe('solveReplayData access', () => {
	const before = process.env.PRO_ENABLED;
	beforeEach(() => {
		process.env.PRO_ENABLED = 'true';
		checkRateLimit.mockClear();
	});
	afterAll(() => {
		process.env.PRO_ENABLED = before;
	});

	it('gives the owner the stream and their verdict', async () => {
		expect(await read({id: 'owner', ...PRO}, row(PRO), CODE)).toEqual({smart_gyro: STREAM, reconstruction_vote: -1, is_owner: true});
		expect(checkRateLimit).not.toHaveBeenCalled();
	});

	it("plays a Pro member's shared solve for a Basic or signed-out viewer, without the verdict", async () => {
		expect(await read({id: 'viewer', ...BASIC}, row(PRO), CODE)).toEqual(SHARED);
		expect(await read(null, row(PRO), CODE)).toEqual(SHARED);
		expect(await read(null, row(PREMIUM), CODE)).toEqual(SHARED);
		expect(checkRateLimit.mock.calls[0][0]).toBe('solve_replay:ip:203.0.113.9');
	});

	it("plays any shared solve for a Pro viewer, a Basic owner's included", async () => {
		expect(await read({id: 'viewer', ...PRO}, row(BASIC), CODE)).toEqual(SHARED);
	});

	it('unlocks nothing through sharing when neither side has Pro', async () => {
		// A Basic owner opening their own solve, through the link or not.
		expect(await read({id: 'owner', ...BASIC}, row(BASIC), CODE)).toBeNull();
		expect(await read({id: 'viewer', ...BASIC}, row(BASIC), CODE)).toBeNull();
		expect(await read(null, row(BASIC), CODE)).toBeNull();
		// Expiry counts even before the cron clears the flag.
		expect(await read(null, row(LAPSED), CODE)).toBeNull();
		expect(await read({id: 'owner', ...LAPSED}, row(LAPSED), CODE)).toBeNull();
	});

	it('opens nothing to someone else by id alone, or with a wrong code', async () => {
		expect(await read({id: 'viewer', ...PRO}, row(PRO))).toBeNull();
		expect(await read({id: 'viewer', ...PRO}, row(PRO), 'WRONGONE')).toBeNull();
		// A solve without a code is never matched by a missing one.
		expect(await read({id: 'viewer', ...PRO}, row(PRO, {share_code: null}), null)).toBeNull();
	});

	it('serves anyone with the link while Pro is off, signed in or not', async () => {
		process.env.PRO_ENABLED = 'false';
		expect(await read(null, row(BASIC), CODE)).toEqual(SHARED);
	});

	it('keeps quiet over the rate limit instead of failing the page', async () => {
		checkRateLimit.mockResolvedValueOnce({allowed: false, count: 61, ttl: 30});
		expect(await read(null, row(PRO), CODE)).toBeNull();
	});

	it('is null for a solve that does not exist', async () => {
		expect(await read({id: 'owner', ...PRO}, null, CODE)).toBeNull();
	});
});
