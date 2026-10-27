import 'reflect-metadata';

// OAuth credentials (Integration.auth_token / refresh_token) must stay on the server.
// GraphQL no longer declares them (graphql_secret_fields.test.ts), but two non-GraphQL
// exits remained: sanitizeUser's result is dispatched as `me` into the SSR Redux state
// and serialized verbatim into window.__STORE__ (and the service worker's HTML cache),
// and createIntegration logged raw provider errors whose axios config holds the Bearer
// token or the client secret.

jest.mock('../database', () => ({getPrisma: () => ({})}));
jest.mock('../models/integration', () => ({getIntegration: jest.fn(async () => null)}));
jest.mock('../models/wca_record', () => ({fetchAndSaveWcaRecords: jest.fn()}));
jest.mock('../integrations/oauth', () => ({
	getIntegrationGetMe: jest.fn(),
	revokeIntegration: jest.fn(),
	linkOAuthAccount: jest.fn(async () => {
		const err: any = new Error('Request failed with status code 502');
		err.response = {status: 502};
		err.config = {
			headers: {Authorization: 'Bearer SECRET-ACCESS-TOKEN'},
			data: 'client_id=x&client_secret=SECRET-CLIENT&code=SECRET-CODE',
		};
		throw err;
	}),
}));

/* eslint-disable @typescript-eslint/no-var-requires */
const {sanitizeUser, sanitizeUsers} = require('../models/user_account');
const {IntegrationResolver} = require('../resolvers/Integration.resolver');
/* eslint-enable @typescript-eslint/no-var-requires */

function makeOwnerRow() {
	return {
		id: 'u-1',
		username: 'owner',
		email: 'owner@example.com',
		password: '$2b$10$hash',
		join_ip: '203.0.113.7',
		integrations: [
			{
				id: 'int-1',
				service_name: 'wca',
				auth_token: 'SECRET-ACCESS-TOKEN',
				refresh_token: 'SECRET-REFRESH-TOKEN',
				wca_id: '2015TEST01',
				created_at: new Date('2025-01-01'),
			},
		],
	};
}

describe('sanitizeUser strips OAuth credentials', () => {
	it('removes tokens from the private (me / SSR) shape and keeps what the client renders', () => {
		const row = makeOwnerRow();
		const me = sanitizeUser(row as any);

		expect(JSON.stringify(me)).not.toMatch(/SECRET-/);
		expect(me.integrations[0]).toMatchObject({id: 'int-1', service_name: 'wca', wca_id: '2015TEST01'});
		expect(me.password).toBeUndefined();
		expect(me.join_ip).toBeUndefined();
		expect(me.has_password).toBe(true);
	});

	it('removes tokens from the public shape too', () => {
		const [pub] = sanitizeUsers([makeOwnerRow() as any], true);
		expect(JSON.stringify(pub)).not.toMatch(/SECRET-/);
		expect(pub.integrations).toHaveLength(1);
	});

	it('does not strip the caller row, which server code still uses to call the provider', () => {
		const row = makeOwnerRow();
		sanitizeUser(row as any);
		expect(row.integrations[0].auth_token).toBe('SECRET-ACCESS-TOKEN');
		expect(row.integrations[0].refresh_token).toBe('SECRET-REFRESH-TOKEN');
	});
});

describe('createIntegration does not log provider credentials', () => {
	it('logs status and message only, not the axios config', async () => {
		const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
		try {
			const resolver = new IntegrationResolver();
			await expect(
				resolver.createIntegration({user: {id: 'u-1'}} as any, 'wca', 'code')
			).rejects.toBeTruthy();

			expect(spy).toHaveBeenCalled();
			const util = require('util'); // eslint-disable-line @typescript-eslint/no-var-requires
			const logged = spy.mock.calls.map((args) => args.map((a) => util.inspect(a, {depth: 10})).join(' ')).join('\n');
			expect(logged).not.toMatch(/SECRET-/);
			expect(logged).toMatch(/502/);
		} finally {
			spy.mockRestore();
		}
	});
});
