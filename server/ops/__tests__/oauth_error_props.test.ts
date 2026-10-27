import 'reflect-metadata';

// server/ops/oauth-tokens.ts decides between "mark the grant dead", "stop the
// run" and "retry later" from the status and RFC error code that the two
// refresh paths now attach to their errors. These tests pin that contract and
// that the thrown error carries no request config (client secret, tokens).

jest.mock('axios', () => ({__esModule: true, default: {post: jest.fn(), get: jest.fn()}}));
jest.mock('../../database', () => ({getPrisma: () => ({})}));
jest.mock('../../models/integration', () => ({
	updateIntegration: jest.fn(async (int: any, params: any) => ({...int, ...params})),
	getIntegration: jest.fn(),
	getIntegrationByWcaId: jest.fn(),
	getIntegrationByWcaUserId: jest.fn(),
	getIntegrationByZktId: jest.fn(),
	getIntegrationByZktUserId: jest.fn(),
	createIntegration: jest.fn(),
}));
jest.mock('../../models/profile', () => ({updateUserProfile: jest.fn()}));
jest.mock('../../models/user_account', () => ({getUserById: jest.fn()}));
jest.mock('../../services/logger', () => ({logger: {warn: jest.fn(), info: jest.fn(), error: jest.fn()}}));

/* eslint-disable @typescript-eslint/no-var-requires */
const axios = require('axios').default;
const {getNewAuthToken, getAuthToken} = require('../../integrations/oauth');
const {rotateZktIntegrationTokens} = require('../../integrations/zkt_oauth');
const {updateIntegration, getIntegration} = require('../../models/integration');
const {classifyOAuthFailure} = require('../oauth_token_ops');
/* eslint-enable @typescript-eslint/no-var-requires */

function providerError(status: number, data: any) {
	const err: any = new Error(`Request failed with status code ${status}`);
	err.response = {status, data};
	err.config = {data: 'client_id=x&client_secret=SECRET-CLIENT&refresh_token=SECRET-REFRESH'};
	return err;
}

const silence = () => {
	jest.spyOn(console, 'log').mockImplementation(() => undefined);
	jest.spyOn(console, 'warn').mockImplementation(() => undefined);
	jest.spyOn(console, 'error').mockImplementation(() => undefined);
};

beforeEach(() => {
	jest.clearAllMocks();
	jest.restoreAllMocks();
	silence();
});

describe('WCA refresh (getNewAuthToken)', () => {
	const row = {id: 'int-1', service_name: 'wca', refresh_token: 'SECRET-REFRESH', auth_token: 'SECRET-OLD'};

	it('stores the new pair through updateIntegration', async () => {
		axios.post.mockResolvedValueOnce({data: {access_token: 'NEW-A', refresh_token: 'NEW-R', expires_in: 7200}});
		await expect(getNewAuthToken(row)).resolves.toBe('NEW-A');
		expect(updateIntegration).toHaveBeenCalledWith(
			row,
			expect.objectContaining({auth_token: 'NEW-A', refresh_token: 'NEW-R'})
		);
	});

	it('throws a plain error with status and RFC code, without the request config', async () => {
		axios.post.mockRejectedValueOnce(
			providerError(400, {error: 'invalid_grant', error_description: 'The provided authorization grant is invalid'})
		);
		const err: any = await getNewAuthToken(row).catch((e: any) => e);
		expect(err.status).toBe(400);
		expect(err.oauthError).toBe('invalid_grant');
		expect(err.config).toBeUndefined();
		expect(err.response).toBeUndefined();
		expect(classifyOAuthFailure(err)).toBe('dead_grant');
		expect(updateIntegration).not.toHaveBeenCalled();
	});

	it('reports a rejected client so the run stops', async () => {
		axios.post.mockRejectedValueOnce(providerError(401, {error: 'invalid_client'}));
		const err = await getNewAuthToken(row).catch((e: any) => e);
		expect(classifyOAuthFailure(err)).toBe('client_rejected');
	});
});

describe('WCA refresh on use (getAuthToken)', () => {
	const expired = {id: 'int-3', service_name: 'wca', refresh_token: 'R', auth_token: 'A', auth_expires_at: String(Date.now() - 1000)};
	const user = {id: 'u-1'};

	it('marks the link revoked when the refresh token is dead', async () => {
		getIntegration.mockResolvedValueOnce(expired);
		axios.post.mockRejectedValueOnce(providerError(400, {error: 'invalid_grant'}));
		await expect(getAuthToken('wca', user)).rejects.toBeTruthy();
		expect(updateIntegration).toHaveBeenCalledWith(expired, expect.objectContaining({revoked_at: expect.any(Date)}));
	});

	it('leaves every link alone when our own client is rejected', async () => {
		getIntegration.mockResolvedValueOnce(expired);
		axios.post.mockRejectedValueOnce(providerError(401, {error: 'invalid_client'}));
		await expect(getAuthToken('wca', user)).rejects.toBeTruthy();
		expect(updateIntegration).not.toHaveBeenCalled();
	});
});

describe('ZKT refresh (rotateZktIntegrationTokens)', () => {
	const row = {id: 'int-2', service_name: 'zkt', refresh_token: 'SECRET-REFRESH', auth_token: 'SECRET-OLD'};

	it('stores the rotated pair', async () => {
		axios.post.mockResolvedValueOnce({data: {access_token: 'NEW-A', refresh_token: 'NEW-R', expires_in: 3600}});
		const tokens = await rotateZktIntegrationTokens(row);
		expect(tokens.accessToken).toBe('NEW-A');
		expect(updateIntegration).toHaveBeenCalledWith(
			row,
			expect.objectContaining({auth_token: 'NEW-A', refresh_token: 'NEW-R'})
		);
	});

	it('carries status and code on failure and leaves the row alone', async () => {
		axios.post.mockRejectedValueOnce(providerError(400, {error: 'invalid_grant'}));
		const err: any = await rotateZktIntegrationTokens(row).catch((e: any) => e);
		expect(err.status).toBe(400);
		expect(err.oauthError).toBe('invalid_grant');
		expect(err.config).toBeUndefined();
		expect(classifyOAuthFailure(err)).toBe('dead_grant');
		expect(updateIntegration).not.toHaveBeenCalled();
	});

	it('a federation 429 is a rate limit, not a dead grant', async () => {
		axios.post.mockRejectedValueOnce(providerError(429, {error: 'rate_limited'}));
		const err = await rotateZktIntegrationTokens(row).catch((e: any) => e);
		expect(classifyOAuthFailure(err)).toBe('rate_limited');
	});
});
