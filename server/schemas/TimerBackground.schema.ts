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

	/** Mobile timer background, used only when mobile_same_as_desktop is false. */
	@Field({nullable: true})
	mobile_storage_path?: string;

	@Field({nullable: true})
	mobile_media_type?: string;

	/** True: phones show the desktop background (storage_path). Default for old rows. */
	@Field({nullable: true})
	mobile_same_as_desktop?: boolean;

	@Field()
	created_at: Date;

	@Field(() => PublicUserAccount)
	user?: PublicUserAccount;
}
