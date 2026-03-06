import { ObjectType, Field, InputType } from 'type-graphql';

@ObjectType()
export class YouTubeVideoResult {
	@Field()
	videoId: string;

	@Field()
	title: string;

	@Field()
	channelTitle: string;

	@Field()
	thumbnail: string;
}

@InputType()
export class YouTubeSearchInput {
	@Field()
	query: string;
}
