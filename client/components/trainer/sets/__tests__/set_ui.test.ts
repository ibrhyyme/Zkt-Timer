import {
	buildCommunitySearch,
	categoryBadges,
	groupItemsByCategory,
	loginRedirectPath,
	mergeById,
	moveId,
	moveIdTo,
	parseCommunitySearch,
	progressCounts,
} from '../set_ui';
import type {AlgSetItemData} from '../../../../lib/alg_sets/types';

function row(id: string, category: string, position: number): AlgSetItemData {
	return {id, category, case_name: id, subset: '', puzzle: '333', algorithm: 'R U', position};
}

describe('set screen helpers', () => {
	it('shows at most three category badges and counts the rest', () => {
		expect(categoryBadges(['OLL', 'PLL'])).toEqual({shown: ['OLL', 'PLL'], more: 0});
		expect(categoryBadges(['OLL', 'PLL', 'F2L', 'COLL', 'ZBLL'])).toEqual({shown: ['OLL', 'PLL', 'F2L'], more: 2});
	});

	it('groups rows by category in order of first appearance, rows in set order', () => {
		const groups = groupItemsByCategory([row('p1', 'PLL', 2), row('o1', 'OLL', 0), row('p2', 'PLL', 1), row('o2', 'OLL', 3)]);
		expect(groups.map((g) => g.category)).toEqual(['OLL', 'PLL']);
		expect(groups[0].items.map((r) => r.id)).toEqual(['o1', 'o2']);
		expect(groups[1].items.map((r) => r.id)).toEqual(['p2', 'p1']);
	});

	it('counts learned and learning flags', () => {
		const flags: Record<string, number> = {a: 2, b: 1, c: 0, d: 2};
		expect(progressCounts(['a', 'b', 'c', 'd', 'x'], (id) => flags[id] || 0)).toEqual({learned: 2, learning: 1});
	});

	it('builds the login redirect to come back to the set', () => {
		expect(loginRedirectPath('/trainer/sets/Ab12Cd34Ef')).toBe('/login?redirect=%2Ftrainer%2Fsets%2FAb12Cd34Ef');
	});

	it('moves ids for reordering', () => {
		expect(moveId(['a', 'b', 'c'], 'b', -1)).toEqual(['b', 'a', 'c']);
		expect(moveId(['a', 'b', 'c'], 'c', 1)).toEqual(['a', 'b', 'c']);
		expect(moveIdTo(['a', 'b', 'c', 'd'], 'a', 'c')).toEqual(['b', 'c', 'a', 'd']);
		expect(moveIdTo(['a', 'b', 'c', 'd'], 'd', 'b')).toEqual(['a', 'd', 'b', 'c']);
	});

	it('reads and writes the community query, defaults left out', () => {
		expect(parseCommunitySearch('')).toEqual({q: '', sort: 'new', puzzle: null});
		expect(parseCommunitySearch('?q=oll&sort=popular&puzzle=222')).toEqual({q: 'oll', sort: 'popular', puzzle: '222'});
		expect(parseCommunitySearch('?sort=bogus&puzzle=clock')).toEqual({q: '', sort: 'new', puzzle: null});
		expect(buildCommunitySearch({q: '  ', sort: 'new', puzzle: null})).toBe('');
		expect(buildCommunitySearch({q: 'p shape', sort: 'popular', puzzle: '333'})).toBe('?q=p+shape&sort=popular&puzzle=333');
	});

	it('appends a page without duplicates', () => {
		expect(mergeById([{id: 'a'}, {id: 'b'}], [{id: 'b'}, {id: 'c'}]).map((x) => x.id)).toEqual(['a', 'b', 'c']);
	});
});
