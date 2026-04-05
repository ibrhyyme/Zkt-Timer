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
import { AdminSendPushResult } from '../schemas/PushToken.schema';

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
					{user: targetUser, triggeringUser: context.user as unknown as UserAccount, sendEmail: true},
					'pro',
					pro_expires_at
				);
				await notification.send();
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
		});

		if (isPremium) {
			try {
				const notification = new MembershipGrantedNotification(
					{user: targetUser, triggeringUser: context.user as unknown as UserAccount, sendEmail: true},
					'premium',
					premium_expires_at
				);
				await notification.send();
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
}
