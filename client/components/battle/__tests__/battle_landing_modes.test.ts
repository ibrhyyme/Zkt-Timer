import {
	BATTLE_MODES,
	applyLaunchBlocks,
	battleCanonicalPath,
	battleLaunchFromConfig,
	canOpenOnlineBattle,
	isLaunchNoIndexPath,
	isOnlineBattleLaunched,
	pickBattleLandingView,
	ratingLine,
	readSeededBattleLaunch,
	showSearchingCount,
	sitemapLaunchExclusions,
} from '../battle_landing_modes';
import {NAV_LINKS, visibleNavLinks} from '../../layout/nav/nav_links';

import tr from '../../../i18n/locales/tr/translation.json';
import en from '../../../i18n/locales/en/translation.json';
import es from '../../../i18n/locales/es/translation.json';
import ru from '../../../i18n/locales/ru/translation.json';
import zh from '../../../i18n/locales/zh/translation.json';

const LOCALES: Record<string, any> = {tr, en, es, ru, zh};

const off = {leaderboards_enabled: true, online_battle_enabled: false, featureOverrides: []};
const on = {leaderboards_enabled: true, online_battle_enabled: true, featureOverrides: []};

describe('launch decisions', () => {
	it('is launched only with both the flag and the leaderboard page on', () => {
		expect(isOnlineBattleLaunched(on)).toBe(true);
		expect(isOnlineBattleLaunched(off)).toBe(false);
		expect(isOnlineBattleLaunched({...on, leaderboards_enabled: false})).toBe(false);
		expect(isOnlineBattleLaunched(null)).toBe(false);
		// A config cached before the column existed has no field at all.
		expect(isOnlineBattleLaunched({leaderboards_enabled: true})).toBe(false);
	});

	it('opens Online Battle like FeatureGuard: admin, flag, or the access list', () => {
		expect(canOpenOnlineBattle(off, {id: 'u1', admin: true})).toBe(true);
		expect(canOpenOnlineBattle(null, {id: 'u1', admin: true})).toBe(true);
		expect(canOpenOnlineBattle(off, {id: 'u1'})).toBe(false);
		expect(canOpenOnlineBattle(off, null)).toBe(false);
		expect(canOpenOnlineBattle(on, null)).toBe(true);
		const listed = {
			...off,
			featureOverrides: [{feature: 'online_battle_enabled', users: [{id: 'tester'}]}, {feature: 'rooms_enabled', users: [{id: 'u1'}]}],
		};
		expect(canOpenOnlineBattle(listed, {id: 'tester'})).toBe(true);
		// Being listed for another feature does not count.
		expect(canOpenOnlineBattle(listed, {id: 'u1'})).toBe(false);
	});

	it('keeps an admin out of the public launch while letting them play', () => {
		expect(battleLaunchFromConfig(off, {id: 'a', admin: true})).toEqual({launched: false, open: true});
		expect(battleLaunchFromConfig(on, null)).toEqual({launched: true, open: true});
	});

	it('reads back only a well formed seed', () => {
		expect(readSeededBattleLaunch({launched: true, open: false})).toEqual({launched: true, open: false});
		expect(readSeededBattleLaunch(undefined)).toBeNull();
		expect(readSeededBattleLaunch({launched: 'yes', open: true})).toBeNull();
		expect(readSeededBattleLaunch('x')).toBeNull();
	});
});

describe('/battle landing', () => {
	it('draws the offline battle until Online Battle is open to the user', () => {
		expect(pickBattleLandingView({launched: false, open: false}, true)).toBe('offline');
		expect(pickBattleLandingView({launched: false, open: true}, true)).toBe('cards');
		expect(pickBattleLandingView({launched: true, open: true}, false)).toBe('cards');
	});

	it('waits for an unknown config online and falls back to the local battle offline', () => {
		expect(pickBattleLandingView(null, true)).toBe('wait');
		expect(pickBattleLandingView(null, false)).toBe('offline');
	});

	it('shows the rating, the first match line, or nothing', () => {
		expect(ratingLine(false, {rating: 1500, provisional: true, games: 3}, true)).toBeNull();
		expect(ratingLine(true, null, false)).toBeNull();
		expect(ratingLine(true, null, true)).toEqual({kind: 'first_match'});
		expect(ratingLine(true, {rating: 1500, provisional: true, games: 0}, true)).toEqual({kind: 'first_match'});
		expect(ratingLine(true, {rating: 1531.6, provisional: true, games: 2}, true)).toEqual({
			kind: 'rating',
			rating: 1532,
			provisional: true,
		});
	});

	it('hides the searching count at zero and while unknown', () => {
		expect(showSearchingCount(null)).toBe(false);
		expect(showSearchingCount(0)).toBe(false);
		expect(showSearchingCount(4)).toBe(true);
	});

	it('has the two modes in order with distinct links', () => {
		expect(BATTLE_MODES.map((m) => m.id)).toEqual(['online', 'offline']);
		expect(BATTLE_MODES.map((m) => m.link)).toEqual(['/battle/online', '/battle/offline']);
	});
});

