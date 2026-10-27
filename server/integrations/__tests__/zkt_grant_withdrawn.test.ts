jest.mock('axios');
jest.mock('../../models/integration', () => ({
	updateIntegration: jest.fn(async (integration: any, data: any) => ({...integration, ...data})),
}));
jest.mock('../../services/logger', () => ({logger: {warn: jest.fn(), info: jest.fn(), error: jest.fn()}}));

import axios from 'axios';
import {isZktGrantWithdrawn} from '../zkt_oauth';

// The member can remove Zkt Timer on zekakuputurkiye.com. The timer learns it
// by asking the federation, and only a definite "no" may drop the link: a
// federation that is down must never cost a member their connection.

const mocked = axios as jest.Mocked<typeof axios>;
const live = () => ({id: 'i1', auth_token: 'access', refresh_token: 'refresh', auth_expires_at: Date.now() + 30 * 60_000});
const expired = () => ({id: 'i1', auth_token: 'access', refresh_token: 'refresh', auth_expires_at: Date.now() - 60_000});
const httpError = (status: number, data: any = {}) => Object.assign(new Error(`HTTP ${status}`), {response: {status, data}});

beforeEach(() => jest.resetAllMocks());

describe('isZktGrantWithdrawn', () => {
	it('a live access token the federation refuses (401) means the grant is gone', async () => {
		mocked.get.mockRejectedValue(httpError(401, {error: 'invalid_token'}));
		await expect(isZktGrantWithdrawn(live())).resolves.toBe(true);
	});

	it('a live access token that still works means still linked', async () => {
		mocked.get.mockResolvedValue({data: {sub: 'u1'}});
		await expect(isZktGrantWithdrawn(live())).resolves.toBe(false);
	});

	it('an expired token whose refresh is refused (invalid_grant) means the grant is gone', async () => {
		mocked.post.mockRejectedValue(httpError(400, {error: 'invalid_grant'}));
		await expect(isZktGrantWithdrawn(expired())).resolves.toBe(true);
		expect(mocked.get).not.toHaveBeenCalled();
	});

	it('a federation outage is not an answer', async () => {
		mocked.get.mockRejectedValue(new Error('ECONNREFUSED'));
		await expect(isZktGrantWithdrawn(live())).resolves.toBe(false);
		mocked.post.mockRejectedValue(httpError(503));
		await expect(isZktGrantWithdrawn(expired())).resolves.toBe(false);
	});

	it('a row with nothing to ask with is left alone', async () => {
		await expect(isZktGrantWithdrawn({id: 'i1', auth_token: null, refresh_token: null, auth_expires_at: 0})).resolves.toBe(false);
		expect(mocked.get).not.toHaveBeenCalled();
		expect(mocked.post).not.toHaveBeenCalled();
	});
});
