import { Arg, Authorized, Ctx, Mutation, Query, Resolver } from 'type-graphql';
import { GraphQLContext } from '../@types/interfaces/server.interface';
import { Role } from '../middlewares/auth';
import GraphQLError from '../util/graphql_error';
import { ErrorCode } from '../constants/errors';
import {
	PaginatedUserAccounts, PaginatedUserAccountsForAdmin,
	PublicUserAccount,
	UserAccount,
	UserAccountForAdmin
} from '../schemas/UserAccount.schema';
import { getUserAccountForAdmin } from '../models/admin';
import { BanLog, BanUserInput } from '../schemas/BanLog.schema';
import {
	banUserAccountForever,
	banUserAccountUntil,
	deleteUserAccount,
	getUserById,
	getUserByIdOrThrow404,
	isUserBanned,
	adminUserSearch,
	unbanUserAccount,
	updateUserAccountWithParams, publicUserInclude
} from '../models/user_account';
import { deleteAllPublishedSolves } from '../models/top_solve';
import MembershipGrantedNotification from '../resources/notification_types/membership_granted';
import { createBanLog, deactivateAllBanLogs } from '../models/ban_log';
import { resolveReportsOfUserId } from './Report.resolver';
import { PaginationArgsInput, AdminUserFiltersInput } from '../schemas/Pagination.schema';
import { getPaginatedResponse, PaginatedRequestInput } from '../util/pagination/paginated_response';
import { sendPushToUser } from '../services/push';
import { AdminSendPushResult, PushTokenInfo } from '../schemas/PushToken.schema';
import { OnlineStats, OnlineUser, BackfillResult } from '../schemas/SiteConfig.schema';
import { getOnlineCounts, getOnlineUsers } from '../services/socket_util';
import WcaResultEnteredNotification from '../resources/notification_types/wca_result_entered';
import WcaRoundFinishedNotification from '../resources/notification_types/wca_round_finished';
import { getPrisma } from '../database';
import { WcaApiService } from '../services/WcaApiService';
import { LINKED_SERVICES } from '../../shared/integration';
import axios from 'axios';
import { updateIntegration } from '../models/integration';
import { fetchAndSaveWcaRecords } from '../models/wca_record';
import { getOAuthPostRequest } from '../integrations/oauth';

@Resolver()
export class AdminResolver {
	@Authorized([Role.ADMIN, Role.MOD])
	@Query(() => PaginatedUserAccountsForAdmin)
	async adminUserSearch(
		@Ctx() context: GraphQLContext,
		@Arg('pageArgs', () => PaginationArgsInput) pageArgs: PaginationArgsInput,
		@Arg('filters', () => AdminUserFiltersInput, {nullable: true}) filters?: AdminUserFiltersInput
	) {
		const conditions: any[] = [];

		if (pageArgs.searchQuery) {
			conditions.push({
				OR: [
					{username: {contains: pageArgs.searchQuery, mode: 'insensitive'}},
					{email: {contains: pageArgs.searchQuery, mode: 'insensitive'}},
				],
			});
		}

		if (filters) {
			if (filters.admin) conditions.push({admin: true});
			if (filters.mod) conditions.push({mod: true});
			if (filters.is_pro) conditions.push({is_pro: true});
			if (filters.email_verified) conditions.push({email_verified: true});
			if (filters.verified) conditions.push({verified: true});
			if (filters.banned) {
				conditions.push({OR: [{banned_forever: true}, {banned_until: {gt: new Date()}}]});
			}
			if (filters.platforms?.length) {
				for (const platform of filters.platforms) {
					conditions.push({pushTokens: {some: {platform}}});
				}
			}
			if (filters.has_wca) {
				conditions.push({integrations: {some: {service_name: 'wca'}}});
			}
		}

		const where = conditions.length === 0 ? {} : conditions.length === 1 ? conditions[0] : {AND: conditions};

		const requestInput: PaginatedRequestInput = {
			paginationArgs: pageArgs,
			tableName: 'userAccount',
			prismaPayload: {
				where,
				select: {
					id: true,
					username: true,
					email: true,
					verified: true,
					email_verified: true,
					created_at: true,
					last_solve_at: true,
					join_country: true,
					join_ip: true,
					banned_forever: true,
					banned_until: true,
					is_pro: true,
					is_premium: true,
					admin: true,
					mod: true,
					integrations: true,
					pushTokens: {
						select: {
							platform: true,
						},
					},
					profile: {
						include: {
							pfp_image: true,
						},
					},
				},
				orderBy: [
					{ admin: 'desc' },
					{ created_at: 'desc' },
				],
			},
		};

		return getPaginatedResponse<UserAccountForAdmin>(requestInput);
	}

