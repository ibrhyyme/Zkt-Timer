import {Arg, Authorized, Ctx, FieldResolver, Int, Mutation, Query, Resolver, Root} from 'type-graphql';
import {GraphQLContext} from '../@types/interfaces/server.interface';
import {Role} from '../middlewares/auth';
import GraphQLError from '../util/graphql_error';
import {ErrorCode} from '../constants/errors';
import {logger} from '../services/logger';
import {checkRateLimit, peekRateLimit} from '../services/rate_limit';
import {extractIp} from '../util/request';
import {
	AlgSet,
	AlgSetCreateInput,
	AlgSetItem,
	AlgSetItemInput,
	AlgSetUpdateInput,
	CommunityAlgSetPage,
	MyAlgSets,
} from '../schemas/AlgSet.schema';
import {
	ALG_SET_ITEM_SELECT,
	ALG_SET_SUMMARY_SELECT,
	AlgSetSummaryRow,
	AlgSetViewer,
	canViewAlgSet,
	CODE_ATTEMPTS,
	generateAlgSetCode,
	getAlgSetItems,
	getAlgSetRowByCode,
	getAlgSetRowById,
	isAlgSetSavedBy,
	isCodeCollision,
	ownerNotBannedWhere,
	recomputeAlgSetCounters,
	recomputeAlgSetSaveCount,
	toAlgSet,
	toAlgSetItem,
	toAlgSetSummary,
} from '../models/alg_set';
import {
	casesNeedingPool,
	getAlgCatalog,
	getCatalogCase,
	matchAlgorithm,
	matchSetItems,
	PoolRow,
	SetItemCandidate,
} from '../util/alg_catalog';
import {
	ALG_SET_COMMUNITY,
	ALG_SET_LIMITS,
	ALG_SET_MODERATION,
	ALG_SET_RATE_LIMITS,
	AlgSetTextError,
	algSetCaseKey,
	algSetTextLength,
	checkAlgSetDescription,
	checkAlgSetName,
	cleanAlgSetDescription,
	cleanAlgSetName,
	commaListNeedle,
	DEFAULT_ALG_SET_VISIBILITY,
	isAlgSetCode,
	isAlgSetCommunitySort,
	isAlgSetReportReason,
	isAlgSetVisibility,
	isSharedVisibility,
} from '../../shared/trainer/alg_sets';

/**
 * Trainer algorithm sets (design .feedback/designs/trainer-sets.md section 4).
 *
 * Open to every signed-in user (owner decision Q1); reads (algSet, communityAlgSets) are open
 * to anonymous callers too, under the access rule in server/models/alg_set.ts canViewAlgSet.
 * Nothing here needs Pro: Smart mode and PDF are gated on the client where they are used.
 *
 * Errors carry `extensions.i18nKey` (alg_set_errors.*). addAlgSetItems also names the rejected
 * cases in `extensions.rejected` (`category::case_name`), forwarded by server/app.ts formatError.
 */

export const ALG_SET_ERROR_KEYS = {
	notFound: 'alg_set_errors.not_found',
	itemNotFound: 'alg_set_errors.item_not_found',
	nameEmpty: 'alg_set_errors.name_empty',
	nameTooLong: 'alg_set_errors.name_too_long',
	descriptionTooLong: 'alg_set_errors.description_too_long',
	descriptionTooManyLines: 'alg_set_errors.description_too_many_lines',
	visibilityInvalid: 'alg_set_errors.visibility_invalid',
	hiddenLocked: 'alg_set_errors.hidden_locked',
	limitSets: 'alg_set_errors.limit_sets',
	limitItems: 'alg_set_errors.limit_items',
	limitSaves: 'alg_set_errors.limit_saves',
	itemsEmpty: 'alg_set_errors.items_empty',
	unknownCase: 'alg_set_errors.unknown_case',
	unknownAlgorithm: 'alg_set_errors.unknown_algorithm',
	reorderMismatch: 'alg_set_errors.reorder_mismatch',
	ownSetSave: 'alg_set_errors.own_set_save',
	ownSetReport: 'alg_set_errors.own_set_report',
	alreadyReported: 'alg_set_errors.already_reported',
	reportReasonInvalid: 'alg_set_errors.report_reason_invalid',
	reportNoteTooLong: 'alg_set_errors.report_note_too_long',
	rateLimited: 'alg_set_errors.rate_limited',
} as const;

