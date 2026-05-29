/**
 * Sözlük (Glossary) statik veri.
 * Renk kodları + pattern terimleri.
 * i18n key prefix: trainer.recognition.glossary.
 */

export interface GlossaryColorEntry {
	id: string; // i18n key suffix: colors_g, colors_o, ...
	cellCode: string; // StickerPattern cells icin (örn. 'g', 'g!', 'x')
	swatch: string; // CSS rengi (görsel)
}

export const GLOSSARY_COLORS: GlossaryColorEntry[] = [
	{id: 'g', cellCode: 'g', swatch: '#21b15b'},
	{id: 'o', cellCode: 'o', swatch: '#e8a11a'},
	{id: 'b', cellCode: 'b', swatch: '#2d8fe3'},
	{id: 'r', cellCode: 'r', swatch: '#e53935'},
	{id: 'x', cellCode: 'x', swatch: '#555'},
	{id: 'outlined', cellCode: 'g!', swatch: '#21b15b'},
];

export interface GlossaryPatternEntry {
	id: string; // i18n key suffix: patterns_bar, patterns_lights, ...
	term: string; // gösterilecek başlık (cubing jargon, çevrilmez)
	exampleCells?: string[]; // opsiyonel: StickerPattern row için 6 cell
}

export const GLOSSARY_PATTERNS: GlossaryPatternEntry[] = [
	{id: 'bar', term: 'Bar', exampleCells: ['g!', 'g!', 'x', 'x', 'x', 'x']},
	{id: 'lights', term: 'Lights', exampleCells: ['g!', 'x', 'g!', 'x', 'x', 'x']},
	{id: 'headlights', term: 'Headlights', exampleCells: ['g', 'g', 'g', 'o!', 'x', 'o!']},
	{id: 'bookends', term: 'Bookends', exampleCells: ['g!', 'x', 'x', 'x', 'x', 'g!']},
	{id: 'checker', term: 'Checker', exampleCells: ['g!', 'o!', 'g!', 'o!', 'g!', 'o!']},
	{id: 'adj', term: 'adj (adjacent)'},
	{id: 'opp', term: 'opp (opposite)'},
	{id: 'auf', term: 'AUF'},
];
