import {Field, Float, InputType, Int, ObjectType, registerEnumType} from 'type-graphql';
import PaginatedResponse from './Pagination.schema';
import {PublicUserAccount} from './UserAccount.schema';

// ============================================================================
// ENUMS
// ============================================================================

export enum ZktCompStatus {
	DRAFT = 'DRAFT',
	CONFIRMED = 'CONFIRMED',
	ANNOUNCED = 'ANNOUNCED',
	REGISTRATION_OPEN = 'REGISTRATION_OPEN',
	REGISTRATION_CLOSED = 'REGISTRATION_CLOSED',
	ONGOING = 'ONGOING',
	FINISHED = 'FINISHED',
	PUBLISHED = 'PUBLISHED',
	CANCELLED = 'CANCELLED',
}

registerEnumType(ZktCompStatus, {name: 'ZktCompStatus'});

export enum ZktCompVisibility {
	PUBLIC = 'PUBLIC',
	PRIVATE = 'PRIVATE',
}

registerEnumType(ZktCompVisibility, {name: 'ZktCompVisibility'});

export enum ZktChampionshipType {
	NATIONAL = 'NATIONAL',
	REGIONAL = 'REGIONAL',
	CITY = 'CITY',
	INVITATIONAL = 'INVITATIONAL',
	YOUTH = 'YOUTH',
}

registerEnumType(ZktChampionshipType, {name: 'ZktChampionshipType'});

export enum ZktRegistrationStatus {
	PENDING = 'PENDING',
	APPROVED = 'APPROVED',
	REJECTED = 'REJECTED',
	WAITLISTED = 'WAITLISTED',
	WITHDRAWN = 'WITHDRAWN',
}

registerEnumType(ZktRegistrationStatus, {name: 'ZktRegistrationStatus'});

export enum ZktRoundFormat {
	BO1 = 'BO1',
	BO2 = 'BO2',
	BO3 = 'BO3',
	MO3 = 'MO3',
	AO5 = 'AO5',
}

registerEnumType(ZktRoundFormat, {name: 'ZktRoundFormat'});

export enum ZktRoundStatus {
	UPCOMING = 'UPCOMING',
	OPEN = 'OPEN',
	ACTIVE = 'ACTIVE',
	FINISHED = 'FINISHED',
}

registerEnumType(ZktRoundStatus, {name: 'ZktRoundStatus'});

export enum ZktAdvancementType {
	RANKING = 'RANKING',
	PERCENT = 'PERCENT',
}

registerEnumType(ZktAdvancementType, {name: 'ZktAdvancementType'});

export enum ZktAssignmentRole {
	COMPETITOR = 'COMPETITOR',
	JUDGE = 'JUDGE',
	SCRAMBLER = 'SCRAMBLER',
	RUNNER = 'RUNNER',
	ORGANIZER = 'ORGANIZER',
	STAFF = 'STAFF',
}

registerEnumType(ZktAssignmentRole, {name: 'ZktAssignmentRole'});

// ============================================================================
// OBJECT TYPES
// ============================================================================

// ZKT-specific competitor identity. Extends PublicUserAccount (username + profile)
// with real name + country, exposed ONLY in competition contexts (WCA-live parity).
// Global PublicUserAccount stays username-only, keeping the privacy surface scoped.
@ObjectType()
export class ZktCompetitorUser extends PublicUserAccount {
	@Field({nullable: true})
	first_name?: string;

	@Field({nullable: true})
	last_name?: string;

	@Field({nullable: true})
	join_country?: string;
}

// Account-less ghost competitor (no UserAccount). Shares the identity shape
// (first_name/last_name + country) so UI helpers work for user OR person.
@ObjectType()
export class ZktPerson {
	@Field()
	id: string;

	@Field()
	competition_id: string;

	@Field()
	first_name: string;

	@Field()
	last_name: string;

	@Field({nullable: true})
	country_code?: string;

	@Field({nullable: true})
	wca_id?: string;

	@Field({nullable: true})
	external_id?: string;

	@Field({nullable: true})
	gender?: string;

	@Field({nullable: true})
	date_of_birth?: Date;

	@Field()
	is_staff: boolean;

	@Field()
	created_at: Date;
}

@ObjectType()
export class ZktResult {
	@Field()
	id: string;

	@Field()
	round_id: string;

