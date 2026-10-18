import type {Store} from 'redux';
// Type-only, erased at build time (same reason as in layout/Routes.ts).
import type {Request} from 'express';
import {setSsrValue} from '../../../actions/ssr';
import {gqlQueryTyped} from '../../api';
import {AlgSetMetaDocument, AlgSetMetaQuery} from '../../../@types/generated/graphql';
import {isAlgSetCode} from '../../../../shared/trainer/alg_sets';
import type {SsrMetaFn} from '../../layout/Routes';

/**
 * Link preview for a shared set page (`/trainer/sets/:code`), design trainer-sets.md 7.5.
 *
 * The trainer body is never server rendered (it sits behind `app_loaded`), so SSR only has to
 * give WhatsApp and friends a title and a description. The request goes through the public
 * GraphQL `algSet` query without a session, so the access rule is the resolver's own: a private
 * set never shows up in a preview, not even for its owner. It comes from localhost, so the
 * server does not count it against the anonymous IP limit.
 *
 * Only a small summary lands in the `ssr` slice (and so in `window.__STORE__`): no rows, no ids.
 */

const SSR_KEY_PREFIX = 'algset:';
/** Categories named in the description before the rest is folded into "+N". */
const MAX_PREVIEW_CATEGORIES = 6;

export interface AlgSetSsrPreview {
	name: string;
	owner: string;
	count: number;
	categories: string[];
}

/** `ssr` slice key; prefixed so it never meets a solve share code in the same slice. */
export function algSetSsrKey(code: string): string {
	return `${SSR_KEY_PREFIX}${code}`;
}

/** Narrows the query result to what the preview needs, or null when there is nothing to show. */
export function toAlgSetSsrPreview(set: AlgSetMetaQuery['algSet'] | null | undefined): AlgSetSsrPreview | null {
	if (!set || !set.name) return null;
	const categories = (set.categories || []).filter((c): c is string => typeof c === 'string' && c.length > 0);
	return {
		name: set.name,
		owner: set.owner?.username || '',
		count: typeof set.item_count === 'number' && set.item_count >= 0 ? set.item_count : 0,
		categories,
	};
}

export async function prefetchAlgSetMeta(store: Store<any>, req: Request) {
	const code: string = req.params?.code;
	if (!isAlgSetCode(code)) {
		// A malformed code cannot exist; skip the round trip and let the page say "not found".
		return store.dispatch(setSsrValue(algSetSsrKey(String(code || '')), null));
	}

	// NOT_FOUND, a rate limit or a network error must never turn into a 404 or a 500 here:
	// the page answers 200 and the client draws "not found" (a 404 would tell a stranger the
	// code exists or not, 7.5).
	try {
		const res = await gqlQueryTyped(AlgSetMetaDocument, {code}, {fetchPolicy: 'no-cache'});
		return store.dispatch(setSsrValue(algSetSsrKey(code), toAlgSetSsrPreview(res?.data?.algSet)));
	} catch {
		return store.dispatch(setSsrValue(algSetSsrKey(code), null));
	}
}

/** Head tags for the set page. Unknown or unreachable set: null, the site defaults stay. */
export const algSetSsrMeta: SsrMetaFn = (store, req, t) => {
	const code: string = req.params?.code;
	const preview: AlgSetSsrPreview | null = store.getState()?.ssr?.[algSetSsrKey(String(code || ''))] || null;
	if (!preview) return null;

	const shown = preview.categories.slice(0, MAX_PREVIEW_CATEGORIES);
	const hiddenCount = preview.categories.length - shown.length;
	const categories = hiddenCount > 0 ? `${shown.join(', ')} +${hiddenCount}` : shown.join(', ');

	return {
		title: t('seo.alg_set_title', {name: preview.name, owner: preview.owner || t('seo.user_fallback')}),
		description: categories
			? t('seo.alg_set_description', {count: preview.count, categories})
			: t('seo.alg_set_description_empty'),
	};
};
