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

	// OAuth credentials (WCA / ZKT federation). Server-only: deliberately NOT a
	// @Field. This type is reachable from every public user (solve share codes,
	// profiles, user search, leaderboards, WCA records), so a @Field here hands any
	// anonymous client every linked account's tokens. The properties stay on the
	// class only so server code that refreshes tokens keeps its typing; they are
	// optional because public loaders (publicIntegrationSelect) never fetch them.
	// Guarded by server/__tests__/graphql_secret_fields.test.ts.
	auth_token?: string;

	refresh_token?: string;

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

	// The counts below are GraphQL fields, but defined by IntegrationVisibilityResolver
	// (privacy toggles), never by a @Field here. In the production build (babel, legacy
	// decorators) a @Field on a class property registers a resolver of its own that returns
	// the stored value, and it replaced the gating one: hidden medals and records went out
	// to everyone. The guard test (server/__tests__/field_resolver_conflicts.test.ts) holds it.
	wca_competition_count?: number;

	wca_medal_gold?: number;

	wca_medal_silver?: number;

	wca_medal_bronze?: number;

	wca_record_nr?: number;

	wca_record_cr?: number;

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

	@Field(() => Boolean, { nullable: true })
	zkt_show_competitions?: boolean;

	@Field(() => Boolean, { nullable: true })
	zkt_show_medals?: boolean;

	@Field(() => Boolean, { nullable: true })
	zkt_show_records?: boolean;

	@Field(() => Boolean, { nullable: true })
	zkt_show_pbs?: boolean;

	@Field(() => Date, { nullable: true })
	revoked_at?: Date;

	@Field(() => Date, { nullable: true })
	last_synced_at?: Date;

	@Field()
	created_at: Date;

	@Field(() => PublicUserAccount)
	user?: PublicUserAccount;
}
