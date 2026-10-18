/**
 * Set picker model (trainer-sets 5): library tree, step address, default variant, limit, and the
 * fallback to the library algorithm when the server refuses a variant (5.5).
 */
import {
	addedItemIds,
	ALL_SUBSETS,
	applyVariantFallback,
	buildPickerSearch,
	buildPickerTree,
	categoryShortName,
	defaultVariant,
	groupSelectState,
	groupSelection,
	parentPickerStep,
	parsePickerStep,
	remainingSlots,
	resolvePickerStep,
	type PickerSelectionItem,
} from '../picker/picker_model';
import type {AlgorithmSubset} from '../../types';

const LIBRARY: Record<string, AlgorithmSubset[]> = {
	PLL: [
		{subset: 'Adj corners', algorithms: [{name: 'Aa perm', algorithm: 'A1'}, {name: 'T perm', algorithm: 'T1'}]},
		{subset: 'Edge perm', algorithms: [{name: 'Ua perm', algorithm: 'U1'}]},
	],
	'2x2 CLL': [{subset: 'Sune', algorithms: [{name: 'CLL S 1', algorithm: 'C1'}]}, {subset: 'H', algorithms: [{name: 'CLL H 1', algorithm: 'C2'}]}],
	'Pyraminx LL': [{subset: 'Default', algorithms: [{name: 'Sune', algorithm: 'P1'}]}],
	OLL: [{subset: 'Dot', algorithms: [{name: 'OLL 1', algorithm: 'O1'}]}, {subset: 'Empty', algorithms: []}],
};

describe('buildPickerTree', () => {
	const tree = buildPickerTree(LIBRARY);

	it('groups categories under puzzles in the selector order', () => {
		expect(tree.map((p) => p.cubeType)).toEqual(['3x3', '2x2', 'Pyraminx']);
		expect(tree[0].categories.map((c) => c.category)).toEqual(['PLL', 'OLL']);
	});

	it('drops empty subsets and marks one-group categories', () => {
		const oll = tree[0].categories[1];
		expect(oll.subsets.map((s) => s.subset)).toEqual(['Dot']);
		expect(oll.singleSubset).toBe(true);
		expect(tree[2].categories[0].singleSubset).toBe(true);
		expect(tree[0].categories[0].singleSubset).toBe(false);
	});

	it('keys cases by category::name and keeps the library text', () => {
		expect(tree[0].categories[0].cases[0]).toEqual({key: 'PLL::Aa perm', category: 'PLL', subset: 'Adj corners', name: 'Aa perm', libraryAlg: 'A1'});
	});

	it('shortens prefixed category names', () => {
		expect(categoryShortName('2x2 CLL')).toBe('CLL');
		expect(categoryShortName('SQ1 OBL')).toBe('OBL');
		expect(categoryShortName('PLL')).toBe('PLL');
	});
});

describe('step address', () => {
	const tree = buildPickerTree(LIBRARY);

	it('round trips', () => {
		const search = buildPickerSearch({group: '2x2 CLL', sub: 'H'});
		expect(parsePickerStep(search)).toEqual({group: '2x2 CLL', sub: 'H'});
		expect(buildPickerSearch({group: null, sub: 'H'})).toBe('');
		expect(parsePickerStep('?sub=H')).toEqual({group: null, sub: null});
	});

	it('resolves unknown parts to the nearest valid step', () => {
		expect(resolvePickerStep(tree, {group: 'Nope', sub: null}).category).toBeNull();
		expect(resolvePickerStep(tree, {group: 'PLL', sub: 'Nope'}).sub).toBeNull();
		expect(resolvePickerStep(tree, {group: 'PLL', sub: ALL_SUBSETS}).sub).toBe(ALL_SUBSETS);
		expect(resolvePickerStep(tree, {group: 'PLL', sub: 'Edge perm'}).sub).toBe('Edge perm');
	});

	it('skips step 2 for a one-group category', () => {
		expect(resolvePickerStep(tree, {group: 'Pyraminx LL', sub: null}).sub).toBe(ALL_SUBSETS);
		expect(parentPickerStep(tree, {group: 'Pyraminx LL', sub: null})).toEqual({group: null, sub: null});
	});

	it('goes one step up', () => {
		expect(parentPickerStep(tree, {group: 'PLL', sub: 'Edge perm'})).toEqual({group: 'PLL', sub: null});
		expect(parentPickerStep(tree, {group: 'PLL', sub: null})).toEqual({group: null, sub: null});
	});
});