	@Authorized([Role.ADMIN, Role.MOD])
	@Query(() => UserAccountForAdmin)
	async getUserAccountForAdmin(@Ctx() context: GraphQLContext, @Arg('userId') userId: string) {
		const userForAdmin = await getUserAccountForAdmin(userId);

		if (!userForAdmin) {
			throw new GraphQLError(ErrorCode.NOT_FOUND);
		}

		return userForAdmin;
	}

	@Authorized([Role.ADMIN, Role.MOD])
	@Mutation(() => BanLog)
	async banUserAccount(@Ctx() context: GraphQLContext, @Arg('input') banInput: BanUserInput) {
		const admin = context.user;

		const {
			user_id: targetUserId,
			minutes,
			reason,
			delete_published_solves: deletePublishedSolves,
			cheating_in_1v1: cheatingIn1v1,
		} = banInput;

		const targetUser = await getUserByIdOrThrow404(targetUserId);

		if (await isUserBanned(targetUser, true)) {
			throw new GraphQLError(ErrorCode.FORBIDDEN, 'This user is already banned');
		}

		let forever = false;
		let min = -1;
		let res;
		if (minutes > 0) {
			min = minutes;
			res = await banUserAccountUntil(targetUser, minutes);
		} else {
			forever = true;
			res = await banUserAccountForever(targetUser);
		}

		if (deletePublishedSolves) {
			await deleteAllPublishedSolves(targetUser);
		}

		await resolveReportsOfUserId(context, targetUser.id);
		return await createBanLog(admin, targetUser, reason, min, forever, res.banned_until);
	}

	@Authorized([Role.ADMIN, Role.MOD])
	@Mutation(() => UserAccount)
	async unbanUserAccount(@Ctx() context: GraphQLContext, @Arg('userId') userId: string) {
		const targetUser = await getUserByIdOrThrow404(userId);

		await unbanUserAccount(targetUser);
		await deactivateAllBanLogs(userId);

		return getUserById(userId);
	}

	@Authorized([Role.ADMIN])
	@Mutation(() => UserAccount)
	async setVerifiedStatus(
		@Ctx() context: GraphQLContext,
		@Arg('userId') userId: string,
		@Arg('verified') verified: boolean
	) {
		const targetUser = await getUserByIdOrThrow404(userId);

		await updateUserAccountWithParams(targetUser.id, {
			verified,
		});

		return getUserById(userId);
	}

	@Authorized([Role.ADMIN])
	@Mutation(() => UserAccount)
	async setProStatus(
		@Ctx() context: GraphQLContext,
		@Arg('userId') userId: string,
		@Arg('isPro') isPro: boolean,
		@Arg('minutes', {nullable: true}) minutes?: number
	) {
		const targetUser = await getUserByIdOrThrow404(userId);

		let pro_expires_at: Date | null = null;
		if (isPro && minutes && minutes > 0) {
			pro_expires_at = new Date(Date.now() + minutes * 60000);
		}

		await updateUserAccountWithParams(targetUser.id, {
			is_pro: isPro,
			pro_expires_at: isPro ? pro_expires_at : null,
		});

		if (isPro) {
			try {
				const notification = new MembershipGrantedNotification(
					{user: targetUser, triggeringUser: context.user as unknown as UserAccount, sendEmail: false},
					'pro',
					pro_expires_at
				);
				await notification.send();
				await sendPushToUser(targetUser.id, notification.subject(), notification.inAppMessage(), {
					type: 'membership_granted',
					membershipType: 'pro',
				});
			} catch (error) {
				console.error('[MembershipNotification] Failed to send:', error);
			}
		}

		return getUserById(userId);
	}

	@Authorized([Role.ADMIN])
	@Mutation(() => UserAccount)
	async setPremiumStatus(
		@Ctx() context: GraphQLContext,
		@Arg('userId') userId: string,
		@Arg('isPremium') isPremium: boolean,
		@Arg('minutes', {nullable: true}) minutes?: number
	) {
		const targetUser = await getUserByIdOrThrow404(userId);

		let premium_expires_at: Date | null = null;
		if (isPremium && minutes && minutes > 0) {
			premium_expires_at = new Date(Date.now() + minutes * 60000);
		}

		await updateUserAccountWithParams(targetUser.id, {
			is_premium: isPremium,
			premium_expires_at: isPremium ? premium_expires_at : null,
			...(isPremium ? {is_pro: false, pro_expires_at: null} : {}),
		});

		if (isPremium) {
			try {
				const notification = new MembershipGrantedNotification(
					{user: targetUser, triggeringUser: context.user as unknown as UserAccount, sendEmail: false},
					'premium',
					premium_expires_at
				);
				await notification.send();
				await sendPushToUser(targetUser.id, notification.subject(), notification.inAppMessage(), {
					type: 'membership_granted',
					membershipType: 'premium',
				});
			} catch (error) {
				console.error('[MembershipNotification] Failed to send:', error);
			}
		}

		return getUserById(userId);
	}

