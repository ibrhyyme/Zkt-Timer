// Client calls of online score entry. Every one goes to Zkt-Timer's own server
// (ZktJudge.resolver.ts), which relays it to the federation site for the
// signed-in member. The answers are the site's JSON, typed by shared/zkt_judge.ts.

import {gqlMutateTyped, gqlQueryTyped} from '../components/api';
import {
	ZktJudgeApprovalPreviewDocument,
	ZktJudgeBoardDocument,
	ZktJudgeDecideDocument,
	ZktJudgeEndGrantDocument,
	ZktJudgeMeDocument,
	ZktJudgeRequestDocument,
	ZktJudgeSelfGrantDocument,
	ZktJudgeSubmitEntriesDocument,
} from '../@types/generated/graphql';
import {
	JUDGE_KNOWN_ERRORS,
	JudgeApprovalPreview,
	JudgeBoard,
	JudgeChoice,
	JudgeEntryItem,
	JudgeEntryResult,
	JudgeGrantResult,
	JudgeMe,
	JudgeRequestResult,
} from '../../shared/zkt_judge';

// The phone stops waiting before the hall Wi-Fi does. A call that lands after
// this is harmless: entries carry an id the site answers the same way twice.
const CALL_TIMEOUT_MS = 9000;

export interface JudgeCallError {
	/** A site or relay code (SELF_CARD, DISABLED, JUDGE_UNAVAILABLE...), 'AUTH', or 'NETWORK'. */
	code: string;
	/** Whether asking again later can work without the judge doing anything. */
	retryable: boolean;
}

export function toJudgeError(error: any): JudgeCallError {
	if (error && typeof error.code === 'string' && typeof error.retryable === 'boolean') return error;
	const gqlError = error?.graphQLErrors?.[0] || error?.networkError?.result?.errors?.[0];
	const code = gqlError?.extensions?.code;
	// "Not signed in" arrives as FORBIDDEN from the auth checker, UNAUTHENTICATED from the gateway.
	if (code === 'FORBIDDEN' || code === 'UNAUTHENTICATED') return {code: 'AUTH', retryable: false};
	if (code === 'RATE_LIMITED' || code === 'JUDGE_UNAVAILABLE') return {code, retryable: true};
	if (typeof code === 'string' && (JUDGE_KNOWN_ERRORS as readonly string[]).includes(code)) {
		return {code, retryable: false};
	}
	if (!gqlError) return {code: 'NETWORK', retryable: true};
	return {code: 'UNKNOWN', retryable: true};
}

/** Translation key for a refusal; unknown codes share one sentence. */
export function judgeErrorKey(code: string): string {
	const known = ['AUTH', 'NETWORK', ...JUDGE_KNOWN_ERRORS] as readonly string[];
	return `zkt_comp.judge_error_${known.includes(code) ? code.toLowerCase() : 'unknown'}`;
}

function withTimeout<T>(promise: Promise<T>): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		const timer = setTimeout(() => reject({code: 'NETWORK', retryable: true} as JudgeCallError), CALL_TIMEOUT_MS);
		promise.then(
			(value) => {
				clearTimeout(timer);
				resolve(value);
			},
			(error) => {
				clearTimeout(timer);
				reject(toJudgeError(error));
			}
		);
	});
}

/** An answer that is not the site's JSON object (a proxy page, an empty body) is a failed call. */
function objectOrFail<T>(value: unknown): T {
	if (!value || typeof value !== 'object') throw {code: 'NETWORK', retryable: true} as JudgeCallError;
	return value as T;
}

export async function fetchJudgeMe(competitionId: string, jti?: string | null): Promise<JudgeMe> {
	const res = await withTimeout(
		gqlQueryTyped(ZktJudgeMeDocument, {competitionId, jti: jti || null}, {fetchPolicy: 'no-cache'})
	);
	return objectOrFail<JudgeMe>(res.data?.zktJudgeMe);
}

export async function fetchJudgeBoard(competitionId: string, roundId?: string | null): Promise<JudgeBoard> {
	const res = await withTimeout(
		gqlQueryTyped(ZktJudgeBoardDocument, {competitionId, roundId: roundId || null}, {fetchPolicy: 'no-cache'})
	);
	return objectOrFail<JudgeBoard>(res.data?.zktJudgeBoard);
}

export interface JudgeCardRequest {
	competitionId: string;
	groupId: string;
	competitorKey: string;
	stationNumber: number | null;
	judge: JudgeChoice;
}

