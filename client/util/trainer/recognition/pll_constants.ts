import pllMap from '../../../../public/trainer/pll-recognition-algs.json';

export const PLL_LETTERS = ['A', 'E', 'F', 'G', 'H', 'J', 'N', 'R', 'T', 'U', 'V', 'Y', 'Z'] as const;

const PLL_LETTER_SET = new Set<string>(PLL_LETTERS);
const SINGLE_LETTER_PLL_SET = new Set(['E', 'F', 'H', 'T', 'V', 'Y', 'Z']);
const TWO_LETTER_PLL_PREFIX_SET = new Set(['A', 'G', 'J', 'N', 'R', 'U']);

export function isPllLetter(l: string): boolean {
	return PLL_LETTER_SET.has(l);
}

export function isSingleLetterPll(l: string): boolean {
	return SINGLE_LETTER_PLL_SET.has(l);
}

export function isTwoLetterPllPrefix(l: string): boolean {
	return TWO_LETTER_PLL_PREFIX_SET.has(l);
}

export const validPllSuffixes: Record<string, string[]> = {
	A: ['a', 'b'],
	G: ['a', 'b', 'c', 'd'],
	J: ['a', 'b'],
	N: ['a', 'b'],
	R: ['a', 'b'],
	U: ['a', 'b'],
};

export const allPllCaseNames = new Set<string>(Object.keys(pllMap as Record<string, unknown>));

const HELP_KEY_SET = new Set(['-', 'F1', '?', 's', 'S', '/']);

export function isHelpKey(key: string): boolean {
	return HELP_KEY_SET.has(key);
}

export function aufByDturn(d: string): string {
	switch (d) {
		case "d'":
			return 'U';
		case 'd2':
			return 'U2';
		case 'd':
			return "U'";
		default:
		case '':
			return '';
	}
}
