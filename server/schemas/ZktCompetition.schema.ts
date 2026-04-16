import {Field, InputType, Int, ObjectType, registerEnumType} from 'type-graphql';
import PaginatedResponse from './Pagination.schema';
import {PublicUserAccount} from './UserAccount.schema';

// ============================================================================
// ENUMS
// ============================================================================

export enum ZktCompStatus {
	DRAFT = 'DRAFT',
	ANNOUNCED = 'ANNOUNCED',
	REGISTRATION_OPEN = 'REGISTRATION_OPEN',
	REGISTRATION_CLOSED = 'REGISTRATION_CLOSED',
	ONGOING = 'ONGOING',
	FINISHED = 'FINISHED',
	PUBLISHED = 'PUBLISHED',
}

registerEnumType(ZktCompStatus, {name: 'ZktCompStatus'});

export enum ZktCompVisibility {
	PUBLIC = 'PUBLIC',
	PRIVATE = 'PRIVATE',
}

registerEnumType(ZktCompVisibility, {name: 'ZktCompVisibility'});

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

@ObjectType()
export class ZktResult {
	@Field()
	id: string;

	@Field()
	round_id: string;

	@Field()
	user_id: string;

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

	@Field({nullable: true})
	single_record_tag?: string;

	@Field({nullable: true})
	average_record_tag?: string;

	@Field()
	entered_by_id: string;

	@Field()
	created_at: Date;

	@Field()
	updated_at: Date;

	@Field(() => PublicUserAccount, {nullable: true})
	user?: PublicUserAccount;

	@Field(() => PublicUserAccount, {nullable: true})
	entered_by?: PublicUserAccount;
}

@ObjectType()
export class ZktGroup {
	@Field()
	id: string;

	@Field()
	round_id: string;

	@Field(() => Int)
	group_number: number;

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

	@Field()
	user_id: string;

	@Field(() => ZktRegistrationStatus)
	status: ZktRegistrationStatus;

	@Field({nullable: true})
	notes?: string;

	@Field()
	created_at: Date;

	@Field()
	updated_at: Date;

	@Field(() => PublicUserAccount, {nullable: true})
	user?: PublicUserAccount;

	@Field(() => [ZktRegistrationEvent], {nullable: true})
	events?: ZktRegistrationEvent[];
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
export class ZktCompetition {
	@Field()
	id: string;

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

	@Field(() => Int, {nullable: true})
	competitor_limit?: number;

	@Field(() => ZktCompStatus)
	status: ZktCompStatus;

	@Field(() => ZktCompVisibility)
	visibility: ZktCompVisibility;

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

	@Field(() => PublicUserAccount, {nullable: true})
	user?: PublicUserAccount;
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
}

@InputType()
export class UpdateZktRegistrationStatusInput {
	@Field()
	registrationId: string;

	@Field(() => ZktRegistrationStatus)
	status: ZktRegistrationStatus;
}

@InputType()
export class AddZktDelegateInput {
	@Field()
	competitionId: string;

	@Field()
	userId: string;
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
}

@InputType()
export class UpdateZktRoundStatusInput {
	@Field()
	roundId: string;

	@Field(() => ZktRoundStatus)
	status: ZktRoundStatus;
}

@ObjectType()
export class ZktAssignment {
	@Field()
	id: string;

	@Field()
	round_id: string;

	@Field({nullable: true})
	group_id?: string;

	@Field()
	user_id: string;

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

	@Field(() => PublicUserAccount, {nullable: true})
	user?: PublicUserAccount;
}

@InputType()
export class AssignUserInput {
	@Field()
	roundId: string;

	@Field({nullable: true})
	groupId?: string;

	@Field()
	userId: string;

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
export class BulkAssignCompetitorsInput {
	@Field()
	roundId: string;

	@Field(() => Int)
	groupCount: number;

	@Field(() => [String])
	userIds: string[];
}

@InputType()
export class SubmitZktResultInput {
	@Field()
	roundId: string;

	@Field()
	userId: string;

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
