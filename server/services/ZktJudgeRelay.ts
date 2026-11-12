// Relay to the federation site's judge endpoints (/api/internal/v1/judge/*),
// for online score entry.
//
// The site owns every rule and every row. This server only says "this call is
// for member X" (the OAuth subject stored when the member linked their ZKT
// account) and passes the answer back. It keeps no queue and no cache: "received"
// reaches the phone only after the site has committed, and a failed call is the
// phone's to retry (client/util/judge-outbox.ts).
//
// Its own secret, ZKT_JUDGE_API_SECRET: it opens the judge endpoints and nothing
// else, and the general ZKT_INTERNAL_API_SECRET does not open these.
//
// These calls deliberately skip zkt_federation_cache.ts and its outgoing budget:
// that budget protects the public read API, and a time a judge sends must never
// wait behind page views. The site meters judge traffic on its own.

import axios, {AxiosRequestConfig} from 'axios';
import {isZktCompetitionId, zktSlugOf} from './ZktWcaAdapter';
import {logger} from './logger';

const DEFAULT_FEDERATION_ORIGIN =
	process.env.NODE_ENV === 'production' ? 'https://zekakuputurkiye.com' : 'http://localhost:4000';

/**
 * The site's origin. ZKT_FEDERATION_API (the public API base, when ops point it
 * at an internal address) wins so both APIs always reach the same host.
 */
export function judgeApiBase(): string {
	const publicApi = process.env.ZKT_FEDERATION_API;
	const origin = publicApi ? publicApi.replace(/\/api\/public\/v1\/?$/, '') : DEFAULT_FEDERATION_ORIGIN;
	return `${origin.replace(/\/+$/, '')}/api/internal/v1/judge`;
}

// The phone gives up after 8 to 10 seconds; answering later than that is wasted.
const REQUEST_TIMEOUT_MS = 7000;

/** A refusal or failure of a relayed call, in a form the resolver can pass on. */
export class JudgeRelayError extends Error {
	constructor(
		/** The site's own code (SELF_CARD, DISABLED...) or JUDGE_UNAVAILABLE / RATE_LIMITED. */
		readonly code: string,
		/** The HTTP status the site answered with; 0 when it did not answer. */
		readonly status: number,
		message: string,
		readonly retryAfterS?: number
	) {
		super(message);
		this.name = 'JudgeRelayError';
	}
}

/** The site takes a competition by slug; the app addresses it as `zkt-<slug>`. */
export function judgeCompetitionRef(competitionId: string): string {
	const ref = (competitionId || '').trim();
	return isZktCompetitionId(ref) ? zktSlugOf(ref) : ref;
}

function toRelayError(path: string, error: unknown): JudgeRelayError {
	if (axios.isAxiosError(error) && error.response) {
		const status = error.response.status;
		const body = error.response.data as {error?: unknown; message?: unknown} | undefined;
		const code = typeof body?.error === 'string' ? body.error : '';
		const message = typeof body?.message === 'string' ? body.message : '';
		if (status === 429) {
			const retryAfterS = Number(error.response.headers?.['retry-after']) || 5;
			return new JudgeRelayError('RATE_LIMITED', status, 'Çok fazla istek. Birazdan yeniden denenecek.', retryAfterS);
		}
		// A real refusal: the site's code in capitals with its own sentence.
		if (status >= 400 && status < 500 && code && code === code.toUpperCase() && status !== 401) {
			return new JudgeRelayError(code, status, message || code);
		}
		// Wrong or missing secret, the site not configured, or a 5xx: nothing the
		// judge can fix. Logged here because the phone only sees "unavailable".
		logger.warn('[ZktJudgeRelay] site refused the relay', {path, status, code});
		return new JudgeRelayError('JUDGE_UNAVAILABLE', status, 'Skor girişine şu an ulaşılamıyor.');
	}
	const reason = axios.isAxiosError(error) ? error.code || error.message : String(error);
	logger.warn('[ZktJudgeRelay] site did not answer', {path, reason});
	return new JudgeRelayError('JUDGE_UNAVAILABLE', 0, 'Skor girişine şu an ulaşılamıyor.');
}

async function call<T>(memberId: string, config: AxiosRequestConfig & {path: string}): Promise<T> {
	const secret = process.env.ZKT_JUDGE_API_SECRET;
	if (!secret) {
		logger.warn('[ZktJudgeRelay] ZKT_JUDGE_API_SECRET is not set');
		throw new JudgeRelayError('JUDGE_UNAVAILABLE', 0, 'Skor girişine şu an ulaşılamıyor.');
	}
	const {path, ...rest} = config;
	try {
		// The site runs with trailingSlash: without it every call is a redirect,
		// and a redirected POST loses its body.
		const res = await axios.request<T>({
			...rest,
			url: `${judgeApiBase()}/${path}/`,
			timeout: REQUEST_TIMEOUT_MS,
			maxRedirects: 0,
			headers: {
				Accept: 'application/json',
				Authorization: `Bearer ${secret}`,
				'x-zkt-member': memberId,
			},
		});
		// A captive portal or a proxy error page answers 200 with HTML. That is
		// not the site saying yes.
		if (!res.data || typeof res.data !== 'object') {
			throw new JudgeRelayError('JUDGE_UNAVAILABLE', res.status, 'Skor girişine şu an ulaşılamıyor.');
		}
		return res.data;
	} catch (error) {
		if (error instanceof JudgeRelayError) throw error;
		throw toRelayError(path, error);
	}
}

export const ZktJudgeRelay = {
	me(memberId: string, competitionId: string, jti?: string | null) {
		return call<Record<string, unknown>>(memberId, {
			path: 'me',
			method: 'GET',
			params: {competition: judgeCompetitionRef(competitionId), ...(jti ? {jti} : {})},
		});
	},

	board(memberId: string, competitionId: string, roundId?: string | null) {
		return call<Record<string, unknown>>(memberId, {
			path: 'board',
			method: 'GET',
			params: {competition: judgeCompetitionRef(competitionId), ...(roundId ? {round: roundId} : {})},
		});
	},

	request(memberId: string, body: Record<string, unknown>) {
		return call<Record<string, unknown>>(memberId, {path: 'requests', method: 'POST', data: body});
	},

	selfGrant(memberId: string, body: Record<string, unknown>) {
		return call<Record<string, unknown>>(memberId, {path: 'grants/self', method: 'POST', data: body});
	},

	previewApproval(memberId: string, token: string) {
		return call<Record<string, unknown>>(memberId, {path: 'approvals/preview', method: 'POST', data: {token}});
	},

	decideApproval(memberId: string, body: {token: string; decision: 'APPROVE' | 'REJECT'; reason?: string | null}) {
		return call<Record<string, unknown>>(memberId, {path: 'approvals', method: 'POST', data: body});
	},

	submitEntries(memberId: string, items: Record<string, unknown>[]) {
		return call<{results: Record<string, unknown>[]}>(memberId, {path: 'entries', method: 'POST', data: {items}});
	},

	endGrants(memberId: string, body: Record<string, unknown>) {
		return call<{ended: number}>(memberId, {path: 'grants/end', method: 'POST', data: body});
	},
};
