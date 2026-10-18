const mockQuery = jest.fn();
const mockMutate = jest.fn();
jest.mock('../../components/api', () => ({
	gqlQueryTyped: (...args: any[]) => mockQuery(...args),
	gqlMutateTyped: (...args: any[]) => mockMutate(...args),
}));
jest.mock('../../@types/generated/graphql', () => ({
	GetActiveAnnouncementsDocument: 'GetActiveAnnouncements',
	MarkAnnouncementAsViewedDocument: 'MarkAnnouncementAsViewed',
}));

type Mod = typeof import('../announcements');

function load(): Mod {
	let mod: Mod;
	jest.isolateModules(() => {
		mod = require('../announcements');
	});
	return mod!;
}

function answer(ids: string[]) {
	return {data: {getActiveAnnouncements: ids.map((id) => ({id}))}};
}

beforeEach(() => {
	mockQuery.mockReset();
	mockMutate.mockReset();
	mockMutate.mockResolvedValue({});
});

afterEach(() => {
	jest.restoreAllMocks();
});

describe('fetchActiveAnnouncements', () => {
	it('shares one request between concurrent callers', async () => {
		const mod = load();
		mockQuery.mockResolvedValue(answer(['a']));
		const [x, y] = await Promise.all([mod.fetchActiveAnnouncements('u1|tr'), mod.fetchActiveAnnouncements('u1|tr', 0)]);
		expect(mockQuery).toHaveBeenCalledTimes(1);
		expect(x).toEqual([{id: 'a'}]);
		expect(y).toBe(x);
	});

	it('answers from memory within a minute and asks again after', async () => {
		let now = 1_000_000;
		jest.spyOn(Date, 'now').mockImplementation(() => now);
		const mod = load();
		mockQuery.mockResolvedValue(answer(['a']));
		await mod.fetchActiveAnnouncements('u1|tr');
		now += 59_000;
		await mod.fetchActiveAnnouncements('u1|tr');
		expect(mockQuery).toHaveBeenCalledTimes(1);
		now += 2_000;
		await mod.fetchActiveAnnouncements('u1|tr');
		expect(mockQuery).toHaveBeenCalledTimes(2);
	});

	it('never serves one user or language the answer of another', async () => {
		const mod = load();
		mockQuery.mockResolvedValueOnce(answer(['a'])).mockResolvedValueOnce(answer(['b'])).mockResolvedValueOnce(answer(['c']));
		await mod.fetchActiveAnnouncements('u1|tr');
		await expect(mod.fetchActiveAnnouncements('u2|tr')).resolves.toEqual([{id: 'b'}]);
		await expect(mod.fetchActiveAnnouncements('u2|en')).resolves.toEqual([{id: 'c'}]);
	});

	it('maxAge 0 forces a fresh answer', async () => {
		const mod = load();
		mockQuery.mockResolvedValueOnce(answer(['a'])).mockResolvedValueOnce(answer(['a', 'b']));
		await mod.fetchActiveAnnouncements('u1|tr');
		await expect(mod.fetchActiveAnnouncements('u1|tr', 0)).resolves.toEqual([{id: 'a'}, {id: 'b'}]);
	});

	it('resolves null on failure and does not cache it', async () => {
		const mod = load();
		mockQuery.mockRejectedValueOnce(new Error('down')).mockResolvedValueOnce(answer(['a']));
		await expect(mod.fetchActiveAnnouncements('u1|tr')).resolves.toBeNull();
		await expect(mod.fetchActiveAnnouncements('u1|tr')).resolves.toEqual([{id: 'a'}]);
	});
});

describe('markAnnouncementViewed', () => {
	it('drops the announcement so the carousel does not reopen on the next page', async () => {
		const mod = load();
		mockQuery.mockResolvedValue(answer(['a', 'b']));
		await mod.fetchActiveAnnouncements('u1|tr');
		await mod.markAnnouncementViewed('a');
		expect(mockMutate).toHaveBeenCalledWith('MarkAnnouncementAsViewed', {announcementId: 'a'});
		await expect(mod.fetchActiveAnnouncements('u1|tr')).resolves.toEqual([{id: 'b'}]);
		expect(mockQuery).toHaveBeenCalledTimes(1);
	});

	it('keeps the announcement when the server refuses', async () => {
		const mod = load();
		mockQuery.mockResolvedValue(answer(['a']));
		mockMutate.mockRejectedValue(new Error('nope'));
		await mod.fetchActiveAnnouncements('u1|tr');
		await expect(mod.markAnnouncementViewed('a')).rejects.toThrow('nope');
		await expect(mod.fetchActiveAnnouncements('u1|tr')).resolves.toEqual([{id: 'a'}]);
	});
});

// A module, so these top-level names do not collide with other test files under tsc.
export {};