	@Field({nullable: true})
	user_id?: string;

	@Field({nullable: true})
	person_id?: string;

	@Field(() => Int, {nullable: true})
	attempt_1?: number;

	@Field(() => Int, {nullable: true})
	attempt_2?: number;

	@Field(() => Int, {nullable: true})
	attempt_3?: number;

	@Field(() => Int, {nullable: true})
	attempt_4?: number;

	@Field(() => Int, {nullable: true})
	attempt_5?: number;

	@Field(() => Int, {nullable: true})
	best?: number;

	@Field(() => Int, {nullable: true})
	average?: number;

	@Field(() => Int, {nullable: true})
	ranking?: number;

	@Field()
	proceeds: boolean;

	@Field()
	no_show: boolean;

	@Field({nullable: true})
	single_record_tag?: string;

	@Field({nullable: true})
	average_record_tag?: string;

	@Field()
	entered_by_id: string;

	@Field(() => Date, {nullable: true})
	entered_at?: Date | null;

	@Field()
	created_at: Date;

	@Field()
	updated_at: Date;

	@Field(() => ZktCompetitorUser, {nullable: true})
	user?: ZktCompetitorUser;

	@Field(() => ZktPerson, {nullable: true})
	person?: ZktPerson;

	@Field(() => PublicUserAccount, {nullable: true})
	entered_by?: PublicUserAccount;

	// `any` (not ZktRound) avoids a TS design:type TDZ crash: ZktRound is
	// declared later in this file. The thunk above still types the GraphQL field.
	@Field(() => ZktRound, {nullable: true})
	round?: any;
}

@ObjectType()
export class ZktScramble {
	@Field()
	id: string;

	@Field()
	round_id: string;

	@Field({nullable: true})
	group_id?: string;

	@Field(() => Int)
	attempt_number: number;

	@Field()
	is_extra: boolean;

	@Field()
	scramble_string: string;

	@Field()
	created_at: Date;
}

@ObjectType()
export class ZktGroup {
	@Field()
	id: string;

	@Field()
	round_id: string;

	@Field(() => Int)
	group_number: number;

	@Field({nullable: true})
	start_time?: Date;

	@Field({nullable: true})
	end_time?: Date;

	@Field()
	created_at: Date;
}

@ObjectType()
export class ZktRound {
	@Field()
	id: string;

	@Field()
	comp_event_id: string;

	@Field(() => Int)
	round_number: number;

	@Field(() => ZktRoundFormat)
	format: ZktRoundFormat;

	@Field(() => Int, {nullable: true})
	time_limit_cs?: number;

	@Field(() => Int, {nullable: true})
	cutoff_cs?: number;

	@Field(() => Int, {nullable: true})
	cutoff_attempts?: number;

	@Field(() => ZktAdvancementType, {nullable: true})
	advancement_type?: ZktAdvancementType;

	@Field(() => Int, {nullable: true})
	advancement_level?: number;

	@Field(() => Int, {nullable: true})
	group_count?: number;

	@Field(() => ZktRoundStatus)
	status: ZktRoundStatus;

	@Field()
	created_at: Date;

	@Field()
	updated_at: Date;

	@Field(() => [ZktResult], {nullable: true})
	results?: ZktResult[];

	@Field(() => [ZktGroup], {nullable: true})
	groups?: ZktGroup[];

	@Field(() => [ZktScramble], {nullable: true})
	scrambles?: ZktScramble[];

	// `any` avoids a design:type TDZ crash — ZktCompEvent is declared later.
	@Field(() => ZktCompEvent, {nullable: true})
	comp_event?: any;

	@Field(() => [ZktAssignment], {nullable: true})
	assignments?: ZktAssignment[];
}

@ObjectType()
export class ZktCompEvent {
	@Field()
	id: string;

	@Field()
	competition_id: string;

	@Field()
	event_id: string;

	@Field(() => Int)
	event_order: number;

	@Field()
	created_at: Date;

	@Field(() => [ZktRound], {nullable: true})
	rounds?: ZktRound[];
}

@ObjectType()
export class ZktRegistrationEvent {
	@Field()
	id: string;

	@Field()
	registration_id: string;

	@Field()
	comp_event_id: string;

	@Field()
	created_at: Date;
}

@ObjectType()
export class ZktRegistration {
	@Field()
	id: string;

	@Field()
	competition_id: string;

