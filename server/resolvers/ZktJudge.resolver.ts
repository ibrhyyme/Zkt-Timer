// Online score entry: a judge types a competitor's times on their own phone, an
// organiser approves the judge by scanning a QR. Every rule and every row lives
// on the federation site; these operations relay the signed-in member's call
// there and hand the site's JSON back untouched (services/ZktJudgeRelay.ts).
//
// What this file adds is identity: the member is whoever holds the session, and
// the site is told their linked ZKT account (Integration.zkt_user_id), never an
// id from an argument. Without a ZKT link there is nobody to act as, so every
// operation but the status read refuses with ZKT_NOT_LINKED.
//
// The site's refusal codes (SELF_CARD, ROUND_FINISHED, EXPIRED_TOKEN...) reach
// the client as the GraphQL error code; the client has a sentence for each.

import {Arg, Authorized, Ctx, Mutation, Query, Resolver} from 'type-graphql';
import {GraphQLJSON} from 'graphql-scalars';
import {GraphQLContext} from '../@types/interfaces/server.interface';
import {getIntegration} from '../models/integration';
import GraphQLError from '../util/graphql_error';
import {ErrorCode} from '../constants/errors';
import {isZktCompetitionId} from '../services/ZktWcaAdapter';
import {JudgeRelayError, ZktJudgeRelay, judgeCompetitionRef} from '../services/ZktJudgeRelay';
import {ZktJudgeEntryInput, ZktJudgeRequestInput} from '../schemas/ZktJudge.schema';

const MAX_ENTRIES_PER_CALL = 50;
const MAX_TOKEN_LENGTH = 1024;
const MAX_REASON_LENGTH = 300;

function badInput(message: string): GraphQLError {
	return new GraphQLError(ErrorCode.BAD_INPUT, message);
}

/** The site User.id this session acts as, or null when no ZKT account is linked. */
async function memberIdOf(ctx: GraphQLContext): Promise<string | null> {
	const integration = await getIntegration(ctx.user, 'zkt');
	return integration?.zkt_user_id || null;
}

async function requireMember(ctx: GraphQLContext): Promise<string> {
	const memberId = await memberIdOf(ctx);
	if (!memberId) {
		throw new GraphQLError('ZKT_NOT_LINKED' as ErrorCode, 'Önce ZKT hesabını bağlamalısın.');
	}
	return memberId;
}

/** Turn a relay failure into a GraphQL error that carries the site's code. */
async function relay<T>(run: () => Promise<T>): Promise<T> {
	try {
		return await run();
	} catch (error) {
		if (error instanceof JudgeRelayError) {
			throw new GraphQLError(error.code as ErrorCode, error.message, {
				...(error.retryAfterS ? {retryAfterS: error.retryAfterS} : {}),
				// What the site answered (0: no answer). formatError drops it in
				// production; in development it says why the relay failed.
				upstreamStatus: error.status,
			});
		}
		throw error;
	}
}

function requestBody(input: ZktJudgeRequestInput): Record<string, unknown> {
	const purpose = input.purpose || 'JUDGE';
	if (purpose !== 'JUDGE') {
		return {purpose, cardId: input.cardId, attemptNo: input.attemptNo};
	}
	if (!input.competitionId || !isZktCompetitionId(input.competitionId)) throw badInput('Yarışma belirtilmedi.');
	const kind = input.judgeKind || 'self';
	const judge =
		kind === 'competitor'
			? {kind, key: input.judgeKey}
			: kind === 'external'
				? {kind, name: (input.judgeName || '').slice(0, 80)}
				: {kind: 'self'};
	return {
		purpose,
		competition: judgeCompetitionRef(input.competitionId),
		groupId: input.groupId,
		competitorKey: input.competitorKey,
		...(input.stationNumber != null ? {stationNumber: input.stationNumber} : {}),
		judge,
	};
}

@Resolver()
export class ZktJudgeResolver {
	/**
	 * The viewer's judging at one competition: whether the feature is on, the
	 * cards they hold with every attempt's state, and (with `jti`) whether the QR
	 * on their screen was decided. Polled while a QR shows, and how the app finds
	 * its way back to a card after it was closed.
	 */
	@Authorized()
	@Query(() => GraphQLJSON)
	async zktJudgeMe(
		@Ctx() ctx: GraphQLContext,
		@Arg('competitionId') competitionId: string,
		@Arg('jti', {nullable: true}) jti?: string
	): Promise<Record<string, unknown>> {
		if (!isZktCompetitionId(competitionId || '')) return {linked: false, enabled: false};
		const memberId = await memberIdOf(ctx);
		// The site can only be asked on behalf of a member, so without a link the
		// state of the switch is unknown here; the page shows nothing.
		if (!memberId) return {linked: false, enabled: false};
		const me = await relay(() => ZktJudgeRelay.me(memberId, competitionId, jti ? jti.slice(0, 128) : null));
		return {...me, linked: true};
	}

	/** Rounds of the competition, or one round's groups, competitors, stations and card progress. */
	@Authorized()
	@Query(() => GraphQLJSON)
	async zktJudgeBoard(
		@Ctx() ctx: GraphQLContext,
		@Arg('competitionId') competitionId: string,
		@Arg('roundId', {nullable: true}) roundId?: string
	): Promise<Record<string, unknown>> {
		if (!isZktCompetitionId(competitionId || '')) throw badInput('Yarışma belirtilmedi.');
		const memberId = await requireMember(ctx);
		return relay(() => ZktJudgeRelay.board(memberId, competitionId, roundId || null));
	}