export type AlgSetErrorKey = keyof typeof ALG_SET_ERROR_KEYS;

/** Message codes stay English and stable (logs, tests); the screen uses the i18nKey. */
const ERROR_MESSAGES: Partial<Record<AlgSetErrorKey, string>> = {
	unknownCase: 'ALG_SET_UNKNOWN_CASE',
	unknownAlgorithm: 'ALG_SET_UNKNOWN_ALGORITHM',
};

export function algSetError(key: AlgSetErrorKey, code: ErrorCode = ErrorCode.BAD_INPUT, extra?: Record<string, unknown>) {
	return new GraphQLError(code, ERROR_MESSAGES[key] || `AlgSet: ${key}`, {
		i18nKey: ALG_SET_ERROR_KEYS[key],
		...(extra || {}),
	});
}

const TEXT_ERROR_KEY: Record<AlgSetTextError, AlgSetErrorKey> = {
	NAME_EMPTY: 'nameEmpty',
	NAME_TOO_LONG: 'nameTooLong',
	DESCRIPTION_TOO_LONG: 'descriptionTooLong',
	DESCRIPTION_TOO_MANY_LINES: 'descriptionTooManyLines',
};

// Raw input longer than this is refused before cleaning (cleaning is linear, but a megabyte
// string has no business reaching it).
const RAW_TEXT_LIMIT = 5000;

function cleanName(raw: unknown): string {
	if (typeof raw !== 'string' || raw.length > RAW_TEXT_LIMIT) throw algSetError('nameTooLong');
	const name = cleanAlgSetName(raw);
	const error = checkAlgSetName(name);
	if (error) throw algSetError(TEXT_ERROR_KEY[error]);
	return name;
}

/** Null when empty (the column is optional). */
function cleanDescription(raw: unknown): string | null {
	if (raw === null || raw === undefined) return null;
	if (typeof raw !== 'string' || raw.length > RAW_TEXT_LIMIT) throw algSetError('descriptionTooLong');
	const description = cleanAlgSetDescription(raw);
	const error = checkAlgSetDescription(description);
	if (error) throw algSetError(TEXT_ERROR_KEY[error]);
	return description || null;
}

// ---------------------------------------------------------------------------------------
// Rate limits (design 4.5)
// ---------------------------------------------------------------------------------------

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

/**
 * The SSR preview of a set page asks GraphQL from inside the server over localhost
 * (client/components/api.ts), so its address is the same for every visitor. Such a read is
 * not counted, or every link preview would share one bucket and one NOT_FOUND lock.
 * Only a request with no proxy header at all counts: anything that came through Cloudflare
 * or nginx carries cf-connecting-ip or X-Forwarded-For, so an outside caller cannot pose as
 * the loopback by sending a header.
 */
export function isLoopbackRequest(req: any): boolean {
	const headers = req?.headers || {};
	if (headers['cf-connecting-ip'] || headers['x-forwarded-for'] || headers['x-real-ip']) return false;
	const socketIp = req?.socket?.remoteAddress || req?.connection?.remoteAddress || '';
	return typeof socketIp === 'string' && LOOPBACK.has(socketIp.trim());
}

async function limitOrThrow(key: string, rule: {max: number; windowSeconds: number}, failOpen = false) {
	const res = await checkRateLimit(key, rule.max, rule.windowSeconds, {failOpen});
	if (!res.allowed) {
		logger.warn('Alg set rate limit', {key, count: res.count});
		throw algSetError('rateLimited', ErrorCode.RATE_LIMITED);
	}
}

const writeLimit = (context: GraphQLContext) =>
	limitOrThrow(`algset:write:${context.user.id}`, ALG_SET_RATE_LIMITS.WRITE);

type ReadScope = {
	/** Anonymous caller's IP, when the IP limits and the NOT_FOUND lock apply. */
	ip: string | null;
};

/**
 * Read limit (fails open): per user when signed in, per IP when anonymous, nothing for the
 * server's own SSR request.
 */
async function readLimit(context: GraphQLContext): Promise<ReadScope> {
	if (context.user) {
		await limitOrThrow(`algset:read:user:${context.user.id}`, ALG_SET_RATE_LIMITS.READ, true);
		return {ip: null};
	}
	if (isLoopbackRequest(context.req)) return {ip: null};
	const ip = extractIp(context.req) || null;
	if (ip) await limitOrThrow(`algset:read:ip:${ip}`, ALG_SET_RATE_LIMITS.READ, true);
	return {ip};
}