	@Field({nullable: true})
	user_id?: string;

	@Field({nullable: true})
	person_id?: string;

	@Field(() => ZktRegistrationStatus)
	status: ZktRegistrationStatus;

	@Field({nullable: true})
	notes?: string;

	@Field({nullable: true})
	admin_comment?: string;

	@Field(() => Int)
	guests: number;

	@Field(() => Int, {nullable: true})
	waiting_list_position?: number;

	@Field(() => Int, {nullable: true})
	registration_number?: number;

	@Field()
	created_at: Date;

	@Field()
	updated_at: Date;

	@Field(() => ZktCompetitorUser, {nullable: true})
	user?: ZktCompetitorUser;

	@Field(() => ZktPerson, {nullable: true})
	person?: ZktPerson;

	@Field(() => [ZktRegistrationEvent], {nullable: true})
	events?: ZktRegistrationEvent[];

	@Field(() => [ZktRegistrationHistory], {nullable: true})
	history?: ZktRegistrationHistory[];
}

@ObjectType()
export class ZktRegistrationHistory {
	@Field()
	id: string;

	@Field()
	registration_id: string;

	@Field()
	actor_id: string;

	@Field()
	action: string;

	// JSON serialized as string; client parses. Nullable when action carries no diff.
	@Field({nullable: true})
	changed_attributes?: string;

	@Field()
	created_at: Date;

	@Field(() => PublicUserAccount, {nullable: true})
	actor?: PublicUserAccount;
}

@ObjectType()
export class ZktCompDelegate {
	@Field()
	id: string;

	@Field()
	competition_id: string;

	@Field()
	user_id: string;

	@Field()
	created_at: Date;

	@Field(() => PublicUserAccount, {nullable: true})
	user?: PublicUserAccount;
}

@ObjectType()
export class ZktCompOrganizer {
	@Field()
	id: string;

	@Field()
	competition_id: string;

	@Field()
	user_id: string;

	@Field()
	created_at: Date;

	@Field(() => PublicUserAccount, {nullable: true})
	user?: PublicUserAccount;
}

@ObjectType()
export class ZktCompTab {
	@Field()
	id: string;

	@Field()
	competition_id: string;

	@Field()
	title: string;

	@Field()
	content: string;

	@Field(() => Int)
	tab_order: number;
}

@ObjectType()
export class ZktScheduleItem {
	@Field()
	id: string;

	@Field()
	competition_id: string;

	@Field()
	title: string;

	@Field()
	start_time: Date;

	@Field({nullable: true})
	end_time?: Date;
}

@InputType()
export class CreateZktScheduleItemInput {
	@Field()
	competitionId: string;

	@Field()
	title: string;

	@Field()
	startTime: string;

	@Field({nullable: true})
	endTime?: string;
}

@InputType()
export class UpdateZktScheduleItemInput {
	@Field()
	itemId: string;

	@Field({nullable: true})
	title?: string;

	@Field({nullable: true})
	startTime?: string;

	@Field({nullable: true})
	endTime?: string;
}

@ObjectType()
export class ZktCompetition {
	@Field()
	id: string;

	// WCA-style readable id (e.g. BursaSummer2026) used in public URLs.
	@Field({nullable: true})
	slug?: string;

	@Field()
	name: string;

	@Field({nullable: true})
	description?: string;

	@Field()
	date_start: Date;

	@Field()
	date_end: Date;

	@Field()
	location: string;

	@Field({nullable: true})
	location_address?: string;

	@Field()
	country_code: string;

	@Field(() => Int, {nullable: true})
	competitor_limit?: number;

	@Field(() => ZktCompStatus)
	status: ZktCompStatus;

	@Field(() => ZktCompVisibility)
	visibility: ZktCompVisibility;

	@Field(() => ZktChampionshipType, {nullable: true})
	championship_type?: ZktChampionshipType;

	@Field({nullable: true})
	confirmed_at?: Date;

	@Field({nullable: true})
	announced_at?: Date;

	@Field({nullable: true})
	announced_by_id?: string;

	@Field({nullable: true})
	cancelled_at?: Date;

	@Field({nullable: true})
	cancel_reason?: string;

	@Field({nullable: true})
	results_published_at?: Date;

	@Field({nullable: true})
	registration_edit_deadline?: Date;

	@Field({nullable: true})
	short_name?: string;

