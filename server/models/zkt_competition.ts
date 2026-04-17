import {getPrisma} from '../database';
import {ZktCompStatus, Prisma} from '@prisma/client';
import GraphQLError from '../util/graphql_error';
import {ErrorCode} from '../constants/errors';

// Reusable includes
export const publicUserInclude = {
	include: {
		profile: {include: {pfp_image: true}},
		integrations: true,
		badges: {include: {badge_type: true}},
	},
};

export const zktCompetitionFullInclude = {
	created_by: publicUserInclude,
	events: {
		include: {
			rounds: {
				include: {
					groups: true,
					results: {
						include: {
							user: publicUserInclude,
						},
					},
				},
				orderBy: {round_number: 'asc' as const},
			},
		},
		orderBy: {event_order: 'asc' as const},
	},
	registrations: {
		include: {
			user: publicUserInclude,
			events: true,
		},
	},
	delegates: {
		include: {
			user: publicUserInclude,
		},
	},
};

export async function getZktCompetitionById(id: string) {
	return getPrisma().zktCompetition.findUnique({
		where: {id},
	});
}

export async function getZktCompetitionWithDetails(id: string) {
	return getPrisma().zktCompetition.findUnique({
		where: {id},
		include: zktCompetitionFullInclude,
	});
}

export async function listZktCompetitions(params: {
	page: number;
	pageSize: number;
	searchQuery?: string;
	status?: ZktCompStatus | null;
	onlyPublic?: boolean;
}) {
	const prisma = getPrisma();
	const {page, pageSize, searchQuery, status, onlyPublic} = params;

	const where: Prisma.ZktCompetitionWhereInput = {};

	if (onlyPublic) {
		where.visibility = 'PUBLIC';
		// Hide pre-announcement states (DRAFT internal, CONFIRMED awaiting announce).
		// CANCELLED stays visible so users learn about the cancellation.
		where.status = {notIn: ['DRAFT', 'CONFIRMED']};
	}

	if (status) {
		where.status = status;
	}

	if (searchQuery && searchQuery.length > 0) {
		where.OR = [
			{name: {contains: searchQuery, mode: 'insensitive'}},
			{location: {contains: searchQuery, mode: 'insensitive'}},
		];
	}

	const [items, total] = await Promise.all([
		prisma.zktCompetition.findMany({
			where,
			orderBy: {date_start: 'desc'},
			skip: page * pageSize,
			take: pageSize,
			include: {
				created_by: publicUserInclude,
				events: true,
				registrations: true,
			},
		}),
		prisma.zktCompetition.count({where}),
	]);

	return {
		items,
		total,
		hasMore: (page + 1) * pageSize < total,
	};
}

export async function getMyZktCompetitions(userId: string) {
	const prisma = getPrisma();

	return prisma.zktCompetition.findMany({
		where: {
			OR: [
				{registrations: {some: {user_id: userId}}},
				{delegates: {some: {user_id: userId}}},
				{created_by_id: userId},
			],
		},
		orderBy: {date_start: 'desc'},
		include: {
			created_by: publicUserInclude,
			events: true,
			registrations: {where: {user_id: userId}},
			delegates: {where: {user_id: userId}},
		},
	});
}

export async function createZktCompetitionWithEvents(params: {
	createdById: string;
	name: string;
	description?: string | null;
	dateStart: Date;
	dateEnd: Date;
	location: string;
	locationAddress?: string | null;
	competitorLimit?: number | null;
	visibility: 'PUBLIC' | 'PRIVATE';
	eventIds: string[];
}) {
	const prisma = getPrisma();

	return prisma.zktCompetition.create({
		data: {
			name: params.name,
			description: params.description ?? null,
			date_start: params.dateStart,
			date_end: params.dateEnd,
			location: params.location,
			location_address: params.locationAddress ?? null,
			competitor_limit: params.competitorLimit ?? null,
			visibility: params.visibility,
			created_by_id: params.createdById,
			events: {
				create: params.eventIds.map((eventId, index) => ({
					event_id: eventId,
					event_order: index,
					rounds: {
						// Every event gets a default Round 1 with AO5 format
						create: {
							round_number: 1,
							format: 'AO5',
						},
					},
				})),
			},
		},
		include: zktCompetitionFullInclude,
	});
}

