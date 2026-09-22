import {Field, ObjectType} from 'type-graphql';
import {PublicUserAccount} from './UserAccount.schema';

@ObjectType()
export class TimerBackground {
	@Field()
	id: string;

	@Field()
	url: string;

	@Field()
	storage_path: string;

	@Field()
	user_id: string;

	@Field()
	hex: string;

	/** "image" or "video". Null means an image, from before video backgrounds existed. */
	@Field({nullable: true})
	media_type?: string;

	@Field()
	created_at: Date;

	@Field(() => PublicUserAccount)
	user?: PublicUserAccount;
}