describe('selection', () => {
	it('defaults to the device text, else the library text', () => {
		expect(defaultVariant('A1', "R U R'")).toBe("R U R'");
		expect(defaultVariant('A1', '  ')).toBe('A1');
		expect(defaultVariant('A1', null)).toBe('A1');
	});

	it('counts the room left in a set of 500', () => {
		expect(remainingSlots(0, 0)).toBe(500);
		expect(remainingSlots(490, 8)).toBe(2);
		expect(remainingSlots(499, 5)).toBe(0);
	});

	it('knows the select all state of a group', () => {
		const tree = buildPickerTree(LIBRARY);
		const cases = tree[0].categories[0].cases; // Aa, T, Ua
		expect(groupSelectState(cases, new Set(), new Map())).toBe('none');
		expect(groupSelectState(cases, new Set(['PLL::Aa perm']), new Map([['PLL::T perm', 1]]))).toBe('some');
		expect(groupSelectState(cases, new Set(['PLL::Aa perm']), new Map([['PLL::T perm', 1], ['PLL::Ua perm', 1]]))).toBe('all');
		expect(groupSelectState(cases, new Set(cases.map((c) => c.key)), new Map())).toBe('done');
	});

	it('groups the selection by category in first appearance order', () => {
		const item = (category: string, name: string): PickerSelectionItem => ({key: `${category}::${name}`, category, case_name: name, subset: '', algorithm: 'x', explicit: false});
		const groups = groupSelection([item('OLL', 'OLL 1'), item('PLL', 'T perm'), item('OLL', 'OLL 2')]);
		expect(groups.map((g) => [g.category, g.items.length])).toEqual([['OLL', 2], ['PLL', 1]]);
	});
});

describe('applyVariantFallback', () => {
	const library: Record<string, string> = {'PLL::T perm': 'T1', 'PLL::Aa perm': 'A1'};
	const libraryAlgOf = (key: string) => library[key] || null;

	it('swaps refused rows to the library text and keeps the others', () => {
		const items = [
			{category: 'PLL', case_name: 'T perm', algorithm: 'my guest alg'},
			{category: 'PLL', case_name: 'Aa perm', algorithm: 'A1'},
		];
		const res = applyVariantFallback(items, ['PLL::T perm'], libraryAlgOf);
		expect(res.items).toEqual([
			{category: 'PLL', case_name: 'T perm', algorithm: 'T1'},
			{category: 'PLL', case_name: 'Aa perm', algorithm: 'A1'},
		]);
		expect(res.replaced).toEqual(['PLL::T perm']);
		expect(res.unfixable).toEqual([]);
	});

	it('cannot fix a row already on the library text or an unknown case', () => {
		const items = [
			{category: 'PLL', case_name: 'Aa perm', algorithm: 'A1'},
			{category: 'PLL', case_name: 'Zz perm', algorithm: 'Z'},
		];
		const res = applyVariantFallback(items, ['PLL::Aa perm', 'PLL::Zz perm'], libraryAlgOf);
		expect(res.replaced).toEqual([]);
		expect(res.unfixable).toEqual(['PLL::Aa perm', 'PLL::Zz perm']);
	});
});

describe('addedItemIds', () => {
	it('lists the rows whose case is new', () => {
		const after = [
			{id: 'a', category: 'PLL', case_name: 'Aa perm'},
			{id: 'b', category: 'PLL', case_name: 'T perm'},
		];
		expect(addedItemIds(['PLL::Aa perm'], after)).toEqual(['b']);
	});
});
