import { Resolver, Query, Mutation, Arg, Ctx, Authorized, Int } from 'type-graphql';
import { GraphQLContext } from '../@types/interfaces/server.interface';
import {
	Announcement,
	CreateAnnouncementInput,
	UpdateAnnouncementInput,
	AnnouncementFilterInput,
	UnreadAnnouncementCount
} from '../schemas/Announcement.schema';
import GraphQLError from '../util/graphql_error';
import { ErrorCode } from '../constants/errors';
import { Role } from '../middlewares/auth';
import { sendPushToAll } from '../services/push';

function getLocale(context: GraphQLContext): string {
	return context.req.cookies?.zkt_language || 'tr';
}

function resolveLocale(announcement: any, lang: string) {
	if (lang === 'tr' || !announcement.translations) return announcement;
	const t = announcement.translations as Record<string, { title?: string; content?: string }>;
	return {
		...announcement,
		title: t[lang]?.title || announcement.title,
		content: t[lang]?.content || announcement.content,
	};
}

@Resolver()
export class AnnouncementResolver {

	// Kullanıcının görmediği aktif duyurular (öncelik sıralı)
	@Query(() => [Announcement])
	async getActiveAnnouncements(@Ctx() context: GraphQLContext): Promise<Announcement[]> {
		if (!context.user) {
			throw new GraphQLError(ErrorCode.UNAUTHENTICATED);
		}

		try {
			const lang = getLocale(context);

			// N+1 problem'i önlemek için include kullanıyoruz
			const announcements = await context.prisma.announcement.findMany({
				where: {
					isActive: true,
					isDraft: false,
					publishedAt: { not: null }
				},
				include: {
					views: {
						where: { userId: context.user.id }
					},
					_count: {
						select: { views: true }
					}
				},
				orderBy: [
					{ priority: 'desc' },
					{ publishedAt: 'desc' }
				]
			});

			// Kullanıcının görmediklerini filtrele
			return announcements
				.filter(a => a.views.length === 0)
				.map(a => {
					const localized = resolveLocale(a, lang);
					return {
						...localized,
						category: a.category as string,
						viewCount: a._count.views,
						hasViewed: false
					};
				});
		} catch (error) {
			throw new GraphQLError(ErrorCode.INTERNAL_SERVER_ERROR, 'Failed to fetch announcements');
		}
	}

	// Okunmamış duyuru sayısı (NavBar badge için)
	@Query(() => UnreadAnnouncementCount)
	async getUnreadAnnouncementCount(@Ctx() context: GraphQLContext): Promise<UnreadAnnouncementCount> {
		if (!context.user) {
			return { count: 0 };
		}

		try {
			const count = await context.prisma.announcement.count({
				where: {
					isActive: true,
					isDraft: false,
					publishedAt: { not: null },
					views: {
						none: { userId: context.user.id }
					}
				}
			});

			return { count };
		} catch (error) {
			console.error('Failed to get unread count:', error);
			return { count: 0 };
		}
	}

	// Admin - Tüm duyurular (filtre ile) — translations raw olarak döndürülür
	@Authorized([Role.ADMIN])
	@Query(() => [Announcement])
	async getAllAnnouncements(
		@Arg('filter', { nullable: true }) filter: AnnouncementFilterInput,
		@Ctx() context: GraphQLContext
	): Promise<Announcement[]> {
		try {
			const where: any = {};
			if (filter?.category) where.category = filter.category;
			if (filter?.isActive !== undefined) where.isActive = filter.isActive;
			if (filter?.isDraft !== undefined) where.isDraft = filter.isDraft;

			const announcements = await context.prisma.announcement.findMany({
				where,
				include: {
					_count: { select: { views: true } }
				},
				orderBy: [
					{ priority: 'desc' },
					{ createdAt: 'desc' }
				]
			});

			return announcements.map(a => ({
				...a,
				category: a.category as string,
				viewCount: a._count.views,
				translations: a.translations ? JSON.stringify(a.translations) : undefined
			}));
		} catch (error) {
			throw new GraphQLError(ErrorCode.INTERNAL_SERVER_ERROR, 'Failed to fetch all announcements');
		}
	}

