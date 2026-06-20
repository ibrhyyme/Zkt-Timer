import {getPrisma} from '../database';
import {ZktRoundStatus} from '@prisma/client';
import GraphQLError from '../util/graphql_error';
import {ErrorCode} from '../constants/errors';

// Round lifecycle (WCA-style, single confirmation):
//   UPCOMING ─▶ ACTIVE ─▶ FINISHED
//              ◀──        ◀── (reopen)
// UPCOMING: configured but not started; later rounds wait here with their
//   carried-over (advancing) competitors until the admin starts them.
// ACTIVE: scoretakers entering attempts (scrambles generated on entry).
// FINISHED: ranking/advancing frozen. Reopen sends back to ACTIVE.
// OPEN is kept for backward compatibility with existing rows but the UI no
// longer uses the two-step (open → activate) flow.
const ROUND_STATUS_TRANSITIONS: Record<ZktRoundStatus, ZktRoundStatus[]> = {
	UPCOMING: ['ACTIVE', 'OPEN'],
	OPEN: ['ACTIVE', 'UPCOMING'],
	ACTIVE: ['FINISHED', 'OPEN', 'UPCOMING'],
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
 * Make a round have exactly `count` groups (numbered 1..count) WITHOUT touching
 * existing ones — preserves their schedule (start/end times) and assignments.
 * Only extra high-numbered groups are deleted and missing numbers created. Set
 * on the Rounds tab; auto-distribute then fills these groups.
 */
export async function syncRoundGroups(roundId: string, count: number): Promise<void> {
	const prisma = getPrisma();
	const target = Math.max(0, count);
	const existing = await prisma.zktGroup.findMany({
		where: {round_id: roundId},
		orderBy: {group_number: 'asc'},
	});
	// Remove groups beyond the target count (highest numbers first).
	for (const g of existing.filter((x) => x.group_number > target)) {
		await prisma.zktGroup.delete({where: {id: g.id}});
	}
	// Create any missing group numbers in 1..target.
	const present = new Set(existing.map((g) => g.group_number));
	for (let n = 1; n <= target; n++) {
		if (!present.has(n)) {
			await prisma.zktGroup.create({data: {round_id: roundId, group_number: n}});
		}
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
