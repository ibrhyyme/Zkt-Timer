/**
 * Adding cases to a set with the variant fallback of trainer-sets 5.5, shared by the set picker
 * and "Add to set" in the normal trainer (T12).
 *
 * A case goes in with the algorithm the user runs for it on this device. The server only knows
 * library and pool texts, so a guest alternative or an old edited copy is refused
 * (ALG_SET_UNKNOWN_ALGORITHM / _CASE with the refused keys). The refused rows are swapped for the
 * library main algorithm and the request is sent once more, so the selection is not lost.
 *
 * React free; the request is passed in so the rule is testable in node.
 */
import {addAlgSetItems, errorI18nKey, rejectedCases} from '../../../lib/alg_sets/api';
import {algSetCaseKey, parseAlgSetCaseKey} from '../../../../shared/trainer/alg_sets';
import {findLibraryCase} from '../../../util/trainer/case_alternatives';
import {applyVariantFallback, type AddItemInput} from './picker/picker_model';
import type {AlgSetData} from '../../../lib/alg_sets/types';
import type {AlgorithmSubset} from '../types';

export interface AddItemsResult {
	set: AlgSetData;
	/** Rows that went in with the library algorithm instead of the device one. */
	fallbackCount: number;
}

type AddRequest = (setId: string, items: AddItemInput[]) => Promise<AlgSetData>;

const VARIANT_REFUSALS = new Set(['alg_set_errors.unknown_algorithm', 'alg_set_errors.unknown_case']);

/**
 * Sends `items` to the set; on a variant refusal retries once with the refused rows on the
 * library algorithm. Throws the original error when the refusal cannot be fixed that way (a row
 * already on the library text, a case the library lacks) or for any other error.
 */
export async function addItemsWithFallback(
	setId: string,
	items: AddItemInput[],
	libraryAlgOf: (key: string) => string | null,
	request: AddRequest = addAlgSetItems
): Promise<AddItemsResult> {
	try {
		return {set: await request(setId, items), fallbackCount: 0};
	} catch (err) {
		const rejected = rejectedCases(err);
		const key = errorI18nKey(err);
		if (!rejected.length || !key || !VARIANT_REFUSALS.has(key)) throw err;
		const fallback = applyVariantFallback(items, rejected, libraryAlgOf);
		if (fallback.unfixable.length || !fallback.replaced.length) throw err;
		return {set: await request(setId, fallback.items), fallbackCount: fallback.replaced.length};
	}
}

/** `category::name` → library main algorithm, read from the trainer's library file. */
export function libraryAlgLookup(
	library: Record<string, AlgorithmSubset[]> | null | undefined
): (key: string) => string | null {
	return (key: string) => {
		const parsed = parseAlgSetCaseKey(key);
		if (!parsed) return null;
		const found = findLibraryCase(library, parsed.category, parsed.caseName);
		return found?.entry?.algorithm || null;
	};
}

/** Request rows for trainer cases, one per case (the first wins when a case is listed twice). */
export function toAddItems(cases: {category: string; name: string; algorithm: string}[]): AddItemInput[] {
	const seen = new Set<string>();
	const out: AddItemInput[] = [];
	for (const c of cases) {
		if (!c?.category || !c.name || !c.algorithm) continue;
		const key = algSetCaseKey(c.category, c.name);
		if (seen.has(key)) continue;
		seen.add(key);
		out.push({category: c.category, case_name: c.name, algorithm: c.algorithm});
	}
	return out;
}