function requestInput(request: JudgeCardRequest) {
	return {
		competitionId: request.competitionId,
		purpose: 'JUDGE',
		groupId: request.groupId,
		competitorKey: request.competitorKey,
		stationNumber: request.stationNumber,
		judgeKind: request.judge.kind,
		judgeKey: request.judge.kind === 'competitor' ? request.judge.key : null,
		judgeName: request.judge.kind === 'external' ? request.judge.name : null,
	};
}

/** Checks the request and returns its QR and warnings. The site stores nothing for it. */
export async function requestJudgeQr(request: JudgeCardRequest): Promise<JudgeRequestResult> {
	const res = await withTimeout(
		gqlMutateTyped(ZktJudgeRequestDocument, {input: requestInput(request)}, {fetchPolicy: 'no-cache'} as any)
	);
	return objectOrFail<JudgeRequestResult>(res.data?.zktJudgeRequest);
}

/**
 * A QR for "Süre düzelt" (CORRECT) or "Ekstra iste" (EXTRA) on one attempt of a
 * card the member judges. Once an organiser approves it, one new time may be
 * sent for that attempt, carrying `permit`.
 */
export async function requestPermitQr(
	cardId: string,
	attemptNo: number,
	purpose: 'CORRECT' | 'EXTRA'
): Promise<JudgeRequestResult> {
	const res = await withTimeout(
		gqlMutateTyped(ZktJudgeRequestDocument, {input: {purpose, cardId, attemptNo}}, {fetchPolicy: 'no-cache'} as any)
	);
	return objectOrFail<JudgeRequestResult>(res.data?.zktJudgeRequest);
}

/** An approver authorises their own phone for the card, without a QR. */
export async function selfAuthorizeJudge(request: JudgeCardRequest): Promise<JudgeGrantResult> {
	const res = await withTimeout(
		gqlMutateTyped(ZktJudgeSelfGrantDocument, {input: requestInput(request)}, {fetchPolicy: 'no-cache'} as any)
	);
	return objectOrFail<JudgeGrantResult>(res.data?.zktJudgeSelfGrant);
}

/** What a scanned QR asks for. Writes nothing; somebody without the right sees no person or card. */
export async function previewJudgeApproval(token: string): Promise<JudgeApprovalPreview> {
	const res = await withTimeout(
		gqlMutateTyped(ZktJudgeApprovalPreviewDocument, {token}, {fetchPolicy: 'no-cache'} as any)
	);
	return objectOrFail<JudgeApprovalPreview>(res.data?.zktJudgeApprovalPreview);
}

/** The organiser's decision on a scanned QR. The same QR decided twice answers with the first decision. */
export async function decideJudgeApproval(
	token: string,
	decision: 'APPROVE' | 'REJECT',
	reason?: string | null
): Promise<JudgeGrantResult> {
	const res = await withTimeout(
		gqlMutateTyped(ZktJudgeDecideDocument, {token, decision, reason: reason || null}, {fetchPolicy: 'no-cache'} as any)
	);
	return objectOrFail<JudgeGrantResult>(res.data?.zktJudgeDecide);
}

export async function endJudging(competitionId: string, target: {grantId: string} | {all: true}): Promise<number> {
	const res = await withTimeout(
		gqlMutateTyped(ZktJudgeEndGrantDocument, {competitionId, ...target}, {fetchPolicy: 'no-cache'} as any)
	);
	return objectOrFail<{ended: number}>(res.data?.zktJudgeEndGrant).ended;
}

/**
 * Send outbox entries. Resolves with the site's per-entry answers; rejects with
 * 'auth' (sign in again) or 'retry' (no usable answer), which is all the outbox
 * tells apart.
 */
export async function sendJudgeEntries(items: JudgeEntryItem[]): Promise<JudgeEntryResult[]> {
	try {
		const res = await withTimeout(
			gqlMutateTyped(ZktJudgeSubmitEntriesDocument, {items}, {fetchPolicy: 'no-cache'} as any)
		);
		const results = objectOrFail<{results?: unknown}>(res.data?.zktJudgeSubmitEntries).results;
		if (!Array.isArray(results)) throw {code: 'NETWORK', retryable: true} as JudgeCallError;
		return results as JudgeEntryResult[];
	} catch (error) {
		throw toJudgeError(error).code === 'AUTH' ? 'auth' : 'retry';
	}
}
