import {
	ApolloClient,
	ApolloLink,
	DocumentNode,
	FetchPolicy,
	InMemoryCache,
	MutationOptions,
	NormalizedCacheObject,
	QueryOptions,
} from '@apollo/client';
import _ from 'lodash';
import { TypedDocumentNode } from '@graphql-typed-document-node/core';
import { createUploadLink } from 'apollo-upload-client';
import nodeFetch from 'node-fetch';
// process.env variables are defined by esbuild, no need to import process
import { MutationFetchPolicy } from '@apollo/client/core/watchQueryOptions';
import { loadErrorMessages, loadDevMessages } from "@apollo/client/dev";
import { isNative } from '../util/platform';
import { getApiBase } from '../util/api-base';
import { getSessionToken, setSessionToken } from '../util/auth/session-token';

if (process.env.NODE_ENV !== "production") {
	loadDevMessages();
	loadErrorMessages();
}

let client: ApolloClient<NormalizedCacheObject>;

export const NO_CACHE = 'no-cache';

// Native login mutations return the session JWT inside their result object
// (authenticateUser/verifyEmailCode/updateForgotPassword/completeWcaSignup expose
// `session_token`; authenticateWithWca exposes `sessionToken`). Scan the top-level
// mutation fields of a GraphQL result for either key.
function extractSessionTokenFromData(data: any): string | null {
	if (!data || typeof data !== 'object') {
		return null;
	}
	for (const key of Object.keys(data)) {
		const value = data[key];
		if (value && typeof value === 'object') {
			const token = value.session_token || value.sessionToken;
			if (typeof token === 'string' && token) {
				return token;
			}
		}
	}
	return null;
}

export function initApollo() {
	type FetchType = (url: RequestInfo, init?: RequestInit) => Promise<Response>;

	let fetchType: any;

	let hostname = '';
	if (typeof window === 'undefined' && typeof process !== 'undefined') {
		// SSR: dahili istekler için localhost kullan, dış ağ döngüsünden kaçın
		const port = process.env.PORT || 3000;
		hostname = `http://localhost:${port}`;
		fetchType = nodeFetch as unknown as FetchType;
	} else if (typeof window !== 'undefined') {
		// Web: page origin. Native: absolute https://zktimer.app — in the Faz 2 local
		// bundle the WebView origin is capacitor://localhost, so origin-relative URIs
		// would miss the server. Old remote-loading binaries resolve to the same value.
		hostname = getApiBase();
		// Auth is injected HERE, at the fetch layer, NOT via an Apollo authLink. The
		// setContext→context.headers→createUploadLink chain silently dropped the
		// Authorization header on native (token was stored + valid, yet getMe still
		// bounced — proven via on-device debugging). Setting it on the final RequestInit
		// is the exact path the working manual fetch used, so it is bypass-proof. Also
		// late-bound (resolves window.fetch at call time) so eruda's network panel sees it.
		fetchType = (async (input: RequestInfo, init?: RequestInit) => {
			try {
				if (isNative()) {
					const token = await getSessionToken();
					const headers = new Headers((init && init.headers) || undefined);
					headers.set('X-ZKT-Native', '1');
					if (token) {
						headers.set('Authorization', `Bearer ${token}`);
					}
					init = {...(init || {}), headers};
				}
			} catch (e) {
				// Never block a request over auth-header injection
			}
			return fetch(input, init);
		}) as FetchType;
	}

	const uri = `${hostname}/graphql`;
	// Native local shell talks to the API cross-origin: 'include' is required for the
	// cookie-based session-carryover attempt (and behaves like 'same-origin' on old
	// remote-loading binaries, where the request IS same-origin). Web stays strict.
	const credentials = typeof window !== 'undefined' && isNative() ? 'include' : 'same-origin';
	const uploadLink = createUploadLink({
		credentials,
		uri,
		fetch: fetchType,
		// apollo-upload-client v15 does NOT auto-add this header. Without it, multipart
		// uploads (e.g. timer background) carry none of the headers the server CSRF
		// middleware accepts and get 403'd on web. Harmless on JSON ops (already CSRF-safe).
		headers: {'Apollo-Require-Preflight': 'true'},
	});

	let link: ApolloLink = uploadLink as unknown as ApolloLink;
	// Only a response-side link now: the REQUEST-side auth (Bearer + X-ZKT-Native) is
	// injected at the fetch layer above, which is bypass-proof. This link just captures
	// the session token from login responses. No-ops on web / when no token present.
	if (typeof window !== 'undefined') {
		const tokenCaptureLink = new ApolloLink((operation, forward) =>
			forward(operation).map((result) => {
				try {
					// Primary channel: the session JWT in the response BODY (reliable —
					// the mutation data always reaches the client). Header is the fallback.
					const bodyToken = extractSessionTokenFromData((result as any)?.data);
					const {response} = operation.getContext();
					const headerToken = response?.headers?.get?.('x-session-token');
					const token = bodyToken || headerToken;
					if (token) {
						// console.error survives the prod build (log/warn are stripped);
						// fires only on login responses, so it stays quiet in normal use.
						console.error('[auth] session token captured (' + (bodyToken ? 'body' : 'header') + '), persisting');
						void setSessionToken(token);
					}
				} catch (e) {
					console.error('[auth] token capture failed:', (e as any)?.message);
				}
				return result;
			})
		);

		link = ApolloLink.from([tokenCaptureLink, link]);
	}

	client = new ApolloClient({
		cache: new InMemoryCache(),
		ssrMode: typeof window === 'undefined',
		link,
	});

	return client;
}

export async function gqlQuery<TData = any, TVariables = any>(
	gql: DocumentNode,
	variables?: TVariables,
	fetchPolicy: FetchPolicy = 'no-cache'
) {
	if (!client) {
		initApollo();
	}

	return await client.query<TData, TVariables>({
		query: gql,
		fetchPolicy,
		variables,
	});
}

export async function gqlQueryTyped<T = any, V = Record<string, any>>(
	operation: TypedDocumentNode<T, V>,
	variables?: V,
	options?: Omit<QueryOptions<V, T>, 'query' | 'variables'>
) {
	if (!client) {
		initApollo();
	}

	return await client.query<T>({
		query: operation,
		variables,
		...options,
	});
}

export async function gqlMutate<TData = any, TVariables = any>(
	gql: DocumentNode,
	variables?: TVariables,
	fetchPolicy: MutationFetchPolicy = 'no-cache'
) {
	if (!client) {
		initApollo();
	}

	return await client.mutate<TData, TVariables>({
		mutation: gql,
		fetchPolicy,
		variables,
	});
}

export async function gqlMutateTyped<T = any, V = Record<string, any>>(
	operation: TypedDocumentNode<T, V>,
	variables?: V,
	options?: MutationOptions<T, V>
) {
	if (!client) {
		initApollo();
	}

	return await client.mutate<T>({
		mutation: operation,
		variables,
		...options,
	});
}

function omitDeep(collection: object, excludeKeys: string[]) {
	function omitFn(value) {
		if (value && typeof value === 'object') {
			excludeKeys.forEach((key) => {
				delete value[key];
			});
		}
	}

	return _.cloneDeepWith(collection, omitFn);
}

export function removeTypename<T extends object>(data: T, removeLokiAndMeta?: boolean): T {
	const omitKeys = ['__typename'];
	if (removeLokiAndMeta) {
		omitKeys.push('$loki', 'meta');
	}

	return omitDeep(data, omitKeys) as T;
}
