// Engine-independent "was this a network/offline failure?" predicate.
//
// Chromium reports a failed fetch as "Failed to fetch", WebKit (iOS WKWebView) as
// "Load failed", React Native as "Network request failed". Any code that branches
// on ONE of those strings breaks on the other engines (this deleted local solves
// on offline iOS). Prefer the structural signals; keep the message sniff only as
// a last-resort net for non-Apollo errors.
export function isNetworkError(err: any): boolean {
	if (err?.networkError) {
		// ApolloError sets networkError for both connection failures (TypeError)
		// and non-2xx HTTP responses (ServerError) — neither is a GraphQL verdict.
		return true;
	}
	if (typeof navigator !== 'undefined' && navigator.onLine === false) {
		return true;
	}
	return /failed to fetch|load failed|network request failed|offline/i.test(err?.message || '');
}
