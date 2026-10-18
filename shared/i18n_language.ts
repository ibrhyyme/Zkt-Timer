// Language negotiation shared by the SSR router and the client i18n bootstrap.
// Pure: no browser or Node APIs, so both sides pick a language the same way.

export const SUPPORTED_LANGUAGES = ['tr', 'en', 'es', 'ru', 'zh'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

/** Used when none of the visitor's languages is one we ship. Must match i18next `fallbackLng`. */
export const FALLBACK_LANGUAGE: SupportedLanguage = 'en';

/** Maps one BCP 47 tag ("tr-TR", "zh_Hans_CN", "EN") to a shipped language, or null. */
export function matchSupportedLanguage(tag: string | null | undefined): SupportedLanguage | null {
	if (!tag || typeof tag !== 'string') return null;
	const primary = tag.trim().toLowerCase().split(/[-_]/)[0];
	return (SUPPORTED_LANGUAGES as readonly string[]).includes(primary) ? (primary as SupportedLanguage) : null;
}

/** First shipped language in a preference-ordered list of tags, or null when none matches. */
export function pickSupportedLanguage(tags: readonly (string | null | undefined)[]): SupportedLanguage | null {
	for (const tag of tags || []) {
		const match = matchSupportedLanguage(tag);
		if (match) return match;
	}
	return null;
}

/**
 * Accept-Language header to tags ordered by preference (q value high to low, header order on ties).
 * Tags with q=0 are dropped: the client said it does not want them.
 */
export function parseAcceptLanguage(header: string | null | undefined): string[] {
	if (!header || typeof header !== 'string') return [];

	const entries: {tag: string; q: number; index: number}[] = [];
	header.split(',').forEach((part, index) => {
		const [rawTag, ...params] = part.trim().split(';');
		const tag = rawTag.trim();
		if (!tag || tag === '*') return;

		let q = 1;
		for (const param of params) {
			const [key, value] = param.trim().split('=');
			if (key?.trim().toLowerCase() === 'q') {
				const parsed = parseFloat(value);
				q = Number.isFinite(parsed) ? parsed : 0;
			}
		}
		if (q <= 0) return;
		entries.push({tag, q, index});
	});

	entries.sort((a, b) => b.q - a.q || a.index - b.index);
	return entries.map((e) => e.tag);
}
