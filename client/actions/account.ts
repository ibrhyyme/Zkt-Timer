import {gql} from '@apollo/client/core';
import {print} from 'graphql';
import {gqlQuery} from '../components/api';
import {USER_FOR_ME_FRAGMENT} from '../util/graphql/fragments';
import {UserAccount} from '../../server/schemas/UserAccount.schema';
import {isNative} from '../util/platform';
import {getApiBase} from '../util/api-base';
import {getSessionToken, refreshSessionTokenCache} from '../util/auth/session-token';

// Transient-failure retry for the boot-critical me fetch. iOS WKWebView is prone to
// one-off fetch failures right after a full-page navigation (the post-login reload),
// and a single miss there used to bounce a freshly-logged-in user back to /login.
const GET_ME_RETRY_DELAYS_MS = [400, 1200];

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getMe() {
	return async (dispatch) => {
		const query = gql`
			${USER_FOR_ME_FRAGMENT}

			query Query {
				me {
					...UserForMeFragment
				}
			}
		`;

		let me: UserAccount | null = null;

		if (typeof window !== 'undefined' && isNative()) {
			// Native: bypass Apollo entirely and use the EXACT plain-fetch + Bearer path
			// that was proven to work via on-device testing (returns `me` reliably). The
			// Apollo link chain silently dropped the Authorization header on native, so
			// the auth gate (this query) must not depend on it. print() serializes the
			// fragment-composed query into the request body.
			//
			// Error semantics matter here: App.tsx treats a resolved `me === null` as an
			// auth REJECTION (it clears zkt_has_auth + the stored session token and
			// redirects to /login), while a THROWN error with `networkError` set keeps
			// the session and boots from the cached identity. So only an authoritative
			// 2xx GraphQL response may resolve to null; offline/unreachable/5xx must throw.
			let token = await getSessionToken();
			if (!token && localStorage.getItem('zkt_has_auth')) {
				// A token is expected but the first read came back empty: the login
				// page's async Preferences write may still be landing. Wait briefly and
				// re-read past the sticky-null cache before going out unauthenticated —
				// an unauthenticated me query is a REAL auth rejection and wipes the flag.
				await sleep(600);
				token = await refreshSessionTokenCache();
			}

			const body = JSON.stringify({query: print(query)});
			let json: any = null;
			let lastNetworkErr: any = null;
			for (let attempt = 0; attempt <= GET_ME_RETRY_DELAYS_MS.length; attempt++) {
				if (attempt > 0) {
					await sleep(GET_ME_RETRY_DELAYS_MS[attempt - 1]);
				}
				let res: Response;
				try {
					res = await fetch(`${getApiBase()}/graphql`, {
						method: 'POST',
						headers: {
							'Content-Type': 'application/json',
							'X-ZKT-Native': '1',
							...(token ? {Authorization: `Bearer ${token}`} : {}),
						},
						body,
					});
				} catch (err) {
					lastNetworkErr = err;
					continue;
				}
				if (!res.ok) {
					// Gateway/server errors (e.g. nginx 502/503) are infrastructure, not
					// an auth verdict.
					lastNetworkErr = new Error(`HTTP ${res.status}`);
					continue;
				}
				try {
					json = await res.json();
				} catch (err) {
					// A 2xx with a non-JSON body (proxy error page) is not authoritative.
					lastNetworkErr = err;
					continue;
				}
				lastNetworkErr = null;
				break;
			}
			if (lastNetworkErr) {
				const e: any = new Error('getMe network failure');
				e.networkError = lastNetworkErr;
				throw e;
			}
			me = (json?.data?.me as UserAccount) || null;
		} else {
			const res = await gqlQuery<{me: UserAccount}>(query, undefined, 'no-cache');
			me = res.data.me;
		}

		if (!me || !Object.keys(me).length) {
			me = null;
		}

		dispatch({
			type: 'SET_ME',
			payload: {
				me,
			},
		});
	};
}
