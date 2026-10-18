import {isHiddenSubset, subsetLabel, subsetSearchText, subsetSlug, subsetTranslationKey} from '../subset_label';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const library: Record<string, Array<{subset: string}>> = require('../../../../public/trainer/default-algs.json');

// Minimal i18next stand in: known keys translate (with {{n}}), unknown keys return defaultValue.
function makeT(dict: Record<string, string>) {
	return (key: string, options?: any): string => {
		const template = dict[key];
		if (template === undefined) return options && options.defaultValue !== undefined ? options.defaultValue : key;
		return template.replace(/\{\{(\w+)\}\}/g, (_, name) => String(options ? options[name] : ''));
	};
}

const t = makeT({
	'trainer.subset_names.adj_corners': 'Komşu köşe değişimi',
	'trainer.subset_names.p_shape': 'P şekli',
	'trainer.subset_names.2_adj_2': '2 komşu / 2',
	'trainer.subset_case_n': 'Vaka {{n}}',
	'trainer.subset_slash_n': '{{n}} slash',
});

function librarySubsets(): string[] {
	const out = new Set<string>();
	for (const groups of Object.values(library)) for (const g of groups) out.add(g.subset);
	return Array.from(out);
}

describe('subsetSlug', () => {
	it('builds stable translation keys', () => {
		expect(subsetSlug('Adj corners')).toBe('adj_corners');
		expect(subsetSlug('2 Adj / 2')).toBe('2_adj_2');
		expect(subsetSlug('1 / 1')).toBe('1_1');
		expect(subsetSlug('3-mover')).toBe('3_mover');
		expect(subsetSlug('Pi + U Perm')).toBe('pi_u_perm');
		expect(subsetTranslationKey('Edge perm')).toBe('trainer.subset_names.edge_perm');
	});

	it('gives every distinct library subset its own slug', () => {
		const bySlug = new Map<string, string>();
		for (const subset of librarySubsets()) {
			const slug = subsetSlug(subset);
			expect({subset, empty: slug === ''}).toEqual({subset, empty: false});
			const previous = bySlug.get(slug);
			expect({slug, other: previous === undefined || previous === subset}).toEqual({slug, other: true});
			bySlug.set(slug, subset);
		}
	});
});

describe('subsetLabel', () => {
	it('translates a known subset', () => {
		expect(subsetLabel(t, 'Adj corners')).toBe('Komşu köşe değişimi');
		expect(subsetLabel(t, '2 Adj / 2')).toBe('2 komşu / 2');
	});

	it('falls back to the raw name without a translation', () => {
		expect(subsetLabel(t, 'Sune')).toBe('Sune');
		expect(subsetLabel(t, 'OLL 21')).toBe('OLL 21');
		expect(subsetLabel(t, 'Pi to Vertical U Perm')).toBe('Pi to Vertical U Perm');
	});

	it('uses one numbered key for ZBLS cases and Square-1 slashes', () => {
		expect(subsetLabel(t, 'Case 12')).toBe('Vaka 12');
		expect(subsetLabel(t, '1 Slash')).toBe('1 slash');
		expect(subsetLabel(t, '7 Slashes')).toBe('7 slash');
	});

	it('falls back to the raw numbered name when the numbered key is missing', () => {
		const bare = makeT({});
		expect(subsetLabel(bare, 'Case 3')).toBe('Case 3');
		expect(subsetLabel(bare, '2 Slashes')).toBe('2 Slashes');
	});

	it('hides the single group subset', () => {
		expect(isHiddenSubset('Default')).toBe(true);
		expect(subsetLabel(t, 'Default')).toBe('');
		expect(subsetLabel(t, '')).toBe('');
		expect(subsetLabel(t, null)).toBe('');
	});

	it('never returns an empty label for a shown library subset', () => {
		const bare = makeT({});
		for (const subset of librarySubsets()) {
			if (isHiddenSubset(subset)) continue;
			expect(subsetLabel(bare, subset)).toBe(subset);
		}
	});
});

describe('subsetSearchText', () => {
	it('carries both the translated and the raw name', () => {
		const text = subsetSearchText(t, 'P shape');
		expect(text).toContain('P şekli');
		expect(text).toContain('P shape');
	});

	it('does not repeat an untranslated name', () => {
		expect(subsetSearchText(t, 'Sune')).toBe('Sune');
	});

	it('is empty for the hidden subset', () => {
		expect(subsetSearchText(t, 'Default')).toBe('');
	});
});