	// Kullanıcının görüntülediği duyuru geçmişi (pagination ile)
	@Query(() => [Announcement])
	async getMyAnnouncementHistory(
		@Arg('limit', () => Int, { defaultValue: 20 }) limit: number,
		@Arg('offset', () => Int, { defaultValue: 0 }) offset: number,
		@Ctx() context: GraphQLContext
	): Promise<Announcement[]> {
		if (!context.user) {
			throw new GraphQLError(ErrorCode.UNAUTHENTICATED);
		}

		try {
			const lang = getLocale(context);

			const viewedAnnouncements = await context.prisma.announcementView.findMany({
				where: { userId: context.user.id },
				include: {
					announcement: {
						include: {
							_count: { select: { views: true } }
						}
					}
				},
				orderBy: { viewedAt: 'desc' },
				take: limit,
				skip: offset
			});

			return viewedAnnouncements.map(v => {
				const localized = resolveLocale(v.announcement, lang);
				return {
					...localized,
					category: v.announcement.category as string,
					viewCount: v.announcement._count.views,
					hasViewed: true
				};
			});
		} catch (error) {
			throw new GraphQLError(ErrorCode.INTERNAL_SERVER_ERROR, 'Failed to fetch announcement history');
		}
	}

	// Admin - Duyuru oluştur
	@Authorized([Role.ADMIN])
	@Mutation(() => Announcement)
	async createAnnouncement(
		@Arg('input') input: CreateAnnouncementInput,
		@Ctx() context: GraphQLContext
	): Promise<Announcement> {
		try {
			const announcement = await context.prisma.announcement.create({
				data: {
					title: input.title,
					content: input.content,
					category: input.category as any,
					priority: input.priority,
					imageUrl: input.imageUrl,
					isDraft: input.isDraft,
					publishedAt: input.isDraft ? null : new Date(),
					translations: input.translations ? JSON.parse(input.translations) : undefined
				},
				include: {
					_count: { select: { views: true } }
				}
			});

			// Bildirim gonder (fire-and-forget, duyuru olusturmayı bloklamaz)
			if (input.sendNotification && !input.isDraft) {
				sendPushToAll(announcement.title, announcement.content.substring(0, 200)).catch((err) => {
					console.error('[Push] Failed to send push for announcement:', err);
				});
			}

			return {
				...announcement,
				category: announcement.category as string,
				viewCount: 0,
				translations: announcement.translations ? JSON.stringify(announcement.translations) : undefined
			};
		} catch (error) {
			throw new GraphQLError(ErrorCode.INTERNAL_SERVER_ERROR, 'Failed to create announcement');
		}
	}

	// Admin - Duyuru güncelle
	@Authorized([Role.ADMIN])
	@Mutation(() => Announcement)
	async updateAnnouncement(
		@Arg('id') id: string,
		@Arg('input') input: UpdateAnnouncementInput,
		@Ctx() context: GraphQLContext
	): Promise<Announcement> {
		try {
			const existing = await context.prisma.announcement.findUnique({ where: { id } });
			if (!existing) {
				throw new GraphQLError(ErrorCode.NOT_FOUND, 'Announcement not found');
			}

			// Draft'tan publish'e geçiyorsa publishedAt güncelle
			const updateData: any = { ...input };
			if (existing.isDraft && input.isDraft === false && !existing.publishedAt) {
				updateData.publishedAt = new Date();
			}

			// translations JSON string → object
			if (updateData.translations) {
				updateData.translations = JSON.parse(updateData.translations);
			}

			const announcement = await context.prisma.announcement.update({
				where: { id },
				data: updateData,
				include: {
					_count: { select: { views: true } }
				}
			});

			return {
				...announcement,
				category: announcement.category as string,
				viewCount: announcement._count.views,
				translations: announcement.translations ? JSON.stringify(announcement.translations) : undefined
			};
		} catch (error) {
			if (error instanceof GraphQLError) throw error;
			throw new GraphQLError(ErrorCode.INTERNAL_SERVER_ERROR, 'Failed to update announcement');
		}
	}

	// Duyuruyu görüldü olarak işaretle
	@Mutation(() => Boolean)
	async markAnnouncementAsViewed(
		@Arg('announcementId') announcementId: string,
		@Ctx() context: GraphQLContext
	): Promise<boolean> {
		if (!context.user) {
			throw new GraphQLError(ErrorCode.UNAUTHENTICATED);
		}

		try {
			await context.prisma.announcementView.upsert({
				where: {
					userId_announcementId: {
						userId: context.user.id,
						announcementId
					}
				},
				create: {
					userId: context.user.id,
					announcementId
				},
				update: {}
			});

			return true;
		} catch (error) {
			console.error('Failed to mark announcement as viewed:', error);
			return false;
		}
	}

	// Admin - Duyuru sil
	@Authorized([Role.ADMIN])
	@Mutation(() => Boolean)
	async deleteAnnouncement(
		@Arg('id') id: string,
		@Ctx() context: GraphQLContext
	): Promise<boolean> {
		try {
			await context.prisma.announcement.delete({ where: { id } });
			return true;
		} catch (error) {
			throw new GraphQLError(ErrorCode.INTERNAL_SERVER_ERROR, 'Failed to delete announcement');
		}
	}
}