const notFoundCountKey = (ip: string) => `algset:nf:ip:${ip}`;
const notFoundLockKey = (ip: string) => `algset:nflock:ip:${ip}`;

async function isNotFoundLocked(ip: string | null): Promise<boolean> {
	if (!ip) return false;
	return (await peekRateLimit(notFoundLockKey(ip), {failOpen: true})) > 0;
}

/** Counts an anonymous NOT_FOUND; at the limit the IP gets only NOT_FOUND for lockSeconds. */
async function countNotFound(ip: string | null) {
	if (!ip) return;
	const rule = ALG_SET_RATE_LIMITS.NOT_FOUND_LOCK;
	const res = await checkRateLimit(notFoundCountKey(ip), rule.max, rule.windowSeconds, {failOpen: true});
	if (!res.allowed) {
		await checkRateLimit(notFoundLockKey(ip), 1, rule.lockSeconds, {failOpen: true});
		logger.warn('Alg set NOT_FOUND lock', {ip, count: res.count});
	}
}

// ---------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------

function viewerOf(context: GraphQLContext): AlgSetViewer {
	const user = context.user;
	return user ? {id: user.id, admin: user.admin, mod: user.mod} : null;
}

/** The caller's own set (summary row), or NOT_FOUND. Someone else's set id says the same. */
async function requireOwnSet(context: GraphQLContext, id: unknown): Promise<AlgSetSummaryRow> {
	const row = typeof id === 'string' && id ? await getAlgSetRowById(context.prisma, id) : null;
	if (!row || row.user_id !== context.user.id) throw algSetError('notFound', ErrorCode.NOT_FOUND);
	return row;
}

async function ownSetResponse(context: GraphQLContext, id: string) {
	const row = await getAlgSetRowById(context.prisma, id);
	if (!row) throw algSetError('notFound', ErrorCode.NOT_FOUND);
	return toAlgSet(row, viewerOf(context), false);
}

function asStringArray(value: unknown, max: number): string[] | null {
	if (!Array.isArray(value) || value.length > max) return null;
	if (!value.every((v) => typeof v === 'string' && v.length > 0 && v.length <= 64)) return null;
	return value as string[];
}

// ---------------------------------------------------------------------------------------
// Resolver
// ---------------------------------------------------------------------------------------

@Resolver(() => AlgSet)
export class AlgSetResolver {
	/** All rows by position; read only when the query selects `items` (design 4.1). */
	@FieldResolver(() => [AlgSetItem])
	async items(@Root() set: AlgSet, @Ctx() context: GraphQLContext) {
		const rows = await getAlgSetItems(context.prisma, set.id);
		return rows.map(toAlgSetItem);
	}

	/** Own sets (newest edit first) and saved sets. A saved set that is no longer shared comes back unavailable without its name. */
	@Authorized()
	@Query(() => MyAlgSets)
	async myAlgSets(@Ctx() context: GraphQLContext) {
		const {prisma} = context;
		const viewer = viewerOf(context);
		const now = new Date();

		const [own, saves] = await Promise.all([
			prisma.algSet.findMany({
				where: {user_id: context.user.id},
				select: ALG_SET_SUMMARY_SELECT,
				orderBy: [{updated_at: 'desc'}, {id: 'asc'}],
			}),
			prisma.algSetSave.findMany({
				where: {user_id: context.user.id},
				select: {set_id: true, created_at: true, set: {select: ALG_SET_SUMMARY_SELECT}},
				orderBy: [{created_at: 'desc'}, {id: 'asc'}],
			}),
		]);

		return {
			own: (own as AlgSetSummaryRow[]).map((row) => toAlgSetSummary(row, viewer)),
			saved: saves.map((save) => {
				const row = save.set as AlgSetSummaryRow | null;
				// The saver is never the owner; staff saving a set still sees it as a regular user would.
				const available = !!row && canViewAlgSet(row, {id: context.user.id}, now);
				return {
					set_id: save.set_id,
					saved_at: save.created_at,
					set: available ? toAlgSetSummary(row, {id: context.user.id}) : null,
					unavailable: !available,
				};
			}),
		};
	}

