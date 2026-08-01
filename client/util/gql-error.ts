// Kept structural instead of importing i18next's TFunction: that type resolves
// differently under the jest ts config and breaks the call signature there.
type TranslateFn = (key: string) => any;

/**
 * Resolvers may attach an `i18nKey` to a user-facing error (see server/app.ts
 * formatError). When present the client renders the translated string instead of the
 * raw server message, which is written in a single language.
 */
export function getGqlErrorMessage(error: any, t: TranslateFn, fallbackKey: string): string {
	const key = error?.graphQLErrors?.[0]?.extensions?.i18nKey || error?.extensions?.i18nKey;

	if (typeof key === 'string' && key) {
		const translated = t(key);
		// i18next echoes the key back when it is missing — never show a raw key to a user.
		if (typeof translated === 'string' && translated && translated !== key) {
			return translated;
		}
	}

	return error?.message || String(t(fallbackKey));
}
