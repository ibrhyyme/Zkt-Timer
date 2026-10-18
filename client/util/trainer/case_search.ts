/**
 * Case search of the set picker (trainer-sets 5.3).
 *
 * Matches the case name ("Aa perm", "OLL 45", "Sune"), the subset name in both its translated
 * and its raw form ("P şekli" and "P shape") and the category name. Runs on the client over the
 * library that is already loaded.
 *
 * Case folding: `toLowerCase()` plus Turkish letters folded to ASCII (ı→i, ş→s, ğ→g, ü→u, ö→o,
 * ç→c, İ→i) and accents stripped, on both sides. `toLocaleLowerCase('tr')` is NOT used: it turns
 * "I" into "ı", so "OLL" typed in capitals would stop matching ASCII names.
 *
 * Pure: the translate function comes in as a parameter.
 */
import {algSetCaseKey} from '../../../shared/trainer/alg_sets';
import {subsetSearchText} from './subset_label';
import type {AlgorithmSubset} from '../../components/trainer/types';

type Translate = (key: string, options?: any) => string;

/** Results shown at most; the screen asks to narrow the search beyond this. */
export const CASE_SEARCH_LIMIT = 200;

const TURKISH_FOLD: Record<string, string> = {
	ı: 'i',
	İ: 'i',
	ş: 's',
	Ş: 's',
	ğ: 'g',
	Ğ: 'g',
	ü: 'u',
	Ü: 'u',
	ö: 'o',
	Ö: 'o',
	ç: 'c',
	Ç: 'c',
};

/** Lower case, Turkish letters to ASCII, accents stripped, spaces collapsed. */
export function foldSearchText(text: string | null | undefined): string {
	if (!text) return '';
	return text
		.replace(/[ıİşŞğĞüÜöÖçÇ]/g, (c) => TURKISH_FOLD[c] || c)
		.toLowerCase()
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/\s+/g, ' ')
		.trim();
}

export interface CaseIndexEntry {
	/** `category::name` */
	key: string;
	category: string;
	subset: string;
	name: string;
	/** Library main algorithm, as written. */
	algorithm: string;
	/** Position in the library (category order, then subset, then case), for a stable order. */
	order: number;
	nameFolded: string;
	categoryFolded: string;
	/** Name, subset (translated and raw) and category, folded. */
	haystack: string;
}

/**
 * One entry per library case. `categories` limits and orders the categories (the picker's
 * order); without it the library's own order is used.
 */
export function buildCaseIndex(
	library: Record<string, AlgorithmSubset[]> | null | undefined,
	t: Translate,
	categories?: readonly string[]
): CaseIndexEntry[] {
	if (!library) return [];
	const order = categories && categories.length ? categories : Object.keys(library);
	const out: CaseIndexEntry[] = [];
	for (const category of order) {
		const subsets = library[category];
		if (!Array.isArray(subsets)) continue;
		const categoryFolded = foldSearchText(category);
		for (const sub of subsets) {
			const subsetText = foldSearchText(subsetSearchText(t, sub?.subset));
			for (const entry of sub?.algorithms || []) {
				if (!entry?.name) continue;
				const nameFolded = foldSearchText(entry.name);
				out.push({
					key: algSetCaseKey(category, entry.name),
					category,
					subset: sub.subset,
					name: entry.name,
					algorithm: entry.algorithm || '',
					order: out.length,
					nameFolded,
					categoryFolded,
					haystack: [nameFolded, subsetText, categoryFolded].filter(Boolean).join(' '),
				});
			}
		}
	}
	return out;
}

export interface CaseSearchResult {
	results: CaseIndexEntry[];
	/** Every match, also those past the limit. */
	total: number;
}

function rank(entry: CaseIndexEntry, query: string): number {
	if (entry.nameFolded === query) return 0;
	if (entry.nameFolded.startsWith(query)) return 1;
	if (entry.nameFolded.includes(query)) return 2;
	if (entry.categoryFolded === query || entry.categoryFolded.startsWith(query)) return 3;
	return 4;
}

/**
 * Cases matching every word of `query`, best first: exact name, name prefix, name contains,
 * category, then subset only. Ties keep the library order.
 */
export function searchCases(index: readonly CaseIndexEntry[], query: string, limit = CASE_SEARCH_LIMIT): CaseSearchResult {
	const folded = foldSearchText(query);
	const words = folded.split(' ').filter(Boolean);
	if (words.length === 0) return {results: [], total: 0};

	const matches: {entry: CaseIndexEntry; rank: number}[] = [];
	for (const entry of index) {
		if (words.every((w) => entry.haystack.includes(w))) matches.push({entry, rank: rank(entry, folded)});
	}
	matches.sort((a, b) => a.rank - b.rank || a.entry.order - b.entry.order);
	return {results: matches.slice(0, Math.max(0, limit)).map((m) => m.entry), total: matches.length};
}