	/** One set by share code. Missing, private, hidden and banned owner all answer the same NOT_FOUND. */
	@Query(() => AlgSet)
	async algSet(@Ctx() context: GraphQLContext, @Arg('code') code: string) {
		const scope = await readLimit(context);
		if (await isNotFoundLocked(scope.ip)) throw algSetError('notFound', ErrorCode.NOT_FOUND);

		const viewer = viewerOf(context);
		const row = isAlgSetCode(code) ? await getAlgSetRowByCode(context.prisma, code) : null;
		if (!row || !canViewAlgSet(row, viewer)) {
			await countNotFound(scope.ip);
			throw algSetError('notFound', ErrorCode.NOT_FOUND);
		}

		const isSaved = await isAlgSetSavedBy(context.prisma, viewer?.id, row.id);
		return toAlgSet(row, viewer, isSaved);
	}

	/** Community Sets: public, not hidden, owner not banned (design 4.6). */
	@Query(() => CommunityAlgSetPage)
	async communityAlgSets(
		@Ctx() context: GraphQLContext,
		@Arg('q', {nullable: true}) q?: string,
		@Arg('sort', {nullable: true}) sort?: string,
		@Arg('puzzle', {nullable: true}) puzzle?: string,
		@Arg('category', {nullable: true}) category?: string,
		@Arg('page', () => Int, {nullable: true}) page?: number,
		@Arg('page_size', () => Int, {nullable: true}) pageSize?: number
	) {
		await readLimit(context);
		const {prisma} = context;
		const viewer = viewerOf(context);

		const size = Math.min(
			ALG_SET_COMMUNITY.MAX_PAGE_SIZE,
			Math.max(1, Math.floor(Number(pageSize) || ALG_SET_COMMUNITY.DEFAULT_PAGE_SIZE))
		);
		// A cap on skip: nobody scrolls 10 000 sets, and a huge offset is a slow query.
		const pageIndex = Math.min(400, Math.max(0, Math.floor(Number(page) || 0)));
		const order = isAlgSetCommunitySort(sort) ? sort : 'new';

		const where: any = {
			visibility: 'public',
			hidden_at: null,
			// An empty set has nothing to study; listed, it would only put a free text name on the public page.
			item_count: {gt: 0},
			user: ownerNotBannedWhere(),
		};

		const search = typeof q === 'string' ? cleanAlgSetName(q).slice(0, ALG_SET_COMMUNITY.QUERY_MAX_LENGTH) : '';
		if (algSetTextLength(search) >= ALG_SET_COMMUNITY.QUERY_MIN_LENGTH) {
			// Case folding in the database (ILIKE), never toLocaleLowerCase('tr') in JS.
			where.OR = [
				{name: {contains: search, mode: 'insensitive'}},
				{description: {contains: search, mode: 'insensitive'}},
			];
		}
		if (typeof puzzle === 'string' && puzzle && puzzle.length <= 20 && puzzle.indexOf(',') === -1) {
			where.puzzles = {contains: commaListNeedle(puzzle)};
		}
		if (typeof category === 'string' && category && category.length <= 40 && category.indexOf(',') === -1) {
			where.categories = {contains: commaListNeedle(category)};
		}

		const orderBy: any[] =
			order === 'popular'
				? [{save_count: 'desc'}, {published_at: 'desc'}, {id: 'asc'}]
				: [{published_at: 'desc'}, {id: 'asc'}];

		const [rows, total] = await Promise.all([
			prisma.algSet.findMany({
				where,
				select: ALG_SET_SUMMARY_SELECT,
				orderBy,
				skip: pageIndex * size,
				take: size,
			}),
			prisma.algSet.count({where}),
		]);

		return {
			items: (rows as AlgSetSummaryRow[]).map((row) => toAlgSetSummary(row, viewer)),
			total,
			has_more: (pageIndex + 1) * size < total,
		};
	}

