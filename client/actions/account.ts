import {gql} from '@apollo/client/core';
import {print} from 'graphql';
import {gqlQuery} from '../components/api';
import {USER_FOR_ME_FRAGMENT} from '../util/graphql/fragments';
import {UserAccount} from '../../server/schemas/UserAccount.schema';
import {isNative} from '../util/platform';
import {getApiBase} from '../util/api-base';
import {getSessionToken} from '../util/auth/session-token';

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
			const token = await getSessionToken();
			let res: Response;
			try {
				res = await fetch(`${getApiBase()}/graphql`, {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'X-ZKT-Native': '1',
						...(token ? {Authorization: `Bearer ${token}`} : {}),
					},
					body: JSON.stringify({query: print(query)}),
				});
			} catch (err) {
				const e: any = new Error('getMe network failure');
				e.networkError = err;
				throw e;
			}
			if (!res.ok) {
				// Gateway/server errors (e.g. nginx 502/503) are infrastructure, not an
				// auth verdict.
				const e: any = new Error(`getMe HTTP ${res.status}`);
				e.networkError = new Error(`HTTP ${res.status}`);
				throw e;
			}
			let json: any;
			try {
				json = await res.json();
			} catch (err) {
				// A 2xx with a non-JSON body (proxy error page) is not authoritative either.
				const e: any = new Error('getMe malformed response');
				e.networkError = err;
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
