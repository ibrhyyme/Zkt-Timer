import GraphQLError from './graphql_error';
import {ErrorCode} from '../constants/errors';
import {FederationUnavailableError} from '../services/zkt_federation_cache';
import {logger} from '../services/logger';

/**
 * What a resolver throws when ZKT federation data is needed and none is
 * available, neither fresh nor cached.
 *
 * Without this the raw error reached formatError as an unknown error: it was
 * masked as "Sunucu hatası oluştu", logged as a server bug, and the
 * client could not tell "the federation is busy, try again in a few seconds"
 * apart from a real fault. The code lets the client keep what it already shows
 * and retry quietly; the i18nKey gives it a sentence in the viewer's language.
 */
export function federationUnavailableError(error: unknown, context: Record<string, unknown> = {}): GraphQLError {
	const retryAfterS = error instanceof FederationUnavailableError ? error.retryAfterS : 10;
	logger.warn('[ZktFederation] no data to serve', {
		...context,
		reason: error instanceof FederationUnavailableError ? error.reason : 'unknown',
		err: (error as any)?.message,
	});
	return new GraphQLError(
		ErrorCode.UPSTREAM_UNAVAILABLE,
		'ZKT yarışma verisine şu an ulaşılamıyor. Birkaç saniye içinde yeniden denenecek.',
		{i18nKey: 'my_schedule.zkt_unavailable', retryAfterS}
	);
}
