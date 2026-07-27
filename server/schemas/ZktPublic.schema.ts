// GraphQL ObjectTypes for the ZKT competition PUBLIC consumer. Zkt-Timer is a
// read-only viewer of competitions owned by the Zeka Kupu Turkiye federation
// (zekakuputurkiye). These types mirror the federation's public JSON contract
// (REST /api/public/v1/) 1:1 so the resolver can return the fetched payload
// verbatim — competitors are opaque-keyed (no internal user/person id leaks),
// times are raw centiseconds (DNF=-1, DNS=-2), and each result row already
// carries ranking + record tags + three-state advancement computed upstream.
//
// Naming is prefixed `ZktPublic*` / `zktPublic*` to sit alongside the legacy
// local management types during the consumer migration (Phase A).

import {ObjectType, Field, Int, Float} from 'type-graphql';

@ObjectType()
export class ZktPublicCompetitor {
	@Field()
	id: string; // opaque stable key (future ZKT-ID)

	@Field()
	name: string;

	@Field({nullable: true})
	wcaId?: string;

	@Field({nullable: true})
	externalId?: string;

	@Field({nullable: true})
	country?: string;

	@Field({nullable: true})
	avatarUrl?: string;

	@Field()
	isGhost: boolean;
}

@ObjectType()
export class ZktPublicRegisteredCompetitor extends ZktPublicCompetitor {
	@Field(() => Int, {nullable: true})
	registrationNumber?: number;

	@Field(() => [String])
	registeredEventIds: string[];
}

@ObjectType()
export class ZktPublicRecordTags {
	@Field({nullable: true})
	single?: string;

	@Field({nullable: true})
	average?: string;
}

@ObjectType()
export class ZktPublicRoundGroup {
	@Field()
	groupId: string;

	@Field(() => Int)
	groupNumber: number;

	@Field({nullable: true})
	startTime?: string;

	@Field({nullable: true})
	endTime?: string;
}

@ObjectType()
export class ZktPublicDetailRound {
	@Field()
	roundId: string;

	@Field(() => Int)
	roundNumber: number;

	@Field()
	format: string;

	@Field()
	status: string;

	@Field({nullable: true})
	advancementType?: string;

	@Field(() => Int, {nullable: true})
	advancementLevel?: number;

	@Field(() => Int, {nullable: true})
	cutoffCs?: number;

	@Field(() => Int, {nullable: true})
	cutoffAttempts?: number;

	@Field(() => Int, {nullable: true})
	timeLimitCs?: number;

	// Live progress, mirroring WCA Live's numEnteredResults / field size.
	@Field(() => Int, {nullable: true})
	numEntered?: number;

	@Field(() => Int, {nullable: true})
	totalExpected?: number;

	@Field(() => [ZktPublicRoundGroup])
	groups: ZktPublicRoundGroup[];
}

@ObjectType()
export class ZktPublicDetailEvent {
	@Field()
	eventId: string;

	@Field()
	eventName: string;

	@Field(() => [ZktPublicDetailRound])
	rounds: ZktPublicDetailRound[];
}

@ObjectType()
export class ZktPublicNamed {
	@Field()
	name: string;
}

@ObjectType()
export class ZktPublicTab {
	@Field()
	id: string;

	@Field()
	title: string;

	@Field()
	content: string;

	@Field(() => Int)
	order: number;
}

@ObjectType()
export class ZktPublicScheduleEntry {
	@Field()
	id: string;

	@Field()
	title: string;

	@Field()
	startTime: string;

	@Field({nullable: true})
	endTime?: string;
}

@ObjectType()
export class ZktPublicPodiumEntry {
	@Field(() => ZktPublicCompetitor)
	competitor: ZktPublicCompetitor;

	@Field(() => Int)
	ranking: number;

	@Field(() => Int, {nullable: true})
	best?: number;

	@Field(() => Int, {nullable: true})
	average?: number;

	@Field(() => ZktPublicRecordTags)
	recordTags: ZktPublicRecordTags;

	@Field(() => [Int], {nullable: 'items'})
	attempts: (number | null)[];
}

@ObjectType()
export class ZktPublicPodium {
	@Field()
	eventId: string;

	@Field()
	eventName: string;

	@Field(() => [ZktPublicPodiumEntry])
	entries: ZktPublicPodiumEntry[];
}

@ObjectType()
export class ZktPublicCompetitionDetail {
	@Field()
	id: string;

	@Field({nullable: true})
	slug?: string;

	@Field()
	name: string;

	@Field({nullable: true})
	description?: string;

	@Field()
	startDate: string;

	@Field()
	endDate: string;

	@Field()
	location: string;

	@Field({nullable: true})
	locationAddress?: string;

	@Field(() => Float, {nullable: true})
	latitude?: number;

	@Field(() => Float, {nullable: true})
	longitude?: number;

	@Field()
	country: string;

	@Field()
	status: string;

	@Field({nullable: true})
	championshipType?: string;

	@Field({nullable: true})
	mainEventId?: string;

	@Field({nullable: true})
	contact?: string;

	@Field(() => Int)
	registrationCount: number;

	@Field(() => [ZktPublicRegisteredCompetitor])
	competitors: ZktPublicRegisteredCompetitor[];

	@Field(() => [ZktPublicNamed])
	delegates: ZktPublicNamed[];

	@Field(() => [ZktPublicNamed])
	organizers: ZktPublicNamed[];

	@Field(() => [ZktPublicTab])
	tabs: ZktPublicTab[];

	@Field(() => [ZktPublicDetailEvent])
	events: ZktPublicDetailEvent[];