	@Field(() => Float, {nullable: true})
	latitude?: number;

	@Field(() => Float, {nullable: true})
	longitude?: number;

	@Field({nullable: true})
	registration_opens_at?: Date;

	@Field({nullable: true})
	registration_closes_at?: Date;

	@Field()
	on_spot_registration: boolean;

	@Field({nullable: true})
	cancellation_policy?: string;

	@Field()
	guests_enabled: boolean;

	@Field()
	force_comment: boolean;

	@Field({nullable: true})
	extra_requirements?: string;

	@Field({nullable: true})
	contact?: string;

	@Field({nullable: true})
	main_event_id?: string;

	@Field()
	created_by_id: string;

	@Field()
	created_at: Date;

	@Field()
	updated_at: Date;

	@Field(() => PublicUserAccount, {nullable: true})
	created_by?: PublicUserAccount;

	@Field(() => [ZktCompEvent], {nullable: true})
	events?: ZktCompEvent[];

	@Field(() => [ZktRegistration], {nullable: true})
	registrations?: ZktRegistration[];

	@Field(() => [ZktCompDelegate], {nullable: true})
	delegates?: ZktCompDelegate[];

	@Field(() => [ZktCompOrganizer], {nullable: true})
	organizers?: ZktCompOrganizer[];

	@Field(() => [ZktCompTab], {nullable: true})
	tabs?: ZktCompTab[];

	@Field(() => [ZktScheduleItem], {nullable: true})
	schedule_items?: ZktScheduleItem[];
}

@ObjectType()
export class ZktPodium {
	@Field()
	event_id: string;

	@Field()
	round_id: string;

	@Field(() => [ZktResult])
	results: ZktResult[];
}

// One competitor's per-event result for the participation certificate.
@ObjectType()
export class ZktParticipationResult {
	@Field()
	event_id: string;

	@Field(() => Int)
	value: number; // centiseconds (average if has_average, else best)

	@Field(() => Int)
	ranking: number;

	@Field()
	has_average: boolean;
}

// One competitor (user or ghost person) grouped with all their event results.
@ObjectType()
export class ZktParticipation {
	@Field()
	name: string;

	@Field({nullable: true})
	country?: string;

	@Field(() => [ZktParticipationResult])
	results: ZktParticipationResult[];
}

@ObjectType()
export class ZktAllTimeRanking {
	@Field(() => Int)
	ranking: number;

	@Field(() => Int)
	value: number;

	@Field()
	event_id: string;

	@Field()
	record_type: string;

	@Field()
	result_id: string;

	@Field()
	round_id: string;

	@Field(() => ZktCompetitorUser, {nullable: true})
	user?: ZktCompetitorUser;

	@Field(() => ZktCompetition, {nullable: true})
	competition?: ZktCompetition;
}

@ObjectType()
export class ZktRecord {
	@Field()
	id: string;

	@Field()
	event_id: string;

	@Field()
	record_type: string;

	@Field(() => Int)
	value: number;

	@Field()
	user_id: string;

	@Field()
	result_id: string;

	@Field()
	competition_id: string;

	@Field()
	set_at: Date;

	@Field()
	created_at: Date;

	@Field(() => ZktCompetitorUser, {nullable: true})
	user?: ZktCompetitorUser;

	@Field(() => ZktCompetition, {nullable: true})
	competition?: ZktCompetition;
}

@ObjectType()
export class PaginatedZktCompetitions extends PaginatedResponse(ZktCompetition) {}

// ============================================================================
// INPUT TYPES
// ============================================================================

@InputType()
export class CreateZktCompetitionInput {
	@Field()
	name: string;

	@Field({nullable: true})
	description?: string;

	@Field()
	dateStart: string;

	@Field()
	dateEnd: string;

	@Field()
	location: string;

	@Field({nullable: true})
	locationAddress?: string;

	@Field(() => Int, {nullable: true})
	competitorLimit?: number;

	@Field(() => ZktCompVisibility)
	visibility: ZktCompVisibility;

	@Field(() => ZktChampionshipType, {nullable: true})
	championshipType?: ZktChampionshipType;

	@Field({nullable: true})
	shortName?: string;

	@Field(() => Float, {nullable: true})
	latitude?: number;

	@Field(() => Float, {nullable: true})
	longitude?: number;

