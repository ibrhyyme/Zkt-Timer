// Which "new feature" tip shows, and when it stays quiet.

import fs from 'fs';
import path from 'path';
import {
	FeatureTip,
	FEATURE_TIPS,
	FEATURE_TIP_LIFETIME_DAYS,
	FEATURE_TIP_MAX_VIEWS,
	emptyFeatureTipState,
	isFeatureTipLive,
	parseFeatureTipState,
	pickFeatureTip,
} from '../feature_tips';

const DAY = 24 * 60 * 60 * 1000;
const tip = (id: string, releasedAt = '2026-11-03'): FeatureTip => ({
	id,
	releasedAt,
	titleKey: `feature_tips.${id}_title`,
	textKey: `feature_tips.${id}`,
	to: '/x',
});
const release = Date.parse('2026-11-03T00:00:00Z');

describe('isFeatureTipLive', () => {
	it('is live from the release day for the lifetime, not before or after', () => {
		const t = tip('a');
		expect(isFeatureTipLive(t, release - 1)).toBe(false);
		expect(isFeatureTipLive(t, release)).toBe(true);
		expect(isFeatureTipLive(t, release + (FEATURE_TIP_LIFETIME_DAYS - 1) * DAY)).toBe(true);
		expect(isFeatureTipLive(t, release + FEATURE_TIP_LIFETIME_DAYS * DAY)).toBe(false);
	});

	it('is never live with an unreadable date', () => {
		expect(isFeatureTipLive(tip('a', 'soon'), release)).toBe(false);
	});
});

describe('pickFeatureTip', () => {
	const now = release + DAY;

	it('picks the first live tip nobody answered', () => {
		expect(pickFeatureTip([tip('a'), tip('b')], emptyFeatureTipState(), now)?.id).toBe('a');
	});

	it('skips a tip that was answered', () => {
		const state = { seen: ['a'], views: {} };
		expect(pickFeatureTip([tip('a'), tip('b')], state, now)?.id).toBe('b');
	});

	it('stops after the most views without an answer', () => {
		const state = { seen: [], views: { a: FEATURE_TIP_MAX_VIEWS } };
		expect(pickFeatureTip([tip('a')], state, now)).toBeNull();
		const once = { seen: [], views: { a: FEATURE_TIP_MAX_VIEWS - 1 } };
		expect(pickFeatureTip([tip('a')], once, now)?.id).toBe('a');
	});

	it('stays quiet for someone already using the feature', () => {
		expect(pickFeatureTip([tip('a')], emptyFeatureTipState(), now, () => false)).toBeNull();
	});

	it('stays quiet once the tip has expired', () => {
		expect(pickFeatureTip([tip('a')], emptyFeatureTipState(), release + 90 * DAY)).toBeNull();
	});
});

describe('parseFeatureTipState', () => {
	it('reads what it wrote', () => {
		const state = { seen: ['a'], views: { a: 2 } };
		expect(parseFeatureTipState(JSON.stringify(state))).toEqual(state);
	});

	it('starts over on anything unreadable', () => {
		expect(parseFeatureTipState(null)).toEqual(emptyFeatureTipState());
		expect(parseFeatureTipState('{nope')).toEqual(emptyFeatureTipState());
		expect(parseFeatureTipState(JSON.stringify({ seen: [1, 'a'], views: { a: 'x', b: 1 } }))).toEqual({
			seen: ['a'],
			views: { b: 1 },
		});
	});
});

describe('registered tips', () => {
	it('have unique ids and readable release days', () => {
		expect(new Set(FEATURE_TIPS.map((t) => t.id)).size).toBe(FEATURE_TIPS.length);
		for (const t of FEATURE_TIPS) expect(Number.isFinite(Date.parse(`${t.releasedAt}T00:00:00Z`))).toBe(true);
	});

	it.each(['tr', 'en', 'es', 'ru', 'zh'])('have their sentence and buttons in %s', (lang) => {
		const file = path.join(__dirname, '../../../i18n/locales', lang, 'translation.json');
		const json = JSON.parse(fs.readFileSync(file, 'utf8'));
		const read = (key: string) => key.split('.').reduce((o: any, k) => o?.[k], json);
		const tipKeys = FEATURE_TIPS.flatMap((t) => [t.titleKey, t.textKey]);
		for (const key of ['feature_tips.new', 'feature_tips.look', ...tipKeys]) {
			expect(typeof read(key)).toBe('string');
			expect(read(key).trim()).not.toBe('');
		}
		expect(typeof json.appearance.preset_bg_own).toBe('string');
	});
});
