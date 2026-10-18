/**
 * Set study queue (trainer-sets 6.2, 6.4, 6.5): set rows become the same cards the selector
 * builds, keyed by `category::name`, and Smart Cube mode keeps only the 3x3 rows.
 */
import {
	canStudyWithSmartCube,
	checkedKey,
	distinctCategoryCount,
	filterForMode,
	setRowsToChecked,
	smartSkipSummary,
	startSetStudyPayload,
	toCheckedAlgorithm,
	trainerAlgText,
	type SetStudyRow,
} from '../set_queue';
import {algToId, expandNotation} from '../algorithm_engine';
import {algSetCaseKey, cubeTypeOfCategory} from '../../../../shared/trainer/alg_sets';

// PLL Y perm and 2-Look PLL "No Matching" share one algorithm text in the library.
const Y_PERM = "F (R U' R' U') (R U R' F') (R U R' U') (R' F R F')";

const MIXED: SetStudyRow[] = [
	{category: 'PLL', case_name: 'Y perm', subset: 'Diag corners', algorithm: Y_PERM, position: 0},
	{category: '2-Look PLL', case_name: 'No Matching (aka No Headlights)', subset: 'Corners', algorithm: Y_PERM, position: 1},
	{category: '2x2 CLL', case_name: 'CLL AS 1', subset: 'Antisune', algorithm: "U R U2 R' U' R U' R'", position: 2},
	{category: 'Pyraminx L4E', case_name: 'Sune', subset: 'Default', algorithm: "(R U R') U (R U R')", position: 3},
	{category: 'OLL', case_name: 'OLL 21', subset: 'Cross', algorithm: "(R U R' U) (R U' R' U) (R U2 R')", position: 4},
];

describe('trainerAlgText', () => {
	it('is the selector transform, so stats keys match between a set and the normal trainer (B-10)', () => {
		const samples = [Y_PERM, "Rw U Rw' U'", "2R2 U2 2R2 Uw2", "(R U R') U (R U R')", ''];
		for (const raw of samples) expect(trainerAlgText(raw)).toBe(expandNotation(raw));
	});

	it('tolerates a missing text', () => {
		expect(trainerAlgText(undefined as unknown as string)).toBe(expandNotation(''));
	});
});

describe('toCheckedAlgorithm', () => {
	it('builds the selector card shape with the transformed text and the stored best time', () => {
		const lookups: string[] = [];
		const card = toCheckedAlgorithm(MIXED[0], (id) => {
			lookups.push(id);
			return 1234;
		});
		expect(card).toEqual({
			algorithm: trainerAlgText(Y_PERM),
			name: 'Y perm',
			bestTime: 1234,
			category: 'PLL',
			subset: 'Diag corners',
		});
		expect(lookups).toEqual([algToId(trainerAlgText(Y_PERM))]);
	});

	it('has no best time without a lookup and an empty subset when the row has none', () => {
		const card = toCheckedAlgorithm({category: 'OLL', case_name: 'OLL 21', algorithm: 'R U R', subset: null});
		expect(card.bestTime).toBeNull();
		expect(card.subset).toBe('');
	});
});

describe('checkedKey', () => {
	it('is the selector key category::name, not the algorithm text', () => {
		const cards = setRowsToChecked(MIXED);
		expect(checkedKey(cards[0])).toBe(algSetCaseKey('PLL', 'Y perm'));
		expect(checkedKey(cards[1])).toBe(algSetCaseKey('2-Look PLL', 'No Matching (aka No Headlights)'));
		// Same text, two cards: both stay, and they share statistics (same algToId).
		expect(cards[0].algorithm).toBe(cards[1].algorithm);
		expect(checkedKey(cards[0])).not.toBe(checkedKey(cards[1]));
	});
});