	@Authorized([Role.ADMIN])
	@Mutation(() => UserAccount)
	async adminDeleteUserAccount(@Ctx() context: GraphQLContext, @Arg('userId') userId: string) {
		const targetUser = await getUserByIdOrThrow404(userId);
		await deleteUserAccount(targetUser);

		return targetUser;
	}

	@Authorized([Role.ADMIN])
	@Query(() => [PushTokenInfo])
	async adminMyPushTokens(@Ctx() context: GraphQLContext): Promise<{platform: string}[]> {
		return getPrisma().pushToken.findMany({
			where: {userId: context.user!.id},
			select: {platform: true},
		});
	}

	@Authorized([Role.ADMIN])
	@Mutation(() => AdminSendPushResult)
	async adminSendPushToUser(
		@Arg('userId') userId: string,
		@Arg('title') title: string,
		@Arg('body') body: string
	): Promise<AdminSendPushResult> {
		await getUserByIdOrThrow404(userId);
		await sendPushToUser(userId, title, body);
		return {success: true};
	}

	@Authorized([Role.ADMIN])
	@Query(() => OnlineStats)
	async onlineStats(): Promise<OnlineStats> {
		return getOnlineCounts();
	}

	@Authorized([Role.ADMIN])
	@Query(() => [OnlineUser])
	async onlineUsers(): Promise<OnlineUser[]> {
		return getOnlineUsers();
	}

	/**
	 * Test mutation: WCA bildirimlerini bir kullaniciya yollar.
	 * WCA ID ile kullaniciyi bulur, hem result_entered hem round_finished push'larini test eder.
	 * Sample data ile calisir, gercek yarisma gerekli degil.
	 */
	@Authorized([Role.ADMIN])
	@Mutation(() => Boolean)
	async testWcaNotification(
		@Arg('wcaId') wcaId: string
	): Promise<boolean> {
		const prisma = getPrisma();

		// WCA ID ile kullaniciyi bul
		const integration = await prisma.integration.findFirst({
			where: {service_name: 'wca', wca_id: wcaId},
			include: {
				user: {
					include: {settings: true},
				},
			},
		});

		if (!integration?.user) {
			throw new GraphQLError(ErrorCode.NOT_FOUND, `WCA ID '${wcaId}' icin kullanici bulunamadi`);
		}

		const user = integration.user;
		const locale = (user as any).settings?.locale || 'tr';
		const eventId = '333';
		const eventName = WcaApiService.getShortEventName(eventId);
		const compId = 'TestCompetition2026';
		const compName = 'Test Yarismasi 2026';

		const baseInput = {
			user: user as any,
			triggeringUser: user as any,
			sendEmail: false,
		};

		// --- Test 1: Sonuc girildi (Avg + Single) ---
		{
			const body = 'Avg: 12.45 · Single: 11.20';
			const notif = new WcaResultEnteredNotification(baseInput, {
				competitionId: compId,
				competitionName: compName,
				eventId,
				eventName,
				roundNumber: 1,
				resultText: body,
				locale,
			});
			await notif.send().catch(() => {});
			await sendPushToUser(user.id, notif.subject(), body, {
				type: 'wca_result_entered',
				competitionId: compId,
				eventId,
				roundNumber: '1',
			});
		}

		// --- Test 2: Round 1 bitti, ust tura yukseldi ---
		{
			const notif = new WcaRoundFinishedNotification(baseInput, {
				competitionId: compId,
				competitionName: compName,
				eventId,
				eventName,
				roundNumber: 1,
				ranking: 14,
				advancing: true,
				advancingQuestionable: false,
				isFinal: false,
				locale,
			});
			await notif.send().catch(() => {});
			await sendPushToUser(user.id, notif.subject(), notif.inAppMessage(), {
				type: 'wca_round_finished',
				competitionId: compId,
				eventId,
				roundNumber: '1',
			});
		}

		// --- Test 3: Round 2 bitti, ust tura YUKSELEMEDI ---
		{
			const notif = new WcaRoundFinishedNotification(baseInput, {
				competitionId: compId,
				competitionName: compName,
				eventId,
				eventName,
				roundNumber: 2,
				ranking: 9,
				advancing: false,
				advancingQuestionable: false,
				isFinal: false,
				locale,
			});
			await notif.send().catch(() => {});
			await sendPushToUser(user.id, notif.subject(), notif.inAppMessage(), {
				type: 'wca_round_finished',
				competitionId: compId,
				eventId,
				roundNumber: '2',
			});
		}

		// --- Test 4: Final bitti ---
		{
			const notif = new WcaRoundFinishedNotification(baseInput, {
				competitionId: compId,
				competitionName: compName,
				eventId,
				eventName,
				roundNumber: 3,
				ranking: 5,
				advancing: false,
				advancingQuestionable: false,
				isFinal: true,
				locale,
			});
			await notif.send().catch(() => {});
			await sendPushToUser(user.id, notif.subject(), notif.inAppMessage(), {
				type: 'wca_round_finished',
				competitionId: compId,
				eventId,
				roundNumber: '3',
			});
		}

		return true;
	}

