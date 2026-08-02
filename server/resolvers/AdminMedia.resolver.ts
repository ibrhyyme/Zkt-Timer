import * as fs from 'fs';
import * as path from 'path';
import {Arg, Authorized, Ctx, Int, Mutation, Query, Resolver} from 'type-graphql';
import {GraphQLContext} from '../@types/interfaces/server.interface';
import {Role} from '../middlewares/auth';
import {MediaAsset, MediaAssetKind, MediaAssetPage} from '../schemas/MediaAsset.schema';
import GraphQLError from '../util/graphql_error';
import {ErrorCode} from '../constants/errors';
import {publicUserInclude} from '../models/user_account';
import {deleteObject} from '../services/storage';
import {logger} from '../services/logger';

const DEFAULT_PAGE_SIZE = 24;
const MAX_PAGE_SIZE = 96;

// Only these prefixes may ever be deleted through this panel. storage_path always comes
// from the database, but a stored value is still validated before it reaches the disk.
const DELETABLE_PREFIXES = ['images/', 'timer_backgrounds/'];

function assertSafeStoragePath(storagePath: string) {
	const normalized = path.posix.normalize(storagePath.replace(/\\/g, '/'));
	if (normalized.startsWith('/') || normalized.includes('..')) {
		throw new GraphQLError(ErrorCode.BAD_INPUT, 'Gecersiz dosya yolu');
	}
	if (!DELETABLE_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
		throw new GraphQLError(ErrorCode.BAD_INPUT, 'Bu klasordeki dosya silinemez');
	}
}

/** Size on disk, or null when the row outlived its file. */
function fileSize(storagePath: string): number | null {
	try {
		const full = path.join(process.cwd(), 'public', 'uploads', storagePath);
		return fs.statSync(full).size;
	} catch {
		return null;
	}
}

function userSearchFilter(search?: string) {
	const term = (search || '').trim();
	if (!term) return {};
	return {
		user: {
			username: {contains: term, mode: 'insensitive' as const},
		},
	};
}

