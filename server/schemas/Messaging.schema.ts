import {Field, InputType, Int, ObjectType, registerEnumType} from 'type-graphql';
import {PublicUserAccount} from './UserAccount.schema';
import {Solve} from './Solve.schema';

export enum DmPolicySchema {
	EVERYONE = 'EVERYONE',
	KNOWN = 'KNOWN',
	NOBODY = 'NOBODY',
}

registerEnumType(DmPolicySchema, {
	name: 'DmPolicy',
	description: 'Who may start a new conversation with this user',
});

@ObjectType()
export class Message {
	@Field()
	id: string;

	@Field()
	conversation_id: string;

	@Field()
	sender_id: string;

	@Field()
	body: string;

	@Field(() => PublicUserAccount, {nullable: true})
	sender?: PublicUserAccount;

	/** Attached solve, if the sender shared one. */
	@Field(() => Solve, {nullable: true})
	solve?: Solve;

	/** Set once the sender changed the text. Null on everything untouched. */
	@Field({nullable: true})
	edited_at?: Date;

	@Field()
	created_at: Date;
}

/**
 * A conversation as one side sees it. The other participant is resolved up front so
 * the client never has to work out which participant is "them".
 */
@ObjectType()
export class ConversationView {
	@Field()
	id: string;

	@Field(() => PublicUserAccount, {nullable: true})
	other_user?: PublicUserAccount;

	@Field(() => Message, {nullable: true})
	last_message?: Message;

	@Field(() => Int)
	unread_count: number;

	/** False while this thread is still in the viewer's request box. */
	@Field()
	accepted: boolean;

	/** Notifications silenced by this viewer. Never visible to the other side. */
	@Field()
	muted: boolean;

	@Field()
	last_message_at: Date;
}

@ObjectType()
export class ConversationList {
	@Field(() => [ConversationView])
	conversations: ConversationView[];

	@Field()
	more_results: boolean;
}

@ObjectType()
export class MessageList {
	@Field(() => [Message])
	messages: Message[];

	@Field()
	more_results: boolean;

	/**
	 * Whether the reader has accepted this conversation. Carried by the thread itself
	 * rather than read off the inbox list, because the inbox only holds whichever
	 * filter is showing and can be missing the thread that is open.
	 */
	@Field()
	accepted: boolean;

	/**
	 * True when the viewer has used their one message into a request box and cannot
	 * write again until the other person accepts. Sent so the composer can say so up
	 * front instead of letting someone type a paragraph into a refusal.
	 */
	@Field()
	awaiting_accept: boolean;

	/** Whether the viewer has this conversation muted. */
	@Field()
	muted: boolean;
}

@ObjectType()
export class InboxSummary {
	@Field(() => Int)
	unread_total: number;

	@Field(() => Int)
	request_count: number;
}

@ObjectType()
export class SocialPreference {
	@Field(() => DmPolicySchema)
	dm_policy: DmPolicySchema;

	@Field()
	searchable: boolean;

	@Field()
	dm_push: boolean;

	@Field()
	read_receipts: boolean;

	@Field()
	typing_indicator: boolean;

	@Field()
	online_status: boolean;
}

@InputType()
export class UpdateSocialPreferenceInput {
	@Field(() => DmPolicySchema, {nullable: true})
	dm_policy?: DmPolicySchema;

	@Field({nullable: true})
	searchable?: boolean;

	@Field({nullable: true})
	dm_push?: boolean;

	@Field({nullable: true})
	read_receipts?: boolean;

	@Field({nullable: true})
	typing_indicator?: boolean;

	@Field({nullable: true})
	online_status?: boolean;
}

export enum ReportStatusSchema {
	OPEN = 'OPEN',
	ACTIONED = 'ACTIONED',
	DISMISSED = 'DISMISSED',
}

registerEnumType(ReportStatusSchema, {
	name: 'ReportStatus',
	description: 'Moderation state of a conversation report',
});

/** One frozen message inside a report's evidence snapshot. */
@ObjectType()
export class ReportSnapshotMessage {
	@Field()
	id: string;

	@Field()
	sender_id: string;

	@Field({nullable: true})
	sender_username?: string;

	@Field()
	body: string;

	@Field()
	has_solve: boolean;

	@Field()
	created_at: string;
}

/**
 * Admin-only view of a report. Note what is absent: there is no conversation field and
 * no way to page further into the thread. A moderator sees the snapshot the reporter
 * attached and nothing else.
 */
@ObjectType()
export class MessageReportView {
	@Field()
	id: string;

	@Field(() => PublicUserAccount, {nullable: true})
	reporter?: PublicUserAccount;

	@Field(() => PublicUserAccount, {nullable: true})
	reported?: PublicUserAccount;

	@Field()
	reason: string;

	@Field(() => [ReportSnapshotMessage])
	snapshot: ReportSnapshotMessage[];

	@Field(() => ReportStatusSchema)
	status: ReportStatusSchema;

	@Field({nullable: true})
	moderator_note?: string;

	@Field({nullable: true})
	reviewed_at?: Date;

	@Field(() => PublicUserAccount, {nullable: true})
	reviewed_by?: PublicUserAccount;

	@Field()
	created_at: Date;
}

@ObjectType()
export class MessageReportList {
	@Field(() => [MessageReportView])
	reports: MessageReportView[];

	@Field(() => Int)
	open_count: number;

	@Field()
	more_results: boolean;
}

@ObjectType()
export class BlockedUser {
	@Field()
	id: string;

	@Field(() => PublicUserAccount, {nullable: true})
	user?: PublicUserAccount;

	@Field()
	created_at: Date;
}