	@Authorized()
	@Mutation(() => AlgSet)
	async createAlgSet(@Ctx() context: GraphQLContext, @Arg('input', () => AlgSetCreateInput) input: AlgSetCreateInput) {
		const {prisma, user} = context;
		const name = cleanName(input?.name);
		const description = cleanDescription(input?.description);
		const visibility = input?.visibility ?? DEFAULT_ALG_SET_VISIBILITY;
		if (!isAlgSetVisibility(visibility)) throw algSetError('visibilityInvalid');

		await limitOrThrow(`algset:create:${user.id}`, ALG_SET_RATE_LIMITS.CREATE);

		const owned = await prisma.algSet.count({where: {user_id: user.id}});
		if (owned >= ALG_SET_LIMITS.MAX_SETS_PER_USER) throw algSetError('limitSets');

		for (let attempt = 1; ; attempt++) {
			try {
				const created = await prisma.algSet.create({
					data: {
						code: generateAlgSetCode(),
						user_id: user.id,
						name,
						description,
						visibility,
						published_at: visibility === 'public' ? new Date() : null,
					},
					select: {id: true},
				});
				return ownSetResponse(context, created.id);
			} catch (error) {
				if (isCodeCollision(error) && attempt < CODE_ATTEMPTS) continue;
				throw error;
			}
		}
	}

	@Authorized()
	@Mutation(() => AlgSet)
	async updateAlgSet(
		@Ctx() context: GraphQLContext,
		@Arg('id') id: string,
		@Arg('input', () => AlgSetUpdateInput) input: AlgSetUpdateInput
	) {
		const set = await requireOwnSet(context, id);
		await writeLimit(context);

		const data: Record<string, unknown> = {};
		if (input?.name !== undefined && input?.name !== null) data.name = cleanName(input.name);
		if (input?.description !== undefined) data.description = cleanDescription(input.description);
		if (input?.visibility !== undefined && input?.visibility !== null && input.visibility !== set.visibility) {
			if (!isAlgSetVisibility(input.visibility)) throw algSetError('visibilityInvalid');
			if (set.hidden_at) throw algSetError('hiddenLocked', ErrorCode.FORBIDDEN);
			data.visibility = input.visibility;
			if (input.visibility === 'public' && !set.published_at) data.published_at = new Date();
		}

		if (Object.keys(data).length > 0) {
			await context.prisma.algSet.update({where: {id: set.id}, data});
		}
		return ownSetResponse(context, set.id);
	}

	/** Rows and saves go by cascade, reports keep their row with an empty link. Stats are device side and untouched. */
	@Authorized()
	@Mutation(() => Boolean)
	async deleteAlgSet(@Ctx() context: GraphQLContext, @Arg('id') id: string) {
		const set = await requireOwnSet(context, id);
		await writeLimit(context);
		const res = await context.prisma.algSet.deleteMany({where: {id: set.id, user_id: context.user.id}});
		return res.count > 0;
	}

	/** New share code; the old link stops working, people who saved the set keep it (they hold set_id). */
	@Authorized()
	@Mutation(() => AlgSet)
	async resetAlgSetCode(@Ctx() context: GraphQLContext, @Arg('id') id: string) {
		const set = await requireOwnSet(context, id);
		await writeLimit(context);

		for (let attempt = 1; ; attempt++) {
			try {
				await context.prisma.algSet.update({where: {id: set.id}, data: {code: generateAlgSetCode()}});
				return ownSetResponse(context, set.id);
			} catch (error) {
				if (isCodeCollision(error) && attempt < CODE_ATTEMPTS) continue;
				throw error;
			}
		}
	}

