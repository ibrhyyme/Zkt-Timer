import crypto from 'crypto';
import {Prisma, PrismaClient} from '@prisma/client';
import {
	ALG_SET_CODE_ALPHABET,
	ALG_SET_CODE_LENGTH,
	ALG_SET_LIMITS,
	packCommaList,
	unpackCommaList,
} from '../../shared/trainer/alg_sets';

/**
 * Trainer algorithm sets: Prisma access shared by the resolver (design
 * .feedback/designs/trainer-sets.md sections 3 and 4).
 *
 * The select constants are the only place the resolver reads columns from; a field added to
 * server/schemas/AlgSet.schema.ts must be added here too (alg_set_select.test.ts).
 */

type Db = PrismaClient | Prisma.TransactionClient;

// ---------------------------------------------------------------------------------------
// Selects
// ---------------------------------------------------------------------------------------

export const ALG_SET_ITEM_SELECT = {
	id: true,
	category: true,
	case_name: true,
	subset: true,
	puzzle: true,
	algorithm: true,
	position: true,
} as const;

/**
 * Owner columns. Deliberately not publicUserInclude: these reads are open to anonymous
 * callers, and the small select keeps integrations and every private column out (B-11).
 * The ban columns are read for canViewAlgSet and never returned.
 */
export const ALG_SET_OWNER_SELECT = {
	id: true,
	username: true,
	verified: true,
	banned_forever: true,
	banned_until: true,
	profile: {select: {pfp_image: {select: {storage_path: true}}}},
} as const;

/** Row ordering of a set: position, then insertion order for positions written in a race. */
export const ALG_SET_ITEM_ORDER: Prisma.AlgSetItemOrderByWithRelationInput[] = [
	{position: 'asc'},
	{created_at: 'asc'},
	{id: 'asc'},
];

export const ALG_SET_SUMMARY_SELECT = {
	id: true,
	code: true,
	user_id: true,
	name: true,
	description: true,
	visibility: true,
	item_count: true,
	save_count: true,
	categories: true,
	puzzles: true,
	published_at: true,
	hidden_at: true,
	hidden_reason: true,
	created_at: true,
	updated_at: true,
	user: {select: ALG_SET_OWNER_SELECT},
	items: {select: ALG_SET_ITEM_SELECT, orderBy: ALG_SET_ITEM_ORDER, take: ALG_SET_LIMITS.PREVIEW_ITEMS},
} as const;

export type AlgSetItemRow = {
	id: string;
	category: string;
	case_name: string;
	subset: string;
	puzzle: string;
	algorithm: string;
	position: number;
};

export type AlgSetOwnerRow = {
	id: string;
	username: string;
	verified: boolean;
	banned_forever: boolean;
	banned_until: Date | null;
	profile?: {pfp_image?: {storage_path?: string | null} | null} | null;
};

export type AlgSetSummaryRow = {
	id: string;
	code: string;
	user_id: string;
	name: string;
	description: string | null;
	visibility: string;
	item_count: number;
	save_count: number;
	categories: string;
	puzzles: string;
	published_at: Date | null;
	hidden_at: Date | null;
	hidden_reason: string | null;
	created_at: Date;
	updated_at: Date;
	user: AlgSetOwnerRow;
	/** The preview rows (first PREVIEW_ITEMS by position). */
	items: AlgSetItemRow[];
};

// ---------------------------------------------------------------------------------------
// Access (design 4.4)
// ---------------------------------------------------------------------------------------

export type AlgSetViewer = {id: string; admin?: boolean | null; mod?: boolean | null} | null | undefined;

/** Admins and mods see every set, for moderation. */
export function isAlgSetStaff(viewer: AlgSetViewer): boolean {
	return !!viewer && (!!viewer.admin || !!viewer.mod);
}

/** Ban state read at query time; a temporary ban ends on its own and the sets come back. */
export function isOwnerBanned(
	owner: {banned_forever?: boolean | null; banned_until?: Date | string | null} | null | undefined,
	now: Date = new Date()
): boolean {
	if (!owner) return false;
	if (owner.banned_forever) return true;
	if (!owner.banned_until) return false;
	return new Date(owner.banned_until).getTime() > now.getTime();
}

/**
 * The one access rule (design 4.4). Owner: always (hidden included, a banned owner cannot
 * sign in anyway). Staff: always. Everyone else, signed in or not: only a link or public set
 * that is not hidden and whose owner is not banned. Saving a set grants nothing extra.
 */
export function canViewAlgSet(
	set: {
		user_id: string;
		visibility: string;
		hidden_at: Date | string | null;
		user?: {banned_forever?: boolean | null; banned_until?: Date | string | null} | null;
	},
	viewer: AlgSetViewer,
	now: Date = new Date()
): boolean {
	if (!set) return false;
	if (viewer && viewer.id === set.user_id) return true;
	if (isAlgSetStaff(viewer)) return true;
	if (set.visibility !== 'link' && set.visibility !== 'public') return false;
	if (set.hidden_at) return false;
	if (isOwnerBanned(set.user, now)) return false;
	return true;
}

/** Prisma filter on the owner relation: not banned right now (community list, design 4.6). */
export function ownerNotBannedWhere(now: Date = new Date()): Prisma.UserAccountWhereInput {
	return {
		banned_forever: false,
		OR: [{banned_until: null}, {banned_until: {lte: now}}],
	};
}

// ---------------------------------------------------------------------------------------
// Mapping to the GraphQL types
// ---------------------------------------------------------------------------------------

