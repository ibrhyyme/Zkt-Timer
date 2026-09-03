// The help page lists supported cubes, timer inputs and import sources by reading the
// code that owns them, instead of repeating them in five translation files. These tests
// hold that wiring in place: the point is that adding a source in one place makes it
// appear on the help page, and that nothing quietly reintroduces a second hand-kept copy.
//
// They exist because the hand-written versions had already gone stale — the cube list was
// five brands behind and the import list had missed CubeTime entirely.

import {
	SUPPORTED_SMART_CUBE_BRANDS,
	SMART_CUBE_NAME_PREFIXES,
} from '../../timer/smart_cube/bluetooth/supported_cubes';
import {TIMER_INPUT_TYPE_KEYS} from '../../settings/hardware/timer_input_types';
import {IMPORT_TYPE_NAMES, ImportDataType} from '../../settings/data/import_data/import_sources';

import tr from '../../../i18n/locales/tr/translation.json';
import en from '../../../i18n/locales/en/translation.json';
import es from '../../../i18n/locales/es/translation.json';
import ru from '../../../i18n/locales/ru/translation.json';
import zh from '../../../i18n/locales/zh/translation.json';

const LOCALES: Record<string, any> = {tr, en, es, ru, zh};

describe('smart cube brands', () => {
	it('covers every prefix the scanner filters on', () => {
		// connect.js passes SMART_CUBE_NAME_PREFIXES straight to the BLE adapters, so this
		// is what actually decides which cubes show up in the picker.
		const fromBrands = SUPPORTED_SMART_CUBE_BRANDS.flatMap((entry) => entry.prefixes);
		expect([...SMART_CUBE_NAME_PREFIXES].sort()).toEqual([...fromBrands].sort());
	});

	it('still filters on the prefixes the protocols were written against', () => {
		// Losing one of these silently stops a whole brand from being discoverable, with
		// no error anywhere: the cube simply never appears in the scan results.
		expect([...SMART_CUBE_NAME_PREFIXES].sort()).toEqual(
			[
				'AiCube',
				'GAN',
				'Gan',
				'Gi',
				'GoCube',
				'Hi-',
				'MG',
				'MHC',
				'Mi Smart Magic Cube',
				'QY-QYSC',
				'Rubiks',
				'WCU_MY3',
				'XMD-TornadoV4-i',
				'gan',
			].sort()
		);
	});

	it('gives every brand a display name and at least one prefix', () => {
		for (const entry of SUPPORTED_SMART_CUBE_BRANDS) {
			expect(entry.brand.trim()).not.toBe('');
			expect(entry.prefixes.length).toBeGreaterThan(0);
		}
	});
});

describe('timer input types', () => {
	it('points every input at a name that exists in all five languages', () => {
		for (const [locale, translation] of Object.entries(LOCALES)) {
			for (const key of Object.values(TIMER_INPUT_TYPE_KEYS)) {
				const value = key.split('.').reduce<any>((node, part) => node?.[part], translation);
				expect(`${locale}: ${key} = ${value}`).toBe(`${locale}: ${key} = ${value}`);
				expect(typeof value).toBe('string');
				expect(value.trim()).not.toBe('');
			}
		}
	});

	it('has a help description for every input, in all five languages', () => {
		// The help page renders one table row per input. A missing description would print
		// the raw key path to the reader.
		for (const [locale, translation] of Object.entries(LOCALES)) {
			for (const id of Object.keys(TIMER_INPUT_TYPE_KEYS)) {
				const value = translation.help?.timer_types?.[id];
				expect(`${locale}/${id}: ${typeof value}`).toBe(`${locale}/${id}: string`);
				expect(value.trim()).not.toBe('');
			}
		}
	});
});

describe('import sources', () => {
	it('names every member of the enum', () => {
		const members = Object.values(ImportDataType).filter((value) => typeof value === 'number');
		expect(Object.keys(IMPORT_TYPE_NAMES).length).toBe(members.length);
		for (const name of Object.values(IMPORT_TYPE_NAMES)) {
			expect(name.trim()).not.toBe('');
		}
	});
});

describe('help sections', () => {
	// The page reads these ids out of SECTIONS in Help.tsx. Importing the component here
	// would pull React and the whole page in, so the list is repeated and checked against
	// the translations instead: a section added to the code without translations renders
	// an empty card, in every language at once.
	const SECTION_IDS = [
		'getting-started',
		'timer',
		'solves',
		'stats',
		'trainer',
		'smart-cube',
		'mobile',
		'rooms',
		'battle',
		'messages',
		'competitions',
		'profile',
		'account',
		'data',
		'shortcuts',
		'faq',
	];

	it('has a title for every section in all five languages', () => {
		for (const [locale, translation] of Object.entries(LOCALES)) {
			for (const id of SECTION_IDS) {
				const title = translation.help?.sections?.[id]?.title;
				expect(`${locale}/${id}: ${typeof title}`).toBe(`${locale}/${id}: string`);
				expect(title.trim()).not.toBe('');
			}
		}
	});

	it('keeps the same body, steps and notes counts across languages', () => {
		// A section that lost a paragraph in one language is a translation gap, not a
		// design choice — the page renders whatever is there, so it would go unnoticed.
		const shape = (translation: any) =>
			SECTION_IDS.map((id) => {
				const section = translation.help?.sections?.[id] ?? {};
				return [id, section.body?.length ?? 0, section.steps?.length ?? 0, section.notes?.length ?? 0].join(':');
			});

		const reference = shape(tr);
		for (const [locale, translation] of Object.entries(LOCALES)) {
			expect(`${locale} ${shape(translation).join(' | ')}`).toBe(`${locale} ${reference.join(' | ')}`);
		}
	});
});
