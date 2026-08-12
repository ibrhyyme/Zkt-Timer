import {Field, ObjectType, registerEnumType} from 'type-graphql';
import {PublicUserAccount} from './UserAccount.schema';
import {GraphQLBigInt} from 'graphql-scalars';

export enum IntegrationTypeSchema {
	wca = 'wca',
	zkt = 'zkt',
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

	@Field(() => String, { nullable: true })
	wca_user_id?: string;

	@Field(() => String, { nullable: true })
	wca_name?: string;

	@Field(() => String, { nullable: true })
	wca_avatar_url?: string;

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

	// --- Zeka Kupu Turkiye federation link (service_name = 'zkt') ------------
	/** Federation OAuth subject; always present once linked. */
	@Field(() => String, { nullable: true })
	zkt_user_id?: string;

	/** Competition identity (e.g. 2013ISAZ01); null until they have competed. */
	@Field(() => String, { nullable: true })
	zkt_id?: string;

	@Field(() => Number, { nullable: true })
	zkt_member_no?: number;

	@Field(() => String, { nullable: true })
	zkt_name?: string;

	@Field(() => String, { nullable: true })
	zkt_avatar_url?: string;

	@Field(() => String, { nullable: true })
	zkt_country_iso2?: string;

	@Field(() => Date, { nullable: true })
	revoked_at?: Date;

	@Field(() => Date, { nullable: true })
	last_synced_at?: Date;

	@Field()
	created_at: Date;

	@Field(() => PublicUserAccount)
	user?: PublicUserAccount;
}
