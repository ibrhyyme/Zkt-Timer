import fs from 'fs';
import path from 'path';

// Every featureKey passed to openProOnlyModal needs a highlight list in ProOnlyModal and a
// `pro.modal.<key>` title and description in every locale. When one was missing the modal
// fell back to the generic sync-and-themes pitch without a sound: the Trainer passed
// `trainer_smart_cube` while the copy sat under `trainer`, and `magnet_start` had copy but
// no list. Read as text, like the design language test, so no component has to render.

const CLIENT = path.resolve(__dirname, '../../../..');
const LANGS = ['tr', 'en', 'es', 'ru', 'zh'];

function files(dir: string): string[] {
	const out: string[] = [];
	for (const entry of fs.readdirSync(dir, {withFileTypes: true})) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			if (entry.name === 'node_modules' || entry.name === '__tests__') continue;
			out.push(...files(full));
		} else if (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts')) {
			out.push(full);
		}
	}
	return out;
}

const callerKeys = new Set<string>();
for (const file of files(path.join(CLIENT, 'components'))) {
	const src = fs.readFileSync(file, 'utf8');
	for (const m of src.matchAll(/openProOnlyModal\([^,]+,\s*[^,]+,\s*'([a-z_]+)'\)/g)) callerKeys.add(m[1]);
}

const modalSrc = fs.readFileSync(path.join(CLIENT, 'components/common/pro_only/ProOnlyModal.tsx'), 'utf8');
const highlightsBlock = modalSrc.slice(modalSrc.indexOf('const FEATURE_HIGHLIGHTS'));
const highlights: Record<string, string[]> = {};
for (const m of highlightsBlock.slice(0, highlightsBlock.indexOf('};')).matchAll(/(\w+):\s*\[([^\]]*)\]/g)) {
	highlights[m[1]] = [...m[2].matchAll(/'([a-z_]+)'/g)].map((h) => h[1]);
}

const locales = Object.fromEntries(
	LANGS.map((lang) => [lang, JSON.parse(fs.readFileSync(path.join(CLIENT, `i18n/locales/${lang}/translation.json`), 'utf8'))]),
);

describe('Pro upsell modal keys', () => {
	it('finds the callers', () => {
		expect(callerKeys.size).toBeGreaterThan(5);
	});

	it.each([...callerKeys])('%s has a highlight list', (key) => {
		expect(highlights[key]?.length).toBeGreaterThan(0);
	});

	it.each([...callerKeys].flatMap((key) => LANGS.map((lang) => [key, lang])))('%s has modal copy in %s', (key, lang) => {
		const modal = locales[lang].pro.modal[key];
		expect(modal?.title).toBeTruthy();
		expect(modal?.desc).toBeTruthy();
	});

	it.each([...callerKeys].flatMap((key) => LANGS.map((lang) => [key, lang])))('%s highlights are translated in %s', (key, lang) => {
		for (const h of highlights[key] || []) {
			expect(locales[lang].pro.highlights[h]).toBeTruthy();
		}
	});
});
