/**
 * Query handling for `routeRedirect` rows (client/components/layout/Routes.ts).
 *
 * A redirect used to drop the incoming query string (`/trainer/standard?cat=pll` landed on
 * `/trainer/algorithms` without `cat`). Both the server 301 (server/router.tsx) and the in-app
 * redirect (client/components/map_route.tsx) go through these helpers so the two agree.
 *
 * Pure: no Node or browser APIs beyond the global URLSearchParams both sides have.
 */

/** Replaces `:name` placeholders in a redirect target with the matched route params. */
export function fillRedirectParams(target: string, params: Record<string, string | undefined> | null | undefined): string {
	let out = target;
	if (!params) return out;
	for (const key of Object.keys(params)) {
		const value = params[key];
		if (value === undefined || value === null) continue;
		// `:id` must not eat the start of `:idx`; keys are plain word characters.
		const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		out = out.replace(new RegExp(`:${escaped}(?![A-Za-z0-9_])`, 'g'), () => String(value));
	}
	return out;
}

/**
 * Appends the incoming query to a redirect target. The target's own query wins on a shared key
 * (`/trainer/smart?cat=oll&mode=standard` -> `/trainer/algorithms?mode=smart&cat=oll`); every
 * other incoming pair is kept in its original order, repeated keys included. A hash on the target
 * stays at the end.
 *
 * @param target  redirect path, may carry its own `?query` and `#hash`
 * @param incomingSearch  the request's query, with or without the leading `?`
 */
export function mergeRedirectQuery(target: string, incomingSearch: string | null | undefined): string {
	const incoming = (incomingSearch || '').replace(/^\?/, '');
	if (!incoming) return target;

	const hashAt = target.indexOf('#');
	const hash = hashAt >= 0 ? target.slice(hashAt) : '';
	const withoutHash = hashAt >= 0 ? target.slice(0, hashAt) : target;

	const queryAt = withoutHash.indexOf('?');
	const path = queryAt >= 0 ? withoutHash.slice(0, queryAt) : withoutHash;
	const targetQuery = queryAt >= 0 ? withoutHash.slice(queryAt + 1) : '';

	const merged = new URLSearchParams(targetQuery);
	const targetKeys = new Set<string>();
	merged.forEach((_value, key) => targetKeys.add(key));

	new URLSearchParams(incoming).forEach((value, key) => {
		if (!targetKeys.has(key)) merged.append(key, value);
	});

	const qs = merged.toString();
	return `${path}${qs ? `?${qs}` : ''}${hash}`;
}