// ============================================================================
// STATE MACHINE
// ============================================================================

// WCA pattern:
//   DRAFT → CONFIRMED → ANNOUNCED → REGISTRATION_OPEN → REGISTRATION_CLOSED
//     → ONGOING → FINISHED → PUBLISHED
// Cancel is reachable from any live state; cancelled is terminal.
const STATUS_TRANSITIONS: Record<ZktCompStatus, ZktCompStatus[]> = {
	DRAFT: ['CONFIRMED', 'CANCELLED'],
	CONFIRMED: ['ANNOUNCED', 'DRAFT', 'CANCELLED'],
	ANNOUNCED: ['REGISTRATION_OPEN', 'CONFIRMED', 'CANCELLED'],
	REGISTRATION_OPEN: ['REGISTRATION_CLOSED', 'ANNOUNCED', 'CANCELLED'],
	REGISTRATION_CLOSED: ['ONGOING', 'REGISTRATION_OPEN', 'CANCELLED'],
	ONGOING: ['FINISHED', 'CANCELLED'],
	FINISHED: ['PUBLISHED', 'ONGOING'], // results can be unpublished back for correction
	PUBLISHED: ['FINISHED'],
	CANCELLED: [],
};

export function canTransitionStatus(from: ZktCompStatus, to: ZktCompStatus): boolean {
	if (from === to) return true;
	return STATUS_TRANSITIONS[from]?.includes(to) ?? false;
}

export async function updateZktCompetitionStatus(id: string, newStatus: ZktCompStatus) {
	const prisma = getPrisma();
	const current = await prisma.zktCompetition.findUnique({where: {id}});
	if (!current) {
		throw new GraphQLError(ErrorCode.NOT_FOUND);
	}
	if (!canTransitionStatus(current.status, newStatus)) {
		throw new GraphQLError(ErrorCode.BAD_INPUT, `Cannot transition ${current.status} -> ${newStatus}`);
	}
	return prisma.zktCompetition.update({
		where: {id},
		data: {status: newStatus},
	});
}

// ============================================================================
// LIFECYCLE ACTIONS (confirm / announce / cancel / publish)
// ============================================================================

/**
 * Confirm competition: validate all required fields are set before it can
 * be announced publicly. Called by mod/admin. Sets `confirmed_at`.
 */
export async function confirmZktCompetition(id: string) {
	const prisma = getPrisma();
	const comp = await prisma.zktCompetition.findUnique({
		where: {id},
		include: {events: true},
	});
	if (!comp) throw new GraphQLError(ErrorCode.NOT_FOUND);

	if (!canTransitionStatus(comp.status, 'CONFIRMED')) {
		throw new GraphQLError(
			ErrorCode.BAD_INPUT,
			`Cannot confirm from status ${comp.status}`
		);
	}

	const missing: string[] = [];
	if (!comp.name?.trim()) missing.push('name');
	if (!comp.location?.trim()) missing.push('location');
	if (!comp.date_start) missing.push('date_start');
	if (!comp.date_end) missing.push('date_end');
	if (comp.events.length === 0) missing.push('events');
	if (missing.length > 0) {
		throw new GraphQLError(
			ErrorCode.BAD_INPUT,
			`Missing required fields: ${missing.join(', ')}`
		);
	}

	return prisma.zktCompetition.update({
		where: {id},
		data: {status: 'CONFIRMED', confirmed_at: new Date()},
	});
}

/**
 * Announce: CONFIRMED → ANNOUNCED. Public-visible from this point.
 * Triggers notification email separately in the resolver.
 */