	/**
	 * Adds cases at the end. A case already in the set is skipped (double tap). Every row is
	 * checked against the library and the pool (design 4.3); one bad row rejects the request
	 * and `extensions.rejected` names the cases.
	 */
	@Authorized()
	@Mutation(() => AlgSet)
	async addAlgSetItems(
		@Ctx() context: GraphQLContext,
		@Arg('set_id') setId: string,
		@Arg('items', () => [AlgSetItemInput], {validate: false}) items: AlgSetItemInput[]
	) {
		const {prisma} = context;
		const set = await requireOwnSet(context, setId);
		await writeLimit(context);

		if (!Array.isArray(items) || items.length === 0) throw algSetError('itemsEmpty');
		if (items.length > ALG_SET_LIMITS.MAX_ITEMS_PER_ADD) throw algSetError('limitItems');

		// One candidate per case, first one wins.
		const seen = new Set<string>();
		const candidates: SetItemCandidate[] = [];
		for (const item of items) {
			const candidate = {
				category: String(item?.category ?? ''),
				case_name: String(item?.case_name ?? ''),
				algorithm: String(item?.algorithm ?? ''),
			};
			const key = algSetCaseKey(candidate.category, candidate.case_name);
			if (seen.has(key)) continue;
			seen.add(key);
			candidates.push(candidate);
		}

		const existing = await prisma.algSetItem.findMany({
			where: {set_id: set.id},
			select: {category: true, case_name: true, position: true},
		});
		const present = new Set(existing.map((r) => algSetCaseKey(r.category, r.case_name)));
		const fresh = candidates.filter((c) => !present.has(algSetCaseKey(c.category, c.case_name)));
		if (fresh.length === 0) return ownSetResponse(context, set.id);
		if (existing.length + fresh.length > ALG_SET_LIMITS.MAX_ITEMS_PER_SET) throw algSetError('limitItems');

		const catalog = getAlgCatalog();
		const need = casesNeedingPool(catalog, fresh);
		const pool: PoolRow[] = need.caseNames.length
			? await prisma.trainerAlternative.findMany({
					where: {category: {in: need.categories}, case_name: {in: need.caseNames}},
					select: {category: true, case_name: true, algorithm: true, original_input: true},
			  })
			: [];

		const match = matchSetItems(catalog, fresh, pool);
		if (match.unknownCases.length || match.unknownAlgorithms.length) {
			throw algSetError(match.unknownCases.length ? 'unknownCase' : 'unknownAlgorithm', ErrorCode.BAD_INPUT, {
				rejected: [...match.unknownCases, ...match.unknownAlgorithms],
			});
		}

		const start = existing.reduce((max, r) => Math.max(max, r.position), -1) + 1;
		await prisma.$transaction(async (tx) => {
			await tx.algSetItem.createMany({
				data: match.accepted.map((item, i) => ({
					set_id: set.id,
					category: item.category,
					case_name: item.case_name,
					subset: item.subset,
					puzzle: item.puzzle,
					algorithm: item.algorithm,
					position: start + i,
				})),
				skipDuplicates: true,
			});
			const count = await recomputeAlgSetCounters(tx, set.id);
			// Two adds racing past the check above: roll back the later one.
			if (count > ALG_SET_LIMITS.MAX_ITEMS_PER_SET) throw algSetError('limitItems');
		});

		return ownSetResponse(context, set.id);
	}

	/** Changes the algorithm of one row (variant choice, design 5.4), checked like an add. */
	@Authorized()
	@Mutation(() => AlgSetItem)
	async updateAlgSetItem(
		@Ctx() context: GraphQLContext,
		@Arg('item_id') itemId: string,
		@Arg('algorithm') algorithm: string
	) {
		const {prisma} = context;
		const item =
			typeof itemId === 'string' && itemId
				? await prisma.algSetItem.findFirst({
						where: {id: itemId, set: {user_id: context.user.id}},
						select: {...ALG_SET_ITEM_SELECT, set_id: true},
				  })
				: null;
		if (!item) throw algSetError('itemNotFound', ErrorCode.NOT_FOUND);
		await writeLimit(context);

		const catalog = getAlgCatalog();
		const known = getCatalogCase(catalog, item.category, item.case_name);
		if (!known) {
			throw algSetError('unknownCase', ErrorCode.BAD_INPUT, {rejected: [algSetCaseKey(item.category, item.case_name)]});
		}
		const pool = await prisma.trainerAlternative.findMany({
			where: {category: item.category, case_name: item.case_name},
			select: {category: true, case_name: true, algorithm: true, original_input: true},
		});
		const text = matchAlgorithm(known, algorithm, pool);
		if (!text) {
			throw algSetError('unknownAlgorithm', ErrorCode.BAD_INPUT, {rejected: [algSetCaseKey(item.category, item.case_name)]});
		}

		const updated = await prisma.$transaction(async (tx) => {
			const row = await tx.algSetItem.update({where: {id: item.id}, data: {algorithm: text}, select: ALG_SET_ITEM_SELECT});
			await tx.algSet.update({where: {id: item.set_id}, data: {updated_at: new Date()}});
			return row;
		});
		return toAlgSetItem(updated);
	}

