import {Field, ObjectType, ID} from 'type-graphql';
import {Integration} from './Integration.schema';
import {UserAccount, PublicUserAccount} from './UserAccount.schema';

@ObjectType()
export class WcaRecord {
	@Field(() => ID)
	id: string;

	@Field()
	user_id: string;

	@Field()
	integration_id: string;

	@Field()
	wca_event: string;

	@Field({nullable: true})
	single_record?: number;

	@Field({nullable: true})
	average_record?: number;

	@Field({nullable: true})
	single_world_rank?: number;

	@Field({nullable: true})
	average_world_rank?: number;

	@Field({nullable: true})
	single_continent_rank?: number;

	@Field({nullable: true})
	average_continent_rank?: number;

	@Field({nullable: true})
	single_country_rank?: number;

	@Field({nullable: true})
	average_country_rank?: number;

	@Field()
	published: boolean;

	@Field()
	fetched_at: Date;

	@Field()
	created_at: Date;

	@Field()
	updated_at: Date;

	@Field(() => Integration)
	integration: Integration;

	@Field(() => PublicUserAccount)
	user: PublicUserAccount;
}
