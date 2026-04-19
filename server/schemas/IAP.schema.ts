import {Field, ObjectType} from 'type-graphql';

@ObjectType()
export class IapStatus {
	@Field()
	is_pro: boolean;

	@Field({nullable: true})
	pro_expires_at?: Date;

	@Field({nullable: true})
	iap_platform?: string;

	@Field({nullable: true})
	iap_product_id?: string;

	@Field({nullable: true})
	iap_cancellation_at?: Date;

	@Field({nullable: true})
	iap_billing_issue_at?: Date;

	@Field({nullable: true})
	iap_paused_until?: Date;

	// IAP ile mi yoksa admin/promo ile mi Pro?
	// iap_product_id null + is_pro true => admin/promo.
	@Field()
	is_iap_pro: boolean;

	// Satin alma paywall'dan yapilabilir mi?
	// false oldugu durumlar: admin/promo Pro aktif.
	@Field()
	can_purchase: boolean;
}