export async function announceZktCompetition(id: string, announcedById: string) {
	const prisma = getPrisma();
	const comp = await prisma.zktCompetition.findUnique({where: {id}});
	if (!comp) throw new GraphQLError(ErrorCode.NOT_FOUND);

	if (!canTransitionStatus(comp.status, 'ANNOUNCED')) {
		throw new GraphQLError(
			ErrorCode.BAD_INPUT,
			`Cannot announce from status ${comp.status}`
		);
	}

	return prisma.zktCompetition.update({
		where: {id},
		data: {
			status: 'ANNOUNCED',
			announced_at: new Date(),
			announced_by_id: announcedById,
		},
	});
}

/**
 * Cancel: any live state → CANCELLED. Reason stored for public communication.
 */
export async function cancelZktCompetition(id: string, reason: string | null) {
	const prisma = getPrisma();
	const comp = await prisma.zktCompetition.findUnique({where: {id}});
	if (!comp) throw new GraphQLError(ErrorCode.NOT_FOUND);

	if (!canTransitionStatus(comp.status, 'CANCELLED')) {
		throw new GraphQLError(
			ErrorCode.BAD_INPUT,
			`Cannot cancel from status ${comp.status}`
		);
	}

	return prisma.zktCompetition.update({
		where: {id},
		data: {
			status: 'CANCELLED',
			cancelled_at: new Date(),
			cancel_reason: reason,
		},
	});
}

/**
 * Publish results: FINISHED → PUBLISHED. Sets `results_published_at`.
 * Until this is set, the public result queries hide completed rounds.
 */
export async function publishZktResults(id: string) {
	const prisma = getPrisma();
	const comp = await prisma.zktCompetition.findUnique({where: {id}});
	if (!comp) throw new GraphQLError(ErrorCode.NOT_FOUND);

	if (!canTransitionStatus(comp.status, 'PUBLISHED')) {
		throw new GraphQLError(
			ErrorCode.BAD_INPUT,
			`Cannot publish from status ${comp.status}`
		);
	}

	return prisma.zktCompetition.update({
		where: {id},
		data: {status: 'PUBLISHED', results_published_at: new Date()},
	});
}

/**
 * Unpublish: PUBLISHED → FINISHED. Clears timestamp; used if a wrong result
 * slipped through and needs correction. Rare.
 */
export async function unpublishZktResults(id: string) {
	const prisma = getPrisma();
	const comp = await prisma.zktCompetition.findUnique({where: {id}});
	if (!comp) throw new GraphQLError(ErrorCode.NOT_FOUND);
	if (comp.status !== 'PUBLISHED') {
		throw new GraphQLError(ErrorCode.BAD_INPUT, 'Competition is not published');
	}
	return prisma.zktCompetition.update({
		where: {id},
		data: {status: 'FINISHED', results_published_at: null},
	});
}

// ============================================================================
// DELEGATE PERMISSION
// ============================================================================

/**
 * Ensures the acting user can modify a competition's operational state:
 * admins, mods, the creator, or an assigned delegate.
 * Throws FORBIDDEN otherwise.
 */
export async function assertCanModifyCompetition(
	user: {id: string; admin: boolean; mod: boolean},
	competitionId: string
): Promise<void> {
	if (user.admin || user.mod) return;

	const prisma = getPrisma();
	const [comp, delegate] = await Promise.all([
		prisma.zktCompetition.findUnique({
			where: {id: competitionId},
			select: {created_by_id: true},
		}),
		prisma.zktCompDelegate.findUnique({
			where: {
				competition_id_user_id: {
					competition_id: competitionId,
					user_id: user.id,
				},
			},
		}),
	]);

	if (!comp) {
		throw new GraphQLError(ErrorCode.NOT_FOUND);
	}

	if (comp.created_by_id === user.id) return;
	if (delegate) return;

	throw new GraphQLError(ErrorCode.FORBIDDEN);
}

export async function getRoundWithCompetition(roundId: string) {
	const prisma = getPrisma();
	return prisma.zktRound.findUnique({
		where: {id: roundId},
		include: {
			comp_event: {
				include: {
					competition: true,
				},
			},
		},
	});
}
