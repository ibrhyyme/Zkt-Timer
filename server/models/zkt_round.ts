import {getPrisma} from '../database';
import {ZktRoundStatus} from '@prisma/client';
import GraphQLError from '../util/graphql_error';
import {ErrorCode} from '../constants/errors';

// Round lifecycle:
//   UPCOMING ─▶ OPEN ─▶ ACTIVE ─▶ FINISHED
//              ◀──     ◀──        ◀── (reopen)
// UPCOMING: default, not yet started.
// OPEN: results can be created (first round) or inherited (later rounds).
// ACTIVE: scoretakers entering attempts.
// FINISHED: ranking/advancing frozen. Reopen sends back to ACTIVE.
const ROUND_STATUS_TRANSITIONS: Record<ZktRoundStatus, ZktRoundStatus[]> = {
	UPCOMING: ['OPEN'],
	OPEN: ['ACTIVE', 'UPCOMING'],
	ACTIVE: ['FINISHED', 'OPEN'],
	FINISHED: ['ACTIVE'],
};

export function canTransitionRoundStatus(
	from: ZktRoundStatus,
	to: ZktRoundStatus
): boolean {
	if (from === to) return true;
	return ROUND_STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertRoundTransition(from: ZktRoundStatus, to: ZktRoundStatus): void {
	if (!canTransitionRoundStatus(from, to)) {
		throw new GraphQLError(
			ErrorCode.BAD_INPUT,
			`Cannot transition round ${from} -> ${to}`
		);
	}
}

/**
 * Returns the next round in the same comp_event, or null if this is the last round.
 */
export async function getNextRound(roundId: string) {
	const prisma = getPrisma();
	const current = await prisma.zktRound.findUnique({
		where: {id: roundId},
		select: {comp_event_id: true, round_number: true},
	});
	if (!current) return null;
	return prisma.zktRound.findUnique({
		where: {
			comp_event_id_round_number: {
				comp_event_id: current.comp_event_id,
				round_number: current.round_number + 1,
			},
		},
	});
}

/**
 * Revokes advancement carry: deletes empty result rows in the next round
 * that were created by finalizeRound for competitors who had proceeds=true.
 * "Empty" = all attempts null AND best null. Preserves any row that already
 * has entered attempts (admin may have started scoretaking).
 */
export async function revokeAdvancementCarry(roundId: string): Promise<number> {
	const next = await getNextRound(roundId);
	if (!next) return 0;

	const prisma = getPrisma();
	const { count } = await prisma.zktResult.deleteMany({
		where: {
			round_id: next.id,
			attempt_1: null,
			attempt_2: null,
			attempt_3: null,
			attempt_4: null,
			attempt_5: null,
			best: null,
			average: null,
			no_show: false,
		},
	});
	return count;
}
