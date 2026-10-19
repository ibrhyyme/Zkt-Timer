import type {Store} from 'redux';
// Type-only, erased at build time (same reason as in layout/Routes.ts).
import type {Request} from 'express';
import {setSsrValue} from '../../../actions/ssr';
import {gqlQueryTyped} from '../../api';
import {BattleChallengeDocument} from '../../../@types/generated/graphql';
import {isChallengeCode} from '../../../../shared/battle/challenge';
import {CHALLENGE_TTL_SEC, ROUNDS_TO_WIN} from '../../../../shared/battle/config';
import type {SsrMetaFn} from '../../layout/Routes';

/**
 * Link preview of a duel invite (`/duel/:code`): "<name> challenges you to a duel" in WhatsApp
 * and friends, which never run the page's JS. The request goes through the public GraphQL
 * `battleChallenge` query without a session, so it follows the resolver's rule: nothing while
 * Online Battle is closed to visitors. Only the inviter's name lands in the `ssr` slice.
 */

const SSR_KEY_PREFIX = 'duel:';

export function duelSsrKey(code: string): string {
	return `${SSR_KEY_PREFIX}${code}`;
}

export async function prefetchDuelMeta(store: Store<any>, req: Request) {
	const code: string = req.params?.code;
	if (!isChallengeCode(code)) return store.dispatch(setSsrValue(duelSsrKey(String(code || '')), null));
	// An unknown code or a failed read is never a 404 or a 500: the page answers 200 and says
	// "not found" itself, so the response tells a stranger nothing about which codes exist.
	try {
		const res = await gqlQueryTyped(BattleChallengeDocument, {code}, {fetchPolicy: 'no-cache'});
		const name = res?.data?.battleChallenge?.from?.username || null;
		return store.dispatch(setSsrValue(duelSsrKey(code), name ? {name} : null));
	} catch {
		return store.dispatch(setSsrValue(duelSsrKey(code), null));
	}
}

/** Head tags for an invite. Unknown invite: null, the site defaults stay. */
export const duelSsrMeta: SsrMetaFn = (store, req, t) => {
	const code: string = req.params?.code;
	const preview: {name: string} | null = store.getState()?.ssr?.[duelSsrKey(String(code || ''))] || null;
	if (!preview) return null;
	return {
		title: t('seo.duel_title', {name: preview.name}),
		description: t('seo.duel_description', {n: ROUNDS_TO_WIN, minutes: CHALLENGE_TTL_SEC / 60}),
	};
};