@Resolver()
export class AdminMediaResolver {
	@Authorized([Role.ADMIN])
	@Query(() => MediaAssetPage)
	async mediaAssets(
		@Ctx() context: GraphQLContext,
		@Arg('kind', () => MediaAssetKind, {nullable: true}) kind?: MediaAssetKind,
		@Arg('search', {nullable: true}) search?: string,
		@Arg('page', () => Int, {nullable: true}) page?: number,
		@Arg('limit', () => Int, {nullable: true}) limit?: number
	): Promise<MediaAssetPage> {
		const {prisma} = context;

		const pageIndex = Math.max(0, page ?? 0);
		const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, limit ?? DEFAULT_PAGE_SIZE));
		const searchFilter = userSearchFilter(search);

		const wantsImages = !kind || kind !== MediaAssetKind.TIMER_BACKGROUND;
		const wantsBackgrounds = !kind || kind === MediaAssetKind.TIMER_BACKGROUND;

		// An Image row is a profile picture or a header depending on which Profile
		// relation points back at it; rows with neither are not surfaced here.
		const imageWhere: any = {
			storage_path: {not: null},
			...searchFilter,
		};
		if (kind === MediaAssetKind.PROFILE_PICTURE) {
			imageWhere.profile_pfp_image = {isNot: null};
		} else if (kind === MediaAssetKind.PROFILE_HEADER) {
			imageWhere.profile_header_image = {isNot: null};
		} else if (!kind) {
			imageWhere.OR = [{profile_pfp_image: {isNot: null}}, {profile_header_image: {isNot: null}}];
		}

		const backgroundWhere: any = {
			storage_path: {not: null},
			...searchFilter,
		};

		// Both tables are read up to skip+limit so a merged page stays correctly ordered.
		const take = (pageIndex + 1) * pageSize;

		const [images, backgrounds, imageCount, backgroundCount] = await Promise.all([
			wantsImages
				? prisma.image.findMany({
						where: imageWhere,
						include: {
							user: publicUserInclude,
							profile_pfp_image: {select: {id: true}},
							profile_header_image: {select: {id: true}},
						},
						orderBy: {created_at: 'desc'},
						take,
				  })
				: Promise.resolve([]),
			wantsBackgrounds
				? prisma.timerBackground.findMany({
						where: backgroundWhere,
						include: {user: publicUserInclude},
						orderBy: {created_at: 'desc'},
						take,
				  })
				: Promise.resolve([]),
			wantsImages ? prisma.image.count({where: imageWhere}) : Promise.resolve(0),
			wantsBackgrounds ? prisma.timerBackground.count({where: backgroundWhere}) : Promise.resolve(0),
		]);

		const merged: MediaAsset[] = [
			...(images as any[]).map((image) => ({
				id: image.id,
				kind: image.profile_pfp_image ? MediaAssetKind.PROFILE_PICTURE : MediaAssetKind.PROFILE_HEADER,
				storage_path: image.storage_path,
				created_at: image.created_at,
				user: image.user,
			})),
			...(backgrounds as any[]).map((background) => ({
				id: background.id,
				kind: MediaAssetKind.TIMER_BACKGROUND,
				storage_path: background.storage_path,
				created_at: background.created_at,
				user: background.user,
			})),
		].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

		const slice = merged.slice(pageIndex * pageSize, pageIndex * pageSize + pageSize);

		// stat() only runs for the rows actually being returned.
		const items = slice.map((asset) => ({...asset, size_bytes: fileSize(asset.storage_path)}));

		return {items: items as any, total: imageCount + backgroundCount};
	}

	/**
	 * Removes the file, its row, and the profile reference pointing at it. Deleting the
	 * row alone would leave a broken image on the user's profile.
	 */
	@Authorized([Role.ADMIN])
	@Mutation(() => Boolean)
	async deleteMediaAsset(
		@Ctx() context: GraphQLContext,
		@Arg('id') id: string,
		@Arg('kind', () => MediaAssetKind) kind: MediaAssetKind
	): Promise<boolean> {
		const {prisma, user} = context;

		if (kind === MediaAssetKind.TIMER_BACKGROUND) {
			const background = await prisma.timerBackground.findUnique({where: {id}});
			if (!background) {
				throw new GraphQLError(ErrorCode.NOT_FOUND, 'Dosya bulunamadi');
			}
			if (background.storage_path) {
				assertSafeStoragePath(background.storage_path);
				await deleteObject(background.storage_path).catch((e) =>
					logger.error('[AdminMedia] File delete failed', {path: background.storage_path, error: e?.message})
				);
			}
			await prisma.timerBackground.delete({where: {id}});
			logger.info('[AdminMedia] Timer background deleted', {id, by: user.id});
			return true;
		}

		const image = await prisma.image.findUnique({
			where: {id},
			include: {profile_pfp_image: {select: {id: true}}, profile_header_image: {select: {id: true}}},
		});
		if (!image) {
			throw new GraphQLError(ErrorCode.NOT_FOUND, 'Dosya bulunamadi');
		}

		// Clear the profile reference first — the relation is SetDefault, so deleting the
		// image while a profile still points at it fails at the database level.
		if (image.profile_pfp_image) {
			await prisma.profile.update({
				where: {id: image.profile_pfp_image.id},
				data: {pfp_image_id: null},
			});
		}
		if (image.profile_header_image) {
			await prisma.profile.update({
				where: {id: image.profile_header_image.id},
				data: {header_image_id: null},
			});
		}

		if (image.storage_path) {
			assertSafeStoragePath(image.storage_path);
			await deleteObject(image.storage_path).catch((e) =>
				logger.error('[AdminMedia] File delete failed', {path: image.storage_path, error: e?.message})
			);
		}

		await prisma.image.delete({where: {id}});
		logger.info('[AdminMedia] Image deleted', {id, kind, by: user.id});
		return true;
	}
}