	@Authorized()
	@Mutation(() => AlgSet)
	async removeAlgSetItems(
		@Ctx() context: GraphQLContext,
		@Arg('set_id') setId: string,
		@Arg('item_ids', () => [String], {validate: false}) itemIds: string[]
	) {
		const set = await requireOwnSet(context, setId);
		await writeLimit(context);
		const ids = asStringArray(itemIds, ALG_SET_LIMITS.MAX_ITEMS_PER_SET);
		if (!ids) throw algSetError('itemsEmpty');
		if (ids.length === 0) return ownSetResponse(context, set.id);

		await context.prisma.$transaction(async (tx) => {
			await tx.algSetItem.deleteMany({where: {set_id: set.id, id: {in: ids}}});
			await recomputeAlgSetCounters(tx, set.id);
		});
		return ownSetResponse(context, set.id);
	}

	/** The list must hold every row of the set exactly once; positions are rewritten from 0. */
	@Authorized()
	@Mutation(() => AlgSet)
	async reorderAlgSetItems(
		@Ctx() context: GraphQLContext,
		@Arg('set_id') setId: string,
		@Arg('item_ids', () => [String], {validate: false}) itemIds: string[]
	) {
		const {prisma} = context;
		const set = await requireOwnSet(context, setId);
		await writeLimit(context);

		const ids = asStringArray(itemIds, ALG_SET_LIMITS.MAX_ITEMS_PER_SET);
		const rows = await prisma.algSetItem.findMany({where: {set_id: set.id}, select: {id: true, position: true}});
		const current = new Map(rows.map((r) => [r.id, r.position]));
		if (!ids || ids.length !== rows.length || new Set(ids).size !== ids.length || !ids.every((i) => current.has(i))) {
			throw algSetError('reorderMismatch');
		}

		// Only rows whose position changes are written: a drag usually moves a few.
		const changes = ids
			.map((itemId, position) => ({itemId, position}))
			.filter(({itemId, position}) => current.get(itemId) !== position);
		await prisma.$transaction([
			...changes.map(({itemId, position}) =>
				prisma.algSetItem.update({where: {id: itemId}, data: {position}, select: {id: true}})
			),
			prisma.algSet.update({where: {id: set.id}, data: {updated_at: new Date()}, select: {id: true}}),
		]);
		return ownSetResponse(context, set.id);
	}

	/** Live link to someone else's link or public set (design 3.4). save_count is recounted, never incremented. */
	@Authorized()
	@Mutation(() => Boolean)
	async saveAlgSet(@Ctx() context: GraphQLContext, @Arg('set_id') setId: string) {
		const {prisma, user} = context;
		const set = typeof setId === 'string' && setId ? await getAlgSetRowById(prisma, setId) : null;
		// Staff rights do not extend to saving: the rule is the regular user's.
		if (!set || !canViewAlgSet(set, {id: user.id})) throw algSetError('notFound', ErrorCode.NOT_FOUND);
		if (set.user_id === user.id) throw algSetError('ownSetSave', ErrorCode.FORBIDDEN);
		if (!isSharedVisibility(set.visibility)) throw algSetError('notFound', ErrorCode.NOT_FOUND);

		if (await isAlgSetSavedBy(prisma, user.id, set.id)) return true;

		await limitOrThrow(`algset:save:${user.id}`, ALG_SET_RATE_LIMITS.SAVE);
		const saved = await prisma.algSetSave.count({where: {user_id: user.id}});
		if (saved >= ALG_SET_LIMITS.MAX_SAVED_SETS_PER_USER) throw algSetError('limitSaves');

		try {
			await prisma.$transaction(async (tx) => {
				await tx.algSetSave.create({data: {user_id: user.id, set_id: set.id}, select: {id: true}});
				await recomputeAlgSetSaveCount(tx, set.id);
			});
		} catch (error: any) {
			// Saved twice at once: the other request already did it.
			if (error?.code !== 'P2002') throw error;
		}
		return true;
	}

	/** Always works, also for a set that is no longer shared or no longer exists. */
	@Authorized()
	@Mutation(() => Boolean)
	async unsaveAlgSet(@Ctx() context: GraphQLContext, @Arg('set_id') setId: string) {
		const {prisma, user} = context;
		if (typeof setId !== 'string' || !setId) return true;
		await writeLimit(context);
		await prisma.$transaction(async (tx) => {
			const res = await tx.algSetSave.deleteMany({where: {user_id: user.id, set_id: setId}});
			if (res.count > 0) await recomputeAlgSetSaveCount(tx, setId);
		});
		return true;
	}

