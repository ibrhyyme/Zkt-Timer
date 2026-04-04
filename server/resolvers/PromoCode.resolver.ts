import {Arg, Authorized, Ctx, Mutation, Query, Resolver} from 'type-graphql';
import {GraphQLContext} from '../@types/interfaces/server.interface';
import {Role} from '../middlewares/auth';
import GraphQLError from '../util/graphql_error';
import {ErrorCode} from '../constants/errors';
import {PromoCode, CreatePromoCodeInput, RedeemPromoCodeResult, PromoCodeRedemptionInfo} from '../schemas/PromoCode.schema';
import {getPrisma} from '../database';
import {updateUserAccountWithParams} from '../models/user_account';

@Resolver()
export class PromoCodeResolver {
	@Authorized([Role.ADMIN])
	@Query(() => [PromoCode])
	async getPromoCodes() {
		return getPrisma().promoCode.findMany({
			orderBy: {created_at: 'desc'},
		});
	}

	@Authorized([Role.ADMIN])
	@Mutation(() => PromoCode)
	async createPromoCode(@Ctx() context: GraphQLContext, @Arg('input') input: CreatePromoCodeInput) {
		const code = input.code.trim().toUpperCase();

		if (!code) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'Code cannot be empty');
		}

		if (!['pro', 'premium'].includes(input.membership_type)) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'Membership type must be "pro" or "premium"');
		}

		if (input.duration_minutes === 0 || input.duration_minutes < -1) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'Invalid duration');
		}

		const existing = await getPrisma().promoCode.findUnique({where: {code}});
		if (existing) {
			throw new GraphQLError(ErrorCode.BAD_INPUT, 'A promo code with this name already exists');
		}

		return getPrisma().promoCode.create({
			data: {
				code,
				membership_type: input.membership_type,
				duration_minutes: input.duration_minutes,
				max_uses: input.max_uses,
				created_by_id: context.user.id,
			},
		});
	}

	@Authorized([Role.LOGGED_IN])
	@Mutation(() => RedeemPromoCodeResult)
	async redeemPromoCode(@Ctx() context: GraphQLContext, @Arg('code') code: string) {
		const normalizedCode = code.trim().toUpperCase();
		const userId = context.user.id;

		const promoCode = await getPrisma().promoCode.findUnique({
			where: {code: normalizedCode},
		});

		if (!promoCode) {
			throw new GraphQLError(ErrorCode.NOT_FOUND, 'invalid_code');
		}

		if (!promoCode.is_active) {
			throw new GraphQLError(ErrorCode.FORBIDDEN, 'invalid_code');
		}

		if (promoCode.expires_at && new Date() > new Date(promoCode.expires_at)) {
			throw new GraphQLError(ErrorCode.FORBIDDEN, 'invalid_code');
		}

		if (promoCode.current_uses >= promoCode.max_uses) {
			throw new GraphQLError(ErrorCode.FORBIDDEN, 'max_uses');
		}

		const existingRedemption = await getPrisma().promoCodeRedemption.findUnique({
			where: {
				promo_code_id_user_id: {
					promo_code_id: promoCode.id,
					user_id: userId,
				},
			},
		});

		if (existingRedemption) {
			throw new GraphQLError(ErrorCode.FORBIDDEN, 'already_used');
		}

		// Calculate expiry
		let expires_at: Date | null = null;
		if (promoCode.duration_minutes > 0) {
			expires_at = new Date(Date.now() + promoCode.duration_minutes * 60000);
		}

		// Apply membership + create redemption atomically
		await getPrisma().$transaction([
			getPrisma().promoCodeRedemption.create({
				data: {
					promo_code_id: promoCode.id,
					user_id: userId,
				},
			}),
			getPrisma().promoCode.update({
				where: {id: promoCode.id},
				data: {current_uses: {increment: 1}},
			}),
		]);

		// Apply Pro/Premium
		if (promoCode.membership_type === 'pro') {
			await updateUserAccountWithParams(userId, {
				is_pro: true,
				pro_expires_at: expires_at,
			});
		} else {
			await updateUserAccountWithParams(userId, {
				is_premium: true,
				premium_expires_at: expires_at,
			});
		}

		return {
			success: true,
			membership_type: promoCode.membership_type,
			expires_at,
		};
	}

	@Authorized([Role.ADMIN])
	@Query(() => [PromoCodeRedemptionInfo])
	async getPromoCodeRedemptions(@Arg('promoCodeId') promoCodeId: string) {
		const redemptions = await getPrisma().promoCodeRedemption.findMany({
			where: {promo_code_id: promoCodeId},
			orderBy: {redeemed_at: 'desc'},
			include: {
				user: {
					select: {id: true, username: true},
				},
			},
		});

		return redemptions.map((r) => ({
			id: r.id,
			username: r.user.username,
			redeemed_at: r.redeemed_at,
		}));
	}

	@Authorized([Role.ADMIN])
	@Mutation(() => PromoCode)
	async togglePromoCodeActive(@Arg('id') id: string, @Arg('isActive') isActive: boolean) {
		return getPrisma().promoCode.update({
			where: {id},
			data: {is_active: isActive},
		});
	}

	@Authorized([Role.ADMIN])
	@Mutation(() => Boolean)
	async deletePromoCode(@Arg('id') id: string) {
		await getPrisma().promoCode.delete({where: {id}});
		return true;
	}
}