	@Field({nullable: true})
	registrationOpensAt?: string;

	@Field({nullable: true})
	registrationClosesAt?: string;

	@Field({nullable: true})
	registrationEditDeadline?: string;

	@Field({nullable: true})
	onSpotRegistration?: boolean;

	@Field({nullable: true})
	cancellationPolicy?: string;

	@Field({nullable: true})
	guestsEnabled?: boolean;

	@Field({nullable: true})
	forceComment?: boolean;

	@Field({nullable: true})
	extraRequirements?: string;

	@Field({nullable: true})
	contact?: string;

	@Field({nullable: true})
	mainEventId?: string;

	@Field(() => [String])
	eventIds: string[];
}

@InputType()
export class UpdateZktCompetitionInput {
	@Field({nullable: true})
	name?: string;

	@Field({nullable: true})
	description?: string;

	@Field({nullable: true})
	dateStart?: string;

	@Field({nullable: true})
	dateEnd?: string;

	@Field({nullable: true})
	location?: string;

	@Field({nullable: true})
	locationAddress?: string;

	@Field(() => Int, {nullable: true})
	competitorLimit?: number;

	@Field(() => ZktCompVisibility, {nullable: true})
	visibility?: ZktCompVisibility;

	@Field(() => ZktChampionshipType, {nullable: true})
	championshipType?: ZktChampionshipType;

	@Field({nullable: true})
	shortName?: string;

	@Field(() => Float, {nullable: true})
	latitude?: number;

	@Field(() => Float, {nullable: true})
	longitude?: number;

	@Field({nullable: true})
	registrationOpensAt?: string;

	@Field({nullable: true})
	registrationClosesAt?: string;

	@Field({nullable: true})
	registrationEditDeadline?: string;

	@Field({nullable: true})
	onSpotRegistration?: boolean;

	@Field({nullable: true})
	cancellationPolicy?: string;

	@Field({nullable: true})
	guestsEnabled?: boolean;

	@Field({nullable: true})
	forceComment?: boolean;

	@Field({nullable: true})
	extraRequirements?: string;

	@Field({nullable: true})
	contact?: string;

	@Field({nullable: true})
	mainEventId?: string;

	@Field(() => [String], {nullable: true})
	eventIds?: string[];
}

@InputType()
export class UpdateZktCompetitionStatusInput {
	@Field()
	competitionId: string;

	@Field(() => ZktCompStatus)
	status: ZktCompStatus;
}

@InputType()
export class CancelZktCompetitionInput {
	@Field()
	competitionId: string;

	@Field({nullable: true})
	reason?: string;
}

@InputType()
export class ZktCompetitionFilterInput {
	@Field(() => ZktCompStatus, {nullable: true})
	status?: ZktCompStatus;

	@Field(() => ZktCompVisibility, {nullable: true})
	visibility?: ZktCompVisibility;
}

@InputType()
export class ZktRegistrationInput {
	@Field()
	competitionId: string;

	@Field(() => [String])
	eventIds: string[];

	@Field({nullable: true})
	notes?: string;

	@Field(() => Int, {nullable: true})
	guests?: number;
}

@InputType()
export class UpdateZktRegistrationStatusInput {
	@Field()
	registrationId: string;

	@Field(() => ZktRegistrationStatus)
	status: ZktRegistrationStatus;

	@Field({nullable: true})
	adminComment?: string;
}

@InputType()
export class UpdateMyZktRegistrationInput {
	@Field()
	competitionId: string;

	@Field(() => [String], {nullable: true})
	eventIds?: string[];

	@Field({nullable: true})
	notes?: string;

	@Field(() => Int, {nullable: true})
	guests?: number;
}

@InputType()
export class BulkZktRegistrationUpdate {
	@Field()
	registrationId: string;

	@Field(() => ZktRegistrationStatus)
	status: ZktRegistrationStatus;
}

@InputType()
export class BulkUpdateZktRegistrationsInput {
	@Field()
	competitionId: string;

	@Field(() => [BulkZktRegistrationUpdate])
	updates: BulkZktRegistrationUpdate[];
}

@InputType()
export class AddZktDelegateInput {
	@Field()
	competitionId: string;

	@Field()
	userId: string;
}

@InputType()
export class AddZktOrganizerInput {
	@Field()
	competitionId: string;

	@Field()
	userId: string;
}

