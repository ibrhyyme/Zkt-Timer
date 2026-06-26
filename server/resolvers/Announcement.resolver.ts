import { Resolver, Query, Mutation, Arg, Ctx, Authorized, Int } from 'type-graphql';
import { GraphQLContext } from '../@types/interfaces/server.interface';
import {
	Announcement,
	CreateAnnouncementInput,
	UpdateAnnouncementInput,
	AnnouncementFilterInput,
	UnreadAnnouncementCount
} from '../schemas/Announcement.schema';
import { TranslateAnnouncementResult } from '../schemas/Translation.schema';
import GraphQLError from '../util/graphql_error';
import { ErrorCode } from '../constants/errors';
import { Role } from '../middlewares/auth';
import { sendPushToAll, sendPushToPlatforms } from '../services/push';
import { translateAnnouncement } from '../util/gemini';

const ANNOUNCEMENT_CATEGORIES = ['FEATURE', 'BUGFIX', 'IMPORTANT', 'INFO'];
const MAX_ANNOUNCEMENT_TITLE_LENGTH = 200;
const MAX_ANNOUNCEMENT_CONTENT_LENGTH = 5000;

// Shared by create (all fields present) and update (fields optional). A field is
// only validated when provided, so partial updates skip absent fields.
function validateAnnouncementFields(title?: string, content?: string, category?: string, priority?: number) {
	if (title !== undefined) {
		if (!title.trim()) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'Title is required');
		}
		if (title.length > MAX_ANNOUNCEMENT_TITLE_LENGTH) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, `Title must be at most ${MAX_ANNOUNCEMENT_TITLE_LENGTH} characters`);
		}
	}
	if (content !== undefined) {
		if (!content.trim()) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'Content is required');
		}
		if (content.length > MAX_ANNOUNCEMENT_CONTENT_LENGTH) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, `Content must be at most ${MAX_ANNOUNCEMENT_CONTENT_LENGTH} characters`);
		}
	}
	if (category !== undefined && !ANNOUNCEMENT_CATEGORIES.includes(category)) {
		throw new GraphQLError(ErrorCode.BAD_INPUT, 'Invalid category');
	}
	if (priority !== undefined && (!Number.isInteger(priority) || priority < 0 || priority > 1000)) {
		throw new GraphQLError(ErrorCode.BAD_INPUT, 'Priority must be between 0 and 1000');
	}
}

function getLocale(context: GraphQLContext): string {
	return context.req.cookies?.zkt_language || 'en';
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

	// Active announcements not seen by the user (sorted by priority)
	@Query(() => [Announcement])
	async getActiveAnnouncements(@Ctx() context: GraphQLContext): Promise<Announcement[]> {
		if (!context.user) {
			throw new GraphQLError(ErrorCode.UNAUTHENTICATED);
		}

		try {
			const lang = getLocale(context);

			// Using include to prevent N+1 problem
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

			// Filter out announcements already seen by the user
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

	// Unread announcement count (for NavBar badge)
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

	// Admin - All announcements (with filter) — translations returned as raw strings
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

	// User's announcement viewing history (with pagination)
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

	// Admin - Create announcement
	@Authorized([Role.ADMIN])
	@Mutation(() => Announcement)
	async createAnnouncement(
		@Arg('input') input: CreateAnnouncementInput,
		@Ctx() context: GraphQLContext
	): Promise<Announcement> {
		validateAnnouncementFields(input.title, input.content, input.category, input.priority);
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
					targetUrl: input.targetUrl || null,
					translations: input.translations ? JSON.parse(input.translations) : undefined
				},
				include: {
					_count: { select: { views: true } }
				}
			});

			// Send notification (fire-and-forget, does not block announcement creation)
			if (input.sendNotification && !input.isDraft) {
				const body = announcement.content.substring(0, 200);
				const pushData: Record<string, string> = {
					type: 'announcement',
					announcementId: announcement.id,
				};
				if (announcement.targetUrl) {
					pushData.link = announcement.targetUrl;
				}
				const pushPromise = input.notificationPlatforms && input.notificationPlatforms.length > 0
					? sendPushToPlatforms(input.notificationPlatforms, announcement.title, body, pushData)
					: sendPushToAll(announcement.title, body, pushData);
				// Persist delivery stats once the push finishes (still non-blocking)
				pushPromise
					.then((res) =>
						context.prisma.announcement.update({
							where: { id: announcement.id },
							data: {
								pushSentAt: new Date(),
								pushSuccessCount: res.successCount,
								pushTargetCount: res.totalTokens,
							},
						}),
					)
					.catch((err) => {
						console.error('[Push] Failed to send/record push for announcement:', err);
					});
			}

			return {
				...announcement,
				category: announcement.category as string,
				viewCount: 0,
				targetUrl: announcement.targetUrl || undefined,
				translations: announcement.translations ? JSON.stringify(announcement.translations) : undefined
			};
		} catch (error) {
			throw new GraphQLError(ErrorCode.INTERNAL_SERVER_ERROR, 'Failed to create announcement');
		}
	}

	// Admin - Translate TR content to 4 languages (EN/ES/RU/ZH) using Gemini
	@Authorized([Role.ADMIN])
	@Mutation(() => TranslateAnnouncementResult)
	async translateAnnouncementContent(
		@Arg('title') title: string,
		@Arg('content') content: string,
	): Promise<TranslateAnnouncementResult> {
		try {
			return await translateAnnouncement({ title, content });
		} catch (err: any) {
			console.error('[Gemini] translate failed:', err?.message || err);
			throw new GraphQLError(ErrorCode.INTERNAL_SERVER_ERROR, err?.message || 'Translation failed');
		}
	}

	// Admin - Update announcement
	@Authorized([Role.ADMIN])
	@Mutation(() => Announcement)
	async updateAnnouncement(
		@Arg('id') id: string,
		@Arg('input') input: UpdateAnnouncementInput,
		@Ctx() context: GraphQLContext
	): Promise<Announcement> {
		validateAnnouncementFields(input.title, input.content, input.category, input.priority);
		try {
			const existing = await context.prisma.announcement.findUnique({ where: { id } });
			if (!existing) {
				throw new GraphQLError(ErrorCode.NOT_FOUND, 'Announcement not found');
			}

			// Update publishedAt when transitioning from draft to published
			const updateData: any = { ...input };
			if (existing.isDraft && input.isDraft === false && !existing.publishedAt) {
				updateData.publishedAt = new Date();
			}

			// Translations JSON string → object
			if (updateData.translations) {
				updateData.translations = JSON.parse(updateData.translations);
			}

			// Empty string → null (field was cleared)
			if (updateData.targetUrl === '') {
				updateData.targetUrl = null;
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

	// Mark announcement as viewed
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

	// Admin - Delete announcement
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
