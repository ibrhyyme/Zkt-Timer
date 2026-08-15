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

	/**
	 * Day-split competitions ("A günü / B günü"): the day this competitor was
	 * accepted onto. 0/null on every ordinary competition. The venue cannot hold
	 * the whole field at once, so each competitor attends exactly one day and
	 * showing up on the other one is not a recoverable mistake.
	 */
	@Field(() => Int, {nullable: true})
	dayIndex?: number;

	@Field({nullable: true})
	dayLabel?: string;
}

/** One day of a day-split competition, as published by the federation. */
@ObjectType()
export class ZktPublicCompetitionDay {
	@Field(() => Int)
	position: number;

	@Field()
	label: string;

	/** ISO date of that day, so the consumer can print the date alongside a name. */
	@Field({nullable: true})
	date?: string;

	/**
	 * True only when the organizer gave the day its own name. A day they left
	 * alone is labelled by its date, so a heading that already shows the date
	 * must not repeat it as a suffix.
	 */
	@Field({nullable: true})
	named?: boolean;
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

	/**
	 * Day this group runs on. A SHARED day-split round holds groups on BOTH days
	 * under one round, and the schedule shows clock times only — without the day
	 * the two 09:00 groups are indistinguishable.
	 */
	@Field(() => Int, {nullable: true})
	dayIndex?: number;

	@Field({nullable: true})
	dayLabel?: string;

	/** Room this group runs in; resolves against the detail's `rooms`. */
	@Field({nullable: true})
	roomId?: string;
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

	/**
	 * Day-chain this round belongs to. Only a SEPARATE day-split event sets it:
	 * that event runs a whole chain per day, so it has two "round 1"s and two
	 * finals. 0/null everywhere else, including the SHARED rounds that run on
	 * both days at once.
	 */
	@Field(() => Int, {nullable: true})
	dayIndex?: number;

	@Field({nullable: true})
	dayLabel?: string;

	/**
	 * Last round of ITS OWN chain — what the consumer prints as "Final". Not
	 * derivable from the round list alone: with SEPARATE days the event's highest
	 * round number belongs to only one of the two chains.
	 */
	@Field({nullable: true})
	isFinal?: boolean;

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

	/** Room this item runs in; resolves against the detail's `rooms`. */
	@Field({nullable: true})
	roomId?: string;
}

@ObjectType()
export class ZktPublicRoom {
	@Field()
	id: string;

	@Field()
	name: string;

	/** Hex colour the organizer picked for the stage, used by the timeline. */
	@Field()
	color: string;
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

	/**
	 * Set when the event's days each hold their own final: that competition
	 * crowns a champion per day, so two podiums for the same event are correct
	 * and only this tells them apart.
	 */
	@Field({nullable: true})
	dayLabel?: string;

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

	/**
	 * The competition's days — empty on an ordinary competition. Non-empty means
	 * every competitor attends exactly ONE of these days, which changes how the
	 * schedule, the competitor list and the viewer's own registration read.
	 *
	 * Nullable on purpose: a federation that has not been deployed yet simply
	 * omits the key, and a non-nullable field would turn that into "Cannot return
	 * null for non-nullable field" — taking the whole competition page down over
	 * a feature the old federation does not have.
	 */
	@Field(() => [ZktPublicCompetitionDay], {nullable: true})
	days?: ZktPublicCompetitionDay[];

	@Field(() => [ZktPublicRegisteredCompetitor])
	competitors: ZktPublicRegisteredCompetitor[];

	@Field(() => [ZktPublicNamed])
	delegates: ZktPublicNamed[];

	@Field(() => [ZktPublicNamed])
	organizers: ZktPublicNamed[];

	@Field(() => [ZktPublicTab])
	tabs: ZktPublicTab[];

	/**
	 * IANA zone the competition runs in ("Europe/Istanbul"). Every time in this
	 * payload is UTC, and the schedule has to be drawn in the VENUE's zone: a
	 * competitor reading from abroad otherwise sees a program shifted by their
	 * own offset. Nullable for the same reason as `days` — an undeployed
	 * federation omits the key and must not take the page down.
	 */
	@Field({nullable: true})
	timezone?: string;

	/**
	 * Stages the competition runs in, in the organizer's order. Empty or absent
	 * when none were defined, which is the ordinary single-hall case.
	 */
	@Field(() => [ZktPublicRoom], {nullable: true})
	rooms?: ZktPublicRoom[];

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

	/**
	 * On a day-split competition, the day this viewer was accepted onto. Null on
	 * an ordinary competition — and also while the entry is still pending, since
	 * the day is part of the organizer's acceptance decision.
	 */
	@Field({nullable: true})
	dayLabel?: string;

	@Field({nullable: true})
	dayDate?: string;
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

	/** Last round of its own day-chain — printed as "Final". */
	@Field({nullable: true})
	isFinal?: boolean;

	/** Day-chain of the round (SEPARATE day-split only); null otherwise. */
	@Field({nullable: true})
	dayLabel?: string;
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

	/** Day this group runs on; null when the competition is not split. */
	@Field({nullable: true})
	dayLabel?: string;

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

	/**
	 * Day this row actually runs on — the GROUP's day, not the competitor's. An
	 * event pinned to the other day, or a shared final, legitimately sits outside
	 * the day they were accepted for, and the row shows a clock time only.
	 */
	@Field({nullable: true})
	dayLabel?: string;

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

	/** The day this competitor attends; null when the competition is not split. */
	@Field({nullable: true})
	dayLabel?: string;

	/** The competition's days, so the date can be printed next to the label. */
	@Field(() => [ZktPublicCompetitionDay], {nullable: true})
	days?: ZktPublicCompetitionDay[];

	@Field(() => [ZktPublicScheduleItemRow])
	assignments: ZktPublicScheduleItemRow[];

	@Field(() => [ZktPublicCompetitorResult])
	results: ZktPublicCompetitorResult[];
}
