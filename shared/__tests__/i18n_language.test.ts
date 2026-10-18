import {matchSupportedLanguage, parseAcceptLanguage, pickSupportedLanguage} from '../i18n_language';

describe('matchSupportedLanguage', () => {
	it('maps region and script variants to the shipped language', () => {
		expect(matchSupportedLanguage('tr-TR')).toBe('tr');
		expect(matchSupportedLanguage('zh_Hans_CN')).toBe('zh');
		expect(matchSupportedLanguage('EN')).toBe('en');
	});

	it('rejects languages we do not ship and junk', () => {
		expect(matchSupportedLanguage('de-DE')).toBeNull();
		expect(matchSupportedLanguage('')).toBeNull();
		expect(matchSupportedLanguage(undefined)).toBeNull();
		// "tro" must not count as Turkish just because it starts with "tr"
		expect(matchSupportedLanguage('tro')).toBeNull();
	});
});

describe('pickSupportedLanguage', () => {
	it('takes the first shipped language in preference order', () => {
		expect(pickSupportedLanguage(['de-DE', 'tr-TR', 'en-US'])).toBe('tr');
	});

	it('returns null when nothing matches', () => {
		expect(pickSupportedLanguage(['de', 'fr'])).toBeNull();
		expect(pickSupportedLanguage([])).toBeNull();
	});
});

describe('parseAcceptLanguage', () => {
	it('keeps a Turkish browser Turkish even though it also lists English', () => {
		// The old substring check found "en" first and served English to this header.
		const tags = parseAcceptLanguage('tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7');
		expect(pickSupportedLanguage(tags)).toBe('tr');
	});

	it('orders by q value, header order on ties, and drops q=0', () => {
		expect(parseAcceptLanguage('en;q=0.5, ru, es;q=0.5, de;q=0')).toEqual(['ru', 'en', 'es']);
	});

	it('ignores the wildcard and empty headers', () => {
		expect(parseAcceptLanguage('*')).toEqual([]);
		expect(parseAcceptLanguage('')).toEqual([]);
		expect(parseAcceptLanguage(undefined)).toEqual([]);
	});
});