	/**
	 * Report (design 3.6). The row goes into the existing report screen (grouped by reported
	 * user = set owner) with `alg_set_id`. Open reports from 3 distinct verified accounts at
	 * least 7 days old hide the set automatically until an admin looks at it.
	 */
	@Authorized()
	@Mutation(() => Boolean)
	async reportAlgSet(
		@Ctx() context: GraphQLContext,
		@Arg('set_id') setId: string,
		@Arg('reason') reason: string,
		@Arg('note', {nullable: true}) note?: string
	) {
		const {prisma, user} = context;
		if (!isAlgSetReportReason(reason)) throw algSetError('reportReasonInvalid');
		let cleanNote = '';
		if (note !== undefined && note !== null) {
			if (typeof note !== 'string' || note.length > RAW_TEXT_LIMIT) throw algSetError('reportNoteTooLong');
			cleanNote = cleanAlgSetDescription(note);
			if (algSetTextLength(cleanNote) > ALG_SET_MODERATION.REPORT_NOTE_MAX_LENGTH) throw algSetError('reportNoteTooLong');
		}

		const set = typeof setId === 'string' && setId ? await getAlgSetRowById(prisma, setId) : null;
		if (!set || !canViewAlgSet(set, {id: user.id})) throw algSetError('notFound', ErrorCode.NOT_FOUND);
		if (set.user_id === user.id) throw algSetError('ownSetReport', ErrorCode.FORBIDDEN);

		const open = await prisma.report.findFirst({
			where: {alg_set_id: set.id, created_by_id: user.id, resolved_at: null},
			select: {id: true},
		});
		if (open) throw algSetError('alreadyReported');

		await limitOrThrow(`algset:report:${user.id}`, ALG_SET_RATE_LIMITS.REPORT);

		await prisma.report.create({
			data: {
				reason: `${ALG_SET_MODERATION.REPORT_REASON_PREFIX}${reason}${cleanNote ? `: ${cleanNote}` : ''}`,
				reported_user_id: set.user_id,
				created_by_id: user.id,
				alg_set_id: set.id,
			},
			select: {id: true},
		});

		if (!set.hidden_at) {
			const cutoff = new Date(Date.now() - ALG_SET_MODERATION.AUTO_HIDE_MIN_ACCOUNT_AGE_DAYS * 24 * 3600 * 1000);
			const qualifying = await prisma.report.findMany({
				where: {
					alg_set_id: set.id,
					resolved_at: null,
					created_by: {email_verified: true, created_at: {lte: cutoff}},
				},
				select: {created_by_id: true},
				distinct: ['created_by_id'],
			});
			if (qualifying.length >= ALG_SET_MODERATION.AUTO_HIDE_REPORTS) {
				await prisma.algSet.updateMany({
					where: {id: set.id, hidden_at: null},
					data: {hidden_at: new Date(), hidden_reason: ALG_SET_MODERATION.AUTO_HIDE_REASON},
				});
				logger.warn('Alg set hidden by reports', {setId: set.id, reporters: qualifying.length});
			}
		}
		return true;
	}

	/** Hide or show a set. Showing also clears an automatic hide and resolves the set's open reports. */
	@Authorized([Role.ADMIN])
	@Mutation(() => AlgSet)
	async adminSetAlgSetHidden(
		@Ctx() context: GraphQLContext,
		@Arg('set_id') setId: string,
		@Arg('hidden') hidden: boolean,
		@Arg('reason', {nullable: true}) reason?: string
	) {
		const {prisma} = context;
		const set = typeof setId === 'string' && setId ? await getAlgSetRowById(prisma, setId) : null;
		if (!set) throw algSetError('notFound', ErrorCode.NOT_FOUND);

		if (hidden) {
			const why = typeof reason === 'string' && reason.trim() ? cleanAlgSetName(reason).slice(0, 200) : 'admin';
			await prisma.algSet.update({where: {id: set.id}, data: {hidden_at: new Date(), hidden_reason: why}});
		} else {
			await prisma.$transaction([
				prisma.algSet.update({where: {id: set.id}, data: {hidden_at: null, hidden_reason: null}}),
				prisma.report.updateMany({where: {alg_set_id: set.id, resolved_at: null}, data: {resolved_at: new Date()}}),
			]);
		}
		logger.info('Alg set visibility changed by admin', {setId: set.id, hidden, adminId: context.user.id});

		const row = await getAlgSetRowById(prisma, set.id);
		return toAlgSet(row as AlgSetSummaryRow, viewerOf(context), false);
	}
}
