import {Authorized, Ctx, Mutation, Query, Resolver} from 'type-graphql';
import {GraphQLContext} from '../@types/interfaces/server.interface';
import {Role} from '../middlewares/auth';
import {IapStatus} from '../schemas/IAP.schema';
import {getUserById} from '../models/user_account';
import {linkRevenueCatUserId} from '../models/iap';

@Resolver()
export class IAPResolver {
	/**
	 * Client calls during login — records the user's own ID as RevenueCat app_user_id. Idempotent.
	 */
	@Authorized([Role.LOGGED_IN])
	@Mutation(() => Boolean)
	async linkRevenueCatUser(@Ctx() context: GraphQLContext): Promise<boolean> {
		await linkRevenueCatUserId(context.user.id);
		return true;
	}

	/**
	 * Client calls before paywall opens — learns current IAP status.
	 * is_iap_pro: Is Pro from IAP, admin, or promo?
	 * can_purchase: Can purchase a new plan?
	 */
	@Authorized([Role.LOGGED_IN])
	@Query(() => IapStatus)
	async getIapStatus(@Ctx() context: GraphQLContext): Promise<IapStatus> {
		const user = await getUserById(context.user.id);
		const isPro = !!user?.is_pro;
		const iapProductId = (user as any)?.iap_product_id || null;
		const isIapPro = isPro && !!iapProductId;

		return {
			is_pro: isPro,
			pro_expires_at: user?.pro_expires_at || undefined,
			iap_platform: (user as any)?.iap_platform || undefined,
			iap_product_id: iapProductId || undefined,
			iap_cancellation_at: (user as any)?.iap_cancellation_at || undefined,
			iap_billing_issue_at: (user as any)?.iap_billing_issue_at || undefined,
			iap_paused_until: (user as any)?.iap_paused_until || undefined,
			is_iap_pro: isIapPro,
			// applyIapPurchase now preserves admin/promo duration with max(currentExpiry, newExpiry) —
			// IAP purchase while promo Pro is active is now safe (no loss of entitlement). Always allow.
			can_purchase: true,
		};
	}
}
