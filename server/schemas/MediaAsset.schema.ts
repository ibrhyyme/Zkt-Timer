import {Field, Int, ObjectType, registerEnumType} from 'type-graphql';
import {PublicUserAccount} from './UserAccount.schema';

/**
 * Where a stored image is actually used. Profile pictures and headers both live in the
 * `image` table and are told apart by which Profile relation points at them.
 */
export enum MediaAssetKind {
	PROFILE_PICTURE = 'profile_picture',
	PROFILE_HEADER = 'profile_header',
	TIMER_BACKGROUND = 'timer_background',
}

registerEnumType(MediaAssetKind, {name: 'MediaAssetKind'});

@ObjectType()
export class MediaAsset {
	@Field()
	id: string;

	@Field(() => MediaAssetKind)
	kind: MediaAssetKind;

	@Field()
	storage_path: string;

	@Field()
	created_at: Date;

	/** Null when the row points at a file that is no longer on disk. */
	@Field(() => Int, {nullable: true})
	size_bytes?: number;

	@Field(() => PublicUserAccount, {nullable: true})
	user?: PublicUserAccount;
}

@ObjectType()
export class MediaAssetPage {
	@Field(() => [MediaAsset])
	items: MediaAsset[];

	@Field(() => Int)
	total: number;
}
