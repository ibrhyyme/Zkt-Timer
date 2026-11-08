import {REUSE_CODE_WINDOW_MS, canReuseForgotPassword, getOrCreateForgotPassword} from '../forgot_password';

const findMany = jest.fn();
const create = jest.fn();

jest.mock('../../database', () => ({
	getPrisma: () => ({forgotPassword: {findMany, create}}),
}));

const NOW = new Date('2026-11-09T12:00:00Z').getTime();
const agedMs = (ms: number) => new Date(NOW - ms).toISOString();

describe('canReuseForgotPassword', () => {
	it('reuses a young, unused code', () => {
		expect(canReuseForgotPassword({claimed: false, created_at: agedMs(60_000)}, NOW)).toBe(true);
	});

	it('replaces a code too close to its 15 minute expiry', () => {
		expect(canReuseForgotPassword({claimed: false, created_at: agedMs(REUSE_CODE_WINDOW_MS)}, NOW)).toBe(false);
	});

	it('never reuses a used or burned code', () => {
		expect(canReuseForgotPassword({claimed: true, created_at: agedMs(1000)}, NOW)).toBe(false);
	});
});

describe('getOrCreateForgotPassword', () => {
	beforeEach(() => {
		findMany.mockReset();
		create.mockReset();
	});

	it('hands back the live code so an earlier mail keeps working', async () => {
		const live = {id: 'a', code: '123456', claimed: false, created_at: new Date().toISOString()};
		findMany.mockResolvedValue([live]);
		await expect(getOrCreateForgotPassword({id: 'u'})).resolves.toBe(live);
		expect(create).not.toHaveBeenCalled();
	});

	it('creates a code when there is none to reuse', async () => {
		findMany.mockResolvedValue([]);
		create.mockResolvedValue({id: 'b', code: '654321'});
		await expect(getOrCreateForgotPassword({id: 'u'})).resolves.toEqual({id: 'b', code: '654321'});
	});
});
