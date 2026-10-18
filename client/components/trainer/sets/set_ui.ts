/**
 * Pure helpers of the set screens (trainer-sets 7). React free so they are testable in node.
 */
import {ALG_SET_COMMUNITY_SORTS, isAlgSetCommunitySort, type AlgSetCommunitySort} from '../../../../shared/trainer/alg_sets';
import type {BuiltinPuzzleKey} from '../../../../shared/cube_puzzle';
import type {AlgSetItemData} from '../../../lib/alg_sets/types';

/** Category badges on a card: at most `max`, the rest as "+N". */
export function categoryBadges(categories: string[], max = 3): {shown: string[]; more: number} {
	const list = categories.filter(Boolean);
	return {shown: list.slice(0, max), more: Math.max(0, list.length - max)};
}

export interface CategoryGroup {
	category: string;
	items: AlgSetItemData[];
}

/**
 * Rows grouped by category, groups in the order their first row appears in the set, rows in
 * set order inside a group (7.4).
 */
export function groupItemsByCategory(items: AlgSetItemData[]): CategoryGroup[] {
	const sorted = items.slice().sort((a, b) => a.position - b.position);
	const groups: CategoryGroup[] = [];
	const byCategory = new Map<string, CategoryGroup>();
	for (const item of sorted) {
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

/** "8 learned · 5 learning" counts from the device flags (6.6). Status: 0 none, 1 learning, 2 learned. */
export function progressCounts(algIds: string[], statusOf: (algId: string) => number): {learned: number; learning: number} {
	let learned = 0;
	let learning = 0;
	for (const id of algIds) {
		const status = statusOf(id);
		if (status === 2) learned++;
		else if (status === 1) learning++;
	}
	return {learned, learning};
}

/** `/login?redirect=<path>`: Study and Save send a signed out visitor here (2.4). */
export function loginRedirectPath(pathWithQuery: string): string {
	return `/login?redirect=${encodeURIComponent(pathWithQuery || '/trainer')}`;
}

/** Moves one id inside an ordered list (reorder mode). Out of range moves change nothing. */
export function moveId(ids: string[], id: string, delta: number): string[] {
	const from = ids.indexOf(id);
	const to = from + delta;
	if (from < 0 || to < 0 || to >= ids.length) return ids;
	const next = ids.slice();
	next.splice(from, 1);
	next.splice(to, 0, id);
	return next;
}

/** Puts `id` at the place of `targetId` (drag and drop). */
export function moveIdTo(ids: string[], id: string, targetId: string): string[] {
	const from = ids.indexOf(id);
	const to = ids.indexOf(targetId);
	if (from < 0 || to < 0 || from === to) return ids;
	const next = ids.slice();
	next.splice(from, 1);
	next.splice(to, 0, id);
	return next;
}

// ── Community list query (?q, ?sort, ?puzzle; 7.3) ─────────────────────────

/** Puzzle filter dropdown options in the selector's order; labels are puzzle names (not translated). */
export const COMMUNITY_PUZZLES: {key: BuiltinPuzzleKey; label: string}[] = [
	{key: '333', label: '3x3'},
	{key: '222', label: '2x2'},
	{key: '444', label: '4x4'},
	{key: 'pyram', label: 'Pyraminx'},
	{key: 'skewb', label: 'Skewb'},
	{key: 'sq1', label: 'Square-1'},
];

export interface CommunityFilters {
	q: string;
	sort: AlgSetCommunitySort;
	puzzle: BuiltinPuzzleKey | null;
}

export function parseCommunitySearch(search: string | null | undefined): CommunityFilters {
	const params = new URLSearchParams(search || '');
	const sort = params.get('sort');
	const puzzle = params.get('puzzle');
	return {
		q: (params.get('q') || '').slice(0, 60),
		sort: isAlgSetCommunitySort(sort) ? sort : ALG_SET_COMMUNITY_SORTS[0],
		puzzle: COMMUNITY_PUZZLES.some((p) => p.key === puzzle) ? (puzzle as BuiltinPuzzleKey) : null,
	};
}

/** Query string for the filters; defaults are left out so the plain list keeps a clean address. */
export function buildCommunitySearch(filters: CommunityFilters): string {
	const params = new URLSearchParams();
	const q = filters.q.trim();
	if (q) params.set('q', q);
	if (filters.sort !== ALG_SET_COMMUNITY_SORTS[0]) params.set('sort', filters.sort);
	if (filters.puzzle) params.set('puzzle', filters.puzzle);
	const qs = params.toString();
	return qs ? `?${qs}` : '';
}

/** Appends a page, skipping sets already listed (popular order can shift between pages, 4.6). */
export function mergeById<T extends {id: string}>(current: T[], next: T[]): T[] {
	const seen = new Set(current.map((x) => x.id));
	const out = current.slice();
	for (const x of next) {
		if (seen.has(x.id)) continue;
		seen.add(x.id);
		out.push(x);
	}
	return out;
}
