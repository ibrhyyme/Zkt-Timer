import fs from 'fs';
import path from 'path';

// The PB badge used to be built as hard-coded Turkish in helpers/pb.ts, so every
// language saw Turkish (feedback E-1). The texts now live under timer_pb.* in each
// locale; pb.ts asks for `timer_pb.<kind>` with a `cube` value.

const LOCALES = ['tr', 'en', 'es', 'ru', 'zh'];
const KINDS = ['single', 'average', 'single_and_average'];

function load(lang: string) {
	const file = path.join(__dirname, '../../../../i18n/locales', lang, 'translation.json');
	return JSON.parse(fs.readFileSync(file, 'utf8'));
}

describe('PB badge texts', () => {
	for (const lang of LOCALES) {
		it(`${lang} has every PB text with the cube name in it`, () => {
			const block = load(lang).timer_pb;
			expect(block).toBeDefined();
			for (const kind of KINDS) {
				const text: string = block[kind];
				expect(typeof text).toBe('string');
				expect(text).toContain('{{cube}}');
				// Copy rule: no em dash or en dash in user-facing text.
				expect(text).not.toMatch(/[–—]/);
			}
		});
	}
});