describe('setRowsToChecked', () => {
	it('keeps the owner order (position), not the array order', () => {
		const shuffled = [MIXED[3], MIXED[0], MIXED[4], MIXED[2], MIXED[1]];
		expect(setRowsToChecked(shuffled).map((c) => c.name)).toEqual(MIXED.map((r) => r.case_name));
	});

	it('falls back to array order when positions are missing or equal', () => {
		const rows = MIXED.map((r) => ({...r, position: undefined}));
		expect(setRowsToChecked(rows).map((c) => c.category)).toEqual(MIXED.map((r) => r.category));
		const same = MIXED.map((r) => ({...r, position: 0}));
		expect(setRowsToChecked(same).map((c) => c.category)).toEqual(MIXED.map((r) => r.category));
	});

	it('drops a repeated case and broken rows', () => {
		const rows: SetStudyRow[] = [
			MIXED[0],
			{...MIXED[0], algorithm: 'R U R', position: 9},
			{category: '', case_name: 'x', algorithm: 'R'},
			{category: 'OLL', case_name: '', algorithm: 'R'},
			{category: 'OLL', case_name: 'OLL 1', algorithm: ''},
		];
		const cards = setRowsToChecked(rows);
		expect(cards).toHaveLength(1);
		expect(cards[0].algorithm).toBe(trainerAlgText(Y_PERM));
	});
});

describe('Smart Cube filter', () => {
	it('only 3x3 shaped categories run on a smart cube', () => {
		expect(canStudyWithSmartCube('PLL')).toBe(true);
		expect(canStudyWithSmartCube('2-Look PLL')).toBe(true);
		expect(canStudyWithSmartCube('CMLL')).toBe(true);
		expect(canStudyWithSmartCube('2x2 CLL')).toBe(false);
		expect(canStudyWithSmartCube('4x4 PLL Parity')).toBe(false);
		expect(canStudyWithSmartCube('Pyraminx L4E')).toBe(false);
		expect(canStudyWithSmartCube('SQ1 CP')).toBe(false);
	});

	it('agrees with the selector, which lists only the 3x3 and 3x3 Roux puzzles in Smart mode', () => {
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const library = require('../../../../public/trainer/default-algs.json') as Record<string, unknown>;
		const categories = Object.keys(library);
		expect(categories.length).toBeGreaterThan(20);
		for (const category of categories) {
			const selectorSmart = ['3x3', '3x3 Roux'].includes(cubeTypeOfCategory(category));
			expect([category, canStudyWithSmartCube(category)]).toEqual([category, selectorSmart]);
		}
	});

	it('Standard keeps every card (as a copy), Smart keeps the 3x3 ones in order', () => {
		const cards = setRowsToChecked(MIXED);
		const standard = filterForMode(cards, 'standard');
		expect(standard).toEqual(cards);
		expect(standard).not.toBe(cards);
		expect(filterForMode(cards, null)).toEqual(cards);
		expect(filterForMode(cards, 'smart').map((c) => c.category)).toEqual(['PLL', '2-Look PLL', 'OLL']);
	});

	it('summarises what Smart mode leaves out, puzzles in selector order', () => {
		const cards = setRowsToChecked(MIXED);
		expect(smartSkipSummary(cards)).toEqual({count: 2, cubeTypes: ['2x2', 'Pyraminx']});
		expect(smartSkipSummary(cards.filter((c) => canStudyWithSmartCube(c.category)))).toEqual({count: 0, cubeTypes: []});
	});
});

describe('distinctCategoryCount', () => {
	it('counts categories for the category tag (shown only for a mixed set)', () => {
		expect(distinctCategoryCount(setRowsToChecked(MIXED))).toBe(5);
		expect(distinctCategoryCount([{category: 'PLL'}, {category: 'PLL'}])).toBe(1);
		expect(distinctCategoryCount([])).toBe(0);
	});
});

describe('startSetStudyPayload', () => {
	it('carries the set identity and every row as a card', () => {
		const payload = startSetStudyPayload({
			id: 'set-1',
			code: 'AbCdEfGhIj',
			name: 'Öğrenmem gerekenler',
			owner_name: 'ibrhyyme',
			is_owner: false,
			items: MIXED,
		});
		expect(payload.set).toEqual({
			id: 'set-1',
			code: 'AbCdEfGhIj',
			name: 'Öğrenmem gerekenler',
			owner_name: 'ibrhyyme',
			is_owner: false,
		});
		expect(payload.items.map(checkedKey)).toEqual(MIXED.map((r) => algSetCaseKey(r.category, r.case_name)));
	});
});
