import {readFileSync} from 'fs';
import {join} from 'path';
import {SUPPORTED_LANGUAGES} from '../../../shared/i18n_language';

const html = readFileSync(join(__dirname, '..', 'not_found.html'), 'utf8');

// The file carries its own strings because it is sent without server rendering.
function languageTable(): Record<string, Record<string, string>> {
	const match = html.match(/var TEXT = (\{.*\});/);
	if (!match) throw new Error('language table not found in not_found.html');
	return JSON.parse(match[1]);
}

describe('not_found.html', () => {
	it('has every language the app ships, with the same non-empty keys', () => {
		const table = languageTable();
		expect(Object.keys(table).sort()).toEqual([...SUPPORTED_LANGUAGES].sort());

		const keys = Object.keys(table.tr).sort();
		for (const language of SUPPORTED_LANGUAGES) {
			expect(Object.keys(table[language]).sort()).toEqual(keys);
			for (const key of keys) expect(table[language][key].trim()).not.toBe('');
		}
	});

	it('has a string for every element that asks for one', () => {
		const table = languageTable();
		const used = Array.from(html.matchAll(/data-t="(\w+)"/g), (m) => m[1]);
		expect(used.length).toBeGreaterThan(0);
		for (const key of used) expect(table.tr).toHaveProperty(key);
	});

	it('loads nothing from another host', () => {
		const hosts = (html.match(/https?:\/\/[^\s"')]+/g) || []).filter((url) => !url.startsWith('http://www.w3.org/'));
		expect(hosts).toEqual([]);
	});

	it('stays out of search results', () => {
		expect(html).toContain('<meta name="robots" content="noindex, follow" />');
	});

	it('uses none of the effects the design language forbids', () => {
		expect(html).not.toMatch(/gradient|backdrop-filter|translateY|@keyframes/);
	});
});