@InputType()
export class CreateZktCompTabInput {
	@Field()
	competitionId: string;

	@Field()
	title: string;

	@Field()
	content: string;
}

@InputType()
export class UpdateZktCompTabInput {
	@Field()
	tabId: string;

	@Field({nullable: true})
	title?: string;

	@Field({nullable: true})
	content?: string;
}

@InputType()
export class ReorderZktCompTabsInput {
	@Field()
	competitionId: string;

	@Field(() => [String])
	tabIds: string[];
}

@InputType()
export class AddZktCompetitorManuallyInput {
	@Field()
	competitionId: string;

	@Field()
	userId: string;

	@Field(() => [String])
	eventIds: string[];
}

@InputType()
export class ZktPersonRowInput {
	@Field()
	firstName: string;

	@Field()
	lastName: string;

	@Field({nullable: true})
	country?: string;

	@Field({nullable: true})
	wcaId?: string;

	@Field({nullable: true})
	externalId?: string;

	@Field({nullable: true})
	gender?: string;

	@Field(() => [String])
	eventIds: string[];
}

@InputType()
export class ImportZktCompetitorsInput {
	@Field()
	competitionId: string;

	@Field(() => [ZktPersonRowInput])
	rows: ZktPersonRowInput[];
}

@InputType()
export class AddZktPersonInput {
	@Field()
	competitionId: string;

	@Field()
	firstName: string;

	@Field()
	lastName: string;

	@Field({nullable: true})
	country?: string;

	@Field({nullable: true})
	wcaId?: string;

	@Field({nullable: true})
	externalId?: string;

	@Field({nullable: true})
	gender?: string;

	@Field(() => [String])
	eventIds: string[];
}

// Account-less staff member (judge/scrambler/runner pool). No registration, no
// events — only assignable to rounds. Separate from competitor ghost persons.
@InputType()
export class AddZktStaffInput {
	@Field()
	competitionId: string;

	@Field()
	firstName: string;

	@Field()
	lastName: string;

	@Field({nullable: true})
	country?: string;
}

@InputType()
export class UpdateZktPersonInput {
	@Field()
	personId: string;

	@Field({nullable: true})
	firstName?: string;

	@Field({nullable: true})
	lastName?: string;

	@Field({nullable: true})
	country?: string;

	@Field({nullable: true})
	wcaId?: string;

	@Field({nullable: true})
	externalId?: string;

	@Field({nullable: true})
	gender?: string;

	@Field(() => [String], {nullable: true})
	eventIds?: string[];
}

@InputType()
export class CreateZktRoundInput {
	@Field()
	compEventId: string;

	@Field(() => Int)
	roundNumber: number;

	@Field(() => ZktRoundFormat)
	format: ZktRoundFormat;

	@Field(() => Int, {nullable: true})
	timeLimitCs?: number;

	@Field(() => Int, {nullable: true})
	cutoffCs?: number;

	@Field(() => Int, {nullable: true})
	cutoffAttempts?: number;

	@Field(() => ZktAdvancementType, {nullable: true})
	advancementType?: ZktAdvancementType;

	@Field(() => Int, {nullable: true})
	advancementLevel?: number;

	@Field(() => Int, {nullable: true})
	groupCount?: number;
}

@InputType()
export class UpdateZktRoundInput {
	@Field()
	roundId: string;

	@Field(() => ZktRoundFormat, {nullable: true})
	format?: ZktRoundFormat;

	@Field(() => Int, {nullable: true})
	timeLimitCs?: number;

	@Field(() => Int, {nullable: true})
	cutoffCs?: number;

	@Field(() => Int, {nullable: true})
	cutoffAttempts?: number;

	@Field(() => ZktAdvancementType, {nullable: true})
	advancementType?: ZktAdvancementType;

	@Field(() => Int, {nullable: true})
	advancementLevel?: number;

	@Field(() => Int, {nullable: true})
	groupCount?: number;
}

@InputType()
export class UpdateZktRoundStatusInput {
	@Field()
	roundId: string;

	@Field(() => ZktRoundStatus)
	status: ZktRoundStatus;
}

@InputType()
export class MarkZktNoShowInput {
	@Field()
	roundId: string;

	@Field({nullable: true})
	userId?: string;

	@Field({nullable: true})
	personId?: string;
}

@ObjectType()
export class ZktAssignment {
	@Field()
	id: string;

