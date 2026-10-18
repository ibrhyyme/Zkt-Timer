/**
 * One merge rule for a case's variants (trainer-sets 5.4): library main, library alternatives,
 * pool, guest; duplicates dropped by the trainer's own text.
 */
import {findLibraryCase, libraryVariants, mergeCaseAlternatives, sameVariant} from '../case_alternatives';
import {trainerAlgText} from '../set_queue';
import type {AlgorithmSubset} from '../../../components/trainer/types';

const LIBRARY: Record<string, AlgorithmSubset[]> = {
	PLL: [
		{subset: 'Adj corners', algorithms: [{name: 'T perm', algorithm: "R U R' U' R' F R2 U' R' U' R U R' F'", alternatives: ["(R U R' U') R' F R2 U' R' U' (R U R' F')", "R2 U R2 U' R2"]}]},
		{subset: 'Edge perm', algorithms: [{name: 'Ua perm', algorithm: "M2 U M U2 M' U M2"}]},
	],
};

describe('findLibraryCase', () => {
	it('returns the entry and its subset', () => {
		const found = findLibraryCase(LIBRARY, 'PLL', 'Ua perm');
		expect(found?.subset).toBe('Edge perm');
		expect(found?.entry.algorithm).toBe("M2 U M U2 M' U M2");
	});

	it('is null for an unknown category or case', () => {
		expect(findLibraryCase(LIBRARY, 'OLL', 'Ua perm')).toBeNull();
		expect(findLibraryCase(LIBRARY, 'PLL', 'Zz perm')).toBeNull();
		expect(findLibraryCase(null, 'PLL', 'Ua perm')).toBeNull();
	});
});

describe('mergeCaseAlternatives', () => {
	const primary = "R U R' U' R' F R2 U' R' U' R U R' F'";

	it('keeps the source order: primary, library, pool, guest', () => {
		const merged = mergeCaseAlternatives({
			primary,
			library: ["R2 U R2 U' R2"],
			pool: ["F R U' R' U' R U R' F' R U R' U' R' F R F'"],
			guest: ["R U2 R'"],
		});
		expect(merged).toEqual([primary, "R2 U R2 U' R2", "F R U' R' U' R U R' F' R U R' U' R' F R F'", "R U2 R'"]);
	});

	it('drops texts that are the same for the trainer (parentheses, spacing)', () => {
		const merged = mergeCaseAlternatives({
			primary,
			library: ["(R U R' U') R' F R2 U' R' U' (R U R' F')"],
			pool: [primary, `  ${primary}  `],
			guest: ["(R U R' U') R' F R2 U' R' U' (R U R' F')"],
		});
		// The parenthesised library text expands to the primary's text only if expandNotation
		// drops the parentheses; either way every survivor is unique by trainerAlgText.
		const keys = merged.map(trainerAlgText);
		expect(new Set(keys).size).toBe(keys.length);
		expect(merged[0]).toBe(primary);
	});

	it('ignores empty and missing texts', () => {
		expect(mergeCaseAlternatives({primary: '', library: [null, undefined, '  '], pool: null})).toEqual([]);
		expect(mergeCaseAlternatives({})).toEqual([]);
	});

	it('matches the old AlternativesPicker merge on a plain case', () => {
		const found = findLibraryCase(LIBRARY, 'PLL', 'T perm')!;
		const merged = mergeCaseAlternatives({primary: found.entry.algorithm, library: found.entry.alternatives});
		expect(merged).toEqual(libraryVariants(found));
		expect(merged[0]).toBe(found.entry.algorithm);
	});
});

describe('sameVariant', () => {
	it('compares by the trainer text', () => {
		expect(sameVariant("R U R'", "R U R'")).toBe(true);
		expect(sameVariant("R U R'", "R U' R'")).toBe(false);
		expect(sameVariant(null, '')).toBe(true);
	});
});
