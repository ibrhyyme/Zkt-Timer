import * as fs from 'fs';
import * as path from 'path';
import {
	KNOWN_BATTLE_FLAGS,
	KNOWN_END_REASONS,
	cleanFlags,
	endReasonLabel,
	flagLabel,
	formatRatingDelta,
	normalizeMatchId,
	parseMoveLog,
	voidMessage,
} from '../admin_battle_matches';

const t = (key: string) => `T(${key})`;

describe('flag and end reason labels', () => {
	test('known flags translate, unknown ones show the raw code', () => {
		expect(flagLabel('same_ip', t)).toBe('T(admin_online_battle.flags.same_ip)');
		expect(flagLabel('brand_new_flag', t)).toBe('brand_new_flag');
	});

	test('end reasons', () => {
		expect(endReasonLabel('FORFEIT', t)).toBe('T(admin_online_battle.end_reason.FORFEIT)');
		expect(endReasonLabel('WHATEVER', t)).toBe('WHATEVER');
		expect(endReasonLabel(null, t)).toBe('');
	});

	test('the flag list covers every BattleFlag in shared/battle/types.ts and the void flag', () => {
		const src = fs.readFileSync(path.join(__dirname, '../../../../../shared/battle/types.ts'), 'utf8');
		const block = src.slice(src.indexOf('export type BattleFlag'), src.indexOf('export type BattleDnfReason'));
		const declared = Array.from(block.matchAll(/\|\s*'([a-z_]+)'/g)).map((m) => m[1]);
		expect(declared.length).toBeGreaterThan(5);
		for (const flag of declared) expect(KNOWN_BATTLE_FLAGS).toContain(flag);
		const model = fs.readFileSync(path.join(__dirname, '../../../../../server/models/battle.ts'), 'utf8');
		const voidFlag = /VOID_RATING_KEPT_FLAG = '([a-z_]+)'/.exec(model)?.[1];
		expect(KNOWN_BATTLE_FLAGS).toContain(voidFlag);
	});
});

describe('cleanFlags', () => {
	test('drops nulls and duplicates, keeps order', () => {
		expect(cleanFlags(['a', null, 'b', 'a', undefined, ''])).toEqual(['a', 'b']);
		expect(cleanFlags(null)).toEqual([]);
	});
});

describe('formatRatingDelta', () => {
	test('signs and rounding', () => {
		expect(formatRatingDelta(1500, 1512)).toBe('+12');
		expect(formatRatingDelta(1500, 1492)).toBe('-8');
		expect(formatRatingDelta(1500, 1500)).toBe('0');
		expect(formatRatingDelta(null, 1500)).toBeNull();
	});
});

describe('parseMoveLog', () => {
	test('counts missing cube stamps and the cube clock span', () => {
		const log = parseMoveLog(
			JSON.stringify([
				{t: 'R', c: 1000, l: 5},
				{t: 'U', c: null, l: 6},
				{t: "R'", c: 1800, l: null},
			])
		);
		expect(log?.moves.map((m) => m.t)).toEqual(['R', 'U', "R'"]);
		expect(log?.missingCubeTs).toBe(1);
		expect(log?.cubeSpanMs).toBe(800);
	});

	test('bad input gives null, junk items are skipped', () => {
		expect(parseMoveLog(null)).toBeNull();
		expect(parseMoveLog('not json')).toBeNull();
		expect(parseMoveLog('{"t":"R"}')).toBeNull();
		const log = parseMoveLog(JSON.stringify([null, {c: 1}, {t: 'F', c: 'x'}]));
		expect(log?.moves).toEqual([{t: 'F', c: null, l: null}]);
		expect(log?.cubeSpanMs).toBeNull();
	});
});

describe('voidMessage', () => {
	const match = {rated: true, player_a: {id: 'a', username: 'ali'}, player_b: {id: 'b', username: 'bea'}};

	test('already void', () => {
		expect(voidMessage({changed: false}, match).key).toBe('admin_online_battle.void_already');
	});

	test('unrated match is only marked', () => {
		expect(voidMessage({changed: true}, {...match, rated: false}).key).toBe('admin_online_battle.void_done');
	});

	test('both reverted', () => {
		expect(voidMessage({changed: true, reverted_a: true, reverted_b: true}, match).key).toBe(
			'admin_online_battle.void_done_reverted'
		);
	});

	test('names the players who kept their rating; a deleted account is not listed', () => {
		expect(voidMessage({changed: true, reverted_a: false, reverted_b: true}, match)).toEqual({
			key: 'admin_online_battle.void_done_kept',
			names: 'ali',
		});
		expect(voidMessage({changed: true, reverted_a: true, reverted_b: false}, {...match, player_b: null}).key).toBe(
			'admin_online_battle.void_done_reverted'
		);
	});
});

describe('normalizeMatchId', () => {
	test('plain id, pasted URL, query and hash', () => {
		expect(normalizeMatchId('  abc-123  ')).toBe('abc-123');
		expect(normalizeMatchId('https://zktimer.app/admin/online-battle/abc-123?x=1#y')).toBe('abc-123');
		expect(normalizeMatchId('')).toBe('');
		expect(normalizeMatchId('   ')).toBe('');
	});
});

describe('translations', () => {
	const langs = ['tr', 'en', 'es', 'ru', 'zh'];
	const usedKeys = [
		'title', 'flag_on', 'flag_off', 'flag_unknown', 'flag_link', 'lookup_placeholder', 'lookup_button',
		'flagged_title', 'flagged_hint', 'empty', 'load_failed', 'not_found', 'previous', 'next', 'page',
		'detail_title', 'close', 'deleted_account', 'rated', 'unrated', 'rematch', 'status_void', 'draw', 'started',
		'ended', 'voided', 'match_id', 'match_flags', 'rounds', 'no_rounds', 'round', 'cube_span', 'show_moves',
		'hide_moves', 'no_moves', 'void_button', 'void_confirm_title', 'void_confirm_description', 'void_done',
		'void_done_reverted', 'void_done_kept', 'void_already', 'void_failed',
	];
	const pluralKeys = ['total_count', 'move_count', 'missing_cube_ts'];

	test.each(langs)('%s has every key the page uses, without em dash', (lang) => {
		const file = path.join(__dirname, '../../../../i18n/locales', lang, 'translation.json');
		const json = JSON.parse(fs.readFileSync(file, 'utf8'));
		const page = json.admin_online_battle;
		for (const key of usedKeys) expect(typeof page[key]).toBe('string');
		for (const key of pluralKeys) expect(typeof page[`${key}_other`]).toBe('string');
		for (const flag of KNOWN_BATTLE_FLAGS) expect(typeof page.flags[flag]).toBe('string');
		for (const reason of KNOWN_END_REASONS) expect(typeof page.end_reason[reason]).toBe('string');
		expect(typeof json.admin_nav.online_battle).toBe('string');
		for (const key of ['online_battle_enabled', 'online_battle_enabled_desc', 'online_battle_enable_confirm']) {
			expect(typeof json.site_config[key]).toBe('string');
		}
		const mine = JSON.stringify([page, json.site_config.online_battle_enabled_desc, json.site_config.online_battle_enable_confirm]);
		expect(mine).not.toMatch(/—/);
	});
});