export function toAlgSetOwner(owner: AlgSetOwnerRow) {
	return {
		id: owner.id,
		username: owner.username,
		verified: !!owner.verified,
		avatar_path: owner.profile?.pfp_image?.storage_path || null,
	};
}

export function toAlgSetItem(row: AlgSetItemRow) {
	return {
		id: row.id,
		category: row.category,
		case_name: row.case_name,
		subset: row.subset,
		puzzle: row.puzzle,
		algorithm: row.algorithm,
		position: row.position,
	};
}

/** AlgSetSummary for a viewer who passed canViewAlgSet. */
export function toAlgSetSummary(row: AlgSetSummaryRow, viewer: AlgSetViewer) {
	const privileged = !!viewer && (viewer.id === row.user_id || isAlgSetStaff(viewer));
	return {
		id: row.id,
		code: row.code,
		name: row.name,
		description: row.description || null,
		visibility: row.visibility,
		item_count: row.item_count,
		save_count: row.save_count,
		categories: unpackCommaList(row.categories),
		puzzles: unpackCommaList(row.puzzles),
		preview: (row.items || []).slice(0, ALG_SET_LIMITS.PREVIEW_ITEMS).map(toAlgSetItem),
		owner: toAlgSetOwner(row.user),
		published_at: row.published_at || null,
		updated_at: row.updated_at,
		created_at: row.created_at,
		hidden: privileged && !!row.hidden_at,
	};
}

/**
 * AlgSet for a viewer who passed canViewAlgSet. `items` is left out on purpose: the field
 * resolver reads all rows only when the query selects them.
 */
export function toAlgSet(row: AlgSetSummaryRow, viewer: AlgSetViewer, isSaved: boolean) {
	return {
		...toAlgSetSummary(row, viewer),
		is_owner: !!viewer && viewer.id === row.user_id,
		is_saved: isSaved,
	};
}

// ---------------------------------------------------------------------------------------
// Share code (design 3.1)
// ---------------------------------------------------------------------------------------

// Largest multiple of the alphabet size below 256: bytes above it are dropped so every
// character is equally likely.
const CODE_BYTE_LIMIT = 256 - (256 % ALG_SET_CODE_ALPHABET.length);

export function generateAlgSetCode(randomBytes: (n: number) => Buffer = crypto.randomBytes): string {
	let code = '';
	while (code.length < ALG_SET_CODE_LENGTH) {
		const bytes = randomBytes(ALG_SET_CODE_LENGTH * 2);
		for (let i = 0; i < bytes.length && code.length < ALG_SET_CODE_LENGTH; i++) {
			if (bytes[i] < CODE_BYTE_LIMIT) code += ALG_SET_CODE_ALPHABET[bytes[i] % ALG_SET_CODE_ALPHABET.length];
		}
	}
	return code;
}

/** True for a Prisma unique violation on AlgSet.code. */
export function isCodeCollision(error: any): boolean {
	if (error?.code !== 'P2002') return false;
	const target = error?.meta?.target;
	if (Array.isArray(target)) return target.includes('code');
	return typeof target === 'string' ? target.includes('code') : true;
}

export const CODE_ATTEMPTS = 5;

// ---------------------------------------------------------------------------------------
// Counters (design 3.1, 4.2): recomputed from the rows, never incremented, so a double tap
// or a race cannot drift them.
// ---------------------------------------------------------------------------------------

/** item_count, categories, puzzles and updated_at from the rows, inside the caller's transaction. */
export async function recomputeAlgSetCounters(db: Db, setId: string) {
	const rows = await db.algSetItem.findMany({
		where: {set_id: setId},
		select: {category: true, puzzle: true},
	});
	await db.algSet.update({
		where: {id: setId},
		data: {
			item_count: rows.length,
			categories: packCommaList(rows.map((r) => r.category)),
			puzzles: packCommaList(rows.map((r) => r.puzzle)),
			updated_at: new Date(),
		},
	});
	return rows.length;
}

/**
 * save_count from AlgSetSave rows. Saves are not edits, so updated_at keeps its value: Prisma
 * stamps an @updatedAt column on every update and updateMany unless the write names it, and a
 * fresh stamp would move the owner's set to the top of "My sets" whenever someone saves it.
 */
export async function recomputeAlgSetSaveCount(db: Db, setId: string) {
	const count = await db.algSetSave.count({where: {set_id: setId}});
	const current = await db.algSet.findUnique({where: {id: setId}, select: {updated_at: true}});
	if (!current) return count;
	await db.algSet.updateMany({where: {id: setId}, data: {save_count: count, updated_at: current.updated_at}});
	return count;
}

// ---------------------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------------------

export function getAlgSetRowById(db: Db, id: string) {
	return db.algSet.findUnique({where: {id}, select: ALG_SET_SUMMARY_SELECT}) as Promise<AlgSetSummaryRow | null>;
}

export function getAlgSetRowByCode(db: Db, code: string) {
	return db.algSet.findUnique({where: {code}, select: ALG_SET_SUMMARY_SELECT}) as Promise<AlgSetSummaryRow | null>;
}

export function getAlgSetItems(db: Db, setId: string) {
	return db.algSetItem.findMany({
		where: {set_id: setId},
		select: ALG_SET_ITEM_SELECT,
		orderBy: ALG_SET_ITEM_ORDER,
	}) as Promise<AlgSetItemRow[]>;
}

export async function isAlgSetSavedBy(db: Db, userId: string | null | undefined, setId: string): Promise<boolean> {
	if (!userId) return false;
	const row = await db.algSetSave.findUnique({
		where: {user_id_set_id: {user_id: userId, set_id: setId}},
		select: {id: true},
	});
	return !!row;
}