	/** Ask for a QR (judge a card, correct a time, enter an extra). The site writes nothing for it. */
	@Authorized()
	@Mutation(() => GraphQLJSON)
	async zktJudgeRequest(
		@Ctx() ctx: GraphQLContext,
		@Arg('input', {validate: false}) input: ZktJudgeRequestInput
	): Promise<Record<string, unknown>> {
		const memberId = await requireMember(ctx);
		const body = requestBody(input);
		return relay(() => ZktJudgeRelay.request(memberId, body));
	}

	/** An approver judging on their own phone authorises it without a QR. */
	@Authorized()
	@Mutation(() => GraphQLJSON)
	async zktJudgeSelfGrant(
		@Ctx() ctx: GraphQLContext,
		@Arg('input', {validate: false}) input: ZktJudgeRequestInput
	): Promise<Record<string, unknown>> {
		const memberId = await requireMember(ctx);
		const body = requestBody({...input, purpose: 'JUDGE'});
		return relay(() => ZktJudgeRelay.selfGrant(memberId, body));
	}

	/**
	 * What a scanned QR asks for, as the approver may see it. A mutation although
	 * it writes nothing: the answer must never be cached or deduplicated.
	 */
	@Authorized()
	@Mutation(() => GraphQLJSON)
	async zktJudgeApprovalPreview(
		@Ctx() ctx: GraphQLContext,
		@Arg('token') token: string
	): Promise<Record<string, unknown>> {
		if (!token || token.length > MAX_TOKEN_LENGTH) throw badInput('QR kodu geçersiz.');
		const memberId = await requireMember(ctx);
		return relay(() => ZktJudgeRelay.previewApproval(memberId, token));
	}

	/** Approve or reject a scanned request. The site checks the approver's permission on every call. */
	@Authorized()
	@Mutation(() => GraphQLJSON)
	async zktJudgeDecide(
		@Ctx() ctx: GraphQLContext,
		@Arg('token') token: string,
		@Arg('decision') decision: string,
		@Arg('reason', {nullable: true}) reason?: string
	): Promise<Record<string, unknown>> {
		if (!token || token.length > MAX_TOKEN_LENGTH) throw badInput('QR kodu geçersiz.');
		if (decision !== 'APPROVE' && decision !== 'REJECT') throw badInput('Karar belirtilmedi.');
		const memberId = await requireMember(ctx);
		return relay(() =>
			ZktJudgeRelay.decideApproval(memberId, {
				token,
				decision,
				reason: reason ? reason.slice(0, MAX_REASON_LENGTH) : null,
			})
		);
	}

	/**
	 * Times from the judge's phone. Every item comes back with its own status
	 * and outcome; the phone drops an item from its outbox only when it finds
	 * that item's id in the answer.
	 */
	@Authorized()
	@Mutation(() => GraphQLJSON)
	async zktJudgeSubmitEntries(
		@Ctx() ctx: GraphQLContext,
		@Arg('items', () => [ZktJudgeEntryInput], {validate: false}) items: ZktJudgeEntryInput[]
	): Promise<Record<string, unknown>> {
		if (!Array.isArray(items) || items.length === 0 || items.length > MAX_ENTRIES_PER_CALL) {
			throw badInput('Gönderilecek süre sayısı geçersiz.');
		}
		const memberId = await requireMember(ctx);
		const payload = items.map((item) => ({
			submissionId: item.submissionId,
			cardId: item.cardId,
			kind: item.kind || 'ATTEMPT',
			...(item.attemptNo != null ? {attemptNo: item.attemptNo} : {}),
			...(item.value != null ? {value: item.value} : {}),
			...(item.rawValue != null ? {rawValue: item.rawValue} : {}),
			...(item.penalty != null ? {penalty: item.penalty} : {}),
			...(item.permit ? {permit: item.permit} : {}),
			...(item.deviceSeq != null ? {deviceSeq: item.deviceSeq} : {}),
		}));
		return relay(() => ZktJudgeRelay.submitEntries(memberId, payload));
	}

	/**
	 * End judging: one grant (the judge's own, or anyone's for an approver), the
	 * viewer's grant on one card, or all of the viewer's at this competition.
	 */
	@Authorized()
	@Mutation(() => GraphQLJSON)
	async zktJudgeEndGrant(
		@Ctx() ctx: GraphQLContext,
		@Arg('competitionId') competitionId: string,
		@Arg('grantId', {nullable: true}) grantId?: string,
		@Arg('cardId', {nullable: true}) cardId?: string,
		@Arg('all', {nullable: true}) all?: boolean
	): Promise<Record<string, unknown>> {
		if (!isZktCompetitionId(competitionId || '')) throw badInput('Yarışma belirtilmedi.');
		const memberId = await requireMember(ctx);
		const target = grantId ? {grantId} : cardId ? {cardId} : all === true ? {all: true} : null;
		if (!target) throw badInput('Hangi hakemliğin biteceği belirtilmedi.');
		return relay(() =>
			ZktJudgeRelay.endGrants(memberId, {competition: judgeCompetitionRef(competitionId), ...target})
		);
	}
}
