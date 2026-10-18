const mockQuery = jest.fn();

jest.mock('../../../api', () => ({
	gqlQueryTyped: (...args: any[]) => mockQuery(...args),
}));

import {createStore} from 'redux';
import ssrReducer from '../../../../reducers/ssr';
import {algSetSsrKey, algSetSsrMeta, prefetchAlgSetMeta, toAlgSetSsrPreview} from '../ssr';

const CODE = 'Ab3dE5gH9k';

function makeStore() {
	return createStore((state: any = {ssr: {}}, action) => ({ssr: ssrReducer(state.ssr, action)}));
}

function req(code: string): any {
	return {params: {code}};
}

// Echoes the key and vars so the assertions can see which string was picked.
const t = (key: string, vars?: any) => (vars ? `${key} ${JSON.stringify(vars)}` : key);

const SET = {
	id: 'set-1',
	code: CODE,
	name: 'Öğrenmem gerekenler',
	description: 'secret description',
	visibility: 'link',
	item_count: 21,
	categories: ['OLL', 'PLL', 'F2L'],
	preview: [{id: 'i1', category: 'OLL', case_name: 'OLL 31', algorithm: "R' U' F U R U' R' F' R"}],
	owner: {id: 'u1', username: 'ibrhyyme', verified: true, avatar_path: 'a/b.png'},
};

beforeEach(() => mockQuery.mockReset());

describe('toAlgSetSsrPreview', () => {
	it('keeps only name, owner name, count and categories', () => {
		expect(toAlgSetSsrPreview(SET as any)).toEqual({
			name: 'Öğrenmem gerekenler',
			owner: 'ibrhyyme',
			count: 21,
			categories: ['OLL', 'PLL', 'F2L'],
		});
	});

	it('returns null without a set', () => {
		expect(toAlgSetSsrPreview(null)).toBeNull();
		expect(toAlgSetSsrPreview(undefined)).toBeNull();
	});
});

describe('prefetchAlgSetMeta', () => {
	it('writes the summary under the prefixed key', async () => {
		mockQuery.mockResolvedValue({data: {algSet: SET}});
		const store = makeStore();
		await prefetchAlgSetMeta(store, req(CODE));

		expect(mockQuery).toHaveBeenCalledTimes(1);
		expect(mockQuery.mock.calls[0][1]).toEqual({code: CODE});
		const stored = store.getState().ssr[algSetSsrKey(CODE)];
		expect(stored).toEqual({name: SET.name, owner: 'ibrhyyme', count: 21, categories: ['OLL', 'PLL', 'F2L']});
		// Nothing beyond the preview reaches window.__STORE__.
		expect(JSON.stringify(store.getState())).not.toContain('secret description');
		expect(JSON.stringify(store.getState())).not.toContain('set-1');
	});

	it('writes null on NOT_FOUND instead of throwing (no 404 from the router)', async () => {
		mockQuery.mockRejectedValue({graphQLErrors: [{extensions: {code: 'NOT_FOUND'}}]});
		const store = makeStore();
		await expect(prefetchAlgSetMeta(store, req(CODE))).resolves.toBeDefined();
		expect(store.getState().ssr[algSetSsrKey(CODE)]).toBeNull();
	});

	it('skips the request for a malformed code', async () => {
		const store = makeStore();
		await prefetchAlgSetMeta(store, req('not a code'));
		expect(mockQuery).not.toHaveBeenCalled();
		expect(store.getState().ssr[algSetSsrKey('not a code')]).toBeNull();
	});
});

describe('algSetSsrMeta', () => {
	it('builds title and description from the stored summary', async () => {
		mockQuery.mockResolvedValue({data: {algSet: SET}});
		const store = makeStore();
		await prefetchAlgSetMeta(store, req(CODE));

		const meta = algSetSsrMeta(store, req(CODE), t);
		expect(meta.title).toBe(`seo.alg_set_title ${JSON.stringify({name: SET.name, owner: 'ibrhyyme'})}`);
		expect(meta.description).toBe(
			`seo.alg_set_description ${JSON.stringify({count: 21, categories: 'OLL, PLL, F2L'})}`
		);
		expect(meta.image).toBeUndefined();
	});

	it('folds long category lists into +N', async () => {
		mockQuery.mockResolvedValue({
			data: {algSet: {...SET, categories: ['OLL', 'PLL', 'F2L', 'ZBLL', 'COLL', 'CMLL', 'ZBLS', 'VLS']}},
		});
		const store = makeStore();
		await prefetchAlgSetMeta(store, req(CODE));
		expect(algSetSsrMeta(store, req(CODE), t).description).toContain('OLL, PLL, F2L, ZBLL, COLL, CMLL +2');
	});

	it('uses the short description for a set without rows', async () => {
		mockQuery.mockResolvedValue({data: {algSet: {...SET, item_count: 0, categories: []}}});
		const store = makeStore();
		await prefetchAlgSetMeta(store, req(CODE));
		expect(algSetSsrMeta(store, req(CODE), t).description).toBe('seo.alg_set_description_empty');
	});

	it('returns null for an unknown set so the site defaults stay', async () => {
		mockQuery.mockRejectedValue(new Error('network'));
		const store = makeStore();
		await prefetchAlgSetMeta(store, req(CODE));
		expect(algSetSsrMeta(store, req(CODE), t)).toBeNull();
	});
});
