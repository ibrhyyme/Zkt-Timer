/**
 * Pure model of the set picker (trainer-sets 5): the library as puzzle → category → subset →
 * case, the step address, the default variant of a case, the selection limit and the fallback
 * when the server refuses a variant. React free so it is testable in node.
 */
import {algSetCaseKey, ALG_SET_LIMITS, CUBE_TYPE_ORDER, cubeTypeOfCategory, type TrainerCubeType} from '../../../../../shared/trainer/alg_sets';
import {isHiddenSubset} from '../../../../util/trainer/subset_label';
import type {AlgorithmSubset} from '../../types';

// ── Library tree ────────────────────────────────────────────────────────

export interface PickerCase {
	/** `category::name` */
	key: string;
	category: string;
	subset: string;
	name: string;
	/** Library main algorithm, as written. */
	libraryAlg: string;
}

export interface PickerSubset {
	subset: string;
	cases: PickerCase[];
}

export interface PickerCategory {
	category: string;
	/** Name under its puzzle heading ("CLL" under 2x2). */
	shortName: string;
	cubeType: TrainerCubeType;
	subsets: PickerSubset[];
	cases: PickerCase[];
	/** One group only ("Default", "EO Algs"): step 2 is skipped, the cases open directly. */
	singleSubset: boolean;
}

export interface PickerPuzzle {
	cubeType: TrainerCubeType;
	categories: PickerCategory[];
}

const CATEGORY_PREFIXES = ['2x2 ', '4x4 ', 'Pyraminx ', 'SQ1 '];

/** Category name under its puzzle heading. Same rule as the Algorithms tab's category tabs. */
export function categoryShortName(category: string): string {
	for (const prefix of CATEGORY_PREFIXES) {
		if (category.startsWith(prefix)) return category.slice(prefix.length);
	}
	return category;
}

/** Library grouped by puzzle in CUBE_TYPE_ORDER; categories and cases keep the library order. */
export function buildPickerTree(library: Record<string, AlgorithmSubset[]> | null | undefined): PickerPuzzle[] {
	if (!library) return [];
	const byType = new Map<TrainerCubeType, PickerCategory[]>();
	for (const category of Object.keys(library)) {
		const raw = library[category];
		if (!Array.isArray(raw)) continue;
		const subsets: PickerSubset[] = [];
		for (const sub of raw) {
			const cases = (sub?.algorithms || [])
				.filter((a) => a && a.name && a.algorithm)
				.map((a) => ({
					key: algSetCaseKey(category, a.name),
					category,
					subset: sub.subset,
					name: a.name,
					libraryAlg: a.algorithm,
				}));
			if (cases.length) subsets.push({subset: sub.subset, cases});
		}
		if (!subsets.length) continue;
		const cubeType = cubeTypeOfCategory(category);
		const entry: PickerCategory = {
			category,
			shortName: categoryShortName(category),
			cubeType,
			subsets,
			cases: subsets.flatMap((s) => s.cases),
			singleSubset: subsets.length === 1 || subsets.every((s) => isHiddenSubset(s.subset)),
		};
		const list = byType.get(cubeType) || [];
		list.push(entry);
		byType.set(cubeType, list);
	}
	return CUBE_TYPE_ORDER.filter((ct) => byType.has(ct)).map((ct) => ({cubeType: ct, categories: byType.get(ct)!}));
}

export function findPickerCategory(tree: PickerPuzzle[], category: string | null): PickerCategory | null {
	if (!category) return null;
	for (const puzzle of tree) {
		const found = puzzle.categories.find((c) => c.category === category);
		if (found) return found;
	}
	return null;
}

// ── Step address (?group=<category>&sub=<subset>) ───────────────────────

/** `sub` value of the "All cases" box (a subset name never is this). */
export const ALL_SUBSETS = '*';

export interface PickerStep {
	/** Category of step 2 / 3, null on step 1. */
	group: string | null;
	/** Subset of step 3, ALL_SUBSETS for "All cases", null on step 2. */
	sub: string | null;
}

export function parsePickerStep(search: string | null | undefined): PickerStep {
	const params = new URLSearchParams(search || '');
	const group = params.get('group') || null;
	const sub = group ? params.get('sub') || null : null;
	return {group, sub};
}

export function buildPickerSearch(step: PickerStep): string {
	const params = new URLSearchParams();
	if (step.group) {
		params.set('group', step.group);
		if (step.sub) params.set('sub', step.sub);
	}
	const qs = params.toString();
	return qs ? `?${qs}` : '';
}

/**
 * The step a valid address shows: an unknown category falls back to step 1, an unknown subset to
 * step 2, and a one-group category goes straight to its cases.
 */
export function resolvePickerStep(tree: PickerPuzzle[], step: PickerStep): {category: PickerCategory | null; sub: string | null} {
	const category = findPickerCategory(tree, step.group);
	if (!category) return {category: null, sub: null};
	if (category.singleSubset) return {category, sub: ALL_SUBSETS};
	if (!step.sub) return {category, sub: null};
	if (step.sub === ALL_SUBSETS || category.subsets.some((s) => s.subset === step.sub)) return {category, sub: step.sub};
	return {category, sub: null};
}

