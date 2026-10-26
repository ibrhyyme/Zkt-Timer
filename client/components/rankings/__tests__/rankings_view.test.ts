import * as fs from 'fs';
import * as path from 'path';
import {
	SEARCH_MAX_LENGTH,
	appendLeaderboardRows,
	hasMoreRows,
	normalizeSearch,
	pickRankingsView,
	winRatePercent,
} from '../rankings_view';

describe('pickRankingsView', () => {
	it('keeps the empty state until Online Battle is open to the viewer', () => {
		expect(pickRankingsView(null)).toBe('empty');
		expect(pickRankingsView({launched: false, open: false})).toBe('empty');
	});

	it('shows the board to admins and the access list before launch, and to everyone after', () => {
		expect(pickRankingsView({launched: false, open: true})).toBe('board');
		expect(pickRankingsView({launched: true, open: true})).toBe('board');
	});
});

describe('winRatePercent', () => {
	it('rounds wins over matches to a whole percent', () => {
		expect(winRatePercent(7, 12)).toBe(58);
		expect(winRatePercent(0, 3)).toBe(0);
		expect(winRatePercent(5, 5)).toBe(100);
	});

	it('has no value without matches and never leaves 0..100', () => {
		expect(winRatePercent(0, 0)).toBeNull();
		expect(winRatePercent(null, undefined)).toBeNull();
		expect(winRatePercent(9, 4)).toBe(100);
		expect(winRatePercent(-2, 4)).toBe(0);
	});
});

describe('normalizeSearch', () => {
	it('trims and caps the term like the server does', () => {
		expect(normalizeSearch('  mert ')).toBe('mert');
		expect(normalizeSearch(null)).toBe('');
		expect(normalizeSearch('x'.repeat(80))).toHaveLength(SEARCH_MAX_LENGTH);
	});
});

describe('appendLeaderboardRows', () => {
	it('appends the next page without showing a shifted player twice', () => {
		const prev = [{user_id: 'a'}, {user_id: 'b'}];
		const next = [{user_id: 'b'}, {user_id: 'c'}];
		expect(appendLeaderboardRows(prev, next).map((r) => r.user_id)).toEqual(['a', 'b', 'c']);
		expect(prev).toHaveLength(2);
	});
});

describe('hasMoreRows', () => {
	it('compares loaded pages with the total', () => {
		expect(hasMoreRows(1, 50, 50)).toBe(false);
		expect(hasMoreRows(1, 50, 51)).toBe(true);
		expect(hasMoreRows(2, 50, 51)).toBe(false);
		expect(hasMoreRows(0, 0, 10)).toBe(false);
	});
});

describe('ranks translations', () => {
	const LANGS = ['tr', 'en', 'es', 'ru', 'zh'];
	const LOCALES_DIR = path.join(__dirname, '../../../i18n/locales');
	const SOURCES = [
		path.join(__dirname, '../Rankings.tsx'),
		path.join(__dirname, '../../profile/battle_rating/BattlePlayerModal.tsx'),
	];

	function load(lang: string): any {
		return JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, lang, 'translation.json'), 'utf8'));
	}

	const used = new Set<string>();
	for (const file of SOURCES) {
		const src = fs.readFileSync(file, 'utf8');
		for (const m of src.matchAll(/t\('ranks\.([a-z_]+)'/g)) used.add(m[1]);
	}

	function placeholders(s: string): string[] {
		return (s.match(/\{\{\w+\}\}/g) || []).sort();
	}

	it('finds the keys the page uses', () => {
		expect(used.size).toBeGreaterThan(10);
	});

	it.each(LANGS)('%s has every key, the same placeholders as tr, and no em dash', (lang) => {
		const tr = load('tr').ranks;
		const ranks = load(lang).ranks;
		for (const key of used) {
			// Plural keys resolve through the language's own suffixes; "other" always exists.
			const value = ranks[key] ?? ranks[`${key}_other`];
			expect(typeof value).toBe('string');
			const trValue = tr[key] ?? tr[`${key}_other`];
			expect(placeholders(value)).toEqual(placeholders(trValue));
		}
		for (const value of Object.values(ranks)) {
			expect(String(value)).not.toMatch(/—/);
		}
	});
});
