import {CUBE_TYPES} from '../../client/util/cubes/cube_types';
import {SCRAMBLE_SUBSETS} from '../../client/util/cubes/scramble_subsets';
import {PUZZLE_KEYS, isBuiltinPuzzleKey, isValidPuzzleKey, puzzleOfBucket} from '../cube_puzzle';

// Timer types that are not a puzzle: 'wca' is a category whose subsets are the puzzles,
// 'other' has no physical puzzle.
const NOT_A_PUZZLE = new Set(['wca', 'other']);

describe('puzzleOfBucket', () => {
	it('maps every built-in timer cube type to a built-in puzzle key', () => {
		// A new type added to cube_types.ts without a mapping falls through to the custom
		// type branch and returns itself, which is not a built-in key: this fails.
		for (const id of Object.keys(CUBE_TYPES)) {
			if (NOT_A_PUZZLE.has(id)) continue;
			const puzzle = puzzleOfBucket(id, null);
			expect({id, builtin: isBuiltinPuzzleKey(puzzle)}).toEqual({id, builtin: true});
		}
	});

	it('keeps the puzzle of a type across every one of its subsets', () => {
		for (const [id, subsets] of Object.entries(SCRAMBLE_SUBSETS)) {
			if (id === 'wca' || NOT_A_PUZZLE.has(id) || !CUBE_TYPES[id]) continue;
			const base = puzzleOfBucket(id, null);
			for (const subset of subsets) {
				if (subset.isHeader) continue;
				expect({id, subset: subset.id, puzzle: puzzleOfBucket(id, subset.id)}).toEqual({
					id,
					subset: subset.id,
					puzzle: base,
				});
			}
		}
	});

	it('maps every WCA subset to its own puzzle key', () => {
		for (const subset of SCRAMBLE_SUBSETS.wca) {
			if (subset.isHeader) continue;
			expect(puzzleOfBucket('wca', subset.id)).toBe(subset.id);
			expect(isBuiltinPuzzleKey(subset.id)).toBe(true);
		}
	});

	it('treats every 3x3 bucket as the 3x3 puzzle', () => {
		expect(puzzleOfBucket('wca', '333')).toBe('333');
		expect(puzzleOfBucket('333', null)).toBe('333');
		expect(puzzleOfBucket('333', '333oh')).toBe('333');
		expect(puzzleOfBucket('333cfop', 'pll')).toBe('333');
		expect(puzzleOfBucket('333roux', undefined)).toBe('333');
		expect(puzzleOfBucket('333mehta', '')).toBe('333');
	});

	it('maps method types and retired types to their puzzle', () => {
		expect(puzzleOfBucket('444yau', null)).toBe('444');
		expect(puzzleOfBucket('333sub', '2gen')).toBe('333');
		expect(puzzleOfBucket('333zz', null)).toBe('333');
	});

	it('maps old WCA event variants to their puzzle', () => {
		expect(puzzleOfBucket('wca', '333oh')).toBe('333');
		expect(puzzleOfBucket('wca', '333bf')).toBe('333');
		expect(puzzleOfBucket('wca', '444bf')).toBe('444');
		expect(puzzleOfBucket('wca', '555bf')).toBe('555');
	});

	it('returns null when there is no physical puzzle', () => {
		expect(puzzleOfBucket('other', null)).toBeNull();
		expect(puzzleOfBucket(null, null)).toBeNull();
		expect(puzzleOfBucket(undefined)).toBeNull();
		expect(puzzleOfBucket('', '333')).toBeNull();
		expect(puzzleOfBucket('wca', null)).toBeNull();
		expect(puzzleOfBucket('wca', 'nonsense')).toBeNull();
	});

	it('keeps a custom cube type id as its own puzzle', () => {
		const id = '6f1c2f4e-2b7a-4d2e-9a43-0c1f5d6a7b8c';
		expect(puzzleOfBucket(id, null)).toBe(id);
		expect(puzzleOfBucket(id, 'anything')).toBe(id);
	});

	it('never returns a timer-only type', () => {
		for (const id of Object.keys(CUBE_TYPES)) {
			const puzzle = puzzleOfBucket(id, null);
			expect(puzzle === null || isBuiltinPuzzleKey(puzzle)).toBe(true);
		}
	});
});

describe('isValidPuzzleKey', () => {
	it('accepts every built-in key', () => {
		for (const key of PUZZLE_KEYS) expect(isValidPuzzleKey(key)).toBe(true);
	});

	it('rejects timer-only types and empty values', () => {
		for (const key of ['wca', 'other', '333cfop', '333roux', '444yau', '', null, undefined]) {
			expect(isValidPuzzleKey(key as string)).toBe(false);
		}
	});

	it('accepts a custom type id only when it is the caller\'s', () => {
		const mine = 'c0ffee00-0000-4000-8000-000000000001';
		const other = 'c0ffee00-0000-4000-8000-000000000002';
		const ids = new Set([mine]);
		expect(isValidPuzzleKey(mine, ids)).toBe(true);
		expect(isValidPuzzleKey(other, ids)).toBe(false);
		expect(isValidPuzzleKey(mine)).toBe(false);
	});

	it('lists each built-in key once', () => {
		expect(new Set(PUZZLE_KEYS).size).toBe(PUZZLE_KEYS.length);
	});
});
