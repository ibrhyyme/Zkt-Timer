import { PUZZLE_KEYS } from '../../../../shared/cube_puzzle';
import { CUBE_TYPES } from '../../../util/cubes/cube_types';
import { intlLocale } from '../../../util/locale_format';
import type { LocalCube } from '../../../lib/cubes/active_cube';

/**
 * Pure helpers of the My Cubes pages (design .feedback/designs/magnet-cubes.md 5.1 to 5.3).
 * No React, no i18n, no storage: unit tested in __tests__/cube_labels.test.ts.
 */

/** A section gets a search box and a sort picker above this many cubes (S-3, "15 tane 3x3"). */
export const SECTION_SEARCH_THRESHOLD = 6;

/** Brand suggestions of the form (free text, the list only saves typing). */
export const BRAND_SUGGESTIONS = ['GAN', 'MoYu', 'QiYi', 'YJ', 'X-Man', 'DaYan', 'Giiker', 'Diansheng', 'ShengShou'];

/** Same limits as server/util/cube_validation.ts (CUBE_NAME_MAX, CUBE_BRAND_MAX). */
export const CUBE_NAME_MAX = 40;
export const CUBE_BRAND_MAX = 30;

export interface CustomPuzzle {
	id: string;
	name: string;
}

/** Display name of a puzzle key: the timer's cube type name, or the custom type's name. */
export function puzzleLabel(puzzle: string, customTypes: ReadonlyArray<CustomPuzzle> = []): string {
	const builtin = CUBE_TYPES[puzzle];
	if (builtin && (PUZZLE_KEYS as readonly string[]).includes(puzzle)) return builtin.name;
	const custom = customTypes.find((ct) => ct.id === puzzle);
	return custom?.name || builtin?.name || puzzle;
}

/**
 * Page order of puzzle sections: PUZZLE_KEYS order, then custom types by name (5.1). A key that
 * is neither (a custom type deleted since) goes last under its raw id, still reachable.
 */
export function orderPuzzles(keys: ReadonlyArray<string>, customTypes: ReadonlyArray<CustomPuzzle> = []): string[] {
	const builtin = PUZZLE_KEYS as readonly string[];
	const rank = (key: string) => {
		const index = builtin.indexOf(key);
		return index >= 0 ? index : builtin.length;
	};
	return [...new Set(keys)].sort((a, b) => {
		const byRank = rank(a) - rank(b);
		if (byRank) return byRank;
		return puzzleLabel(a, customTypes).localeCompare(puzzleLabel(b, customTypes), undefined, { sensitivity: 'base', numeric: true });
	});
}

/** The form's puzzle list (5.2): every physical puzzle plus the person's custom types. No WCA, no subsets. */
export function formPuzzleOptions(customTypes: ReadonlyArray<CustomPuzzle> = []): { id: string; label: string }[] {
	const builtin = PUZZLE_KEYS.map((key) => ({ id: key as string, label: puzzleLabel(key) }));
	const custom = [...customTypes]
		.filter((ct) => ct && ct.id && !(PUZZLE_KEYS as readonly string[]).includes(ct.id))
		.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true }))
		.map((ct) => ({ id: ct.id, label: ct.name }));
	return [...builtin, ...custom];
}

/** Lower-cased, accent-free text for search (Turkish dotted/dotless i folded too). */
function fold(text: string): string {
	return text
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '')
		.replace(/ı/g, 'i')
		.replace(/İ/g, 'i')
		.toLowerCase();
}

/** Cubes whose name or brand contains every word of the query. Empty query keeps all. */
export function filterCubes<T extends Pick<LocalCube, 'name' | 'brand'>>(cubes: ReadonlyArray<T>, query: string): T[] {
	const words = fold(query || '').split(/\s+/).filter(Boolean);
	if (!words.length) return [...cubes];
	return cubes.filter((cube) => {
		const haystack = fold(`${cube.name} ${cube.brand || ''}`);
		return words.every((word) => haystack.includes(word));
	});
}

export type AddFrom = 'magnet' | null;

export interface AddLinkParams {
	puzzle?: string | null;
	from?: AddFrom;
}

/**
 * Where to send someone who should add a cube: My Cubes with the form open (5.2). The Magnet
 * Timer guide (T10) passes the puzzle and `from: 'magnet'`, so saving goes back to the timer.
 */
export function cubeAddLink(params: AddLinkParams = {}): string {
	const query = new URLSearchParams({ add: '1' });
	if (params.puzzle) query.set('puzzle', params.puzzle);
	if (params.from) query.set('from', params.from);
	return `/settings/cubes?${query.toString()}`;
}

/** Reads cubeAddLink's parameters back. `open` false: the page opened normally. */
export function parseAddLink(search: string | null | undefined): { open: boolean; puzzle: string | null; from: AddFrom } {
	const query = new URLSearchParams(search || '');
	return {
		open: query.get('add') === '1',
		puzzle: query.get('puzzle') || null,
		from: query.get('from') === 'magnet' ? 'magnet' : null,
	};
}

/** The profile address of a cube. */
export function cubeProfileLink(cubeId: string): string {
	return `/settings/cubes/${encodeURIComponent(cubeId)}`;
}

/** Whole calendar days from `then` to `now` in local time (0 = the same day). */
export function calendarDaysAgo(then: number, now: number): number {
	const a = new Date(then);
	const b = new Date(now);
	const startA = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime();
	const startB = new Date(b.getFullYear(), b.getMonth(), b.getDate()).getTime();
	return Math.round((startB - startA) / 86_400_000);
}

/** "12 Mart 2026" (tr), "March 12, 2026" (en). */
export function formatLongDay(ms: number, language: string | null | undefined): string {
	const d = new Date(ms);
	if (Number.isNaN(d.getTime())) return '';
	return new Intl.DateTimeFormat(intlLocale(language), { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
}

/** "5 Eki 2026" (tr), "Oct 5, 2026" (en): calibration dates in the profile. */
export function formatShortDay(ms: number, language: string | null | undefined): string {
	const d = new Date(ms);
	if (Number.isNaN(d.getTime())) return '';
	return new Intl.DateTimeFormat(intlLocale(language), { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
}

/**
 * Last use in words: "bugün", "dün", "3 gün önce" for the last month, a date before that.
 * Intl does the wording and the plural rules of every language. A time in the future (clock
 * skew between devices) reads as today.
 */
export function formatLastUsed(ms: number | null | undefined, language: string | null | undefined, now: number = Date.now()): string {
	if (ms === null || ms === undefined || !Number.isFinite(ms)) return '';
	const days = Math.max(0, calendarDaysAgo(ms, now));
	if (days <= 30 && typeof Intl !== 'undefined' && typeof (Intl as any).RelativeTimeFormat === 'function') {
		return new (Intl as any).RelativeTimeFormat(intlLocale(language), { numeric: 'auto' }).format(-days, 'day');
	}
	return formatShortDay(ms, language);
}
