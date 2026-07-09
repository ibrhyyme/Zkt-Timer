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
import { setContext } from '@apollo/client/link/context';
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
		fetchType = fetch as FetchType;
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
	if (typeof window !== 'undefined' && isNative()) {
		// Bearer auth for the local-bundle shell: attach the stored session JWT on the
		// way out, capture a fresh one from X-Session-Token on the way in (set by
		// every login mutation server-side). No-ops while no token is stored, so the
		// cookie path of old remote-loading binaries keeps working unchanged.
		const authLink = setContext(async (_operation, prevContext) => {
			const token = await getSessionToken();
			if (!token) {
				return {};
			}
			return {
				headers: {
					...(prevContext.headers || {}),
					Authorization: `Bearer ${token}`,
				},
			};
		});

		const tokenCaptureLink = new ApolloLink((operation, forward) =>
			forward(operation).map((result) => {
				try {
					const {response} = operation.getContext();
					const headerToken = response?.headers?.get?.('x-session-token');
					if (headerToken) {
						void setSessionToken(headerToken);
					}
				} catch (e) {
					// Header capture is best-effort
				}
				return result;
			})
		);

		link = ApolloLink.from([authLink, tokenCaptureLink, link]);
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
