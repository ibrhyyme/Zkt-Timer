import {getPrisma} from '../database';
import {ZktCompStatus, Prisma} from '@prisma/client';
import GraphQLError from '../util/graphql_error';
import {ErrorCode} from '../constants/errors';
import {getAttemptCount} from './zkt_result';

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
					assignments: {include: {group: true, person: true}},
					results: {
						include: {
							user: publicUserInclude,
							person: true,
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
			person: true,
			events: true,
		},
	},
	delegates: {
		include: {
			user: publicUserInclude,
		},
	},
	organizers: {
		include: {
			user: publicUserInclude,
		},
	},
	tabs: {
		orderBy: {tab_order: 'asc' as const},
	},
	schedule_items: {
		orderBy: {start_time: 'asc' as const},
	},
};

export async function getZktCompetitionById(id: string) {
	// Accept slug or UUID so admin URLs and mutations work with the readable slug.
	return getPrisma().zktCompetition.findFirst({
		where: {OR: [{slug: id}, {id}]},
	});
}

export async function getZktCompetitionWithDetails(id: string) {
	// Accept either the readable slug (BursaSummer2026) or the raw UUID, so old
	// UUID links keep working alongside the new slug URLs.
	return getPrisma().zktCompetition.findFirst({
		where: {OR: [{slug: id}, {id}]},
		include: zktCompetitionFullInclude,
	});
}