describe('menu', () => {
	it('hides the leaderboard entry until launch, including while unknown', () => {
		const names = (launched: boolean | null) => visibleNavLinks(NAV_LINKS, launched).map((l) => l.name);
		expect(names(false)).not.toContain('nav.ranks');
		expect(names(null)).not.toContain('nav.ranks');
		expect(names(true)).toContain('nav.ranks');
		// Nothing else depends on the launch.
		expect(names(true).filter((n) => n !== 'nav.ranks')).toEqual(names(false));
	});

	it('keeps Battle pointing at the landing for every /battle path', () => {
		const battle = NAV_LINKS.find((l) => l.name === 'nav.battle');
		expect(battle?.link).toBe('/battle');
		expect(battle?.match.test('/battle/online')).toBe(true);
		expect(battle?.match.test('/battle/offline')).toBe(true);
	});
});

describe('SEO', () => {
	it('never indexes the live screen and indexes /ranks only after launch', () => {
		expect(isLaunchNoIndexPath('/battle/online', true)).toBe(true);
		expect(isLaunchNoIndexPath('/ranks', false)).toBe(true);
		expect(isLaunchNoIndexPath('/ranks', null)).toBe(true);
		expect(isLaunchNoIndexPath('/ranks', true)).toBe(false);
		expect(isLaunchNoIndexPath('/battle', false)).toBe(false);
		expect(isLaunchNoIndexPath('/battle/offline', false)).toBe(false);
		expect(isLaunchNoIndexPath('/rankings-other', false)).toBe(false);
	});

	it('points /battle/offline at /battle until launch', () => {
		expect(battleCanonicalPath('/battle/offline', false)).toBe('/battle');
		expect(battleCanonicalPath('/battle/offline', null)).toBe('/battle');
		expect(battleCanonicalPath('/battle/offline', true)).toBe('/battle/offline');
		expect(battleCanonicalPath('/timer', false)).toBe('/timer');
	});

	it('keeps launch pages out of the sitemap until launch', () => {
		expect(sitemapLaunchExclusions(false).sort()).toEqual(['/battle/offline', '/battle/online', '/ranks']);
		expect(sitemapLaunchExclusions(true)).toEqual(['/battle/online']);
	});

	it('drops the llms.txt launch block before launch and only its markers after', () => {
		const text = [
			'- [Battle](https://zktimer.app/battle): battle',
			'<!-- launch:online_battle -->',
			'- [Online Battle leaderboard](https://zktimer.app/ranks): ratings',
			'<!-- /launch:online_battle -->',
			'- [Sign Up](https://zktimer.app/signup): sign up',
			'',
		].join('\r\n');
		expect(applyLaunchBlocks(text, false)).toBe(
			'- [Battle](https://zktimer.app/battle): battle\r\n- [Sign Up](https://zktimer.app/signup): sign up\r\n'
		);
		expect(applyLaunchBlocks(text, true)).toBe(
			'- [Battle](https://zktimer.app/battle): battle\r\n- [Online Battle leaderboard](https://zktimer.app/ranks): ratings\r\n- [Sign Up](https://zktimer.app/signup): sign up\r\n'
		);
	});

	it('ships the public llms.txt with a well formed launch block', () => {
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const fs = require('fs');
		// eslint-disable-next-line @typescript-eslint/no-var-requires
		const path = require('path');
		const text: string = fs.readFileSync(path.join(__dirname, '../../../../public/llms.txt'), 'utf8');
		expect(applyLaunchBlocks(text, false)).not.toContain('/ranks');
		expect(applyLaunchBlocks(text, true)).toContain('https://zktimer.app/ranks');
		expect(applyLaunchBlocks(text, true)).not.toContain('launch:online_battle');
	});
});

describe('translations', () => {
	const get = (obj: any, key: string) => key.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
	const STRING_KEYS = [
		...BATTLE_MODES.flatMap((m) => [m.titleKey, m.descKey, m.tagKey, m.ctaKey, ...m.featureKeys]),
		'battle_landing.subtitle',
		'battle_landing.your_rating',
		'battle_landing.first_match',
		'online_battle.internet_required',
		'online_battle.searching_count',
		'online_battle.provisional',
		'nav.battle',
		'nav.ranks',
		'seo.battle_title',
		'seo.battle_description',
		'seo.battle_launch_title',
		'seo.battle_launch_description',
		'seo.battle_online_title',
		'seo.battle_online_description',
		'seo.leaderboards_title',
		'seo.leaderboards_description',
		'seo.leaderboards_keywords',
		'seo.nav_leaderboards_name',
		'seo.nav_leaderboards_desc',
		'help.sections.online-battle.title',
		'welcome_inside.together.battle_online',
	];

	it.each(Object.keys(LOCALES))('%s has every string the landing, menu and SEO read', (lang) => {
		for (const key of STRING_KEYS) {
			const value = get(LOCALES[lang], key);
			expect(typeof value === 'string' && value.trim().length > 0 ? key : `missing ${key}`).toBe(key);
			// No em dash in product copy.
			expect(value).not.toContain('—');
		}
		expect(get(LOCALES[lang], 'battle_landing.your_rating')).toContain('{{rating}}');
		for (const part of ['body', 'steps', 'notes']) {
			const list = get(LOCALES[lang], `help.sections.online-battle.${part}`);
			expect(Array.isArray(list) && list.length).toBe(get(LOCALES.tr, `help.sections.online-battle.${part}`).length);
		}
	});
});
