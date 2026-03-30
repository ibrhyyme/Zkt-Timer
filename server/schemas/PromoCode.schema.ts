import {ObjectType, Field, Int, InputType} from 'type-graphql';

@ObjectType()
export class PromoCode {
	@Field()
	id: string;

	@Field()
	code: string;

	@Field()
	membership_type: string;

	@Field(() => Int)
	duration_minutes: number;

	@Field(() => Int)
	max_uses: number;

	@Field(() => Int)
	current_uses: number;

	@Field()
	is_active: boolean;

	@Field({nullable: true})
	expires_at?: Date;

	@Field()
	created_at: Date;

	@Field()
	created_by_id: string;
}

@InputType()
export class CreatePromoCodeInput {
	@Field()
	code: string;

	@Field()
	membership_type: string;

	@Field(() => Int)
	duration_minutes: number;

	@Field(() => Int, {defaultValue: 1})
	max_uses: number;
}

@ObjectType()
export class RedeemPromoCodeResult {
	@Field()
	success: boolean;

	@Field()
	membership_type: string;

	@Field({nullable: true})
	expires_at?: Date;
}