	@Field(() => [ZktPublicScheduleEntry])
	schedule: ZktPublicScheduleEntry[];

	@Field(() => [ZktPublicPodium])
	podiums: ZktPublicPodium[];
}

@ObjectType()
export class ZktPublicListItem {
	@Field()
	id: string;

	@Field({nullable: true})
	slug?: string;

	@Field()
	name: string;

	@Field({nullable: true})
	shortName?: string;

	@Field()
	startDate: string;

	@Field()
	endDate: string;

	@Field()
	location: string;

	@Field()
	country: string;

	@Field()
	status: string;

	@Field({nullable: true})
	championshipType?: string;

	@Field(() => [String])
	eventIds: string[];

	@Field(() => Int)
	registrationCount: number;
}

// A list item enriched with the viewer's own registration, returned by
// zktPublicMyCompetitions. Same shape as the public list plus the two fields
// that only make sense for "my" competitions.
@ObjectType()
export class ZktPublicMyListItem extends ZktPublicListItem {
	/** APPROVED | PENDING | WAITLISTED */
	@Field({nullable: true})
	registrationStatus?: string;

	@Field(() => Int, {nullable: true})
	registrationNumber?: number;
}

@ObjectType()
export class ZktPublicCompetitionList {
	@Field(() => [ZktPublicListItem])
	items: ZktPublicListItem[];

	@Field(() => Int)
	total: number;

	@Field()
	hasMore: boolean;

	@Field(() => Int)
	page: number;

	@Field(() => Int)
	pageSize: number;
}

@ObjectType()
export class ZktPublicAttemptResult {
	@Field(() => ZktPublicCompetitor)
	competitor: ZktPublicCompetitor;

	@Field(() => Int, {nullable: true})
	ranking?: number;

	@Field(() => [Int])
	attempts: number[];

	@Field(() => Int, {nullable: true})
	best?: number;

	@Field(() => Int, {nullable: true})
	average?: number;

	@Field(() => ZktPublicRecordTags)
	recordTags: ZktPublicRecordTags;

	@Field()
	advancing: boolean;

	@Field()
	clinched: boolean;

	@Field()
	questionable: boolean;
}

@ObjectType()
export class ZktPublicRoundResults {
	@Field()
	roundId: string;

	@Field(() => Int)
	roundNumber: number;

	@Field()
	eventId: string;

	@Field()
	eventName: string;

	@Field()
	format: string;

	@Field()
	status: string;

	@Field(() => Int, {nullable: true})
	timeLimitCs?: number;

	@Field(() => Int, {nullable: true})
	cutoffCs?: number;

	@Field(() => Int, {nullable: true})
	cutoffAttempts?: number;

	@Field({nullable: true})
	advancementType?: string;

	@Field(() => Int, {nullable: true})
	advancementLevel?: number;

	@Field(() => [ZktPublicAttemptResult])
	results: ZktPublicAttemptResult[];
}

@ObjectType()
export class ZktPublicMiniRound {
	@Field({nullable: true})
	roundId?: string;

	@Field(() => Int)
	roundNumber: number;

	@Field()
	format: string;

	@Field()
	status: string;

	@Field()
	eventId: string;

	@Field()
	eventName: string;
}

@ObjectType()
export class ZktPublicGroupAssignmentRow {
	@Field(() => ZktPublicCompetitor)
	competitor: ZktPublicCompetitor;

	@Field()
	role: string;

	@Field(() => Int, {nullable: true})
	stationNumber?: number;

	@Field(() => Int, {nullable: true})
	seedResult?: number;
}

@ObjectType()
export class ZktPublicGroupAssignments {
	@Field()
	groupId: string;

	@Field(() => Int)
	groupNumber: number;

	@Field({nullable: true})
	startTime?: string;

	@Field({nullable: true})
	endTime?: string;

	@Field(() => ZktPublicMiniRound)
	round: ZktPublicMiniRound;

	@Field(() => [ZktPublicGroupAssignmentRow])
	assignments: ZktPublicGroupAssignmentRow[];
}

@ObjectType()
export class ZktPublicScheduleItemRow {
	@Field()
	role: string;

	@Field(() => Int, {nullable: true})
	stationNumber?: number;

	@Field(() => Int, {nullable: true})
	groupNumber?: number;

	@Field({nullable: true})
	startTime?: string;

	@Field({nullable: true})
	endTime?: string;

	@Field(() => ZktPublicMiniRound)
	round: ZktPublicMiniRound;
}

@ObjectType()
export class ZktPublicCompetitorResult {
	@Field()
	roundId: string;

	@Field()
	eventId: string;

	@Field()
	eventName: string;

	@Field(() => Int)
	roundNumber: number;

	@Field()
	format: string;

	@Field(() => [Int])
	attempts: number[];

	@Field(() => Int, {nullable: true})
	best?: number;

	@Field(() => Int, {nullable: true})
	average?: number;

	@Field(() => Int, {nullable: true})
	ranking?: number;

	@Field()
	proceeds: boolean;

	@Field(() => ZktPublicRecordTags)
	recordTags: ZktPublicRecordTags;
}

@ObjectType()
export class ZktPublicCompetitorDetail {
	@Field(() => ZktPublicCompetitor)
	competitor: ZktPublicCompetitor;

	@Field(() => [String])
	registeredEventIds: string[];

	@Field(() => [ZktPublicScheduleItemRow])
	assignments: ZktPublicScheduleItemRow[];

	@Field(() => [ZktPublicCompetitorResult])
	results: ZktPublicCompetitorResult[];
}
