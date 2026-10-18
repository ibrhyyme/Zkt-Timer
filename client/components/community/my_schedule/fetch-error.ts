// How the competition pages read a failed request. Pure, so it is unit tested
// (__tests__/fetch_error.test.ts).
//
// The rule these pages follow: a failure never replaces data the viewer can
// already see, and a failure that will pass on its own (a busy federation, a
// rate limit, a dropped connection) is retried quietly instead of leaving a
// dead "try again later" box behind.

export type FetchErrorKind = 'auth' | 'rate_limited' | 'upstream' | 'network' | 'other';

export interface FetchErrorInfo {
	kind: FetchErrorKind;
	/** Translation key for the sentence to show. */
	messageKey: string;
	/** The server's own words, only for faults we cannot explain better. */
	detail: string | null;
	/** Whether waiting and asking again is expected to work. */
	retryable: boolean;
}

export function classifyFetchError(error: any): FetchErrorInfo {
	const gqlError = error?.graphQLErrors?.[0] || error?.networkError?.result?.errors?.[0];
	const code = gqlError?.extensions?.code;

	if (code === 'FORBIDDEN' || code === 'UNAUTHENTICATED') {
		return {kind: 'auth', messageKey: 'my_schedule.fetch_error', detail: null, retryable: false};
	}
	if (code === 'RATE_LIMITED') {
		return {kind: 'rate_limited', messageKey: 'my_schedule.rate_limited', detail: null, retryable: true};
	}
	if (code === 'UPSTREAM_UNAVAILABLE') {
		return {kind: 'upstream', messageKey: 'my_schedule.zkt_unavailable', detail: null, retryable: true};
	}
	// No GraphQL answer at all: the request never made it (offline, server
	// restarting during a deploy, gateway error).
	if (!gqlError && error?.networkError) {
		return {kind: 'network', messageKey: 'my_schedule.fetch_error', detail: null, retryable: true};
	}
	const detail = gqlError?.message || error?.message || null;
	return {kind: 'other', messageKey: 'my_schedule.fetch_error', detail, retryable: true};
}

const RETRY_BASE_MS = 5000;
const RETRY_MAX_MS = 30000;

/** 5s, 10s, 20s, then every 30s. */
export function retryDelayMs(attempt: number): number {
	return Math.min(RETRY_MAX_MS, RETRY_BASE_MS * Math.pow(2, Math.max(0, attempt)));
}
