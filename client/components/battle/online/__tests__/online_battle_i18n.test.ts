/**
 * Every Online Battle string exists in all five languages with the same placeholders:
 * the keys written in the screens, the ones built at runtime (cancel and DNF reasons) and
 * the error keys the server sends in battle:error.
 */
import * as fs from 'fs';
import * as path from 'path';
import {BATTLE_ERROR_KEYS} from '../../../../../shared/battle/events';

const LANGS = ['tr', 'en', 'es', 'ru', 'zh'];
const LOCALES_DIR = path.join(__dirname, '../../../../i18n/locales');
// The battle screens, and the profile's battle card and modals.
const SOURCE_DIRS = [path.join(__dirname, '..'), path.join(__dirname, '../../../profile/battle_rating')];

const CANCEL_REASONS = ['left_before_start', 'server_restart', 'both_disconnected', 'not_found'];
const DNF_REASONS = [
	'client',
	'inspection',
	'cutoff',
	'replay_not_solved',
	'no_cube_clock',
	'wallclock',
	'scramble_timeout',
	'timeout',
	'disconnect',
];

function load(lang: string): any {
	return JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, lang, 'translation.json'), 'utf8'));
}

function lookup(obj: any, key: string): unknown {
	return key.split('.').reduce((o, k) => (o && typeof o === 'object' ? o[k] : undefined), obj);
}

function flatten(obj: any, prefix = ''): Record<string, string> {
	const out: Record<string, string> = {};
	for (const [k, v] of Object.entries(obj || {})) {
		if (v && typeof v === 'object') Object.assign(out, flatten(v, `${prefix}${k}.`));
		else out[`${prefix}${k}`] = String(v);
	}
	return out;
}

function sourceKeys(): string[] {
	const keys = new Set<string>();
	for (const dir of SOURCE_DIRS) {
		for (const file of fs.readdirSync(dir)) {
			if (!/\.(ts|tsx)$/.test(file)) continue;
			const text = fs.readFileSync(path.join(dir, file), 'utf8');
			for (const m of text.matchAll(/['"`](online_battle\.[a-z0-9_.]+[a-z0-9_])['"`]/g)) keys.add(m[1]);
		}
	}
	return [...keys];
}

const placeholders = (s: string) => (s.match(/\{\{\s*\w+\s*\}\}/g) || []).map((p) => p.replace(/\s/g, '')).sort();

describe('online_battle translations', () => {
	const locales = Object.fromEntries(LANGS.map((l) => [l, load(l)]));
	const required = [
		...sourceKeys(),
		...CANCEL_REASONS.map((r) => `online_battle.cancelled.${r}`),
		...DNF_REASONS.map((r) => `online_battle.dnf_reason.${r}`),
		...Object.values(BATTLE_ERROR_KEYS),
		'online_battle.internet_required',
	];

	it('finds the keys in the screens', () => {
		expect(required.length).toBeGreaterThan(60);
	});

	it.each(LANGS)('%s has every key as a non-empty string', (lang) => {
		const missing = required.filter((key) => {
			const v = lookup(locales[lang], key);
			return typeof v !== 'string' || !v.trim();
		});
		expect(missing).toEqual([]);
	});

	it.each(LANGS.filter((l) => l !== 'tr'))('%s has the same keys and placeholders as tr', (lang) => {
		const tr = flatten(locales.tr.online_battle);
		const other = flatten(locales[lang].online_battle);
		expect(Object.keys(other).sort()).toEqual(Object.keys(tr).sort());
		for (const key of Object.keys(tr)) {
			expect([key, placeholders(other[key])]).toEqual([key, placeholders(tr[key])]);
		}
	});

	it('uses no em dash', () => {
		for (const lang of LANGS) {
			const values = Object.values(flatten(locales[lang].online_battle));
			expect(values.filter((v) => v.includes('—'))).toEqual([]);
		}
	});
});
