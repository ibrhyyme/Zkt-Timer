import { ObjectType, Field, InputType, Int } from 'type-graphql';

@ObjectType()
export class Announcement {
	@Field()
	id: string;

	@Field()
	title: string;

	@Field()
	content: string;

	@Field()
	category: string;  // FEATURE, BUGFIX, IMPORTANT, INFO

	@Field(() => Int)
	priority: number;

	@Field({ nullable: true })
	imageUrl?: string;

	@Field()
	isDraft: boolean;

	@Field()
	createdAt: Date;

	@Field({ nullable: true })
	publishedAt?: Date;

	@Field()
	isActive: boolean;

	@Field(() => Int, { nullable: true })
	viewCount?: number;  // Computed field - total views

	@Field({ nullable: true })
	hasViewed?: boolean; // Has user viewed?

	@Field({ nullable: true })
	targetUrl?: string; // Page to open when notification is clicked: "/pro" or "https://..."

	@Field({ nullable: true })
	translations?: string; // JSON string: {"en": {"title":"...","content":"..."}, ...}

	@Field(() => Date, { nullable: true })
	pushSentAt?: Date; // When the push send finished (null = not sent)

	@Field(() => Int, { nullable: true })
	pushSuccessCount?: number; // Devices the push reached

	@Field(() => Int, { nullable: true })
	pushTargetCount?: number; // Total target tokens at send time
}

@ObjectType()
export class UnreadAnnouncementCount {
	@Field(() => Int)
	count: number;
}

@InputType()
export class CreateAnnouncementInput {
	@Field()
	title: string;

	@Field()
	content: string;

	@Field()
	category: string;

	@Field(() => Int, { defaultValue: 0 })
	priority: number;

	@Field({ nullable: true })
	imageUrl?: string;

	@Field({ defaultValue: false })
	isDraft: boolean;

	@Field({ defaultValue: false })
	sendNotification: boolean;

	@Field(() => [String], { nullable: true })
	notificationPlatforms?: string[]; // WEB, ANDROID, IOS

	@Field({ nullable: true })
	targetUrl?: string;

	@Field({ nullable: true })
	translations?: string; // JSON string
}

@InputType()
export class UpdateAnnouncementInput {
	@Field({ nullable: true })
	title?: string;

	@Field({ nullable: true })
	content?: string;

	@Field({ nullable: true })
	category?: string;

	@Field(() => Int, { nullable: true })
	priority?: number;

	@Field({ nullable: true })
	imageUrl?: string;

	@Field({ nullable: true })
	isDraft?: boolean;

	@Field({ nullable: true })
	isActive?: boolean;

	@Field({ nullable: true })
	targetUrl?: string;

	@Field({ nullable: true })
	translations?: string; // JSON string
}

@InputType()
export class AnnouncementFilterInput {
	@Field({ nullable: true })
	category?: string;

	@Field({ nullable: true })
	isActive?: boolean;

	@Field({ nullable: true })
	isDraft?: boolean;
}
