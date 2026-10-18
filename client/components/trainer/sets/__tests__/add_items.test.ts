// The real lib/alg_sets/api error readers are used; only the network client is replaced.
jest.mock('../../../api', () => ({
	gqlQueryTyped: jest.fn(),
	gqlMutateTyped: jest.fn(),
}));

import {addItemsWithFallback, libraryAlgLookup, toAddItems} from '../add_items';

const LIBRARY: any = {
	PLL: [{subset: 'Adj corners', algorithms: [{name: 'T', algorithm: "R U R' U' R' F R2 U' R' U' R U R' F'"}]}],
	OLL: [{subset: 'P shape', algorithms: [{name: 'OLL 31', algorithm: "R' U' F U R U' R' F' R"}]}],
};

function refusal(i18nKey: string, rejected: string[]) {
	return {graphQLErrors: [{message: 'refused', extensions: {code: 'BAD_USER_INPUT', i18nKey, rejected}}]};
}

const SET: any = {id: 'set-1', name: 'Mine', items: [], item_count: 2};

describe('addItemsWithFallback', () => {
	it('sends once when the server accepts every row', async () => {
		const request = jest.fn().mockResolvedValue(SET);
		const items = [{category: 'PLL', case_name: 'T', algorithm: 'guest alg'}];
		const out = await addItemsWithFallback('set-1', items, libraryAlgLookup(LIBRARY), request);
		expect(out).toEqual({set: SET, fallbackCount: 0});
		expect(request).toHaveBeenCalledTimes(1);
	});

	it('retries once with the library algorithm for refused rows only', async () => {
		const request = jest
			.fn()
			.mockRejectedValueOnce(refusal('alg_set_errors.unknown_algorithm', ['PLL::T']))
			.mockResolvedValueOnce(SET);
		const items = [
			{category: 'PLL', case_name: 'T', algorithm: 'guest alg'},
			{category: 'OLL', case_name: 'OLL 31', algorithm: 'pool alg'},
		];
		const out = await addItemsWithFallback('set-1', items, libraryAlgLookup(LIBRARY), request);
		expect(out.fallbackCount).toBe(1);
		expect(request).toHaveBeenCalledTimes(2);
		expect(request.mock.calls[1][1]).toEqual([
			{category: 'PLL', case_name: 'T', algorithm: LIBRARY.PLL[0].algorithms[0].algorithm},
			{category: 'OLL', case_name: 'OLL 31', algorithm: 'pool alg'},
		]);
	});

	it('throws the refusal when a refused row is already the library text', async () => {
		const err = refusal('alg_set_errors.unknown_algorithm', ['PLL::T']);
		const request = jest.fn().mockRejectedValue(err);
		const items = [{category: 'PLL', case_name: 'T', algorithm: LIBRARY.PLL[0].algorithms[0].algorithm}];
		await expect(addItemsWithFallback('set-1', items, libraryAlgLookup(LIBRARY), request)).rejects.toBe(err);
		expect(request).toHaveBeenCalledTimes(1);
	});

	it('throws a case the library lacks', async () => {
		const err = refusal('alg_set_errors.unknown_case', ['PLL::Zz']);
		const request = jest.fn().mockRejectedValue(err);
		const items = [{category: 'PLL', case_name: 'Zz', algorithm: 'x'}];
		await expect(addItemsWithFallback('set-1', items, libraryAlgLookup(LIBRARY), request)).rejects.toBe(err);
		expect(request).toHaveBeenCalledTimes(1);
	});

	it('does not retry other errors (limit, rate limit, network)', async () => {
		const err = refusal('alg_set_errors.limit_items', ['PLL::T']);
		const request = jest.fn().mockRejectedValue(err);
		const items = [{category: 'PLL', case_name: 'T', algorithm: 'guest alg'}];
		await expect(addItemsWithFallback('set-1', items, libraryAlgLookup(LIBRARY), request)).rejects.toBe(err);
		const network = new Error('Failed to fetch');
		const request2 = jest.fn().mockRejectedValue(network);
		await expect(addItemsWithFallback('set-1', items, libraryAlgLookup(LIBRARY), request2)).rejects.toBe(network);
		expect(request).toHaveBeenCalledTimes(1);
		expect(request2).toHaveBeenCalledTimes(1);
	});
});

describe('libraryAlgLookup', () => {
	it('finds the main algorithm by category::name', () => {
		const lookup = libraryAlgLookup(LIBRARY);
		expect(lookup('OLL::OLL 31')).toBe(LIBRARY.OLL[0].algorithms[0].algorithm);
		expect(lookup('OLL::OLL 99')).toBeNull();
		expect(lookup('bad key')).toBeNull();
		expect(libraryAlgLookup(null)('PLL::T')).toBeNull();
	});
});

describe('toAddItems', () => {
	it('maps trainer cases to request rows, one per case', () => {
		expect(
			toAddItems([
				{category: 'PLL', name: 'T', algorithm: 'a'},
				{category: 'PLL', name: 'T', algorithm: 'b'},
				{category: 'OLL', name: 'T', algorithm: 'c'},
				{category: 'OLL', name: '', algorithm: 'd'},
			])
		).toEqual([
			{category: 'PLL', case_name: 'T', algorithm: 'a'},
			{category: 'OLL', case_name: 'T', algorithm: 'c'},
		]);
	});
});
