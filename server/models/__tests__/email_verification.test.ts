import {
	REUSE_CODE_WINDOW_MS,
	canReuseEmailVerification,
	getOrCreateEmailVerification,
} from '../email_verification';

const findMany = jest.fn();
const create = jest.fn();

jest.mock('../../database', () => ({
	getPrisma: () => ({emailVerification: {findMany, create}}),
}));

const NOW = new Date('2026-11-09T12:00:00Z').getTime();
const agedMs = (ms: number) => new Date(NOW - ms).toISOString();

describe('canReuseEmailVerification', () => {
	it('reuses a young, unused code', () => {
		expect(canReuseEmailVerification({claimed: false, created_at: agedMs(60_000)}, NOW)).toBe(true);
	});

	it('replaces a code too close to its 30 minute expiry', () => {
		expect(canReuseEmailVerification({claimed: false, created_at: agedMs(REUSE_CODE_WINDOW_MS)}, NOW)).toBe(false);
	});

	it('never reuses a used or burned code', () => {
		expect(canReuseEmailVerification({claimed: true, created_at: agedMs(1000)}, NOW)).toBe(false);
	});

	it('has nothing to reuse when no code exists', () => {
		expect(canReuseEmailVerification(undefined, NOW)).toBe(false);
	});
});

// Only the newest code is accepted, so a resend that replaced it made the code in
// the first mail fail for anyone who opened that one.
describe('getOrCreateEmailVerification', () => {
	beforeEach(() => {
		findMany.mockReset();
		create.mockReset();
	});

	it('hands back the live code so every mail carries the same one', async () => {
		const live = {id: 'a', code: '123456', claimed: false, created_at: new Date().toISOString()};
		findMany.mockResolvedValue([live]);
		await expect(getOrCreateEmailVerification({id: 'u'})).resolves.toBe(live);
		expect(create).not.toHaveBeenCalled();
	});

	it('creates a code when the latest one is burned', async () => {
		findMany.mockResolvedValue([{id: 'a', code: '123456', claimed: true, created_at: new Date().toISOString()}]);
		create.mockResolvedValue({id: 'b', code: '654321'});
		await expect(getOrCreateEmailVerification({id: 'u'})).resolves.toEqual({id: 'b', code: '654321'});
		expect(create).toHaveBeenCalledTimes(1);
	});

	it('creates a code on the first mail', async () => {
		findMany.mockResolvedValue([]);
		create.mockResolvedValue({id: 'c', code: '111111'});
		await expect(getOrCreateEmailVerification({id: 'u'})).resolves.toEqual({id: 'c', code: '111111'});
	});
});