	@Field()
	round_id: string;

	@Field({nullable: true})
	group_id?: string;

	@Field({nullable: true})
	user_id?: string;

	@Field({nullable: true})
	person_id?: string;

	@Field(() => ZktAssignmentRole)
	role: ZktAssignmentRole;

	@Field(() => Int, {nullable: true})
	station_number?: number;

	@Field(() => Int, {nullable: true})
	seed_result?: number;

	@Field()
	created_at: Date;

	@Field()
	updated_at: Date;

	@Field(() => ZktCompetitorUser, {nullable: true})
	user?: ZktCompetitorUser;

	@Field(() => ZktPerson, {nullable: true})
	person?: ZktPerson;

	@Field(() => ZktRound, {nullable: true})
	round?: ZktRound;

	@Field(() => ZktGroup, {nullable: true})
	group?: ZktGroup;
}

@InputType()
export class AssignUserInput {
	@Field()
	roundId: string;

	@Field({nullable: true})
	groupId?: string;

	// Exactly one of userId / personId: registered account vs account-less
	// staff/ghost person from the competition pool.
	@Field({nullable: true})
	userId?: string;

	@Field({nullable: true})
	personId?: string;

	@Field(() => ZktAssignmentRole)
	role: ZktAssignmentRole;

	@Field(() => Int, {nullable: true})
	stationNumber?: number;
}

@InputType()
export class CreateGroupInput {
	@Field()
	roundId: string;

	@Field(() => Int)
	groupNumber: number;
}

@InputType()
export class UpdateZktGroupScheduleInput {
	@Field()
	groupId: string;

	@Field({nullable: true})
	startTime?: Date;

	@Field({nullable: true})
	endTime?: Date;
}

// One competitor reference: either a registered user OR an account-less ghost
// person (exactly one of the two is set). Mirrors the user_id/person_id XOR
// identity used throughout ZKT competitions.
@InputType()
export class CompetitorRefInput {
	@Field({nullable: true})
	userId?: string;

	@Field({nullable: true})
	personId?: string;
}

@InputType()
export class BulkAssignCompetitorsInput {
	@Field()
	roundId: string;

	// Physical station/timer count = per-group capacity. Used to derive the group
	// count as ceil(competitors / stationCount) ONLY when groupCount is absent.
	@Field(() => Int)
	stationCount: number;

	// Explicit group count (from the round's group_count set on the Rounds tab).
	// Takes precedence over the stationCount-derived count when provided.
	@Field(() => Int, {nullable: true})
	groupCount?: number;

	@Field(() => [CompetitorRefInput])
	competitors: CompetitorRefInput[];
}

// Distribute a single staff role (JUDGE/SCRAMBLER/RUNNER) round-robin across the
// round's groups. Replaces existing assignments of that role for the round.
@InputType()
export class BulkAssignStaffInput {
	@Field()
	roundId: string;

	@Field(() => ZktAssignmentRole)
	role: ZktAssignmentRole;

	@Field(() => [CompetitorRefInput])
	staff: CompetitorRefInput[];
}

@InputType()
export class SubmitZktResultInput {
	@Field()
	roundId: string;

	@Field({nullable: true})
	userId?: string;

	@Field({nullable: true})
	personId?: string;

	@Field(() => Int, {nullable: true})
	attempt1?: number;

	@Field(() => Int, {nullable: true})
	attempt2?: number;

	@Field(() => Int, {nullable: true})
	attempt3?: number;

	@Field(() => Int, {nullable: true})
	attempt4?: number;

	@Field(() => Int, {nullable: true})
	attempt5?: number;
}

@InputType()
export class SubmitZktResultBatchItem {
	@Field({nullable: true})
	userId?: string;

	@Field({nullable: true})
	personId?: string;

	@Field(() => Int, {nullable: true})
	attempt1?: number;

	@Field(() => Int, {nullable: true})
	attempt2?: number;

	@Field(() => Int, {nullable: true})
	attempt3?: number;

	@Field(() => Int, {nullable: true})
	attempt4?: number;

	@Field(() => Int, {nullable: true})
	attempt5?: number;
}

@InputType()
export class SubmitZktResultsBatchInput {
	@Field()
	roundId: string;

	@Field(() => [SubmitZktResultBatchItem])
	results: SubmitZktResultBatchItem[];
}
