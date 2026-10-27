import 'reflect-metadata';

// Both resolvers read the secret at module scope, so it has to exist before they load.
process.env.JWT_SECRET = 'test-secret';

const createUserAccount = jest.fn();
const getUserByEmail = jest.fn();
const getUserByUsername = jest.fn();
const getIntegrationByZktUserId = jest.fn();
const getIntegrationByWcaUserId = jest.fn();
const getIntegrationByWcaId = jest.fn();

jest.mock('../../models/user_account', () => ({
	createUserAccount: (...a: any[]) => createUserAccount(...a),
	getUserByEmail: (...a: any[]) => getUserByEmail(...a),
	getUserByUsername: (...a: any[]) => getUserByUsername(...a),
	getUserById: jest.fn(),
	getUserByIdWithProfile: jest.fn(),
	updateUserAccountWithParams: jest.fn(),
	sanitizeUser: (u: any) => ({...u}),
}));
jest.mock('../../models/integration', () => ({
	createIntegration: jest.fn(async () => ({id: 'int-1'})),
	updateIntegration: jest.fn(async (i: any) => i),
	getIntegration: jest.fn(async () => null),
	getIntegrationByZktId: jest.fn(async () => null),
	getIntegrationByZktUserId: (...a: any[]) => getIntegrationByZktUserId(...a),
	getIntegrationByWcaUserId: (...a: any[]) => getIntegrationByWcaUserId(...a),
	getIntegrationByWcaId: (...a: any[]) => getIntegrationByWcaId(...a),
}));
jest.mock('../../integrations/zkt_oauth', () => ({
	exchangeZktLoginCode: jest.fn(async () => ({accessToken: 'fed-at', refreshToken: 'fed-rt', expiresAt: 123})),
	fetchZktProfile: jest.fn(async () => ({
		sub: 'zkt-sub-1',
		zktId: null,
		memberNo: 7,
		name: 'Doruk Halici',
		firstName: 'Doruk',
		lastName: 'Halici',
		email: 'new.member@example.com',
		emailVerified: true,
		avatarUrl: null,
		countryIso2: 'TR',
		wcaId: null,
	})),
	revokeZktGrant: jest.fn(async () => undefined),
	syncZktProfileToIntegration: jest.fn(async (i: any) => i),
}));
jest.mock('../../integrations/oauth', () => ({
	exchangeWcaLoginCode: jest.fn(),
	syncWcaProfileToIntegration: jest.fn(async (i: any) => i),
}));
jest.mock('../../models/wca_record', () => ({fetchAndSaveWcaRecords: jest.fn(async () => undefined)}));
jest.mock('../../models/settings', () => ({createSetting: jest.fn(async () => undefined)}));
jest.mock('../../models/notification_preference', () => ({createNotificationPreference: jest.fn(async () => undefined)}));
jest.mock('../../models/session', () => ({createDefaultSession: jest.fn(async () => undefined)}));
jest.mock('../../models/profile', () => ({getOrCreateUserProfile: jest.fn()}));
jest.mock('../../models/ban_log', () => ({deactivateAllBanLogs: jest.fn()}));
jest.mock('../../database', () => ({getPrisma: () => ({userAccount: {update: jest.fn(async () => undefined)}})}));
jest.mock('../../services/redis', () => ({getRedisPubClient: jest.fn()}));
jest.mock('../../services/admin_notification', () => ({notifyAdminsOfNewUser: jest.fn(async () => undefined)}));
jest.mock('../../services/rate_limit', () => ({checkRateLimit: jest.fn(async () => ({allowed: true, count: 1}))}));
jest.mock('../../services/logger', () => ({logger: {warn: jest.fn(), info: jest.fn(), error: jest.fn()}}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const jwt = require('jsonwebtoken');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const {ZktAuthResolver} = require('../ZktAuth.resolver');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const {WcaAuthResolver} = require('../WcaAuth.resolver');

function makeContext(opts: {isWebView?: boolean; cookies?: Record<string, string>} = {}) {
	const res = {cookie: jest.fn(), clearCookie: jest.fn(), setHeader: jest.fn()};
	const req = {
		headers: {},
		cookies: opts.cookies || {},
		connection: {remoteAddress: '10.0.0.1'},
		isWebView: !!opts.isWebView,
	};
	return {req, res, user: null} as any;
}

beforeEach(() => {
	jest.clearAllMocks();
	createUserAccount.mockImplementation(async (first: string, last: string, email: string, username: string) => ({
		id: 'user-1',
		first_name: first,
		last_name: last,
		email,
		username,
	}));
	getUserByEmail.mockResolvedValue(null);
	getUserByUsername.mockResolvedValue([]);
	getIntegrationByZktUserId.mockResolvedValue(null);
	getIntegrationByWcaUserId.mockResolvedValue(null);
	getIntegrationByWcaId.mockResolvedValue(null);
});

describe('ZKT signup pending token', () => {
	const resolver = new ZktAuthResolver();

	it('keeps the pending token out of the body on web', async () => {
		const ctx = makeContext({isWebView: false});
		const result = await resolver.authenticateWithZkt(ctx, 'code');

		expect(result.needsUsername).toBe(true);
		expect(result.pendingToken).toBeUndefined();
		expect(ctx.res.cookie).toHaveBeenCalledWith('zkt_pending', expect.any(String), expect.any(Object));
	});

	it('hands the native shell the same token it put in the cookie', async () => {
		const ctx = makeContext({isWebView: true});
		const result = await resolver.authenticateWithZkt(ctx, 'code');

		const cookieValue = ctx.res.cookie.mock.calls[0][1];
		expect(result.pendingToken).toBe(cookieValue);
	});

	it('completes signup from the argument when the cookie never arrived (iOS)', async () => {
		const first = makeContext({isWebView: true});
		const {pendingToken} = await resolver.authenticateWithZkt(first, 'code');

		// No cookie on the second request: exactly what WKWebView does under ITP.
		const second = makeContext({isWebView: true});
		const user = await resolver.completeZktSignup(second, 'Kemalistfedai', true, pendingToken);

		expect(createUserAccount).toHaveBeenCalledWith(
			'Doruk',
			'Halici',
			'new.member@example.com',
			'Kemalistfedai',
			null,
			'10.0.0.1',
			// The country comes from Cloudflare's CF-IPCountry; the test request has none.
			'NONE'
		);
		expect(typeof user.session_token).toBe('string');
	});

	it('still completes from the cookie alone on web', async () => {
		const first = makeContext();
		await resolver.authenticateWithZkt(first, 'code');
		const cookieValue = first.res.cookie.mock.calls[0][1];

		const user = await resolver.completeZktSignup(makeContext({cookies: {zkt_pending: cookieValue}}), 'webuser', true, null);
		expect(user.id).toBe('user-1');
	});

	it('reports an expired session with a translatable key when neither is present', async () => {
		await expect(resolver.completeZktSignup(makeContext(), 'someone', true, null)).rejects.toMatchObject({
			extensions: expect.objectContaining({i18nKey: 'zkt_signup.session_expired'}),
		});
		expect(createUserAccount).not.toHaveBeenCalled();
	});

	it('rejects a token that was not signed by us', async () => {
		const forged = jwt.sign({sub: 'x', email: 'x@example.com'}, 'someone-elses-secret');
		await expect(resolver.completeZktSignup(makeContext(), 'someone', true, forged)).rejects.toMatchObject({
			extensions: expect.objectContaining({i18nKey: 'zkt_signup.session_expired'}),
		});
		expect(createUserAccount).not.toHaveBeenCalled();
	});
});

describe('WCA signup pending token', () => {
	const resolver = new WcaAuthResolver();

	function wcaPending() {
		return jwt.sign(
			{
				email: 'wca.member@example.com',
				name: 'Wca Member',
				wcaId: '2020TEST01',
				wcaUserId: '555',
				wcaAvatarUrl: null,
				countryIso2: 'TR',
				accessToken: 'wca-at',
				refreshToken: 'wca-rt',
				expiresAt: 123,
			},
			'test-secret',
			{expiresIn: 60}
		);
	}

	it('completes signup from the argument when the cookie never arrived (iOS)', async () => {
		const user = await resolver.completeWcaSignup(makeContext({isWebView: true}), 'wcauser', true, wcaPending());
		expect(user.id).toBe('user-1');
	});

	it('refuses a WCA identity linked elsewhere BEFORE creating any account', async () => {
		getIntegrationByWcaUserId.mockResolvedValue({id: 'other', user_id: 'someone-else'});

		await expect(
			resolver.completeWcaSignup(makeContext({isWebView: true}), 'wcauser', true, wcaPending())
		).rejects.toThrow('Bu WCA hesabi baska bir kullaniciya bagli.');
		expect(createUserAccount).not.toHaveBeenCalled();
	});
});
