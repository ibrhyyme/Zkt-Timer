import {randomBytes} from 'crypto';
import {GraphQLError} from 'graphql';
import {createGraphQLError} from 'graphql-yoga';
import {logger} from '../services/logger';

// Production error shaping for /graphql (Yoga's maskError hook). Errors that carry a
// code are expected (BAD_INPUT, FORBIDDEN, NOT_FOUND, validation...) and reach the
// client with only whitelisted extensions. Anything without a code is a server fault:
// its message and stack stay in our log and the client gets a trace id instead.
// `http` is kept on both paths: Yoga reads the status from it and strips it from the body.
export function formatProductionError(error: unknown): GraphQLError {
	const gqlError = error instanceof GraphQLError ? error : null;
	const extensions: {[key: string]: any} = gqlError?.extensions || {};
	// Yoga tags the request errors it raises itself (a variable of the wrong type, a
	// malformed body) with a 4xx status but no code. They describe the request, not the
	// server, so they pass as BAD_USER_INPUT, the code Apollo 2 gave them.
	const status = extensions.http?.status;
	const code = extensions.code || (typeof status === 'number' && status >= 400 && status < 500 ? 'BAD_USER_INPUT' : undefined);
	const http = extensions.http ? {http: extensions.http} : {};
	const message = (error as Error)?.message;
	const path = gqlError?.path;

	if (code === 'INTERNAL_SERVER_ERROR' || !code) {
		// A short id ties the code on the user's screen to this log line.
		const traceId = randomBytes(6).toString('hex');
		logger.error('GraphQL error', {message, path, code, traceId});
		// The message reaches a screen, so it is Turkish and carries a code the
		// organizer can read out. `unexpected` lets Yoga answer 500 when no data came back.
		return createGraphQLError(`Sunucu hatası oluştu. Hata kodu: ${traceId}`, {
			extensions: {code: 'INTERNAL_SERVER_ERROR', traceId, unexpected: true, ...http},
		});
	}

	// `i18nKey` lets the client render the message in the user's language.
	const i18nKey = extensions.i18nKey;
	// addAlgSetItems / updateAlgSetItem name the refused cases (`category::case_name`)
	// so the client can fall back to the library algorithm for just those (trainer-sets 5.5).
	const rejected = extensions.rejected;
	const rejectedList =
		Array.isArray(rejected) && rejected.every((r: unknown) => typeof r === 'string') ? rejected.slice(0, 500) : null;
	// Seconds until a cooldown lifts (the GIF spam brake). A number only, nothing else.
	const retryAfter = extensions.retry_after;
	const safeRetryAfter =
		typeof retryAfter === 'number' && Number.isFinite(retryAfter) ? Math.max(0, Math.round(retryAfter)) : null;
	// Expected errors are logged too, at warn: a solve that keeps failing to sync usually
	// fails on one of these, and without a line here the only evidence is on the user's screen.
	logger.warn('GraphQL rejected request', {message, path, code});
	return createGraphQLError(message, {
		path,
		extensions: {
			code,
			...(i18nKey ? {i18nKey} : {}),
			...(rejectedList ? {rejected: rejectedList} : {}),
			...(safeRetryAfter !== null ? {retry_after: safeRetryAfter} : {}),
			...http,
		},
	});
}
