import {getTrainerLibrary} from './trainer_library';
import {
	ALG_SET_LIMITS,
	algSetCaseKey,
	canonAlg,
	categoryPuzzle,
	isMoveSequence,
} from '../../shared/trainer/alg_sets';

/**
 * Trainer algorithm catalog (design .feedback/designs/trainer-sets.md section 4.3).
 *
 * An index of the served trainer library (trainer_library.ts) built once on first use:
 * `category::case_name` -> {subset, puzzle, algorithms}. A set row is accepted only for a
 * known case and an algorithm the library or the TrainerAlternative pool holds for that same
 * case. The stored text is the matching source's text, never the client's, so a public set
 * can only show algorithms that came from the library or the pool.
 *
 * The library is read once per process, so a new file takes effect on the next container
 * start; no cache to clear.
 */

export type LibraryEntry = {name: string; algorithm: string; alternatives?: string[]};
export type LibrarySubset = {subset: string; algorithms: LibraryEntry[]};
export type Library = Record<string, LibrarySubset[]>;

export type CatalogCase = {
	category: string;
	case_name: string;
	subset: string;
	puzzle: string;
	/** canonAlg(text) -> text as the library writes it; the main algorithm first. */
	algorithms: Map<string, string>;
};

export type AlgCatalog = Map<string, CatalogCase>;

/** Pool row fields the matcher reads (TrainerAlternative). */
export type PoolRow = {category: string; case_name: string; algorithm: string; original_input: string};

export type SetItemCandidate = {category: string; case_name: string; algorithm: string};

export type AcceptedSetItem = {
	category: string;
	case_name: string;
	subset: string;
	puzzle: string;
	/** The matching source's text (library or pool), not the client's. */
	algorithm: string;
};

export type SetItemMatch = {
	accepted: AcceptedSetItem[];
	/** Case keys (`category::case_name`) that the library does not know. */
	unknownCases: string[];
	/** Case keys whose algorithm is neither in the library nor in the pool for that case. */
	unknownAlgorithms: string[];
};

// Longest category and case name in the library are far below these; anything longer is
// garbage and never reaches a lookup.
export const MAX_CATEGORY_LENGTH = 40;
export const MAX_CASE_NAME_LENGTH = 100;

export function buildAlgCatalog(library: Library): AlgCatalog {
	const catalog: AlgCatalog = new Map();
	for (const category of Object.keys(library || {})) {
		const puzzle = categoryPuzzle(category);
		for (const sub of library[category] || []) {
			for (const entry of sub?.algorithms || []) {
				if (!entry?.name) continue;
				const algorithms = new Map<string, string>();
				for (const text of [entry.algorithm, ...(entry.alternatives || [])]) {
					const canon = canonAlg(text);
					if (canon && !algorithms.has(canon)) algorithms.set(canon, text);
				}
				catalog.set(algSetCaseKey(category, entry.name), {
					category,
					case_name: entry.name,
					subset: sub.subset,
					puzzle,
					algorithms,
				});
			}
		}
	}
	return catalog;
}

let cached: AlgCatalog | null = null;

/** The catalog of the served library, built on first call and kept for the process lifetime. */
export function getAlgCatalog(): AlgCatalog {
	if (!cached) {
		cached = buildAlgCatalog(getTrainerLibrary().full);
	}
	return cached;
}

/** Test hook: replace (or with null, drop) the cached catalog. */
export function setAlgCatalogForTests(catalog: AlgCatalog | null): void {
	cached = catalog;
}

export function getCatalogCase(catalog: AlgCatalog, category: string, caseName: string): CatalogCase | null {
	if (typeof category !== 'string' || typeof caseName !== 'string') return null;
	if (category.length > MAX_CATEGORY_LENGTH || caseName.length > MAX_CASE_NAME_LENGTH) return null;
	return catalog.get(algSetCaseKey(category, caseName)) || null;
}

/**
 * The text a pool row offers for `canon`, when the row is for this case and the text passes
 * the move sequence check. The pool keeps the expandNotation output in `algorithm` and what
 * the user typed in `original_input` (the one the trainer shows); both are tried, the typed
 * one first.
 */
function poolText(row: PoolRow, canon: string, puzzle: string): string | null {
	for (const text of [row.original_input, row.algorithm]) {
		if (text && canonAlg(text) === canon && isMoveSequence(text, puzzle)) return text;
	}
	return null;
}

/**
 * Library first, then the pool rows of that case. Returns the stored text or null.
 * `pool` may hold rows of other cases; they are skipped.
 */
export function matchAlgorithm(
	known: CatalogCase,
	algorithm: string,
	pool: readonly PoolRow[]
): string | null {
	if (typeof algorithm !== 'string' || !algorithm) return null;
	// Generous bound before canonAlg: whitespace runs collapse, so a valid text may be a bit
	// longer than the 200 character limit isMoveSequence applies after canonAlg.
	if (algorithm.length > ALG_SET_LIMITS.ALGORITHM_MAX_LENGTH * 2) return null;
	const canon = canonAlg(algorithm);
	if (!canon) return null;

	const library = known.algorithms.get(canon);
	if (library) return library;

	for (const row of pool) {
		if (row.category !== known.category || row.case_name !== known.case_name) continue;
		const text = poolText(row, canon, known.puzzle);
		if (text) return text;
	}
	return null;
}

/** Candidates whose algorithm the library does not hold: only these need the pool query. */
export function casesNeedingPool(
	catalog: AlgCatalog,
	items: readonly SetItemCandidate[]
): {categories: string[]; caseNames: string[]} {
	const categories = new Set<string>();
	const caseNames = new Set<string>();
	for (const item of items) {
		const known = getCatalogCase(catalog, item?.category, item?.case_name);
		if (!known) continue;
		if (known.algorithms.has(canonAlg(item.algorithm))) continue;
		categories.add(known.category);
		caseNames.add(known.case_name);
	}
	return {categories: Array.from(categories), caseNames: Array.from(caseNames)};
}

/**
 * Validates every candidate. The caller writes nothing when either rejection list is not
 * empty (design 4.2: one bad row rejects the whole request and names the rejected cases).
 */
export function matchSetItems(
	catalog: AlgCatalog,
	items: readonly SetItemCandidate[],
	pool: readonly PoolRow[]
): SetItemMatch {
	const accepted: AcceptedSetItem[] = [];
	const unknownCases: string[] = [];
	const unknownAlgorithms: string[] = [];

	for (const item of items) {
		const known = getCatalogCase(catalog, item?.category, item?.case_name);
		if (!known) {
			unknownCases.push(algSetCaseKey(String(item?.category ?? ''), String(item?.case_name ?? '')));
			continue;
		}
		const text = matchAlgorithm(known, item.algorithm, pool);
		if (!text) {
			unknownAlgorithms.push(algSetCaseKey(known.category, known.case_name));
			continue;
		}
		accepted.push({
			category: known.category,
			case_name: known.case_name,
			subset: known.subset,
			puzzle: known.puzzle,
			algorithm: text,
		});
	}

	return {accepted, unknownCases, unknownAlgorithms};
}
