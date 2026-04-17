import {getPrisma} from '../database';
import {ZktRegistrationStatus} from '@prisma/client';

/**
 * Registration history action codes. Kept as strings (not enum) so we can
 * evolve without a Prisma migration each time.
 */
export const HISTORY_ACTIONS = {
	CREATED: 'CREATED',
	STATUS_CHANGED: 'STATUS_CHANGED',
	EVENTS_CHANGED: 'EVENTS_CHANGED',
	NOTES_CHANGED: 'NOTES_CHANGED',
	ADMIN_COMMENT_CHANGED: 'ADMIN_COMMENT_CHANGED',
	GUESTS_CHANGED: 'GUESTS_CHANGED',
	WAITLIST_POSITION_CHANGED: 'WAITLIST_POSITION_CHANGED',
	WAITLIST_AUTO_PROMOTED: 'WAITLIST_AUTO_PROMOTED',
	WITHDRAWN: 'WITHDRAWN',
} as const;

export async function appendRegistrationHistory(
	registrationId: string,
	actorId: string,
	action: string,
	changedAttributes?: Record<string, unknown>
) {
	return getPrisma().zktRegistrationHistory.create({
		data: {
			registration_id: registrationId,
			actor_id: actorId,
			action,
			changed_attributes: (changedAttributes ?? undefined) as any,
		},
	});
}

/**
 * Assign the next waiting-list slot to this registration. Positions are 1-based
 * and dense within a competition.
 */
export async function enqueueWaitlist(registrationId: string) {
	const prisma = getPrisma();
	const reg = await prisma.zktRegistration.findUnique({
		where: {id: registrationId},
	});
	if (!reg) return;

	const last = await prisma.zktRegistration.findFirst({
		where: {
			competition_id: reg.competition_id,
			status: 'WAITLISTED',
		},
		orderBy: {waiting_list_position: 'desc'},
	});
	const nextPos = (last?.waiting_list_position ?? 0) + 1;

	await prisma.zktRegistration.update({
		where: {id: registrationId},
		data: {status: 'WAITLISTED', waiting_list_position: nextPos},
	});
}

/**
 * Auto-promote: when an APPROVED registration is withdrawn/rejected and the
 * competition has a competitor_limit, pick the waitlisted user with the
 * smallest waiting_list_position and flip them to APPROVED. Promoted id is
 * returned so the resolver can emit Socket.IO + history entries.
 */
export async function promoteNextFromWaitlist(
	competitionId: string,
	actorId: string
): Promise<string | null> {
	const prisma = getPrisma();
	const comp = await prisma.zktCompetition.findUnique({
		where: {id: competitionId},
		select: {competitor_limit: true},
	});
	if (!comp?.competitor_limit) return null;

	const approvedCount = await prisma.zktRegistration.count({
		where: {competition_id: competitionId, status: 'APPROVED'},
	});
	if (approvedCount >= comp.competitor_limit) return null;

	const next = await prisma.zktRegistration.findFirst({
		where: {competition_id: competitionId, status: 'WAITLISTED'},
		orderBy: {waiting_list_position: 'asc'},
	});
	if (!next) return null;

	await prisma.zktRegistration.update({
		where: {id: next.id},
		data: {status: 'APPROVED', waiting_list_position: null},
	});
	await appendRegistrationHistory(next.id, actorId, HISTORY_ACTIONS.WAITLIST_AUTO_PROMOTED, {
		previous_position: next.waiting_list_position,
	});

	return next.id;
}

/**
 * Reseat waitlist positions so they form a dense 1..N sequence after a
 * removal. Cheap: only rewrites drift beyond the removed slot.
 */
export async function normalizeWaitlistPositions(competitionId: string) {
	const prisma = getPrisma();
	const waitlisted = await prisma.zktRegistration.findMany({
		where: {competition_id: competitionId, status: 'WAITLISTED'},
		orderBy: {waiting_list_position: 'asc'},
		select: {id: true, waiting_list_position: true},
	});
	await Promise.all(
		waitlisted.map((r, i) => {
			const desired = i + 1;
			if (r.waiting_list_position === desired) return Promise.resolve();
			return prisma.zktRegistration.update({
				where: {id: r.id},
				data: {waiting_list_position: desired},
			});
		})
	);
}

export async function isWithinEditWindow(competitionId: string): Promise<boolean> {
	const prisma = getPrisma();
	const comp = await prisma.zktCompetition.findUnique({
		where: {id: competitionId},
		select: {registration_edit_deadline: true, status: true},
	});
	if (!comp) return false;
	// Allow edits only while registration is open. Deadline narrows further.
	if (comp.status !== 'REGISTRATION_OPEN') return false;
	if (!comp.registration_edit_deadline) return true;
	return new Date() < comp.registration_edit_deadline;
}
