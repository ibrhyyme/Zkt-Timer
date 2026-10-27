import 'reflect-metadata';

// solveByShareCode is anonymous: anyone holding a share link opens the solve and its
// owner. The owner is loaded through publicUserInclude, which used to pull every
// Integration column, OAuth tokens included. This suite runs the real resolver and
// model against a stand-in Prisma that honours `select` the way Prisma does, and
// checks no OAuth credential leaves the database on that path.

const DB_INTEGRATION = {
	id: 'int-1',
	user_id: 'owner-1',
	service_name: 'wca',
	auth_token: 'SECRET-ACCESS-TOKEN',
	refresh_token: 'SECRET-REFRESH-TOKEN',
	auth_expires_at: BigInt(1),
	wca_id: '2015TEST01',
	wca_country_iso2: 'TR',
	zkt_country_iso2: null,
	created_at: new Date('2025-01-01'),
};

const DB_USER = {
	id: 'owner-1',
	username: 'owner',
	email: 'owner@example.com',
	password: '$2b$10$hash',
	join_ip: '203.0.113.7',
	admin: false,
	mod: false,
	verified: false,
	is_pro: false,
	banned_forever: false,
	banned_until: null,
	created_at: new Date('2025-01-01'),
	integrations: [DB_INTEGRATION],
	profile: {id: 'p-1', pfp_image: null},
};

// Mimics Prisma relation loading: `true` returns the whole row, `{select}` only the
// listed columns, recursively.
function project(row: any, spec: any): any {
	if (spec === true) return row;
	if (Array.isArray(row)) return row.map((r) => project(r, spec));
	const fields = spec.select || null;
	if (!fields) return row;
	const out: any = {};
	for (const key of Object.keys(fields)) {
		if (!fields[key]) continue;
		const value = row[key];
		out[key] = fields[key] === true || value == null ? value : project(value, fields[key]);
	}
	return out;
}

const findUnique = jest.fn(async (args: any) => ({
	id: 'solve-1',
	user_id: 'owner-1',
	share_code: 'ABCDEFGH',
	user: project(DB_USER, args.include.user),
}));

jest.mock('../../database', () => ({getPrisma: () => ({solve: {findUnique}})}));
jest.mock('../../services/rate_limit', () => ({checkRateLimit: jest.fn(async () => ({allowed: true}))}));
jest.mock('../../models/solve_view', () => ({
	createSolveView: jest.fn(async () => undefined),
	deleteSolveViewsBySolveId: jest.fn(async () => undefined),
}));
jest.mock('../../util/auth', () => ({checkLoggedIn: jest.fn()}));
jest.mock('../../services/logger', () => ({logger: {warn: jest.fn(), info: jest.fn(), error: jest.fn()}}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const {queryActions} = require('../solve');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const {publicUserInclude} = require('../../models/user_account');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const {publicIntegrationSelect} = require('../../models/integration');

describe('solveByShareCode does not load OAuth tokens', () => {
	it('asks Prisma for the owner integrations without auth_token or refresh_token', async () => {
		await queryActions.solveByShareCode(null, {shareCode: 'ABCDEFGH'}, {user: null, req: null});

		const userSpec = findUnique.mock.calls[0][0].include.user;
		const integrationSpec = userSpec.select.integrations;
		expect(integrationSpec).not.toBe(true);
		expect(integrationSpec.select).toBeDefined();
		expect(integrationSpec.select.auth_token).toBeUndefined();
		expect(integrationSpec.select.refresh_token).toBeUndefined();
		// The public owner never carries the account's own secrets either.
		expect(userSpec.select.password).toBeUndefined();
		expect(userSpec.select.email).toBeUndefined();
		expect(userSpec.select.join_ip).toBeUndefined();
	});

	it('returns an owner whose integrations hold no credentials but keep what the client renders', async () => {
		const solve = await queryActions.solveByShareCode(null, {shareCode: 'ABCDEFGH'}, {user: null, req: null});
		const [integration] = solve.user.integrations;

		expect(JSON.stringify(solve, (_k, v) => (typeof v === 'bigint' ? v.toString() : v))).not.toMatch(/SECRET-/);
		expect(integration.auth_token).toBeUndefined();
		expect(integration.refresh_token).toBeUndefined();
		expect(integration).toMatchObject({id: 'int-1', service_name: 'wca', wca_country_iso2: 'TR', wca_id: '2015TEST01'});
		expect(solve.user.password).toBeUndefined();
		expect(solve.user.email).toBeUndefined();
	});

	it('publicIntegrationSelect and publicUserInclude never list a credential column', () => {
		expect(Object.keys(publicIntegrationSelect)).not.toEqual(expect.arrayContaining(['auth_token']));
		expect(Object.keys(publicIntegrationSelect)).not.toEqual(expect.arrayContaining(['refresh_token']));
		expect(publicUserInclude.select.integrations).toEqual({select: publicIntegrationSelect});
	});
});