/** One step up: cases → subsets (or step 1 for a one-group category) → step 1. */
export function parentPickerStep(tree: PickerPuzzle[], step: PickerStep): PickerStep {
	const {category, sub} = resolvePickerStep(tree, step);
	if (!category) return {group: null, sub: null};
	if (sub && !category.singleSubset) return {group: category.category, sub: null};
	return {group: null, sub: null};
}

// ── Selection ───────────────────────────────────────────────────────────

export interface PickerSelectionItem {
	key: string;
	category: string;
	case_name: string;
	subset: string;
	/** The variant this set gets for the case, as written. */
	algorithm: string;
	/** Picked in the variant window (library or pool text) rather than the default. */
	explicit: boolean;
}

/**
 * The variant a case gets without a choice (5.4): the algorithm the user already runs for it in
 * the trainer (this device's library copy), else the library main algorithm.
 */
export function defaultVariant(libraryAlg: string, deviceAlg: string | null | undefined): string {
	return typeof deviceAlg === 'string' && deviceAlg.trim() ? deviceAlg : libraryAlg;
}

/** How many more cases fit in the set. */
export function remainingSlots(setItemCount: number, selectedCount: number): number {
	return Math.max(0, ALG_SET_LIMITS.MAX_ITEMS_PER_SET - Math.max(0, setItemCount) - Math.max(0, selectedCount));
}

/** Count per category of a list of `category::name` keys or items. */
export function countByCategory(items: Iterable<{category: string}>): Map<string, number> {
	const out = new Map<string, number>();
	for (const item of items) out.set(item.category, (out.get(item.category) || 0) + 1);
	return out;
}

/** Selection grouped by category, categories in first appearance order (the selection sheet). */
export function groupSelection(items: PickerSelectionItem[]): {category: string; items: PickerSelectionItem[]}[] {
	const groups: {category: string; items: PickerSelectionItem[]}[] = [];
	const byCategory = new Map<string, {category: string; items: PickerSelectionItem[]}>();
	for (const item of items) {
		let group = byCategory.get(item.category);
		if (!group) {
			group = {category: item.category, items: []};
			byCategory.set(item.category, group);
			groups.push(group);
		}
		group.items.push(item);
	}
	return groups;
}

/** Cases of a list that can still be picked (not in the set yet). */
export function pickableCases(cases: PickerCase[], inSet: ReadonlySet<string>): PickerCase[] {
	return cases.filter((c) => !inSet.has(c.key));
}

/** "Select all" state of a group: every pickable case selected, some, or none. */
export function groupSelectState(
	cases: PickerCase[],
	inSet: ReadonlySet<string>,
	selected: ReadonlyMap<string, unknown>
): 'all' | 'some' | 'none' | 'done' {
	const pickable = pickableCases(cases, inSet);
	if (pickable.length === 0) return 'done';
	const count = pickable.filter((c) => selected.has(c.key)).length;
	if (count === 0) return 'none';
	return count === pickable.length ? 'all' : 'some';
}

// ── Server refusal fallback (5.5) ───────────────────────────────────────

export interface AddItemInput {
	category: string;
	case_name: string;
	algorithm: string;
}

export interface VariantFallback {
	/** The request to send again, refused rows on the library main algorithm. */
	items: AddItemInput[];
	/** Keys whose algorithm was swapped for the library one. */
	replaced: string[];
	/** Keys the swap cannot fix (already the library text, or the case is not in the library). */
	unfixable: string[];
}

/**
 * The server refused some rows (ALG_SET_UNKNOWN_ALGORITHM / _CASE with `rejected` keys). A
 * default variant may be a guest alternative or an old edited copy the server does not know; it
 * is replaced by the library main algorithm so the selection is not lost. A row already on the
 * library text, or a case the library lacks, cannot be fixed this way.
 */
export function applyVariantFallback(
	items: AddItemInput[],
	rejectedKeys: readonly string[],
	libraryAlgOf: (key: string) => string | null
): VariantFallback {
	const rejected = new Set(rejectedKeys);
	const replaced: string[] = [];
	const unfixable: string[] = [];
	const out = items.map((item) => {
		const key = algSetCaseKey(item.category, item.case_name);
		if (!rejected.has(key)) return item;
		const libraryAlg = libraryAlgOf(key);
		if (!libraryAlg || libraryAlg === item.algorithm) {
			unfixable.push(key);
			return item;
		}
		replaced.push(key);
		return {...item, algorithm: libraryAlg};
	});
	return {items: out, replaced, unfixable};
}

/** Ids of the rows a set gained (rows whose case was not there before). */
export function addedItemIds(before: Iterable<string>, after: {id: string; category: string; case_name: string}[]): string[] {
	const had = new Set(before);
	return after.filter((row) => !had.has(algSetCaseKey(row.category, row.case_name))).map((row) => row.id);
}
