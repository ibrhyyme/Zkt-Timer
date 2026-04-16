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
		where.status = {not: 'DRAFT'};
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

const STATUS_TRANSITIONS: Record<ZktCompStatus, ZktCompStatus[]> = {
	DRAFT: ['ANNOUNCED'],
	ANNOUNCED: ['REGISTRATION_OPEN', 'DRAFT'],
	REGISTRATION_OPEN: ['REGISTRATION_CLOSED', 'ANNOUNCED'],
	REGISTRATION_CLOSED: ['ONGOING', 'REGISTRATION_OPEN'],
	ONGOING: ['FINISHED'],
	FINISHED: ['PUBLISHED'],
	PUBLISHED: [],
};

export function canTransitionStatus(from: ZktCompStatus, to: ZktCompStatus): boolean {
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