export async function listZktCompetitions(params: {
	page: number;
	pageSize: number;
	searchQuery?: string;
	status?: ZktCompStatus | null;
	onlyPublic?: boolean;
	viewerId?: string | null;
}) {
	const prisma = getPrisma();
	const {page, pageSize, searchQuery, status, onlyPublic, viewerId} = params;

	const where: Prisma.ZktCompetitionWhereInput = {};

	if (onlyPublic) {
		// Public listing: hide DRAFT/CONFIRMED (pre-announcement) entries.
		// Visibility: show PUBLIC — plus any PRIVATE comp the viewer is tied to
		// (registered, delegate, or creator). This way manually-added users on
		// private competitions still see them in "My Competitions" style lists.
		const visibilityFilter: Prisma.ZktCompetitionWhereInput[] = [{visibility: 'PUBLIC'}];
		if (viewerId) {
			visibilityFilter.push({
				visibility: 'PRIVATE',
				OR: [
					{registrations: {some: {user_id: viewerId}}},
					{delegates: {some: {user_id: viewerId}}},
					{created_by_id: viewerId},
				],
			});
		}
		where.AND = [
			{OR: visibilityFilter},
			{status: {notIn: ['DRAFT', 'CONFIRMED']}},
		];
		// NOTE: No country scoping. ZKT is TR-only, and filtering by the viewer's
		// join_country hid competitions from users whose account country wasn't
		// exactly 'TR' (null/blank slipped through, others didn't) — every logged-in
		// user must see all public competitions regardless of their profile country.
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

const MAX_SLUG_LENGTH = 32;
// "Words YYYY" — WCA VALID_NAME_RE equivalent (unicode-aware for Turkish).
const NAME_YEAR_RE = /^([-&.:'\s\p{L}\p{N}]+)\s+(\d{4})$/u;

// ASCII transliteration of Turkish + accented letters, mirrors the WCA
// monolith's ActiveSupport transliterate(:en) before id generation.
function transliterateAscii(input: string): string {
	return input
		.replace(/ı/g, 'i').replace(/İ/g, 'I')
		.replace(/ş/g, 's').replace(/Ş/g, 'S')
		.replace(/ğ/g, 'g').replace(/Ğ/g, 'G')
		.replace(/ç/g, 'c').replace(/Ç/g, 'C')
		.replace(/ü/g, 'u').replace(/Ü/g, 'U')
		.replace(/ö/g, 'o').replace(/Ö/g, 'O')
		.normalize('NFD')
		.replace(/[̀-ͯ]/g, '');
}

/**
 * Build a WCA-style competition id from the name. Birebir port of the WCA
 * monolith's Competition#create_id_and_cell_name
 * (Referans/worldcubeassociation.org-main/app/models/competition.rb:755):
 * strip the trailing year, transliterate to ASCII, drop every non-alphanumeric
 * char (keeping letter case), truncate to leave room for the year, append the
 * year. "Bursa Summer 2026" -> "BursaSummer2026". When the name has no trailing
 * year, fall back to the start year (WCA requires it; ZKT stays lenient).
 */
export function slugifyCompetitionName(name: string, fallbackYear: number): string {
	const m = name.trim().match(NAME_YEAR_RE);
	const nameWithoutYear = m ? m[1] : name;
	const year = m ? m[2] : String(fallbackYear);
	const safe = transliterateAscii(nameWithoutYear).replace(/[^a-z0-9]+/gi, '');
	return safe.slice(0, MAX_SLUG_LENGTH - year.length) + year;
}

/**
 * Unique slug. Same name+year is rare, but the slug column is @unique, so on a
 * collision append -2, -3, ... to avoid a create failure (safety net).
 */
export async function generateUniqueSlug(
	prisma: ReturnType<typeof getPrisma>,
	name: string,
	fallbackYear: number
): Promise<string> {
	const base = slugifyCompetitionName(name, fallbackYear);
	let slug = base;
	let n = 1;
	// eslint-disable-next-line no-await-in-loop
	while (await prisma.zktCompetition.findFirst({where: {slug}, select: {id: true}})) {
		n++;
		slug = `${base}-${n}`;
	}
	return slug;
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
	championshipType?: 'NATIONAL' | 'REGIONAL' | 'CITY' | 'INVITATIONAL' | 'YOUTH' | null;
	shortName?: string | null;
	latitude?: number | null;
	longitude?: number | null;
	registrationOpensAt?: Date | null;
	registrationClosesAt?: Date | null;
	registrationEditDeadline?: Date | null;
	onSpotRegistration?: boolean;
	cancellationPolicy?: string | null;
	guestsEnabled?: boolean;
	forceComment?: boolean;
	extraRequirements?: string | null;
	contact?: string | null;
	mainEventId?: string | null;
	eventIds: string[];
}) {
	const prisma = getPrisma();
	const slug = await generateUniqueSlug(prisma, params.name, params.dateStart.getFullYear());

	return prisma.zktCompetition.create({
		data: {
			slug,
			name: params.name,
			description: params.description ?? null,
			date_start: params.dateStart,
			date_end: params.dateEnd,
			location: params.location,
			location_address: params.locationAddress ?? null,
			competitor_limit: params.competitorLimit ?? null,
			visibility: params.visibility,
			...({championship_type: params.championshipType ?? null} as any),
			short_name: params.shortName ?? null,
			latitude: params.latitude ?? null,
			longitude: params.longitude ?? null,
			registration_opens_at: params.registrationOpensAt ?? null,
			registration_closes_at: params.registrationClosesAt ?? null,
			registration_edit_deadline: params.registrationEditDeadline ?? null,
			on_spot_registration: params.onSpotRegistration ?? false,
			cancellation_policy: params.cancellationPolicy ?? null,
			guests_enabled: params.guestsEnabled ?? true,
			force_comment: params.forceComment ?? false,
			extra_requirements: params.extraRequirements ?? null,
			contact: params.contact ?? null,
			main_event_id: params.mainEventId ?? null,
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

	// Publish blockers (recordranks finishContest validations): every round
	// must be FINISHED and no result may be left with missing attempts —
	// otherwise rankings/records go out the door half-entered.
	const events = await prisma.zktCompEvent.findMany({
		where: {competition_id: id},
		include: {rounds: {include: {results: true}}},
	});
	const problems: string[] = [];
	for (const ev of events) {
		for (const round of ev.rounds) {
			if (round.status !== 'FINISHED') {
				problems.push(`${ev.event_id} R${round.round_number}: not finished`);
				continue;
			}
			const fullCount = getAttemptCount(round.format);
			for (const r of round.results) {
				if (r.no_show) continue;
				const attempts = [
					r.attempt_1,
					r.attempt_2,
					r.attempt_3,
					r.attempt_4,
					r.attempt_5,
				].slice(0, fullCount);
				// A competitor that missed the cutoff legitimately has only the
				// first cutoff_attempts attempts — don't flag those as missing.
				let expected = fullCount;
				if (round.cutoff_cs && round.cutoff_attempts && round.cutoff_attempts < fullCount) {
					const madeCutoff = attempts
						.slice(0, round.cutoff_attempts)
						.some((a) => a !== null && a > 0 && a < round.cutoff_cs!);
					if (!madeCutoff) expected = round.cutoff_attempts;
				}
				const filled = attempts.filter((a) => a !== null).length;
				if (filled < expected) {
					problems.push(
						`${ev.event_id} R${round.round_number}: incomplete result (${filled}/${expected})`
					);
				}
			}
		}
	}
	if (problems.length > 0) {
		const head = problems.slice(0, 5).join('; ');
		const more = problems.length > 5 ? ` (+${problems.length - 5})` : '';
		throw new GraphQLError(ErrorCode.BAD_INPUT, `Cannot publish: ${head}${more}`);
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
	const [comp, delegate, organizer] = await Promise.all([
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
		prisma.zktCompOrganizer.findUnique({
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
	if (organizer) return;

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

/**
 * Next competition-local registrant id (WCA registrantId): max existing + 1.
 * Assigned in registration/import order so the number printed on scorecards,
 * shown on the competitors list and searched in scoretaking is stable. The
 * @@unique([competition_id, registration_number]) constraint guards against a
 * rare concurrent-register collision (the second insert simply retries/fails).
 */
export async function nextRegistrationNumber(competitionId: string): Promise<number> {
	const prisma = getPrisma();
	const last = await prisma.zktRegistration.findFirst({
		where: {competition_id: competitionId, registration_number: {not: null}},
		orderBy: {registration_number: 'desc'},
		select: {registration_number: true},
	});
	return (last?.registration_number ?? 0) + 1;
}
