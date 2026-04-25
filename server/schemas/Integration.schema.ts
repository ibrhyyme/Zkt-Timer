import {Field, ObjectType, registerEnumType} from 'type-graphql';
import {PublicUserAccount} from './UserAccount.schema';
import {GraphQLBigInt} from 'graphql-scalars';

export enum IntegrationTypeSchema {
	wca = 'wca',
}

registerEnumType(IntegrationTypeSchema, {
	name: 'IntegrationType',
});

@ObjectType()
export class Integration {
	@Field()
	id: string;

	@Field()
	user_id: string;

	@Field(() => IntegrationTypeSchema)
	service_name: string;

	@Field()
	auth_token: string;

	@Field()
	refresh_token: string;

	@Field(() => GraphQLBigInt)
	auth_expires_at: bigint;

	@Field(() => String, { nullable: true })
	wca_id?: string;

	wca_user_id?: string;

	@Field(() => String, { nullable: true })
	wca_country_iso2?: string;

	@Field(() => Number, { nullable: true })
	wca_competition_count?: number;

	@Field(() => Number, { nullable: true })
	wca_medal_gold?: number;

	@Field(() => Number, { nullable: true })
	wca_medal_silver?: number;

	@Field(() => Number, { nullable: true })
	wca_medal_bronze?: number;

	@Field(() => Number, { nullable: true })
	wca_record_nr?: number;

	@Field(() => Number, { nullable: true })
	wca_record_cr?: number;

	@Field(() => Number, { nullable: true })
	wca_record_wr?: number;

	@Field(() => Boolean, { nullable: true })
	wca_show_competitions?: boolean;

	@Field(() => Boolean, { nullable: true })
	wca_show_medals?: boolean;

	@Field(() => Boolean, { nullable: true })
	wca_show_records?: boolean;

	@Field(() => Boolean, { nullable: true })
	wca_show_rank?: boolean;

	@Field(() => Boolean, { nullable: true })
	wca_show_results?: boolean;

	@Field()
	created_at: Date;

	@Field(() => PublicUserAccount)
	user?: PublicUserAccount;
}
