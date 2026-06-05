import { Arg, Authorized, Ctx, Int, Mutation, Query, Resolver } from 'type-graphql';
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
	getUserByIdWithSettings,
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
import { OnlineStats, OnlineUser, BackfillResult, WcaStats, IpInfo, MethodStepsBackfillResult, AdminDashboardStats } from '../schemas/SiteConfig.schema';
import { getSolveSteps } from '../util/solve/solve_method';
import { createSolveMethodSteps, deleteSolveMethodSteps } from '../models/solve_method_step';
import { parseSmartTurns } from '../../shared/smart_cube/parse_turns';
import { countHTM } from '../../shared/util/solve/move_counter';
import { updateSolveLiteral } from '../models/solve';
import { getOnlineCounts, getOnlineUsers, disconnectUserSockets } from '../services/socket_util';
import WcaResultEnteredNotification from '../resources/notification_types/wca_result_entered';
import WcaRoundFinishedNotification from '../resources/notification_types/wca_round_finished';
import { getPrisma } from '../database';
import { WcaApiService } from '../services/WcaApiService';
import axios from 'axios';
import { runWcaBackfill } from '../services/WcaBackfillService';
import { getIpDetail } from '../services/ipstack';
import { archiveCompetition } from '../services/CompetitionArchiveService';
import { BulkArchiveResult, ReindexESResult, ReindexLLResult } from '../schemas/ArchiveAdmin.schema';
import { ARCHIVED_COMP_INDEX, bootstrapArchivedCompIndex, getSearchClient } from '../services/search';
import { todayBoundsIstanbul, thisWeekBoundsIstanbul, thisMonthBoundsIstanbul } from '../util/calendar_window';

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
					{
						integrations: {
							some: {
								service_name: 'wca',
								OR: [
									{wca_name: {contains: pageArgs.searchQuery, mode: 'insensitive'}},
									{wca_id: {contains: pageArgs.searchQuery, mode: 'insensitive'}},
									{wca_user_id: {contains: pageArgs.searchQuery, mode: 'insensitive'}},
								],
							},
						},
					},
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
					last_seen_at: true,
					join_country: true,
					join_ip: true,
					banned_forever: true,
					banned_until: true,
					is_pro: true,
					is_premium: true,
					pro_expires_at: true,
					premium_expires_at: true,
					iap_platform: true,
					iap_product_id: true,
					iap_cancellation_at: true,
					iap_billing_issue_at: true,
					iap_paused_until: true,
					iap_latest_event_at: true,
					revenuecat_user_id: true,
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
		// Disconnect all sockets of banned user — prevent ghost users in lists,
		// and block real-time notification/chat flows.
		disconnectUserSockets(targetUser.id);
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
		const targetUser = await getUserByIdWithSettings(userId);
		if (!targetUser) throw new Error('User not found');

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
		const targetUser = await getUserByIdWithSettings(userId);
		if (!targetUser) throw new Error('User not found');

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
		disconnectUserSockets(targetUser.id);
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

	@Authorized([Role.ADMIN])
	@Query(() => AdminDashboardStats)
	async adminDashboardStats(): Promise<AdminDashboardStats> {
		const prisma = getPrisma();
		const {start: todayStart} = todayBoundsIstanbul();
		const {start: weekStart} = thisWeekBoundsIstanbul();
		const {start: monthStart} = thisMonthBoundsIstanbul();

		const [
			total_users,
			dau,
			wau,
			mau,
			signups_today,
			signups_week,
			solves_today,
			solves_week,
			solves_total,
			pro_users_count,
			pending_reports_count,
			pending_support_tickets_count,
			online,
			wca_connected,
		] = await Promise.all([
			prisma.userAccount.count(),
			prisma.userAccount.count({ where: { last_seen_at: { gte: todayStart } } }),
			prisma.userAccount.count({ where: { last_seen_at: { gte: weekStart } } }),
			prisma.userAccount.count({ where: { last_seen_at: { gte: monthStart } } }),
			prisma.userAccount.count({ where: { created_at: { gte: todayStart } } }),
			prisma.userAccount.count({ where: { created_at: { gte: weekStart } } }),
			prisma.solve.count({ where: { created_at: { gte: todayStart }, OR: [{ trainer_name: null }, { trainer_name: '' }] } }),
			prisma.solve.count({ where: { created_at: { gte: weekStart }, OR: [{ trainer_name: null }, { trainer_name: '' }] } }),
			prisma.solve.count({ where: { OR: [{ trainer_name: null }, { trainer_name: '' }] } }),
			prisma.userAccount.count({ where: { OR: [{ is_pro: true }, { is_premium: true }] } }),
			prisma.report.count({ where: { resolved_at: null } }),
			prisma.supportTicket.count({ where: { resolved_at: null } }),
			getOnlineCounts(),
			prisma.integration.count({ where: { service_name: 'wca' } }),
		]);

		return {
			total_users,
			dau,
			wau,
			mau,
			signups_today,
			signups_week,
			solves_today,
			solves_week,
			solves_total,
			pro_users_count,
			pending_reports_count,
			pending_support_tickets_count,
			online_users: online.uniqueUsers,
			wca_connected,
		};
	}

	/**
	 * Test mutation: Sends WCA notifications to a user.
	 * Finds user by WCA ID, tests both result_entered and round_finished pushes.
	 * Works with sample data, no real competition required.
	 */
	@Authorized([Role.ADMIN])
	@Mutation(() => Boolean)
	async testWcaNotification(
		@Arg('wcaId') wcaId: string
	): Promise<boolean> {
		const prisma = getPrisma();

		// Find user by WCA ID
		const integration = await prisma.integration.findFirst({
			where: {service_name: 'wca', wca_id: wcaId},
			include: {
				user: {
					include: {settings: true},
				},
			},
		});

		if (!integration?.user) {
			throw new GraphQLError(ErrorCode.NOT_FOUND, `User not found for WCA ID '${wcaId}'`);
		}

		const user = integration.user;
		const locale = (user as any).settings?.locale || 'en';
		const eventId = '333';
		const eventName = WcaApiService.getShortEventName(eventId);
		const compId = 'TestCompetition2026';
		const compName = 'Test Competition 2026';

		const baseInput = {
			user: user as any,
			triggeringUser: user as any,
			sendEmail: false,
		};

		// --- Test 1: Result entered (Avg + Single) ---
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

		// --- Test 2: Round 1 finished, advanced to next round ---
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

		// --- Test 3: Round 2 finished, did NOT advance ---
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

		// --- Test 4: Final finished ---
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

	@Authorized([Role.ADMIN, Role.MOD])
	@Query(() => IpInfo)
	async ipInfo(@Arg('ip') ip: string): Promise<IpInfo> {
		return getIpDetail(ip);
	}

	@Authorized([Role.ADMIN])
	@Query(() => WcaStats)
	async wcaStats(): Promise<WcaStats> {
		const prisma = getPrisma();
		const [totalUsers, wcaConnected, wcaWithId, wcaWithoutUserId, wcaRevoked, wcaBackfillPending] = await Promise.all([
			prisma.userAccount.count(),
			prisma.integration.count({where: {service_name: 'wca'}}),
			prisma.integration.count({where: {service_name: 'wca', wca_id: {not: null}}}),
			prisma.integration.count({where: {service_name: 'wca', wca_user_id: null}}),
			prisma.integration.count({where: {service_name: 'wca', revoked_at: {not: null}} as any}),
			prisma.integration.count({where: {service_name: 'wca', revoked_at: null, OR: [{wca_user_id: null}, {wca_id: null}]} as any}),
		]);
		return {
			totalUsers,
			wcaConnected,
			wcaWithId,
			wcaWithoutId: wcaConnected - wcaWithId,
			wcaWithoutUserId,
			wcaRevoked,
			wcaBackfillPending,
		};
	}

	@Authorized([Role.ADMIN])
	@Mutation(() => BackfillResult)
	async backfillWcaIds(): Promise<BackfillResult> {
		// All current logic moved to WcaBackfillService (cron calls the same function).
		// Admin mutation kept for manual triggering — so even if "site_config wca_backfill_enabled=false"
		// is set, admin can still run it once.
		return await runWcaBackfill();
	}

	/**
	 * DELETES and recalculates SolveMethodStep records for all smart cube solves.
	 *
	 * Single comprehensive mutation:
	 *   - Solves without step records -> created (old backfill behavior)
	 *   - Solves with step records -> deleted and recalculated (fixes old step.turn_count values
	 *     after engine fix)
	 *   - If smart_turns missing or unparseable, solve downgraded to is_smart_cube=false
	 *     (old corrupted data cleanup).
	 *
	 * Run when engine algorithm changes (e.g. boundary-aware HTM fix).
	 */
	@Authorized([Role.ADMIN])
	@Mutation(() => MethodStepsBackfillResult)
	async reindexSmartCubeMethodSteps(): Promise<MethodStepsBackfillResult> {
		const prisma = getPrisma();

		const result: MethodStepsBackfillResult = {
			totalCandidates: 0,
			processed: 0,
			filled: 0,
			skippedNoTurns: 0,
			skippedAlreadyHasSteps: 0,
			downgraded: 0,
			error: 0,
		};

		const candidates = await prisma.solve.findMany({
			where: { is_smart_cube: true },
			select: { id: true, smart_turns: true, scramble: true },
		});

		result.totalCandidates = candidates.length;
		console.log(`[MethodStepsReindex] ${candidates.length} candidate solves found`);

		for (const cand of candidates) {
			result.processed++;

			// smart_turns missing or unparseable -> downgrade
			if (!cand.smart_turns || typeof cand.smart_turns !== 'string') {
				result.skippedNoTurns++;
				try {
					await updateSolveLiteral(cand.id, { is_smart_cube: false });
					result.downgraded++;
				} catch (e) {
					result.error++;
				}
				continue;
			}

			try {
				const turns = parseSmartTurns(cand.smart_turns);
				if (!turns.length) {
					// Empty turns -> downgrade
					await updateSolveLiteral(cand.id, { is_smart_cube: false });
					result.downgraded++;
					continue;
				}
				const steps = getSolveSteps(turns, cand.scramble);
				const htmCount = countHTM(turns.map((t) => t.turn));
				await deleteSolveMethodSteps({ id: cand.id });
				await createSolveMethodSteps({ id: cand.id }, steps);
				// Old solves may have null or incorrect smart_turn_count — recalculate with engine.
				// This is the single source of truth for all turn/TPS displays in the UI.
				await updateSolveLiteral(cand.id, { smart_turn_count: htmCount });
				result.filled++;
			} catch (e: any) {
				// Corrupted data — don't corrupt solve metadata, just skip it.
				console.warn(`[MethodStepsReindex] solve ${cand.id} skipped: ${e?.message}`);
				result.error++;
			}

			if (result.processed % 100 === 0) {
				console.log(`[MethodStepsReindex] ${result.processed}/${result.totalCandidates}...`);
			}
		}

		console.log(`[MethodStepsReindex] Done.`, result);
		return result;
	}

	@Authorized([Role.ADMIN])
	@Mutation(() => BulkArchiveResult)
	async bulkArchiveWcaCompetitions(
		@Arg('startDate') startDate: string,
		@Arg('endDate', {nullable: true}) endDate: string | undefined,
		@Arg('rateLimitMs', () => Int, {defaultValue: 1500}) rateLimitMs: number,
		@Arg('skipExisting', {defaultValue: true}) skipExisting: boolean,
	): Promise<BulkArchiveResult> {
		const prisma = getPrisma();
		const result: BulkArchiveResult = {
			total: 0,
			imported: 0,
			skipped: 0,
			failed: 0,
			lastProcessedId: undefined,
			failedIds: [],
		};

		// 1. Fetch competition list from WCA page by page
		const PER_PAGE = 100;
		const allComps: any[] = [];
		const baseUrl = 'https://www.worldcubeassociation.org/api/v0/competitions';
		const params: Record<string, any> = {
			start: startDate,
			sort: 'start_date',
			per_page: PER_PAGE,
		};
		if (endDate) params.end = endDate;

		let page = 1;
		while (true) {
			try {
				const res = await axios.get(baseUrl, {
					params: {...params, page},
					timeout: 20000,
				});
				const data: any[] = res.data || [];
				if (data.length === 0) break;
				allComps.push(...data.filter((c) => !c.cancelled_at));
				if (data.length < PER_PAGE) break;
				page++;
				await sleep(500); // polite wait between pages
			} catch (err: any) {
				console.error('[BulkArchive] list fetch failed', err?.message);
				break;
			}
		}

		result.total = allComps.length;
		console.log(`[BulkArchive] ${result.total} comp(s) found, starting import...`);

		// 2. Fetch existing archives at once (for skipExisting)
		const existingIds = new Set<string>();
		if (skipExisting) {
			const existing = await prisma.archivedWcaCompetition.findMany({
				where: {id: {in: allComps.map((c) => c.id)}},
				select: {id: true},
			});
			existing.forEach((e) => existingIds.add(e.id));
		}

		// 3. Archive one by one, with rate-limiting
		for (const comp of allComps) {
			result.lastProcessedId = comp.id;

			if (skipExisting && existingIds.has(comp.id)) {
				result.skipped++;
				continue;
			}

			const archiveResult = await archiveCompetition(comp.id, {
				name: comp.name,
				start_date: comp.start_date ? new Date(comp.start_date + 'T00:00:00Z') : undefined,
				end_date: comp.end_date ? new Date(comp.end_date + 'T00:00:00Z') : undefined,
				country_iso2: comp.country_iso2 || null,
				city: comp.city || null,
			}, undefined, {onlyIfFinished: true});

			if (archiveResult.success) {
				result.imported++;
				if (result.imported % 50 === 0) {
					console.log(`[BulkArchive] ${result.imported}/${result.total} imported...`);
				}
			} else if (archiveResult.error === 'not_finished') {
				// Upcoming/active comps aren't archived — their registration list is
				// still changing, so they're read live instead. Not a failure.
				result.skipped++;
			} else {
				result.failed++;
				result.failedIds.push(comp.id);
			}

			await sleep(rateLimitMs);
		}

		console.log(`[BulkArchive] Done.`, result);
		return result;
	}

	@Authorized([Role.ADMIN])
	@Mutation(() => ReindexESResult)
	async reindexArchivedCompsToES(): Promise<ReindexESResult> {
		const prisma = getPrisma();
		const client = getSearchClient();
		if (!client) {
			throw new Error('ES client not initialized');
		}

		// Create index if it doesn't exist (with mappings)
		await bootstrapArchivedCompIndex();

		const result: ReindexESResult = {total: 0, indexed: 0, failed: 0};
		const BATCH_SIZE = 100;
		let cursor: string | undefined;

		while (true) {
			const batch: any[] = await prisma.archivedWcaCompetition.findMany({
				take: BATCH_SIZE,
				...(cursor ? {skip: 1, cursor: {id: cursor}} : {}),
				orderBy: {id: 'asc'},
				select: {
					id: true,
					name: true,
					start_date: true,
					end_date: true,
					country_iso2: true,
					city: true,
					wcif_data: true,
				},
			});
			if (batch.length === 0) break;

			result.total += batch.length;

			const body: any[] = [];
			for (const arc of batch) {
				const persons = Array.isArray(arc.wcif_data?.persons) ? arc.wcif_data.persons : [];
				const competitors = persons
					.filter((p: any) => p?.registration?.status === 'accepted')
					.map((p: any) => ({wca_id: p.wcaId || null, name: p.name || ''}));
				const eventIds = Array.isArray(arc.wcif_data?.events)
					? arc.wcif_data.events.map((e: any) => e.id).filter(Boolean)
					: [];

				body.push({index: {_index: ARCHIVED_COMP_INDEX, _id: arc.id}});
				body.push({
					id: arc.id,
					name: arc.name,
					start_date: arc.start_date,
					end_date: arc.end_date,
					country_iso2: arc.country_iso2,
					city: arc.city,
					event_ids: eventIds,
					competitors,
				});
			}

			try {
				const resp: any = await client.bulk({body});
				const items: any[] = resp?.body?.items || resp?.items || [];
				if (items.length > 0) {
					for (const item of items) {
						if (item.index?.error) result.failed++;
						else result.indexed++;
					}
				} else {
					result.indexed += batch.length;
				}
			} catch (e: any) {
				console.error('[ReindexES] bulk failed', e?.message);
				result.failed += batch.length;
			}

			cursor = batch[batch.length - 1].id;
			if (batch.length < BATCH_SIZE) break;
		}

		console.log('[ReindexES] Done.', result);
		return result;
	}

	@Authorized([Role.ADMIN])
	@Mutation(() => ReindexLLResult)
	async reindexLLCaseKeys(): Promise<ReindexLLResult> {
		const prisma = getPrisma();
		const result: ReindexLLResult = { total: 0, scanned: 0, ollUpdated: 0, pllUpdated: 0, failed: 0 };
		const BATCH_SIZE = 200;
		let cursor: string | undefined;

		while (true) {
			const batch: any[] = await prisma.solve.findMany({
				take: BATCH_SIZE,
				...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
				where: {
					is_smart_cube: true,
					smart_turns: { not: null },
					solve_method_steps: {
						some: {
							step_name: { in: ['oll', 'pll'] },
							OR: [{ oll_case_key: null }, { pll_case_key: null }],
						},
					},
				},
				select: {
					id: true,
					smart_turns: true,
					scramble: true,
					solve_method_steps: {
						where: { step_name: { in: ['oll', 'pll'] } },
						select: { id: true, step_name: true, oll_case_key: true, pll_case_key: true },
					},
				},
				orderBy: { id: 'asc' },
			});
			if (batch.length === 0) break;

			result.total += batch.length;

			for (const solve of batch) {
				try {
					const turns = parseSmartTurns(solve.smart_turns);
					if (turns.length === 0) continue;
					const steps = getSolveSteps(turns, solve.scramble);
					result.scanned++;

					for (const step of solve.solve_method_steps) {
						if (step.step_name === 'oll' && steps.oll?.ollCaseKey && step.oll_case_key !== steps.oll.ollCaseKey) {
							await prisma.solveMethodStep.update({
								where: { id: step.id },
								data: { oll_case_key: steps.oll.ollCaseKey },
							});
							result.ollUpdated++;
						} else if (step.step_name === 'pll' && steps.pll?.pllCaseKey && step.pll_case_key !== steps.pll.pllCaseKey) {
							await prisma.solveMethodStep.update({
								where: { id: step.id },
								data: { pll_case_key: steps.pll.pllCaseKey },
							});
							result.pllUpdated++;
						}
					}
				} catch (e: any) {
					result.failed++;
					console.warn('[ReindexLL] solve failed', solve.id, e?.message);
				}
			}

			if (result.total % 1000 === 0) {
				console.log(`[ReindexLL] ${result.total} scanned, OLL: ${result.ollUpdated}, PLL: ${result.pllUpdated}`);
			}

			cursor = batch[batch.length - 1].id;
			if (batch.length < BATCH_SIZE) break;
		}

		console.log('[ReindexLL] Done.', result);
		return result;
	}
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