	@Authorized([Role.ADMIN])
	@Mutation(() => BackfillResult)
	async backfillWcaIds(): Promise<BackfillResult> {
		const prisma = getPrisma();
		const wcaService = LINKED_SERVICES['wca'];

		const result: BackfillResult = {
			total: 0, filled: 0, tokenFailed: 0, noWcaId: 0, error: 0,
			recordsTotal: 0, recordsFilled: 0, recordsError: 0,
		};

		// Phase 1: wca_user_id eksik olan TUM wca integration'lari guncelle
		// (wca_id null olanlar dahil — newcomer destek)
		const needsUpdate = await prisma.integration.findMany({
			where: {service_name: 'wca', wca_user_id: null},
			include: {user: true},
		});

		result.total = needsUpdate.length;

		for (const int of needsUpdate) {
			try {
				let authToken = int.auth_token;
				const expiresAt = new Date(Number(int.auth_expires_at));
				if (expiresAt < new Date()) {
					try {
						const refreshResult = await getOAuthPostRequest(
							wcaService,
							wcaService.tokenEndpoint,
							{grant_type: 'refresh_token', refresh_token: int.refresh_token}
						);
						authToken = refreshResult.accessToken;
						await updateIntegration(int, {
							auth_token: refreshResult.accessToken,
							refresh_token: refreshResult.refreshToken,
							auth_expires_at: refreshResult.createdAt + refreshResult.expiresIn * 1000,
						});
					} catch (e) {
						console.warn(`[Backfill] Token refresh failed for user ${int.user_id}:`, e?.message);
						result.tokenFailed++;
						continue;
					}
				}

				await new Promise((r) => setTimeout(r, 300));
				const res = await axios.get(wcaService.meEndpoint, {
					headers: {Authorization: 'Bearer ' + authToken},
					timeout: 8000,
				});

				const wcaData = res?.data?.me || res?.data;
				const wcaUserId = wcaData?.id ? String(wcaData.id) : null;
				const wcaId = wcaData?.wca_id || null;

				const update: any = {};
				if (wcaUserId) update.wca_user_id = wcaUserId;
				if (wcaId && !int.wca_id) update.wca_id = wcaId;
				if (wcaData?.country_iso2 && !int.wca_country_iso2) update.wca_country_iso2 = wcaData.country_iso2;

				if (Object.keys(update).length > 0) {
					await updateIntegration(int, update);
				}

				if (!wcaId) {
					result.noWcaId++;
					console.log(`[Backfill] Newcomer — wca_user_id=${wcaUserId} saved for user ${int.user_id}`);
				} else {
					result.filled++;
					console.log(`[Backfill] Filled wca_user_id=${wcaUserId} wca_id=${wcaId} for user ${int.user_id}`);
				}
			} catch (e) {
				console.warn(`[Backfill] Failed for user ${int.user_id}:`, e?.message);
				result.error++;
			}
		}

		// Phase 2: wca_id var ama ranking skoru olmayan herkese WCA record cek + ranking hesapla
		const missingRankings = await prisma.integration.findMany({
			where: {
				service_name: 'wca',
				wca_id: {not: null},
				kinch_score: null,
			},
			include: {user: true},
		});

		result.recordsTotal = missingRankings.length;

		for (const int of missingRankings) {
			try {
				await fetchAndSaveWcaRecords(int.user as any, int as any);
				result.recordsFilled++;
				console.log(`[Backfill] Records fetched for wca_id=${int.wca_id} user=${int.user_id}`);
			} catch (e) {
				console.warn(`[Backfill] Records failed for user ${int.user_id}:`, e?.message);
				result.recordsError++;
			}
		}

		console.log(`[Backfill] Done.`, result);
		return result;
	}
}
