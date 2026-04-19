import {Authorized, Ctx, Mutation, Query, Resolver} from 'type-graphql';
import {GraphQLContext} from '../@types/interfaces/server.interface';
import {Role} from '../middlewares/auth';
import {IapStatus} from '../schemas/IAP.schema';
import {getUserById} from '../models/user_account';
import {linkRevenueCatUserId} from '../models/iap';

@Resolver()
export class IAPResolver {
	/**
	 * Login sirasinda client cagirir — RevenueCat app_user_id olarak
	 * kullanicinin kendi id'sini kaydeder. Idempotent.
	 */
	@Authorized([Role.LOGGED_IN])
	@Mutation(() => Boolean)
	async linkRevenueCatUser(@Ctx() context: GraphQLContext): Promise<boolean> {
		await linkRevenueCatUserId(context.user.id);
		return true;
	}

	/**
	 * Paywall acilmadan once client cagirir — mevcut IAP durumunu ogrenir.
	 * is_iap_pro: IAP kaynakli Pro mu, admin/promo mu?
	 * can_purchase: yeni bir plan satin alabilir mi?
	 */
	@Authorized([Role.LOGGED_IN])
	@Query(() => IapStatus)
	async getIapStatus(@Ctx() context: GraphQLContext): Promise<IapStatus> {
		const user = await getUserById(context.user.id);
		const isPro = !!user?.is_pro;
		const iapProductId = (user as any)?.iap_product_id || null;
		const isIapPro = isPro && !!iapProductId;
		const isGrantedPro = isPro && !iapProductId;

		return {
			is_pro: isPro,
			pro_expires_at: user?.pro_expires_at || undefined,
			iap_platform: (user as any)?.iap_platform || undefined,
			iap_product_id: iapProductId || undefined,
			iap_cancellation_at: (user as any)?.iap_cancellation_at || undefined,
			iap_billing_issue_at: (user as any)?.iap_billing_issue_at || undefined,
			iap_paused_until: (user as any)?.iap_paused_until || undefined,
			is_iap_pro: isIapPro,
			// Admin/promo Pro aktifken satin alma kapali — yeni IAP uzerine yazar, hak kaybi olur
			can_purchase: !isGrantedPro,
		};
	}
}
