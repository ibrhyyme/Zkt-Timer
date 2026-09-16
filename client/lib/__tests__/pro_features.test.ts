import * as fs from 'fs';
import * as path from 'path';
import {PRO_FEATURES, PRO_FEATURE_KEYS} from '../pro_features';

const LOCALES = ['tr', 'en', 'es', 'ru', 'zh'];

// Read the JSON off disk instead of importing it. A resolveJsonModule import would
// give tsc a ~4600-line literal type for every locale, for no benefit here.
function loadLocale(lang: string): any {
	const file = path.join(__dirname, '..', '..', 'i18n', 'locales', lang, 'translation.json');
	return JSON.parse(fs.readFileSync(file, 'utf8'));
}

const locales: Record<string, any> = {};
for (const lang of LOCALES) {
	locales[lang] = loadLocale(lang);
}

describe('pro feature registry', () => {
	it('has unique keys', () => {
		expect(new Set(PRO_FEATURE_KEYS).size).toBe(PRO_FEATURE_KEYS.length);
	});

	it('gives every feature an icon', () => {
		for (const feature of PRO_FEATURES) {
			expect(feature.icon).toBeTruthy();
		}
	});

	it('derives both i18n keys from the feature key', () => {
		for (const feature of PRO_FEATURES) {
			expect(feature.titleKey).toBe(`pro_page.features.${feature.key}.title`);
			expect(feature.descKey).toBe(`pro_page.features.${feature.key}.desc`);
		}
	});
});

describe('pro feature translations', () => {
	for (const lang of LOCALES) {
		it(`${lang}: every listed feature has a title and a description`, () => {
			const features = locales[lang].pro_page.features;
			for (const feature of PRO_FEATURES) {
				const entry = features[feature.key];
				expect(entry).toBeDefined();
				expect(typeof entry.title).toBe('string');
				expect(entry.title.trim().length).toBeGreaterThan(0);
				expect(typeof entry.desc).toBe('string');
				expect(entry.desc.trim().length).toBeGreaterThan(0);
			}
		});

		// The page must advertise exactly what the registry lists: a leftover key here is
		// how the old lists drifted into promising features nothing gates.
		it(`${lang}: has no feature strings the registry does not list`, () => {
			const keys = Object.keys(locales[lang].pro_page.features).sort();
			expect(keys).toEqual([...PRO_FEATURE_KEYS].sort());
		});
	}

	it('all five languages describe the same feature set', () => {
		const reference = Object.keys(locales.tr.pro_page.features).sort();
		for (const lang of LOCALES) {
			expect(Object.keys(locales[lang].pro_page.features).sort()).toEqual(reference);
		}
	});
});

describe('pro upsell modal naming', () => {
	// Record alerts were `record_alerts` on the Pro page and `competition_watch` on the
	// upsell modal. One name now, so the modal copy is reachable from the registry key.
	it('uses the registry key for the record alert upsell', () => {
		for (const lang of LOCALES) {
			const modal = locales[lang].pro.modal;
			expect(modal.record_alerts).toBeDefined();
			expect(modal.record_alerts.title.trim().length).toBeGreaterThan(0);
			expect(modal.record_alerts.desc.trim().length).toBeGreaterThan(0);
			expect(modal.competition_watch).toBeUndefined();
		}
	});

	// Dropped features must not keep an upsell modal or highlight bullet alive: the modal
	// falls back to a default title, so an orphan entry is invisible until someone reads it.
	it('keeps no upsell copy for features that were removed', () => {
		for (const lang of LOCALES) {
			expect(locales[lang].pro.modal.data_import).toBeUndefined();
			const highlights = locales[lang].pro.highlights;
			for (const key of ['advanced_stats', 'import_history', 'import_sources', 'import_one_click']) {
				expect(highlights[key]).toBeUndefined();
			}
		}
	});

	it('still has the highlight bullets the modal falls back to', () => {
		for (const lang of LOCALES) {
			const highlights = locales[lang].pro.highlights;
			// ProOnlyModal DEFAULT_HIGHLIGHTS
			for (const key of ['sync', 'themes', 'stats_customize']) {
				expect(typeof highlights[key]).toBe('string');
				expect(highlights[key].trim().length).toBeGreaterThan(0);
			}
		}
	});
});
